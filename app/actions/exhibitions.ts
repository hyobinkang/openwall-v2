'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type ExhibitionState = { error?: string }

const MAX_COVER_MB = 10

async function uploadCoverFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = []
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue
    if (!file.type.startsWith('image/')) continue
    if (file.size > MAX_COVER_MB * 1024 * 1024) continue
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    console.log('[uploadCoverFiles] uploading:', { path, type: file.type, size: file.size })
    const bytes = await file.arrayBuffer()
    const { error } = await supabase.storage
      .from('covers')
      .upload(path, bytes, { contentType: file.type })
    if (error) {
      console.error('[uploadCoverFiles] storage upload error:', error)
    } else {
      paths.push(path)
    }
  }
  return paths
}

export async function createExhibition(
  formData: FormData
): Promise<ExhibitionState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const title = (formData.get('title') as string).trim()
    const description = (formData.get('description') as string | null)?.trim() || null
    const slug = (formData.get('slug') as string).trim().toLowerCase()
    const starts_at = (formData.get('starts_at') as string) || null
    const ends_at = (formData.get('ends_at') as string) || null

    if (!title) return { error: '전시 제목을 입력해 주세요.' }
    if (!slug) return { error: '슬러그를 입력해 주세요.' }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { error: '슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.' }
    }

    const coverFiles = formData.getAll('covers') as File[]
    console.log('[createExhibition] cover files received:', coverFiles.length, coverFiles.map(f => ({ name: (f as File).name, size: (f as File).size, type: (f as File).type })))

    const cover_images = await uploadCoverFiles(supabase, user!.id, coverFiles)
    console.log('[createExhibition] cover_images paths:', cover_images)

    const { data, error } = await supabase
      .from('exhibitions')
      .insert({
        organizer_id: user!.id,
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
  } catch (err: unknown) {
    // redirect()는 내부적으로 throw하므로 재throw
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[createExhibition] unexpected error:', err)
    return { error: '알 수 없는 오류가 발생했습니다.' }
  }
}

export async function updateExhibition(
  formData: FormData
): Promise<ExhibitionState> {
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
    .select('id, cover_images')
    .eq('id', id)
    .eq('organizer_id', user.id)
    .single()

  if (!ex) return { error: '전시를 찾을 수 없습니다.' }

  const removePaths = formData.getAll('remove_cover') as string[]
  if (removePaths.length > 0) {
    await supabase.storage.from('covers').remove(removePaths)
  }

  const coverFiles = formData.getAll('covers') as File[]
  const newPaths = await uploadCoverFiles(supabase, user.id, coverFiles)

  const currentPaths = (ex.cover_images as string[] | null) ?? []
  const finalPaths = [
    ...currentPaths.filter((p) => !removePaths.includes(p)),
    ...newPaths,
  ]

  const { error } = await supabase
    .from('exhibitions')
    .update({ title, description, starts_at, ends_at, status, cover_images: finalPaths })
    .eq('id', id)
    .eq('organizer_id', user.id)

  if (error) return { error: '수정에 실패했습니다. 다시 시도해 주세요.' }

  redirect(`/dashboard/exhibitions/${id}`)
}
