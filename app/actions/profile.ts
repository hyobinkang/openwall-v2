'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfileName(name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('profiles')
    .update({ name: name.trim() || null })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/my')
  return {}
}
