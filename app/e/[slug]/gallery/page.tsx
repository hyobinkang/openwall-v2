import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UploadsGrid, type UploadItem } from '@/app/dashboard/exhibitions/[id]/uploads/UploadsGrid'
import { MyUploadsSection, type MyUploadCardItem } from './MyUploadsSection'

function toKST(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

  let myProfileName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
    myProfileName = profile?.name ?? user.email?.split('@')[0] ?? null
  }

  function myDisplayName(u: { guest_name: string | null }): string {
    if (u.guest_name !== null) {
      const gn = u.guest_name
      return !gn || gn === '익명' ? '익명' : gn
    }
    return myProfileName || '익명'
  }

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
    const label = u.guest_name !== null
      ? (!u.guest_name || u.guest_name === '익명' ? '익명' : u.guest_name)
      : (u.uploader_id === user?.id ? myProfileName : null) || '익명'
    return {
      id: u.id,
      type: u.type as 'photo' | 'text',
      publicUrl: data?.publicUrl ?? null,
      text_content: u.text_content,
      caption: u.caption,
      uploaderLabel: label,
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

  const myCardItems: MyUploadCardItem[] = myUploads.map((u) => ({
    id: u.id,
    type: u.type as 'photo' | 'text',
    publicUrl: u.type === 'photo' ? getPublicUrl(u.storage_path) : null,
    textContent: u.text_content,
    displayName: myDisplayName(u),
    createdAt: toKST(u.created_at),
  }))

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-subtle py-4">
        <div className="w-full px-10 flex items-center justify-between">
          <Link href={`/e/${slug}`} className="text-sm font-bold tracking-tight text-fg">
            Openwall
          </Link>
          {user ? (
            <Link href="/my" className="text-xs text-secondary hover:text-fg transition-colors">
              내 페이지
            </Link>
          ) : (
            <Link href="/login" className="text-xs text-secondary hover:text-fg transition-colors">
              로그인
            </Link>
          )}
        </div>
      </header>

      <main className="w-full px-10 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">{exhibition.title}</h1>
          <p className="mt-1 text-sm text-secondary">업로드 {allItems.length}개</p>
        </div>

        {/* 내가 남긴 기록 */}
        {myCardItems.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold mb-3">내가 남긴 기록</h2>
            <MyUploadsSection items={myCardItems} />
          </section>
        )}

        {/* 전체 업로드 */}
        {allItems.length === 0 ? (
          <div className="border border-dashed border-subtle py-24 text-center">
            <p className="text-sm text-secondary">아직 업로드된 항목이 없습니다.</p>
          </div>
        ) : (
          <UploadsGrid items={allItems} />
        )}

        {/* 비로그인 또는 업로드 없는 로그인 유저 → 업로드 유도 */}
        {exhibition.status === 'active' && myUploads.length === 0 && (
          <div className="mt-10 text-center">
            <Link
              href={`/e/${slug}`}
              className="inline-block border border-subtle text-fg px-6 py-2.5 text-sm font-medium hover:border-fg transition-colors"
            >
              나도 업로드하기
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
