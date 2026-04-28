'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import type { AuthState } from '@/app/actions/auth'

const initial: AuthState = {}

export function SignupForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(signup, initial)

  if (state?.message) {
    return (
      <div className="space-y-6 text-center">
        <div className="rounded border border-subtle bg-surface px-6 py-8">
          <p className="text-sm font-medium text-fg">{state.message}</p>
          <p className="mt-2 text-xs text-secondary">
            스팸 폴더도 확인해 주세요.
          </p>
        </div>
        <Link
          href="/login"
          className="block text-sm text-secondary underline underline-offset-2 hover:text-fg"
        >
          로그인 페이지로 이동
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}
      <div className="space-y-1">
        <label
          htmlFor="name"
          className="block text-xs font-medium uppercase tracking-widest text-secondary"
        >
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="홍길동"
          className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
        />
      </div>

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
          autoComplete="new-password"
          placeholder="6자 이상"
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
        {pending ? '가입 중…' : '시작하기'}
      </button>

      <p className="text-center text-sm text-secondary">
        이미 계정이 있으신가요?{' '}
        <Link
          href="/login"
          className="text-fg underline underline-offset-2 hover:text-fg"
        >
          로그인
        </Link>
      </p>
    </form>
  )
}
