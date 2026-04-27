'use server'

import { createClient } from '@/lib/supabase/server'

export type UploadState = {
  error?: string
  success?: boolean
  isLoggedIn?: boolean
}

const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function submitUpload(
  exhibitionId: string,
  _: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const type = formData.get('type') as 'photo' | 'text'
  const caption = (formData.get('caption') as string)?.trim() || null
  const guestName = !user
    ? (formData.get('guest_name') as string)?.trim() || null
    : null
  const textContent = (formData.get('text_content') as string)?.trim() || null

  let storagePath: string | null = null

  if (type === 'photo') {
    const file = formData.get('photo') as File | null

    if (!file || file.size === 0) return { error: '사진을 선택해 주세요.' }
    if (file.size > MAX_BYTES) return { error: '파일 크기는 10MB 이하여야 합니다.' }
    if (!file.type.startsWith('image/')) return { error: '이미지 파일만 업로드할 수 있습니다.' }

    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const fileName = `${exhibitionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // File → ArrayBuffer 변환: Node.js 환경에서 더 안정적
    const buffer = await file.arrayBuffer()

    const { error: storageError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: file.type, upsert: false })

    if (storageError) {
      return { error: '사진 업로드에 실패했습니다. 다시 시도해 주세요.' }
    }

    storagePath = fileName
  } else {
    if (!textContent) return { error: '텍스트를 입력해 주세요.' }
  }

  const { error: dbError } = await supabase.from('uploads').insert({
    exhibition_id: exhibitionId,
    uploader_id: user?.id ?? null,
    guest_name: guestName,
    type,
    storage_path: storagePath,
    text_content: textContent,
    caption,
  })

  if (dbError) {
    // DB 저장 실패 시 Storage 롤백
    if (storagePath) {
      await supabase.storage.from('uploads').remove([storagePath])
    }
    return { error: '업로드에 실패했습니다. 다시 시도해 주세요.' }
  }

  return { success: true, isLoggedIn: !!user }
}
