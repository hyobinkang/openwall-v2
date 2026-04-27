import { notFound } from 'next/navigation'
import Image from 'next/image'
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

  const { data: { user } } = await supabase.auth.getUser()

  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, type, storage_path, text_content, caption, guest_name, uploader_id, created_at')
    .eq('exhibition_id', exhibition.id)
    .order('created_at', { ascending: false })

  const raw = uploads ?? []

  function toItem(u: typeof raw[number]): UploadItem {
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
  }

  const myUploads = user ? raw.filter((u) => u.uploader_id === user.id) : []
  const allItems: UploadItem[] = raw.map(toItem)

  function getPublicUrl(path: string | null): string | null {
    if (!path) return null
    const { data } = supabase.storage.from('uploads').getPublicUrl(path)
    return data.publicUrl
  }

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
          <p className="mt-1 text-sm text-neutral-400">업로드 {allItems.length}개</p>
        </div>

        {/* 내가 남긴 기록 */}
        {myUploads.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold mb-3">내가 남긴 기록</h2>
            <div className="space-y-2">
              {myUploads.map((u) => {
                const url = u.type === 'photo' ? getPublicUrl(u.storage_path) : null

                // 텍스트 전용 카드
                if (u.type === 'text') {
                  return (
                    <div key={u.id} className="border border-neutral-100 px-4 py-3">
                      {u.text_content && (
                        <p className="text-sm text-neutral-800 leading-relaxed line-clamp-3 break-words">
                          {u.text_content}
                        </p>
                      )}
                      {u.caption && (
                        <p className="mt-1 text-xs text-neutral-500 italic line-clamp-1">{u.caption}</p>
                      )}
                      <p className="mt-1.5 text-xs text-neutral-400">{toKST(u.created_at)}</p>
                    </div>
                  )
                }

                // 사진 카드
                return (
                  <div key={u.id} className="border border-neutral-100 flex gap-4 p-3">
                    {url && (
                      <div className="relative w-16 h-16 flex-shrink-0 bg-neutral-100">
                        <Image
                          src={url}
                          alt={u.caption ?? '업로드 사진'}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {u.text_content && (
                          <p className="text-sm text-neutral-800 leading-relaxed line-clamp-2 break-words">
                            {u.text_content}
                          </p>
                        )}
                        {u.caption && (
                          <p className="mt-0.5 text-xs text-neutral-500 italic line-clamp-1">{u.caption}</p>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{toKST(u.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 전체 업로드 */}
        {allItems.length === 0 ? (
          <div className="border border-dashed border-neutral-200 py-24 text-center">
            <p className="text-sm text-neutral-400">아직 업로드된 항목이 없습니다.</p>
          </div>
        ) : (
          <UploadsGrid items={allItems} />
        )}

        {/* 비로그인 또는 업로드 없는 로그인 유저 → 업로드 유도 */}
        {exhibition.status === 'active' && myUploads.length === 0 && (
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
