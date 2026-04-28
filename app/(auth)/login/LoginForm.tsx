'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import type { AuthState } from '@/app/actions/auth'

const initial: AuthState = {}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/my` },
    })
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-xs font-medium uppercase tracking-widest text-secondary"
          >
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="hello@example.com"
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-xs font-medium uppercase tracking-widest text-secondary"
          >
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
          />
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-500">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg transition-colors hover:bg-gray6 disabled:opacity-40"
        >
          {pending ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-subtle" />
        <span className="text-xs text-muted">또는</span>
        <div className="flex-1 border-t border-subtle" />
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="flex items-center justify-center gap-3 w-full border border-subtle bg-surface py-3 text-sm font-medium text-fg hover:border-fg transition-colors disabled:opacity-50"
      >
        <GoogleIcon />
        {googleLoading ? '연결 중…' : 'Google로 로그인'}
      </button>

      <p className="text-center text-sm text-secondary">
        계정이 없으신가요?{' '}
        <Link
          href="/signup"
          className="text-fg underline underline-offset-2 hover:opacity-70 transition-opacity"
        >
          가입하기
        </Link>
      </p>
    </div>
  )
}
