import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { QRCodeDisplay } from './QRCodeDisplay'
import { DeleteExhibitionButton } from './DeleteExhibitionButton'
import { CloseExhibitionButton } from './CloseExhibitionButton'
import type { Exhibition } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function coverUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/covers/${path}`
}

function parseEndsAt(endsAt: string | null): Date | null {
  if (!endsAt) return null
  return endsAt.includes('T') ? new Date(endsAt) : new Date(endsAt + 'T23:59:59')
}

function getStatusInfo(ex: Exhibition) {
  const now = new Date()
  if (ex.status === 'draft') {
    return { label: '임시저장', className: 'border border-white text-white bg-black' }
  }
  const endsAt = parseEndsAt(ex.ends_at)
  if (ex.status === 'closed' || (endsAt && endsAt < now)) {
    return { label: '종료', className: 'border border-gray-500 text-gray-500 bg-black' }
  }
  if (ex.starts_at && new Date(ex.starts_at) > now) {
    return { label: '진행 전', className: 'border border-blue-400 text-blue-400 bg-black' }
  }
  return { label: '진행 중', className: 'border border-green-400 text-green-400 bg-black' }
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

  const { count: uploadCount } = await supabase
    .from('uploads')
    .select('*', { count: 'exact', head: true })
    .eq('exhibition_id', id)

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const exhibitionUrl = `${proto}://${host}/e/${ex.slug}`

  const statusInfo = getStatusInfo(ex as Exhibition)
  const isClosed = ex.status === 'closed'

  return (
    <div className="w-full">
      <Link
        href="/my"
        className="text-xs text-secondary hover:text-fg transition-colors"
      >
        ← 내 페이지로
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{ex.title}</h1>
          {ex.description && (
            <p className="mt-1.5 text-sm text-secondary">{ex.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
            {(ex.starts_at || ex.ends_at) && (
              <span className="text-xs text-secondary">
                {formatDate(ex.starts_at)} {ex.ends_at && `— ${formatDate(ex.ends_at)}`}
              </span>
            )}
            <span className="text-xs text-secondary">
              업로드 {uploadCount ?? 0}개
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/exhibitions/${id}/edit`}
            className="text-xs border border-subtle text-fg px-3 py-1.5 hover:border-fg transition-colors whitespace-nowrap"
          >
            수정
          </Link>
          {!isClosed && <CloseExhibitionButton exhibitionId={id} />}
          <DeleteExhibitionButton
            exhibitionId={id}
            uploadCount={uploadCount ?? 0}
          />
        </div>
      </div>

      {ex.cover_images && ex.cover_images.length > 0 && (
        <>
          <hr className="my-8 border-subtle" />
          <section>
            <h2 className="text-xs font-medium uppercase tracking-widest text-secondary mb-4">
              커버 이미지
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {ex.cover_images.map((path) => (
                <div key={path} className="relative aspect-square bg-bg overflow-hidden">
                  <Image
                    src={coverUrl(path)}
                    alt="커버"
                    fill
                    sizes="(max-width: 512px) 33vw, 160px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <hr className="my-8 border-subtle" />

      {/* QR 코드 섹션 */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-secondary mb-6">
          QR 코드
        </h2>
        {ex.status === 'draft' ? (
          <p className="text-sm text-secondary text-center py-8 border border-dashed border-subtle">
            전시를 생성하면 QR코드가 만들어집니다. 수정 버튼을 눌러 전시를 완성해주세요.
          </p>
        ) : (
          <>
            <QRCodeDisplay url={exhibitionUrl} slug={ex.slug} />
            <p className="mt-6 text-xs text-center text-secondary">
              관람객이 이 QR을 스캔하면 사진·텍스트를 업로드할 수 있습니다.
            </p>
          </>
        )}
      </section>

      <hr className="my-8 border-subtle" />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-secondary">
            수집된 업로드
          </h2>
          <span className="text-sm font-medium text-fg">
            {uploadCount ?? 0}개
          </span>
        </div>
        {uploadCount === 0 ? (
          <p className="text-sm text-secondary text-center py-8 border border-dashed border-subtle">
            아직 업로드된 항목이 없습니다. QR을 공유해 보세요.
          </p>
        ) : (
          <Link
            href={`/dashboard/exhibitions/${id}/uploads`}
            className="block text-center text-sm font-medium text-fg border border-subtle py-3 hover:border-fg transition-colors"
          >
            업로드 전체 보기 →
          </Link>
        )}
      </section>
    </div>
  )
}
