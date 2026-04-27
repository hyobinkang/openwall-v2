import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ClaimUploads } from './ClaimUploads'

function toKST(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, type, storage_path, text_content, caption, created_at, exhibition_id, exhibitions(id, title, slug)')
    .eq('uploader_id', user.id)
    .order('created_at', { ascending: false })

  const raw = uploads ?? []

  // Group by exhibition
  const grouped = new Map<string, {
    exhibitionId: string
    title: string
    slug: string
    items: typeof raw
  }>()

  for (const u of raw) {
    const ex = u.exhibitions as { id: string; title: string; slug: string } | null
    if (!ex) continue
    if (!grouped.has(ex.id)) {
      grouped.set(ex.id, { exhibitionId: ex.id, title: ex.title, slug: ex.slug, items: [] })
    }
    grouped.get(ex.id)!.items.push(u)
  }

  const groups = Array.from(grouped.values())

  function getPublicUrl(path: string | null): string | null {
    if (!path) return null
    const { data } = supabase.storage.from('uploads').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <div className="min-h-screen bg-white">
      <ClaimUploads />

      {/* 헤더 */}
      <header className="border-b border-neutral-100 px-5 py-4 flex items-center justify-between">
        <Link href="/" className="text-base font-bold tracking-tight">Openwall</Link>
        <span className="text-sm text-neutral-400">내 아카이브</span>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-10">
        <h1 className="text-xl font-bold tracking-tight mb-1">내 아카이브</h1>
        <p className="text-sm text-neutral-400 mb-10">
          내가 참여한 전시와 남긴 기록들
        </p>

        {groups.length === 0 ? (
          <div className="border border-dashed border-neutral-200 py-24 text-center">
            <p className="text-sm text-neutral-400">아직 참여한 전시가 없습니다.</p>
            <p className="mt-1 text-xs text-neutral-300">
              전시 QR 코드를 스캔하고 사진이나 글을 남겨보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <section key={group.exhibitionId}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-base font-semibold">{group.title}</h2>
                  <Link
                    href={`/e/${group.slug}/gallery`}
                    className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    전체 업로드 보기 →
                  </Link>
                </div>

                <div className="space-y-3">
                  {group.items.map((u) => {
                    const url = getPublicUrl(u.storage_path)
                    return (
                      <div
                        key={u.id}
                        className="border border-neutral-100 flex gap-4 p-3"
                      >
                        {u.type === 'photo' && url && (
                          <div className="relative w-20 h-20 flex-shrink-0 bg-neutral-100">
                            <Image
                              src={url}
                              alt={u.caption ?? '업로드 사진'}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        {u.type === 'text' && (
                          <div className="w-20 h-20 flex-shrink-0 bg-neutral-50 flex items-center justify-center p-2">
                            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-4 text-center">
                              {u.text_content}
                            </p>
                          </div>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            {u.text_content && (
                              <p className="text-sm text-neutral-800 leading-relaxed line-clamp-2">
                                {u.text_content}
                              </p>
                            )}
                            {u.caption && (
                              <p className="mt-1 text-xs text-neutral-500 italic line-clamp-1">
                                {u.caption}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{toKST(u.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
