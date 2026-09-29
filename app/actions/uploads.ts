'use server'

import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getExhibitionPhase } from '@/lib/exhibition-status'

export type UploadState = {
  error?: string
  success?: boolean
  isLoggedIn?: boolean
  uploadId?: string
  editToken?: string | null // 비회원 업로드 수정·귀속용 원본 토큰 (DB에는 해시만 저장)
  nonce?: string
  storagePath?: string | null
  textContent?: string | null
  guestName?: string | null
  photoPublicUrl?: string | null
}

const MAX_BYTES = 10 * 1024 * 1024
// uploads 버킷 allowed_mime_types와 동일하게 유지
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']

function hashEditToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function editTokenMatches(token: string | null, storedHash: string | null) {
  if (!token || !storedHash) return false // 토큰 없는 기존 업로드는 비회원 수정·귀속 불가
  const a = Buffer.from(hashEditToken(token), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

// 로그인 사용자는 본인 업로드만, 비회원 업로드(uploader_id null)는 수정 토큰이 일치할 때만
function canEditUpload(
  row: { uploader_id: string | null; edit_token_hash: string | null },
  userId: string | null,
  token: string | null
) {
  if (row.uploader_id) return row.uploader_id === userId
  return editTokenMatches(token, row.edit_token_hash)
}

export async function submitUpload(
  exhibitionId: string,
  slug: string,
  _: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // 권한 검사는 모두 이 함수에서 끝내고, Storage·DB 쓰기는 admin client로만 한다 (RLS 공개 쓰기 정책에 의존하지 않음)
  const admin = createAdminClient()

  // 종료된 전시(status closed 또는 종료일 경과)는 신규 업로드·수정 모두 거부. 시작 전(upcoming)은 허용.
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('status, starts_at, ends_at')
    .eq('id', exhibitionId)
    .single()
  if (!exhibition) return { error: '전시를 찾을 수 없습니다.' }
  if (getExhibitionPhase({ status: exhibition.status, startsAt: exhibition.starts_at, endsAt: exhibition.ends_at }) === 'ended') {
    return { error: '종료된 전시입니다' }
  }

  const updateId = (formData.get('upload_id') as string)?.trim() || null
  const editToken = (formData.get('edit_token') as string)?.trim() || null
  // 브라우저에서는 "기존 사진 유지" 여부만 받는다. 경로 값 자체는 DB에서 조회한 것을 쓴다.
  const keepExistingPhoto = !!(formData.get('existing_storage_path') as string)?.trim()
  const guestName = (formData.get('guest_name') as string)?.trim() || null
  const textContent = (formData.get('text_content') as string)?.trim() || null

  const file = formData.get('photo') as File | null
  const hasNewPhoto = !!file && file.size > 0
  const hasText = !!textContent

  // 수정이면 대상 행을 먼저 조회해 권한 확인
  let existing: { storage_path: string | null } | null = null
  if (updateId) {
    const { data: row } = await admin
      .from('uploads')
      .select('exhibition_id, uploader_id, storage_path, edit_token_hash')
      .eq('id', updateId)
      .single()
    if (!row || row.exhibition_id !== exhibitionId || !canEditUpload(row, user?.id ?? null, editToken)) {
      return { error: '수정 권한이 없습니다.' }
    }
    existing = row
  }

  const keptPath = keepExistingPhoto ? existing?.storage_path ?? null : null

  if (!hasNewPhoto && !hasText && !keptPath) {
    return { error: '사진 또는 텍스트 중 하나는 입력해야 합니다.' }
  }

  let storagePath: string | null = keptPath

  if (hasNewPhoto) {
    if (file!.size > MAX_BYTES) return { error: '파일 크기는 10MB 이하여야 합니다.' }
    if (!ALLOWED_IMAGE_TYPES.includes(file!.type)) {
      return { error: 'JPG, PNG, WEBP, GIF, HEIC, AVIF 이미지만 업로드할 수 있습니다.' }
    }

    const ext = (file!.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const fileName = `${exhibitionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = await file!.arrayBuffer()

    const { error: storageError } = await admin.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: file!.type, upsert: false })

    if (storageError) {
      console.error('[submitUpload] storage upload error:', storageError)
      return { error: '사진 업로드에 실패했습니다. 다시 시도해 주세요.' }
    }
    storagePath = fileName
  }

  const type = storagePath ? 'photo' : 'text'
  const nonce = randomUUID()
  const newFileUploaded = hasNewPhoto ? storagePath : null

  if (updateId) {
    const { error: dbError } = await admin
      .from('uploads')
      .update({ guest_name: guestName, type, storage_path: storagePath, text_content: textContent })
      .eq('id', updateId)

    if (dbError) {
      console.error('[submitUpload] update error:', dbError)
      if (newFileUploaded) await admin.storage.from('uploads').remove([newFileUploaded])
      return { error: '수정에 실패했습니다. 다시 시도해 주세요.' }
    }

    // DB 반영 후 교체·제거된 옛 사진 삭제
    const oldPath = existing?.storage_path ?? null
    if (oldPath && oldPath !== storagePath) {
      const { error: removeErr } = await admin.storage.from('uploads').remove([oldPath])
      if (removeErr) console.error('[submitUpload] old photo remove error:', removeErr)
    }

    const photoPublicUrl = storagePath
      ? admin.storage.from('uploads').getPublicUrl(storagePath).data.publicUrl
      : null

    revalidatePath('/my')
    revalidatePath(`/e/${slug}/gallery`)

    return { success: true, isLoggedIn: !!user, uploadId: updateId, editToken, nonce, storagePath, textContent, guestName, photoPublicUrl }
  }

  const uploadId = randomUUID()
  // 비회원 업로드에만 수정 토큰 발급. 원본은 응답으로만 전달하고 DB에는 SHA-256 해시만 저장
  const newEditToken = user ? null : randomBytes(32).toString('base64url')

  const { error: dbError } = await admin.from('uploads').insert({
    id: uploadId,
    exhibition_id: exhibitionId,
    uploader_id: user?.id ?? null,
    guest_name: guestName,
    type,
    storage_path: storagePath,
    text_content: textContent,
    edit_token_hash: newEditToken ? hashEditToken(newEditToken) : null,
  })

  if (dbError) {
    console.error('[submitUpload] insert error:', dbError)
    if (newFileUploaded) await admin.storage.from('uploads').remove([newFileUploaded])
    return { error: '업로드에 실패했습니다. 다시 시도해 주세요.' }
  }

  const photoPublicUrl = storagePath
    ? admin.storage.from('uploads').getPublicUrl(storagePath).data.publicUrl
    : null

  revalidatePath('/my')
  revalidatePath(`/e/${slug}/gallery`)

  return { success: true, isLoggedIn: !!user, uploadId, editToken: newEditToken, nonce, storagePath, textContent, guestName, photoPublicUrl }
}

export async function deleteUploads(uploadIds: string[]): Promise<{ error?: string }> {
  if (!uploadIds.length) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, uploader_id, storage_path, exhibition_id')
    .in('id', uploadIds)
  if (!uploads?.length) return {}

  const exhibitionIds = [...new Set(uploads.map((u) => u.exhibition_id))]
  const { data: exhibitions } = await supabase
    .from('exhibitions')
    .select('id, slug, organizer_id')
    .in('id', exhibitionIds)
  const exMap = new Map(exhibitions?.map((e) => [e.id, e]) ?? [])

  for (const upload of uploads) {
    const ex = exMap.get(upload.exhibition_id)
    if (upload.uploader_id !== user.id && ex?.organizer_id !== user.id) {
      return { error: '삭제 권한이 없는 항목이 포함되어 있습니다.' }
    }
  }

  const admin = createAdminClient()

  const storagePaths = uploads.map((u) => u.storage_path).filter(Boolean) as string[]
  if (storagePaths.length) {
    await admin.storage.from('uploads').remove(storagePaths)
  }

  const { error: dbError } = await admin.from('uploads').delete().in('id', uploadIds)
  if (dbError) {
    console.error('[deleteUploads] db error:', dbError)
    return { error: '삭제에 실패했습니다.' }
  }

  for (const id of exhibitionIds) {
    revalidatePath(`/dashboard/exhibitions/${id}/uploads`)
    revalidatePath(`/dashboard/exhibitions/${id}`)
  }
  for (const ex of exhibitions ?? []) {
    revalidatePath(`/e/${ex.slug}/gallery`)
  }
  revalidatePath('/my')

  return {}
}

export async function deleteUpload(uploadId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: upload } = await supabase
    .from('uploads')
    .select('id, uploader_id, storage_path, exhibition_id')
    .eq('id', uploadId)
    .single()
  if (!upload) return { error: '업로드를 찾을 수 없습니다.' }

  const { data: exhibition } = await supabase
    .from('exhibitions')
    .select('slug, organizer_id')
    .eq('id', upload.exhibition_id)
    .single()

  const isUploader = upload.uploader_id === user.id
  const isOrganizer = exhibition?.organizer_id === user.id
  if (!isUploader && !isOrganizer) return { error: '삭제 권한이 없습니다.' }

  const admin = createAdminClient()

  if (upload.storage_path) {
    const { error: storageErr } = await admin.storage.from('uploads').remove([upload.storage_path])
    if (storageErr) console.error('[deleteUpload] storage error:', storageErr)
  }

  const { error: dbError } = await admin.from('uploads').delete().eq('id', uploadId)
  if (dbError) {
    console.error('[deleteUpload] db error:', dbError)
    return { error: '삭제에 실패했습니다.' }
  }

  if (exhibition?.slug) revalidatePath(`/e/${exhibition.slug}/gallery`)
  revalidatePath('/my')
  revalidatePath(`/dashboard/exhibitions/${upload.exhibition_id}/uploads`)
  revalidatePath(`/dashboard/exhibitions/${upload.exhibition_id}`)

  return {}
}

// 비회원 업로드를 로그인 후 내 계정으로 귀속 — 수정 토큰이 일치하는 업로드만 이전
export type PendingUpload = { id: string; token: string }

export async function claimUploads(items: PendingUpload[]): Promise<void> {
  if (!items.length) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  const { data: rows, error: selectError } = await admin
    .from('uploads')
    .select('id, edit_token_hash')
    .in('id', items.map((i) => i.id))
    .is('uploader_id', null)
  if (selectError) {
    console.error('[claimUploads] select error:', selectError)
    return
  }

  const tokenById = new Map(items.map((i) => [i.id, i.token]))
  const claimable = (rows ?? [])
    .filter((r) => editTokenMatches(tokenById.get(r.id) ?? null, r.edit_token_hash))
    .map((r) => r.id)
  if (!claimable.length) return

  // 귀속 후에는 계정 소유로만 수정 가능하도록 토큰 해시 제거
  const { error } = await admin
    .from('uploads')
    .update({ uploader_id: user.id, edit_token_hash: null })
    .in('id', claimable)
    .is('uploader_id', null)
  if (error) console.error('[claimUploads] update error:', error)
}
