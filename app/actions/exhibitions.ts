'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

export type ExhibitionState = { error?: string }


export async function createExhibition(
  formData: FormData
): Promise<ExhibitionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = (formData.get('title') as string).trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const slug = (formData.get('slug') as string).trim().toLowerCase()
  const starts_at = (formData.get('starts_at') as string) || null
  const ends_at = (formData.get('ends_at') as string) || null
  // 클라이언트에서 이미 업로드된 storage 경로만 받음
  const cover_images = formData.getAll('cover_path') as string[]

  if (!title) return { error: '전시 제목을 입력해 주세요.' }
  if (!slug) return { error: '슬러그를 입력해 주세요.' }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: '슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.' }
  }

  const { data, error } = await supabase
    .from('exhibitions')
    .insert({
      organizer_id: user.id,
      title,
      description,
      slug,
      starts_at,
      ends_at,
      status: 'active',
      cover_images,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createExhibition] insert error:', error)
    if (error.code === '23505') {
      return { error: '이미 사용 중인 슬러그입니다. 다른 값을 사용해 주세요.' }
    }
    return { error: '전시 생성에 실패했습니다. 다시 시도해 주세요.' }
  }

  redirect(`/dashboard/exhibitions/${data!.id}`)
}

export async function updateExhibition(
  formData: FormData
): Promise<ExhibitionState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const id = (formData.get('id') as string).trim()
    const title = (formData.get('title') as string).trim()
    const description = (formData.get('description') as string | null)?.trim() || null
    const starts_at = (formData.get('starts_at') as string) || null
    const ends_at = (formData.get('ends_at') as string) || null
    const status = formData.get('status') as 'draft' | 'active' | 'closed'

    console.log('[updateExhibition] start', { id, title, status })

    if (!title) return { error: '전시 제목을 입력해 주세요.' }
    if (!['draft', 'active', 'closed'].includes(status)) return { error: '올바르지 않은 상태입니다.' }

    const { data: ex } = await supabase
      .from('exhibitions')
      .select('id, cover_images')
      .eq('id', id)
      .eq('organizer_id', user.id)
      .single()

    if (!ex) return { error: '전시를 찾을 수 없습니다.' }

    const removePaths = formData.getAll('remove_cover') as string[]
    if (removePaths.length > 0) {
      const { error: removeErr } = await supabase.storage.from('covers').remove(removePaths)
      if (removeErr) console.error('[updateExhibition] storage remove error:', removeErr)
    }

    const newPaths = formData.getAll('new_cover_path') as string[]
    console.log('[updateExhibition] newPaths:', newPaths)

    const currentPaths = (ex.cover_images as string[] | null) ?? []
    const finalPaths = [
      ...currentPaths.filter((p) => !removePaths.includes(p)),
      ...newPaths,
    ]

    console.log('[updateExhibition] finalPaths:', finalPaths)

    const { error } = await supabase
      .from('exhibitions')
      .update({ title, description, starts_at, ends_at, status, cover_images: finalPaths })
      .eq('id', id)
      .eq('organizer_id', user.id)

    if (error) {
      console.error('[updateExhibition] db update error:', error)
      return { error: '수정에 실패했습니다. 다시 시도해 주세요.' }
    }

    redirect(`/dashboard/exhibitions/${id}`)
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err
    console.error('[updateExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.' }
  }
}
