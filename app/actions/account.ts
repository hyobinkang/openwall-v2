'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 1. 삭제 전에 파일 경로 수집
  const { data: exhibitions } = await admin
    .from('exhibitions')
    .select('id, cover_images')
    .eq('organizer_id', user.id)

  const exhibitionIds = (exhibitions ?? []).map((e) => e.id)
  const coverPaths: string[] = (exhibitions ?? []).flatMap(
    (e) => (e.cover_images as string[] | null) ?? []
  )

  let uploadPaths: string[] = []
  if (exhibitionIds.length > 0) {
    const { data: uploads } = await admin
      .from('uploads')
      .select('storage_path')
      .in('exhibition_id', exhibitionIds)
      .not('storage_path', 'is', null)
    uploadPaths = (uploads ?? [])
      .map((u) => u.storage_path)
      .filter(Boolean) as string[]
  }

  // 2. auth user 삭제 — DB CASCADE가 profiles, exhibitions, uploads 처리
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('[deleteAccount] deleteUser error:', deleteError)
    return { error: '탈퇴에 실패했습니다. 다시 시도해 주세요.' }
  }

  // 3. Storage 파일 정리 (best-effort, 실패해도 탈퇴는 성공)
  try {
    for (const chunk of chunkArray(coverPaths, 100)) {
      const { error } = await admin.storage.from('covers').remove(chunk)
      if (error) console.error('[deleteAccount] covers remove error:', error)
    }
    for (const chunk of chunkArray(uploadPaths, 100)) {
      const { error } = await admin.storage.from('uploads').remove(chunk)
      if (error) console.error('[deleteAccount] uploads remove error:', error)
    }
  } catch (err) {
    console.error('[deleteAccount] storage cleanup error:', err)
  }

  // 4. 세션 쿠키 정리 후 홈으로
  await supabase.auth.signOut()
  redirect('/')
}
