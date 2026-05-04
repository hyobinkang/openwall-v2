'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

export type ExhibitionState = { error?: string }

function toSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
  return ascii || 'exhibition'
}

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

export async function saveDraft(
  formData: FormData
): Promise<ExhibitionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = (formData.get('title') as string)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const starts_at = (formData.get('starts_at') as string) || null
  const ends_at = (formData.get('ends_at') as string) || null
  const cover_images = formData.getAll('cover_path') as string[]

  const slug = title ? toSlug(title) : `draft-${Date.now().toString(36)}`

  const { data, error } = await supabase
    .from('exhibitions')
    .insert({
      organizer_id: user.id,
      title,
      description,
      slug,
      starts_at,
      ends_at,
      status: 'draft',
      cover_images,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[saveDraft] insert error:', error)
    return { error: '임시저장에 실패했습니다. 다시 시도해 주세요.' }
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

    if (!title) return { error: '전시 제목을 입력해 주세요.' }
    if (!['draft', 'active', 'closed'].includes(status)) return { error: '올바르지 않은 상태입니다.' }

    const { data: ex } = await supabase
      .from('exhibitions')
      .select('id, cover_images, status, slug')
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
    const currentPaths = (ex.cover_images as string[] | null) ?? []
    const finalPaths = [
      ...currentPaths.filter((p) => !removePaths.includes(p)),
      ...newPaths,
    ]

    let newSlug: string | undefined
    if (ex.status === 'draft' && status === 'active') {
      const rawSlug = (formData.get('slug') as string)?.trim().toLowerCase()
      if (!rawSlug || !/^[a-z0-9-]+$/.test(rawSlug)) {
        return { error: '슬러그를 올바르게 입력해 주세요.' }
      }
      if (rawSlug !== ex.slug) {
        const { data: conflict } = await supabase
          .from('exhibitions')
          .select('id')
          .eq('slug', rawSlug)
          .neq('id', id)
          .maybeSingle()
        if (conflict) return { error: '이미 사용 중인 슬러그입니다. 다른 값을 사용해 주세요.' }
      }
      newSlug = rawSlug
    }

    const { error } = await supabase
      .from('exhibitions')
      .update({
        title,
        description,
        starts_at,
        ends_at,
        status,
        cover_images: finalPaths,
        ...(newSlug !== undefined ? { slug: newSlug } : {}),
      })
      .eq('id', id)
      .eq('organizer_id', user.id)

    if (error) {
      console.error('[updateExhibition] db update error:', error)
      if (error.code === '23505') {
        return { error: '이미 사용 중인 슬러그입니다. 다른 값을 사용해 주세요.' }
      }
      return { error: '수정에 실패했습니다. 다시 시도해 주세요.' }
    }

    redirect(`/dashboard/exhibitions/${id}`)
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err
    console.error('[updateExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.' }
  }
}

export async function closeExhibition(exhibitionId: string): Promise<ExhibitionState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('exhibitions')
      .update({ status: 'closed' })
      .eq('id', exhibitionId)
      .eq('organizer_id', user.id)

    if (error) {
      console.error('[closeExhibition] db error:', error)
      return { error: '종료에 실패했습니다.' }
    }

    revalidatePath(`/dashboard/exhibitions/${exhibitionId}`)
    revalidatePath('/my')
    return {}
  } catch (err: unknown) {
    console.error('[closeExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다.' }
  }
}

export async function deleteExhibition(exhibitionId: string): Promise<ExhibitionState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const { data: ex } = await supabase
      .from('exhibitions')
      .select('id, cover_images')
      .eq('id', exhibitionId)
      .eq('organizer_id', user.id)
      .single()
    if (!ex) return { error: '전시를 찾을 수 없습니다.' }

    const { count: uploadCount } = await supabase
      .from('uploads')
      .select('*', { count: 'exact', head: true })
      .eq('exhibition_id', exhibitionId)
    if (uploadCount && uploadCount > 0) {
      return { error: '관람객 기록이 있는 전시는 삭제할 수 없습니다.' }
    }

    const coverPaths = (ex.cover_images as string[] | null) ?? []
    if (coverPaths.length > 0) {
      await supabase.storage.from('covers').remove(coverPaths)
    }

    const { error: dbError } = await supabase
      .from('exhibitions')
      .delete()
      .eq('id', exhibitionId)
      .eq('organizer_id', user.id)
    if (dbError) {
      console.error('[deleteExhibition] db error:', dbError)
      return { error: '삭제에 실패했습니다.' }
    }

    revalidatePath('/my')
    redirect('/my')
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err
    console.error('[deleteExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다.' }
  }
}
