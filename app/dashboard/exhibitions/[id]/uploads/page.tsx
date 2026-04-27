import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
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
    .eq('organizer_id', user!.id)
    .single()

  if (!exhibition) notFound()

  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, type, storage_path, text_content, caption, guest_name, uploader_id, created_at')
    .eq('exhibition_id', id)
    .order('created_at', { ascending: false })

  const items = uploads ?? []
  const photoCount = items.filter((u) => u.type === 'photo').length
  const textCount = items.filter((u) => u.type === 'text').length

  function getPublicUrl(path: string | null): string {
    if (!path) return ''
    const { data } = supabase.storage.from('uploads').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <div>
      {/* 상단 네비게이션 */}
      <div className="flex items-center gap-2 mb-8">
        <Link
          href={`/dashboard/exhibitions/${id}`}
          className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          ← {exhibition.title}
        </Link>
      </div>

      {/* 헤더 */}
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {items.map((upload) => {
            if (upload.type === 'photo') {
              const url = getPublicUrl(upload.storage_path)
              return (
                <div key={upload.id} className="group relative aspect-square bg-neutral-100 overflow-hidden">
                  {url && (
                    <Image
                      src={url}
                      alt={upload.caption ?? '업로드 사진'}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100">
                    {upload.caption && (
                      <p className="text-white text-xs font-medium leading-snug line-clamp-2">
                        {upload.caption}
                      </p>
                    )}
                    <p className="text-white/70 text-xs mt-1">
                      {uploaderLabel(upload)} · {formatDate(upload.created_at)}
                    </p>
                  </div>
                </div>
              )
            }

            // 텍스트 카드
            return (
              <div
                key={upload.id}
                className="aspect-square bg-neutral-50 border border-neutral-200 p-4 flex flex-col justify-between overflow-hidden"
              >
                <p className="text-sm text-neutral-800 leading-relaxed line-clamp-6 flex-1">
                  {upload.text_content}
                </p>
                <div className="mt-2 pt-2 border-t border-neutral-200">
                  {upload.caption && (
                    <p className="text-xs text-neutral-500 italic truncate mb-0.5">
                      {upload.caption}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400">
                    {uploaderLabel(upload)} · {formatDate(upload.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
