import type { Metadata } from 'next'
import Link from 'next/link'
import { CreateExhibitionForm } from './CreateExhibitionForm'

export const metadata: Metadata = { title: '새 전시 만들기 — Openwall' }

export default function NewExhibitionPage() {
  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <Link
          href="/my"
          className="text-xs text-secondary hover:text-fg transition-colors"
        >
          ← 내 페이지로
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">새 전시 만들기</h1>
        <p className="mt-1 text-sm text-secondary">
          전시를 생성하면 QR 코드가 발급됩니다. 관람객은 QR을 스캔해 사진·텍스트를 업로드할 수 있습니다.
        </p>
      </div>

      <div className="bg-surface border border-subtle p-6">
        <CreateExhibitionForm />
      </div>
    </div>
  )
}
