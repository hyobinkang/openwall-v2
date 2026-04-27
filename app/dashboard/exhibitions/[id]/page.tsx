import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { QRCodeDisplay } from './QRCodeDisplay'
import type { Exhibition } from '@/lib/supabase/types'

const STATUS_LABEL: Record<Exhibition['status'], string> = {
  active: '진행 중',
  draft: '초안',
  closed: '종료',
}

const STATUS_CLASS: Record<Exhibition['status'], string> = {
  active: 'text-emerald-700 bg-emerald-50',
  draft: 'text-neutral-500 bg-neutral-100',
  closed: 'text-neutral-400 bg-neutral-100',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function ExhibitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ex } = await supabase
    .from('exhibitions')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', user!.id)
    .single()

  if (!ex) notFound()

  // 업로드 수 조회
  const { count: uploadCount } = await supabase
    .from('uploads')
    .select('*', { count: 'exact', head: true })
    .eq('exhibition_id', id)

  // 전시 공개 URL
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const exhibitionUrl = `${proto}://${host}/e/${ex.slug}`

  return (
    <div className="max-w-2xl">
      {/* 뒤로가기 */}
      <Link
        href="/dashboard"
        className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
      >
        ← 대시보드로
      </Link>

      {/* 헤더 */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{ex.title}</h1>
          {ex.description && (
            <p className="mt-1.5 text-sm text-neutral-500">{ex.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASS[ex.status]}`}
            >
              {STATUS_LABEL[ex.status]}
            </span>
            {(ex.starts_at || ex.ends_at) && (
              <span className="text-xs text-neutral-400">
                {formatDate(ex.starts_at)} {ex.ends_at && `— ${formatDate(ex.ends_at)}`}
              </span>
            )}
            <span className="text-xs text-neutral-400">
              업로드 {uploadCount ?? 0}개
            </span>
          </div>
        </div>
        <Link
          href={`/e/${ex.slug}`}
          target="_blank"
          className="shrink-0 text-xs border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 transition-colors whitespace-nowrap"
        >
          전시 보기 ↗
        </Link>
      </div>

      <hr className="my-8 border-neutral-100" />

      {/* QR 코드 섹션 */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-400 mb-6">
          QR 코드
        </h2>
        <QRCodeDisplay url={exhibitionUrl} slug={ex.slug} />
        <p className="mt-6 text-xs text-center text-neutral-400">
          관람객이 이 QR을 스캔하면 사진·텍스트를 업로드할 수 있습니다.
        </p>
      </section>

      <hr className="my-8 border-neutral-100" />

      {/* 업로드 목록 바로가기 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            수집된 업로드
          </h2>
          <span className="text-sm font-medium text-neutral-700">
            {uploadCount ?? 0}개
          </span>
        </div>
        {uploadCount === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8 border border-dashed border-neutral-200">
            아직 업로드된 항목이 없습니다. QR을 공유해 보세요.
          </p>
        ) : (
          <Link
            href={`/dashboard/exhibitions/${id}/uploads`}
            className="block text-center text-sm font-medium text-neutral-900 border border-neutral-200 py-3 hover:border-neutral-900 transition-colors"
          >
            업로드 전체 보기 →
          </Link>
        )}
      </section>
    </div>
  )
}
