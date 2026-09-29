// 전시 커버 이미지: 고를 때는 압축만 하고, 저장 버튼을 누를 때 Storage에 업로드한다.
// 업로드·저장이 실패하면 방금 올린 파일을 discardCoverUploads로 되돌려 고아 파일을 남기지 않는다.
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { discardCoverUploads } from '@/app/actions/exhibitions'

export const MAX_COVERS = 9

export type PendingCover = {
  id: string
  preview: string // URL.createObjectURL — 제거·언마운트 시 revoke
  file: Blob | null // 압축 완료 전에는 null
  ext: string
  status: 'compressing' | 'ready' | 'error'
}

export function createPendingCover(file: File): PendingCover {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    preview: URL.createObjectURL(file),
    file: null,
    ext: file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg',
    status: 'compressing',
  }
}

export function compressCover(file: File): Promise<Blob> {
  return imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  })
}

/**
 * 준비된 커버들을 순서대로 경로를 매겨 업로드한다. 하나라도 실패하면 성공한 것까지 삭제하고 throw.
 * 반환된 경로는 입력 순서와 같다.
 */
export async function uploadCovers(
  covers: PendingCover[],
  onProgress: (done: number, total: number) => void
): Promise<string[]> {
  if (covers.length === 0) return []

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let done = 0
  onProgress(0, covers.length)

  const results = await Promise.allSettled(
    covers.map(async (cover) => {
      if (!cover.file) throw new Error('Cover not ready')
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${cover.ext}`
      const { error } = await supabase.storage.from('covers').upload(path, cover.file, {
        contentType: cover.file.type || undefined,
      })
      if (error) throw error
      onProgress(++done, covers.length)
      return path
    })
  )

  const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  if (uploaded.length !== covers.length) {
    console.error(
      '[uploadCovers] upload failed:',
      results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []))
    )
    await discardUploadedCovers(uploaded)
    throw new Error('Cover upload failed')
  }
  return uploaded
}

/** 방금 업로드한 커버 되돌리기. 서버에서 본인 폴더 + 미사용 여부를 확인하므로 저장 성공 여부가 불확실해도 호출해도 안전 */
export async function discardUploadedCovers(paths: string[]) {
  if (paths.length === 0) return
  try {
    await discardCoverUploads(paths)
  } catch (err) {
    console.error('[discardUploadedCovers] failed:', err)
  }
}

export function isRedirect(err: unknown) {
  return !!(err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')
}

export function uploadLabel({ done, total }: { done: number; total: number }) {
  return `사진 업로드 중… (${done}/${total})`
}
