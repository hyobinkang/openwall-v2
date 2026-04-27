import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UploadForm } from './UploadForm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('exhibitions')
    .select('title')
    .eq('slug', slug)
    .single()

  return { title: data ? `${data.title} — Openwall` : 'Openwall' }
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function ExhibitionVisitorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: exhibition } = await supabase
    .from('exhibitions')
    .select('id, title, description, status, starts_at, ends_at')
    .eq('slug', slug)
    .single()

  if (!exhibition) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <Link href={user ? '/my' : '/'} className="text-sm font-bold tracking-tight">
          Openwall
        </Link>
        {user ? (
          <Link href="/my" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
            내 페이지
          </Link>
        ) : (
          <Link href="/login" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
            로그인
          </Link>
        )}
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        {/* 전시 정보 */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">{exhibition.title}</h1>
          {exhibition.description && (
            <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
              {exhibition.description}
            </p>
          )}
          {(exhibition.starts_at || exhibition.ends_at) && (
            <p className="mt-2 text-xs text-neutral-400">
              {formatDate(exhibition.starts_at)}
              {exhibition.ends_at && ` — ${formatDate(exhibition.ends_at)}`}
            </p>
          )}
        </div>

        {/* 상태별 분기 */}
        {exhibition.status === 'closed' ? (
          <div className="border border-neutral-200 px-6 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">전시가 종료되었습니다.</p>
            <p className="mt-1 text-xs text-neutral-400">
              업로드가 마감됐지만 전시 기록은 보존됩니다.
            </p>
          </div>
        ) : exhibition.status === 'draft' ? (
          <div className="border border-dashed border-neutral-200 px-6 py-8 text-center">
            <p className="text-sm text-neutral-400">준비 중인 전시입니다.</p>
          </div>
        ) : (
          <UploadForm exhibitionId={exhibition.id} isLoggedIn={!!user} />
        )}
      </main>
    </div>
  )
}
