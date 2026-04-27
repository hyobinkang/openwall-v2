'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type ExhibitionState = { error?: string }

export async function createExhibition(
  _: ExhibitionState,
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

  if (!title) return { error: '전시 제목을 입력해 주세요.' }
  if (!slug) return { error: '슬러그를 입력해 주세요.' }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: '슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.' }
  }

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
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 사용 중인 슬러그입니다. 다른 값을 사용해 주세요.' }
    }
    return { error: '전시 생성에 실패했습니다. 다시 시도해 주세요.' }
  }

  redirect(`/dashboard/exhibitions/${data!.id}`)
}
