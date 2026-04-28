import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Exhibition } from '@/lib/supabase/types'

const STATUS_LABEL: Record<Exhibition['status'], string> = {
  active: '진행 중',
  draft: '초안',
  closed: '종료',
}

const STATUS_CLASS: Record<Exhibition['status'], string> = {
  active: 'border border-subtle text-fg',
  draft: 'border border-subtle text-secondary',
  closed: 'border border-subtle text-secondary',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: exhibitions } = await supabase
    .from('exhibitions')
    .select('id, title, slug, status, starts_at, ends_at, created_at')
    .eq('organizer_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">나의 전시</h1>
          <p className="mt-1 text-sm text-secondary">
            {exhibitions?.length ?? 0}개의 전시
          </p>
        </div>
        <Link
          href="/dashboard/exhibitions/new"
          className="bg-fg text-bg text-sm font-medium px-4 py-2.5 hover:bg-gray6 transition-colors"
        >
          + 새 전시 만들기
        </Link>
      </div>

      {!exhibitions || exhibitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-subtle rounded py-24 text-center">
          <p className="text-secondary text-sm">아직 생성된 전시가 없습니다.</p>
          <Link
            href="/dashboard/exhibitions/new"
            className="mt-3 text-sm font-medium text-fg underline underline-offset-2 hover:text-fg"
          >
            첫 번째 전시 만들기 →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {exhibitions.map((ex) => (
            <Link
              key={ex.id}
              href={`/dashboard/exhibitions/${ex.id}`}
              className="flex items-center justify-between bg-surface border border-subtle px-5 py-4 hover:border-fg transition-colors group"
            >
              <div className="min-w-0">
                <p className="font-medium text-fg truncate">
                  {ex.title}
                </p>
                <p className="mt-0.5 text-xs text-secondary font-mono">
                  /e/{ex.slug}
                  {ex.starts_at && (
                    <span className="ml-3 font-sans">
                      {formatDate(ex.starts_at)}
                      {ex.ends_at && ` — ${formatDate(ex.ends_at)}`}
                    </span>
                  )}
                </p>
              </div>
              <span
                className={`ml-4 shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASS[ex.status]}`}
              >
                {STATUS_LABEL[ex.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
