import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ClaimUploads } from './ClaimUploads'
import { ProfileSection } from './ProfileSection'

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

  const [{ data: uploads }, { data: profile }] = await Promise.all([
    supabase
      .from('uploads')
      .select('id, type, storage_path, text_content, guest_name, created_at, exhibition_id, exhibitions(id, title, slug)')
      .eq('uploader_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single(),
  ])

  const myProfileName = profile?.name ?? user.email?.split('@')[0] ?? null

  console.log('[my/page] uploads guest_name values:', (uploads ?? []).map((u) => ({ id: u.id, guest_name: u.guest_name })))

  function displayName(upload: { guest_name: string | null }): string {
    if (upload.guest_name !== null) {
      const gn = upload.guest_name
      return !gn || gn === '익명' ? '익명' : gn
    }
    return myProfileName || '익명'
  }

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
        <p className="text-sm text-neutral-400 mb-6">
          내가 참여한 전시와 남긴 기록들
        </p>

        <ProfileSection initialName={myProfileName} joinedAt={user.created_at} />

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
                          <p className="text-xs text-neutral-400 mt-1.5">
                            {displayName(u)} · {toKST(u.created_at)}
                          </p>
                        </div>
                      )
                    }

                    // 사진 카드
                    return (
                      <div key={u.id} className="border border-neutral-100 flex gap-4 p-3">
                        {url && (
                          <div className="relative w-20 h-20 flex-shrink-0 bg-neutral-100">
                            <Image
                              src={url}
                              alt="업로드 사진"
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          {u.text_content && (
                            <p className="text-sm text-neutral-800 leading-relaxed line-clamp-2 break-words">
                              {u.text_content}
                            </p>
                          )}
                          <p className="text-xs text-neutral-400 mt-1">
                            {displayName(u)} · {toKST(u.created_at)}
                          </p>
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
