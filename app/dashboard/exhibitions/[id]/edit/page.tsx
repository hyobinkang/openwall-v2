import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EditExhibitionForm } from './EditExhibitionForm'

export default async function EditExhibitionPage({
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
    .eq('organizer_id', user.id)
    .single()

  if (!ex) notFound()

  const coverPaths = (ex.cover_images as string[] | null) ?? []
  const initialCovers = coverPaths.map((path) => ({
    path,
    url: supabase.storage.from('covers').getPublicUrl(path).data.publicUrl,
  }))

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/dashboard/exhibitions/${id}`}
          className="text-xs text-secondary hover:text-fg transition-colors"
        >
          ← 전시로
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">전시 수정</h1>
      </div>

      <div className="bg-surface border border-subtle p-6">
        <EditExhibitionForm
          id={id}
          title={ex.title}
          description={ex.description}
          slug={ex.slug}
          startsAt={ex.starts_at ? ex.starts_at.slice(0, 10) : ''}
          endsAt={ex.ends_at ? ex.ends_at.slice(0, 10) : ''}
          status={ex.status}
          initialCovers={initialCovers}
        />
      </div>
    </div>
  )
}
