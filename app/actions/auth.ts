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
  const rawRedirect = (formData.get('redirectTo') as string)?.trim()
  // 오픈 리다이렉트 방지: 반드시 / 로 시작하는 상대 경로만 허용
  const redirectTo = rawRedirect?.startsWith('/') ? rawRedirect : '/dashboard'

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
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
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

  redirect(redirectTo)
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (!error) redirect('/dashboard')

  // 이메일 미인증 상태
  if (error.code === 'email_not_confirmed') {
    return { error: '이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해 주세요.' }
  }

  // invalid_credentials: Supabase는 이메일 미존재·비밀번호 오류를 동일 코드로 반환한다.
  // profiles 테이블 조회로 이메일 존재 여부를 확인해 메시지를 분기한다.
  if (error.code === 'invalid_credentials') {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)

    if (count === 0) {
      return { error: '존재하지 않는 계정입니다.' }
    }
    return { error: '비밀번호가 올바르지 않습니다.' }
  }

  return { error: '로그인에 실패했습니다. 다시 시도해 주세요.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
