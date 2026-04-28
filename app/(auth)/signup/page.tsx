import type { Metadata } from 'next'
import { SignupForm } from './SignupForm'

export const metadata: Metadata = { title: '회원가입 — Openwall' }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; uploadId?: string }>
}) {
  const { redirect: redirectTo } = await searchParams
  return <SignupForm redirectTo={redirectTo} />
}
