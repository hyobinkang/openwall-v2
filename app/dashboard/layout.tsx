import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName =
    (user.user_metadata?.name as string | undefined) ?? user.email ?? '주최자'

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg border-b border-subtle">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight hover:opacity-70 transition-opacity"
          >
            Openwall
          </Link>
          <div className="flex items-center gap-5">
            <span className="text-sm text-secondary hidden sm:block">
              {displayName}
            </span>
            <Link
              href="/my"
              className="text-sm text-secondary hover:text-fg transition-colors"
            >
              내 페이지
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-secondary hover:text-fg transition-colors"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
