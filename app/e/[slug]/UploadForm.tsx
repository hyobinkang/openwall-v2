'use client'

import { useActionState, useMemo, useState, useRef } from 'react'
import { submitUpload } from '@/app/actions/uploads'
import { createClient } from '@/lib/supabase/client'
import type { UploadState } from '@/app/actions/uploads'

type UploadType = 'photo' | 'text'

const MAX_MB = 10

// ─── Google 로그인 버튼 ────────────────────────────────────
function GoogleSignInButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // 리다이렉트되므로 setLoading(false)는 도달하지 않음
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center justify-center gap-3 w-full border border-neutral-300 px-4 py-3 text-sm font-medium hover:border-neutral-900 transition-colors disabled:opacity-50"
    >
      {/* Google 'G' 아이콘 (SVG inline) */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {loading ? '연결 중…' : 'Google로 계속하기'}
    </button>
  )
}

// ─── 성공 화면 ─────────────────────────────────────────────
function SuccessView({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-900 text-white text-xl mb-4">
          ✓
        </div>
        <h2 className="text-lg font-bold">업로드 완료!</h2>
        {isLoggedIn ? (
          <p className="mt-1 text-sm text-neutral-500">
            내 아카이브에도 자동으로 저장되었습니다.
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            이 업로드는 비회원으로 기록되었습니다.
          </p>
        )}
      </div>

      {!isLoggedIn && (
        <div className="border border-neutral-200 px-5 py-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              내 아카이브에 자동 저장하고 싶으신가요?
            </p>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
              회원으로 업로드하면 이 전시의 기록이 내 아카이브에 쌓입니다.
              가입은 Google 계정으로 5초면 완료됩니다.
            </p>
          </div>
          <GoogleSignInButton />
        </div>
      )}

      <button
        onClick={() => window.location.reload()}
        className="w-full border border-neutral-200 py-3 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
      >
        다시 업로드하기
      </button>
    </div>
  )
}

// ─── 업로드 폼 ─────────────────────────────────────────────
export function UploadForm({
  exhibitionId,
  isLoggedIn,
}: {
  exhibitionId: string
  isLoggedIn: boolean
}) {
  const boundAction = useMemo(
    () => submitUpload.bind(null, exhibitionId),
    [exhibitionId]
  )
  const [state, formAction, pending] = useActionState<UploadState, FormData>(
    boundAction,
    {}
  )

  const [uploadType, setUploadType] = useState<UploadType>('photo')
  const [preview, setPreview] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (state.success) {
    return <SuccessView isLoggedIn={state.isLoggedIn ?? isLoggedIn} />
  }

  function handleTypeChange(type: UploadType) {
    setUploadType(type)
    setPreview(null)
    setClientError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setClientError('이미지 파일만 업로드할 수 있습니다.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setClientError(`파일 크기는 ${MAX_MB}MB 이하여야 합니다.`)
      e.target.value = ''
      return
    }

    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const error = clientError ?? state.error

  return (
    <form action={formAction} className="space-y-6">
      {/* hidden: upload type */}
      <input type="hidden" name="type" value={uploadType} />

      {/* 타입 토글 */}
      <div className="flex border border-neutral-200">
        {(['photo', 'text'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              uploadType === t
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {t === 'photo' ? '사진' : '텍스트'}
          </button>
        ))}
      </div>

      {/* 사진 업로드 영역 */}
      {uploadType === 'photo' && (
        <div className="space-y-3">
          <label className="block cursor-pointer group">
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="미리보기"
                  className="w-full max-h-72 object-cover border border-neutral-200"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-xs text-white bg-black/60 px-3 py-1 transition-opacity">
                    다른 사진 선택
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-neutral-200 group-hover:border-neutral-400 transition-colors flex flex-col items-center justify-center py-14 gap-2">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-neutral-300 group-hover:text-neutral-500 transition-colors"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-sm text-neutral-400 group-hover:text-neutral-600 transition-colors">
                  사진을 선택하거나 드래그하세요
                </span>
                <span className="text-xs text-neutral-300">최대 {MAX_MB}MB</span>
              </div>
            )}
          </label>
        </div>
      )}

      {/* 텍스트 입력 */}
      {uploadType === 'text' && (
        <textarea
          name="text_content"
          rows={6}
          required
          placeholder="전시에 남길 글을 자유롭게 써주세요."
          className="w-full border border-neutral-200 px-3 py-3 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors resize-none"
        />
      )}

      {/* 캡션 */}
      <div className="space-y-1.5">
        <label
          htmlFor="caption"
          className="block text-xs font-medium uppercase tracking-widest text-neutral-400"
        >
          캡션 <span className="text-neutral-300">(선택)</span>
        </label>
        <input
          id="caption"
          name="caption"
          type="text"
          placeholder="짧은 설명을 남겨보세요."
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
        />
      </div>

      {/* 이름 (비회원만) */}
      {!isLoggedIn && (
        <div className="space-y-1.5">
          <label
            htmlFor="guest_name"
            className="block text-xs font-medium uppercase tracking-widest text-neutral-400"
          >
            이름 <span className="text-neutral-300">(선택)</span>
          </label>
          <input
            id="guest_name"
            name="guest_name"
            type="text"
            placeholder="표시될 이름"
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* 에러 */}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-neutral-900 py-3 text-sm font-medium tracking-wide text-white hover:bg-black transition-colors disabled:opacity-40"
      >
        {pending ? '업로드 중…' : '업로드하기'}
      </button>

      {!isLoggedIn && (
        <p className="text-center text-xs text-neutral-400">
          비회원으로도 업로드할 수 있습니다. 내 아카이브에 저장하려면{' '}
          <span className="text-neutral-600 underline underline-offset-2 cursor-pointer">
            로그인
          </span>
          이 필요합니다.
        </p>
      )}
    </form>
  )
}
