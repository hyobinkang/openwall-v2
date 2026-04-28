'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createExhibition } from '@/app/actions/exhibitions'
import type { ExhibitionState } from '@/app/actions/exhibitions'

const initial: ExhibitionState = {}

function toSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')   // 한글 등 비ASCII 제거
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)

  // 영문이 없는 경우(한글 전용 제목) 타임스탬프 기반 코드 사용
  return ascii || `ex-${Date.now().toString(36)}`
}

function isValidSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0
}

export function CreateExhibitionForm() {
  const [state, formAction, pending] = useActionState(createExhibition, initial)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) {
      setSlug(toSlug(e.target.value))
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true)
    setSlug(e.target.value)
  }

  const slugValid = isValidSlug(slug)

  return (
    <form action={formAction} className="space-y-6">
      {/* 제목 */}
      <div className="space-y-1.5">
        <label
          htmlFor="title"
          className="block text-xs font-medium uppercase tracking-widest text-gray-400"
        >
          전시 제목 <span className="text-red-400">*</span>
        </label>
        <input
          ref={titleRef}
          id="title"
          name="title"
          type="text"
          required
          placeholder="예: 빛과 그림자 — 2024"
          onChange={handleTitleChange}
          className="w-full border border-white bg-black px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-white focus:outline-none transition-colors"
        />
      </div>

      {/* 슬러그 */}
      <div className="space-y-1.5">
        <label
          htmlFor="slug"
          className="block text-xs font-medium uppercase tracking-widest text-gray-400"
        >
          슬러그 <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-0">
          <span className="border border-r-0 border-white bg-black px-3 py-2.5 text-sm text-gray-400 whitespace-nowrap select-none">
            /e/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            value={slug}
            onChange={handleSlugChange}
            placeholder="light-and-shadow"
            className={`flex-1 border bg-black text-white px-3 py-2.5 text-sm font-mono placeholder:text-gray-500 focus:outline-none transition-colors ${
              slug && !slugValid
                ? 'border-red-500 focus:border-red-400'
                : 'border-white focus:border-white'
            }`}
          />
        </div>
        <p className="text-xs text-gray-500">
          영문 소문자, 숫자, 하이픈만 사용 가능. QR 코드 URL에 쓰입니다.
          {slug && !slugValid && (
            <span className="text-red-400 ml-2">올바르지 않은 형식입니다.</span>
          )}
        </p>
      </div>

      {/* 설명 */}
      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="block text-xs font-medium uppercase tracking-widest text-gray-400"
        >
          전시 설명 <span className="text-gray-600">(선택)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="전시에 대한 간단한 설명을 입력하세요."
          className="w-full border border-white bg-black px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-white focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* 기간 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="starts_at"
            className="block text-xs font-medium uppercase tracking-widest text-gray-400"
          >
            시작일 <span className="text-gray-600">(선택)</span>
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="date"
            className="w-full border border-white bg-black px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="ends_at"
            className="block text-xs font-medium uppercase tracking-widest text-gray-400"
          >
            종료일 <span className="text-gray-600">(선택)</span>
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="date"
            className="w-full border border-white bg-black px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-500">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (slug.length > 0 && !slugValid)}
        className="w-full bg-white py-3 text-sm font-medium tracking-wide text-black transition-colors hover:bg-gray-100 disabled:opacity-40"
      >
        {pending ? '생성 중…' : '전시 생성하기'}
      </button>
    </form>
  )
}
