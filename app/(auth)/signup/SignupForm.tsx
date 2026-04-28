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
        <div className="rounded border border-neutral-200 bg-neutral-50 px-6 py-8">
          <p className="text-sm font-medium text-neutral-700">{state.message}</p>
          <p className="mt-2 text-xs text-neutral-400">
            스팸 폴더도 확인해 주세요.
          </p>
        </div>
        <Link
          href="/login"
          className="block text-sm text-neutral-400 underline underline-offset-2 hover:text-neutral-900"
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
          className="block text-xs font-medium uppercase tracking-widest text-neutral-400"
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
          className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block text-xs font-medium uppercase tracking-widest text-neutral-400"
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
          className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block text-xs font-medium uppercase tracking-widest text-neutral-400"
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
          className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
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
        className="w-full bg-neutral-900 py-3 text-sm font-medium tracking-wide text-white transition-colors hover:bg-black disabled:opacity-40"
      >
        {pending ? '가입 중…' : '시작하기'}
      </button>

      <p className="text-center text-sm text-neutral-400">
        이미 계정이 있으신가요?{' '}
        <Link
          href="/login"
          className="text-neutral-900 underline underline-offset-2 hover:text-black"
        >
          로그인
        </Link>
      </p>
    </form>
  )
}
