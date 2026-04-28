import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { ClaimUploads } from './ClaimUploads'
import { ProfileSection } from './ProfileSection'
import { MyPageTabs, type HostedExhibition, type ParticipatedGroup, type UploadItem } from './MyPageTabs'

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

  const [{ data: uploads }, { data: profile }, { data: exhibitions }] = await Promise.all([
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
    supabase
      .from('exhibitions')
      .select('id, title, slug, status, created_at')
      .eq('organizer_id', user.id)
      .order('created_at', { ascending: false }),
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

  function getPublicUrl(path: string | null): string | null {
    if (!path) return null
    return supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
  }

  // 주최한 전시
  const hosted: HostedExhibition[] = (exhibitions ?? []).map((ex) => ({
    id: ex.id,
    title: ex.title,
    slug: ex.slug,
    status: ex.status,
    createdAt: ex.created_at,
  }))

  // 참여한 전시 (업로드 기준, 전시별 그룹)
  const raw = uploads ?? []
  const groupMap = new Map<string, ParticipatedGroup>()

  for (const u of raw) {
    const ex = u.exhibitions as { id: string; title: string; slug: string } | null
    if (!ex) continue
    if (!groupMap.has(ex.id)) {
      groupMap.set(ex.id, { exhibitionId: ex.id, title: ex.title, slug: ex.slug, items: [] })
    }
    const item: UploadItem = {
      id: u.id,
      type: u.type as 'photo' | 'text',
      publicUrl: u.type === 'photo' ? getPublicUrl(u.storage_path) : null,
      textContent: u.text_content,
      displayName: displayName(u),
      createdAt: toKST(u.created_at),
    }
    groupMap.get(ex.id)!.items.push(item)
  }

  const participated: ParticipatedGroup[] = Array.from(groupMap.values())

  return (
    <div className="min-h-screen bg-bg text-fg">
      <ClaimUploads />

      <header className="border-b border-subtle px-5 py-4 flex items-center justify-between">
        <Link href="/" className="text-base font-bold tracking-tight text-fg">Openwall</Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-secondary hover:text-fg transition-colors"
          >
            로그아웃
          </button>
        </form>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-10">
        <ProfileSection initialName={myProfileName} joinedAt={user.created_at} />
        <MyPageTabs hosted={hosted} participated={participated} />
      </main>
    </div>
  )
}
