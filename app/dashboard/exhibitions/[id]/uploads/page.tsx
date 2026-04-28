import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UploadsGrid, type UploadItem } from './UploadsGrid'

function toKST(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function uploaderLabel(upload: {
  uploader_id: string | null
  guest_name: string | null
}): string {
  if (upload.guest_name !== null) {
    const gn = upload.guest_name
    return !gn || gn === '익명' ? '익명' : gn
  }
  return '익명'
}

export default async function ExhibitionUploadsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: exhibition } = await supabase
    .from('exhibitions')
    .select('id, title')
    .eq('id', id)
    .eq('organizer_id', user.id)
    .single()

  if (!exhibition) notFound()

  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, type, storage_path, text_content, caption, guest_name, uploader_id, created_at')
    .eq('exhibition_id', id)
    .order('created_at', { ascending: false })

  const raw = uploads ?? []
  const photoCount = raw.filter((u) => u.type === 'photo').length
  const textCount = raw.filter((u) => u.type === 'text').length

  const items: UploadItem[] = raw.map((u) => {
    const { data } = u.storage_path
      ? supabase.storage.from('uploads').getPublicUrl(u.storage_path)
      : { data: { publicUrl: null } }
    return {
      id: u.id,
      type: u.type as 'photo' | 'text',
      publicUrl: data?.publicUrl ?? null,
      text_content: u.text_content,
      caption: u.caption,
      uploaderLabel: uploaderLabel(u),
      createdAt: toKST(u.created_at),
    }
  })

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <Link
          href={`/dashboard/exhibitions/${id}`}
          className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          ← {exhibition.title}
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">업로드 목록</h1>
          <p className="mt-1 text-sm text-neutral-400">
            전체 {items.length}개 &middot; 사진 {photoCount}개 &middot; 텍스트 {textCount}개
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-neutral-200 py-24 text-center">
          <p className="text-sm text-neutral-400">아직 업로드된 항목이 없습니다.</p>
          <p className="mt-1 text-xs text-neutral-300">
            QR 코드를 공유하면 관람객이 사진과 텍스트를 올릴 수 있습니다.
          </p>
        </div>
      ) : (
        <UploadsGrid items={items} />
      )}
    </div>
  )
}
