'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import type { AuthState } from '@/app/actions/auth'

const initial: AuthState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial)

  return (
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

      <p className="text-center text-sm text-secondary">
        계정이 없으신가요?{' '}
        <Link
          href="/signup"
          className="text-fg underline underline-offset-2 hover:text-fg"
        >
          가입하기
        </Link>
      </p>
    </form>
  )
}
