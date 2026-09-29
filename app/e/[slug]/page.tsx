import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { UploadForm } from './UploadForm'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function coverUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/covers/${path}`
}

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
    .select('id, title, description, status, starts_at, ends_at, cover_images')
    .eq('slug', slug)
    .single()

  if (!exhibition) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  let userName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
    userName = profile?.name ?? user.email?.split('@')[0] ?? null
  }

  const isClosed = exhibition.status === 'closed'
  const isDraft = exhibition.status === 'draft'

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-subtle py-4">
        <div className="w-full page-px flex items-center justify-between">
          <Link href={user ? '/my' : '/'} className="text-sm font-bold tracking-tight text-fg">
            Openwall
          </Link>
          {user ? (
            <Link href="/my" className="text-xs text-secondary hover:text-fg transition-colors">
              마이페이지
            </Link>
          ) : (
            <Link href="/login" className="text-xs text-secondary hover:text-fg transition-colors">
              로그인
            </Link>
          )}
        </div>
      </header>

      <main className="w-full page-px py-12">
        {/* 전시 정보 */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">{exhibition.title}</h1>

          {exhibition.cover_images && exhibition.cover_images.length > 0 && (
            <div className="overflow-x-auto flex gap-2 mt-4" style={{ scrollbarWidth: 'none' }}>
              {exhibition.cover_images.map((path) => (
                <div key={path} className="relative shrink-0 h-[200px] aspect-[3/2] overflow-hidden bg-black">
                  <Image
                    src={coverUrl(path)}
                    alt="커버"
                    fill
                    sizes="300px"
                    className="object-contain"
                  />
                </div>
              ))}
            </div>
          )}

          {exhibition.description && (
            <p className="mt-4 text-sm text-secondary leading-relaxed">
              {exhibition.description}
            </p>
          )}
          {(exhibition.starts_at || exhibition.ends_at) && (
            <p className="mt-2 text-xs text-secondary">
              {formatDate(exhibition.starts_at)}
              {exhibition.ends_at && ` — ${formatDate(exhibition.ends_at)}`}
            </p>
          )}
        </div>

        {isDraft ? (
          <div className="border border-dashed border-subtle px-6 py-8 text-center">
            <p className="text-sm text-secondary">준비 중인 전시입니다.</p>
          </div>
        ) : (
          <>
            {isClosed && (
              <div className="mb-6 px-4 py-3 border border-gray-200 bg-gray-50 text-sm text-gray-500 text-center">
                이 전시는 종료되었습니다.
              </div>
            )}
            <UploadForm exhibitionId={exhibition.id} isLoggedIn={!!user} userName={userName} slug={slug} />
          </>
        )}
      </main>
    </div>
  )
}
