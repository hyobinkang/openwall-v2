'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type UploadState = {
  error?: string
  success?: boolean
  isLoggedIn?: boolean
  uploadId?: string
  nonce?: string
  storagePath?: string | null
  textContent?: string | null
  guestName?: string | null
  photoPublicUrl?: string | null
}

const MAX_BYTES = 10 * 1024 * 1024

export async function submitUpload(
  exhibitionId: string,
  slug: string,
  _: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const updateId = (formData.get('upload_id') as string)?.trim() || null
  const keepStoragePath = (formData.get('existing_storage_path') as string)?.trim() || null
  const guestName = (formData.get('guest_name') as string)?.trim() || null
  const textContent = (formData.get('text_content') as string)?.trim() || null

  const file = formData.get('photo') as File | null
  const hasNewPhoto = !!file && file.size > 0
  const hasText = !!textContent

  if (!hasNewPhoto && !hasText && !keepStoragePath) {
    return { error: '사진 또는 텍스트 중 하나는 입력해야 합니다.' }
  }

  let storagePath: string | null = keepStoragePath

  if (hasNewPhoto) {
    if (file!.size > MAX_BYTES) return { error: '파일 크기는 10MB 이하여야 합니다.' }
    if (!file!.type.startsWith('image/')) return { error: '이미지 파일만 업로드할 수 있습니다.' }

    const ext = (file!.name.split('.').pop() ?? 'jpg').toLowerCase()
    const fileName = `${exhibitionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = await file!.arrayBuffer()

    const { error: storageError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: file!.type, upsert: false })

    if (storageError) return { error: '사진 업로드에 실패했습니다. 다시 시도해 주세요.' }

    if (keepStoragePath) {
      await supabase.storage.from('uploads').remove([keepStoragePath])
    }
    storagePath = fileName
  }

  const type = storagePath ? 'photo' : 'text'
  const nonce = randomUUID()

  if (updateId) {
    const admin = createAdminClient()
    const updateFields = { guest_name: guestName, type: type as 'photo' | 'text', storage_path: storagePath, text_content: textContent }

    console.log('[submitUpload] UPDATE 시도 — uploadId:', updateId, '| user.id:', user?.id ?? null, '| guestName:', guestName)

    const base = admin.from('uploads').update(updateFields).eq('id', updateId)
    const { error: dbError, count } = await (user ? base.eq('uploader_id', user.id) : base).select('id', { count: 'exact', head: true })

    console.log('[submitUpload] UPDATE 결과 — count:', count, '| error:', dbError?.message ?? null)

    if (dbError) {
      if (hasNewPhoto && storagePath) await supabase.storage.from('uploads').remove([storagePath])
      return { error: '수정에 실패했습니다. 다시 시도해 주세요.' }
    }

    // DB에 실제로 반영됐는지 확인
    const { data: verified } = await admin
      .from('uploads')
      .select('id, guest_name, uploader_id')
      .eq('id', updateId)
      .single()
    console.log('[submitUpload] UPDATE 후 DB 재조회 — row:', verified)

    const photoPublicUrl = storagePath
      ? supabase.storage.from('uploads').getPublicUrl(storagePath).data.publicUrl
      : null

    revalidatePath('/my')
    revalidatePath(`/e/${slug}/gallery`)

    return { success: true, isLoggedIn: !!user, uploadId: updateId, nonce, storagePath, textContent, guestName, photoPublicUrl }
  }

  // INSERT 전에 ID를 미리 생성 — 비로그인 사용자는 RLS SELECT 정책에 막혀
  // insert().select()로 row를 돌려받지 못하므로, ID를 직접 생성해 반환한다.
  const uploadId = randomUUID()

  const { error: dbError } = await supabase.from('uploads').insert({
    id: uploadId,
    exhibition_id: exhibitionId,
    uploader_id: user?.id ?? null,
    guest_name: guestName,
    type,
    storage_path: storagePath,
    text_content: textContent,
  })

  if (dbError) {
    if (storagePath) await supabase.storage.from('uploads').remove([storagePath])
    return { error: '업로드에 실패했습니다. 다시 시도해 주세요.' }
  }

  const photoPublicUrl = storagePath
    ? supabase.storage.from('uploads').getPublicUrl(storagePath).data.publicUrl
    : null

  revalidatePath('/my')
  revalidatePath(`/e/${slug}/gallery`)

  return { success: true, isLoggedIn: !!user, uploadId, nonce, storagePath, textContent, guestName, photoPublicUrl }
}

// 비회원 업로드를 로그인 후 내 계정으로 귀속
export async function claimUploads(uploadIds: string[]): Promise<void> {
  if (!uploadIds.length) return

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[claimUploads] user:', user?.id ?? null, 'userError:', userError?.message ?? null)
  if (!user) {
    console.log('[claimUploads] 유저 없음 — 종료')
    return
  }

  const admin = createAdminClient()
  const { data, error, count } = await admin
    .from('uploads')
    .update({ uploader_id: user.id })
    .in('id', uploadIds)
    .is('uploader_id', null)
    .select()

  console.log('[claimUploads] UPDATE 결과 — count:', count, 'data:', data, 'error:', error?.message ?? null)
}
