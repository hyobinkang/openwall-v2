'use client'

import { useActionState, useEffect, useMemo, useState, useRef } from 'react'
import { submitUpload } from '@/app/actions/uploads'
import { createClient } from '@/lib/supabase/client'
import type { UploadState } from '@/app/actions/uploads'

const MAX_MB = 10

function GoogleSignInButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    // 로그인 후 /my 아카이브로 이동
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/my` },
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center justify-center gap-3 w-full border border-neutral-300 px-4 py-3 text-sm font-medium hover:border-neutral-900 transition-colors disabled:opacity-50"
    >
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

function SuccessView({
  isLoggedIn,
  uploadId,
}: {
  isLoggedIn: boolean
  uploadId?: string
}) {
  // 비회원 uploadId를 sessionStorage에 저장 → /my에서 귀속 처리
  useEffect(() => {
    if (isLoggedIn || !uploadId) return
    try {
      const prev: string[] = JSON.parse(sessionStorage.getItem('pendingUploads') ?? '[]')
      if (!prev.includes(uploadId)) {
        sessionStorage.setItem('pendingUploads', JSON.stringify([...prev, uploadId]))
      }
    } catch {}
  }, [isLoggedIn, uploadId])

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-900 text-white text-xl mb-4">
          ✓
        </div>
        <h2 className="text-lg font-bold">업로드 완료!</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {isLoggedIn
            ? '내 아카이브에도 자동으로 저장되었습니다.'
            : '이 업로드는 비회원으로 기록되었습니다.'}
        </p>
      </div>

      {!isLoggedIn && (
        <div className="border border-neutral-200 px-5 py-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              내 아카이브에 자동 저장하고 싶으신가요?
            </p>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
              Google 계정으로 5초 만에 가입하면 방문한 전시의 기록이 쌓입니다.
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

  const [preview, setPreview] = useState<string | null>(null)
  const [hasText, setHasText] = useState(false)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (state.success) {
    return <SuccessView isLoggedIn={state.isLoggedIn ?? isLoggedIn} uploadId={state.uploadId} />
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null)
    const file = e.target.files?.[0]
    if (!file) { setHasPhoto(false); setPreview(null); return }

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
    setHasPhoto(true)
    setPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPreview(null)
    setHasPhoto(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const error = clientError ?? state.error

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={(e) => {
        if (!hasPhoto && !hasText) {
          e.preventDefault()
          setClientError('사진 또는 텍스트 중 하나는 입력해야 합니다.')
        }
      }}
    >
      {/* 사진 업로드 */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-widest text-neutral-400">
          사진 <span className="text-neutral-300">(선택)</span>
        </label>
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="미리보기"
              className="w-full max-h-72 object-cover border border-neutral-200"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 hover:bg-black transition-colors"
            >
              제거
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer group">
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
            <div className="border-2 border-dashed border-neutral-200 group-hover:border-neutral-400 transition-colors flex flex-col items-center justify-center py-10 gap-2">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300 group-hover:text-neutral-500 transition-colors" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm text-neutral-400 group-hover:text-neutral-600 transition-colors">
                사진 추가
              </span>
              <span className="text-xs text-neutral-300">최대 {MAX_MB}MB</span>
            </div>
          </label>
        )}
      </div>

      {/* 텍스트 입력 */}
      <div className="space-y-1.5">
        <label
          htmlFor="text_content"
          className="block text-xs font-medium uppercase tracking-widest text-neutral-400"
        >
          텍스트 <span className="text-neutral-300">(선택)</span>
        </label>
        <textarea
          id="text_content"
          name="text_content"
          rows={4}
          placeholder="전시에 남길 글을 자유롭게 써주세요."
          onChange={(e) => setHasText(e.target.value.trim().length > 0)}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors resize-none"
        />
      </div>

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

      {/* 이름 (비회원) */}
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
    </form>
  )
}
