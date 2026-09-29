'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

export type ExhibitionState = { error?: string }

// 커버 파일 삭제 — 호출 전에 organizer_id 검증을 끝낸 경로만 넘길 것.
// 사용자 client로 remove()하면 RLS에 막혀도 { data: [], error: null }로 조용히 실패하므로 admin client로 지우고,
// 실제 삭제된 개수까지 확인해 로그를 남긴다.
async function removeCoverFiles(paths: string[], context: string) {
  if (paths.length === 0) return
  const { data, error } = await createAdminClient().storage.from('covers').remove(paths)
  if (error) {
    console.error(`[${context}] covers remove error:`, error, paths)
    return
  }
  const removed = new Set((data ?? []).map((o) => o.name))
  const missing = paths.filter((p) => !removed.has(p))
  if (missing.length > 0) {
    console.error(`[${context}] covers not removed (${missing.length}/${paths.length}):`, missing)
  }
}

// 커버 경로는 반드시 본인 폴더의 파일({userId}/{파일명})이어야 한다.
// 남의 경로를 cover_images에 넣은 뒤 전시를 삭제해 admin client로 남의 파일을 지우는 것을 막는다.
function isOwnCoverPath(path: string, userId: string) {
  const [folder, name, ...rest] = path.split('/')
  return folder === userId && !!name && rest.length === 0 && name !== '.' && name !== '..'
}

function ownCoverPaths(formData: FormData, key: string, userId: string) {
  return (formData.getAll(key) as string[]).filter((p) => isOwnCoverPath(p, userId))
}

/**
 * 저장 전에 업로드했다가 저장이 실패한 커버를 되돌린다.
 * admin client로 지우기 전에 (1) 현재 사용자 폴더의 파일이고 (2) 어떤 전시의 cover_images에도 없는지 확인한다.
 */
export async function discardCoverUploads(paths: string[]): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const candidates = [...new Set(paths)].filter((p) => isOwnCoverPath(p, user.id))
  if (candidates.length === 0) return

  const { data: referencing, error } = await createAdminClient()
    .from('exhibitions')
    .select('cover_images')
    .overlaps('cover_images', candidates)
  if (error) {
    console.error('[discardCoverUploads] reference check error:', error)
    return // 확인 못 하면 지우지 않는다
  }

  const referenced = new Set((referencing ?? []).flatMap((e) => (e.cover_images as string[] | null) ?? []))
  await removeCoverFiles(candidates.filter((p) => !referenced.has(p)), 'discardCoverUploads')
}

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
  const cover_images = ownCoverPaths(formData, 'cover_path', user.id)

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
  const cover_images = ownCoverPaths(formData, 'cover_path', user.id)

  const slug = `temp-${user.id.slice(0, 8)}-${Date.now().toString(36)}`

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
  let updatedId: string | undefined

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

    const currentPaths = (ex.cover_images as string[] | null) ?? []
    // 클라이언트가 보낸 값 중 이 전시에 실제로 연결된 커버만 삭제 대상으로 인정
    const removePaths = (formData.getAll('remove_cover') as string[]).filter((p) => currentPaths.includes(p))
    const newPaths = ownCoverPaths(formData, 'new_cover_path', user.id)
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

    // DB 반영이 성공한 뒤에 파일 삭제 — 실패 시 DB가 없는 파일을 가리키지 않도록
    await removeCoverFiles(removePaths, 'updateExhibition')

    updatedId = id
  } catch (err: unknown) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error('[updateExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.' }
  }

  revalidatePath(`/dashboard/exhibitions/${updatedId}`)
  revalidatePath('/my')
  redirect(`/dashboard/exhibitions/${updatedId}`)
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

    const { data: deleted, error: dbError } = await supabase
      .from('exhibitions')
      .delete()
      .eq('id', exhibitionId)
      .eq('organizer_id', user.id)
      .select('id')
    if (dbError || !deleted?.length) {
      console.error('[deleteExhibition] db error:', dbError ?? 'no rows deleted')
      return { error: '삭제에 실패했습니다.' }
    }

    // 전시 row 삭제가 확인된 뒤 커버 파일 정리 (organizer_id 검증은 위 select/delete에서 완료)
    await removeCoverFiles(coverPaths, 'deleteExhibition')

    revalidatePath('/my')
    redirect('/my')
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err
    console.error('[deleteExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다.' }
  }
}
