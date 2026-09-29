import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { ProfileSection } from '../ProfileSection'
import { DeleteAccountButton } from '../DeleteAccountButton'

function providerLabel(provider: string | undefined): string {
  if (provider === 'google') return 'Google'
  return '이메일/비밀번호'
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const myProfileName = profile?.name ?? user.email?.split('@')[0] ?? null
  const provider = user.app_metadata?.provider as string | undefined

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-subtle py-4">
        <div className="w-full px-20 flex items-center justify-between">
          <Link href="/" className="text-base font-bold tracking-tight text-fg">Openwall</Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-secondary hover:text-fg transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <main className="w-full px-20 py-10 max-w-lg">
        <Link
          href="/my"
          className="text-xs text-secondary hover:text-fg transition-colors"
        >
          ← 마이페이지로
        </Link>

        <h1 className="mt-6 text-xl font-bold tracking-tight">설정</h1>

        {/* 프로필 */}
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-secondary mb-4">
            프로필
          </h2>
          <ProfileSection initialName={myProfileName} joinedAt={user.created_at} />
        </section>

        <hr className="border-subtle" />

        {/* 계정 */}
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-secondary mb-4">
            계정
          </h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-secondary">이메일</p>
              <p className="text-sm text-fg">{user.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-secondary">로그인 방식</p>
              <p className="text-sm text-fg">{providerLabel(provider)}</p>
            </div>
          </div>
        </section>

        <hr className="mt-16 border-subtle" />

        <div className="mt-12 pb-16">
          <DeleteAccountButton />
        </div>
      </main>
    </div>
  )
}
