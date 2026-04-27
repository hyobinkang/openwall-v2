import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UploadsGrid, type UploadItem } from '@/app/dashboard/exhibitions/[id]/uploads/UploadsGrid'

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
  if (upload.guest_name) return upload.guest_name
  if (upload.uploader_id) return '회원'
  return '익명'
}

export default async function ExhibitionGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: exhibition } = await supabase
    .from('exhibitions')
    .select('id, title, status')
    .eq('slug', slug)
    .single()

  if (!exhibition) notFound()

  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, type, storage_path, text_content, caption, guest_name, uploader_id, created_at')
    .eq('exhibition_id', exhibition.id)
    .order('created_at', { ascending: false })

  const raw = uploads ?? []

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
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <Link href={`/e/${slug}`} className="text-sm font-bold tracking-tight">
          Openwall
        </Link>
        <span className="text-xs text-neutral-400">{exhibition.title}</span>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">{exhibition.title}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            업로드 {items.length}개
          </p>
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-neutral-200 py-24 text-center">
            <p className="text-sm text-neutral-400">아직 업로드된 항목이 없습니다.</p>
          </div>
        ) : (
          <UploadsGrid items={items} />
        )}

        {exhibition.status === 'active' && (
          <div className="mt-10 text-center">
            <Link
              href={`/e/${slug}`}
              className="inline-block border border-neutral-900 px-6 py-2.5 text-sm font-medium hover:bg-neutral-900 hover:text-white transition-colors"
            >
              나도 업로드하기
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
