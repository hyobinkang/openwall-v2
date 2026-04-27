'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export type AuthState = { error?: string; message?: string }

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    return { error: '모든 항목을 입력해 주세요.' }
  }
  if (password.length < 6) {
    return { error: '비밀번호는 6자 이상이어야 합니다.' }
  }

  const headersList = await headers()
  const origin = headersList.get('origin') ?? `http://${headersList.get('host')}`

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: '이미 가입된 이메일입니다.' }
    }
    return { error: error.message }
  }

  // 이메일 인증 필요한 경우 (Supabase 설정에 따라)
  if (data.user && !data.session) {
    return { message: '가입 확인 이메일을 발송했습니다. 이메일을 확인해 주세요.' }
  }

  redirect('/dashboard')
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
