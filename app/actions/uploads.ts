'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

export type UploadState = {
  error?: string
  success?: boolean
  isLoggedIn?: boolean
  uploadId?: string
}

const MAX_BYTES = 10 * 1024 * 1024

export async function submitUpload(
  exhibitionId: string,
  _: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const caption = (formData.get('caption') as string)?.trim() || null
  const guestName = !user
    ? (formData.get('guest_name') as string)?.trim() || null
    : null
  const textContent = (formData.get('text_content') as string)?.trim() || null

  const file = formData.get('photo') as File | null
  const hasPhoto = !!file && file.size > 0
  const hasText = !!textContent

  if (!hasPhoto && !hasText) {
    return { error: '사진 또는 텍스트 중 하나는 입력해야 합니다.' }
  }

  let storagePath: string | null = null

  if (hasPhoto) {
    if (file!.size > MAX_BYTES) return { error: '파일 크기는 10MB 이하여야 합니다.' }
    if (!file!.type.startsWith('image/')) return { error: '이미지 파일만 업로드할 수 있습니다.' }

    const ext = (file!.name.split('.').pop() ?? 'jpg').toLowerCase()
    const fileName = `${exhibitionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = await file!.arrayBuffer()

    const { error: storageError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: file!.type, upsert: false })

    if (storageError) return { error: '사진 업로드에 실패했습니다. 다시 시도해 주세요.' }
    storagePath = fileName
  }

  // 사진이 있으면 type='photo', 텍스트만 있으면 type='text'
  const type = hasPhoto ? 'photo' : 'text'

  const { data: inserted, error: dbError } = await supabase
    .from('uploads')
    .insert({
      exhibition_id: exhibitionId,
      uploader_id: user?.id ?? null,
      guest_name: guestName,
      type,
      storage_path: storagePath,
      text_content: textContent,
      caption,
    })
    .select('*')
    .single()

  if (dbError) {
    if (storagePath) await supabase.storage.from('uploads').remove([storagePath])
    return { error: '업로드에 실패했습니다. 다시 시도해 주세요.' }
  }

  return {
    success: true,
    isLoggedIn: !!user,
    uploadId: (inserted as { id: string } | null)?.id,
  }
}

// 비회원 업로드를 로그인 후 내 계정으로 귀속
export async function claimUploads(uploadIds: string[]): Promise<void> {
  if (!uploadIds.length) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // RLS를 우회하는 service client로 익명 업로드만 귀속 (uploader_id가 null인 것만 업데이트)
  const service = await createServiceClient()
  await service
    .from('uploads')
    .update({ uploader_id: user.id, guest_name: null })
    .in('id', uploadIds)
    .is('uploader_id', null)
}
