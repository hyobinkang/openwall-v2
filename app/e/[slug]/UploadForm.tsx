'use client'

import { useActionState, useEffect, useMemo, useState, useRef, startTransition } from 'react'
import imageCompression from 'browser-image-compression'
import { submitUpload } from '@/app/actions/uploads'
import { createClient } from '@/lib/supabase/client'
import type { UploadState, PendingUpload } from '@/app/actions/uploads'

const MAX_MB = 10
// Vercel Functions 요청 본문 한도(4.5MB)보다 작게 — 서버 액션으로 보내는 최종 파일 크기 상한
const MAX_SEND_BYTES = 4 * 1024 * 1024

// 방문자 사진은 서버 액션을 거치므로 전송 전에 브라우저에서 압축한다.
// GIF는 압축하면 첫 프레임만 남으므로 원본을 보낸다. 압축 실패(예: Chrome의 HEIC) 시에도 한도 이내면 원본 전송.
async function preparePhoto(file: File): Promise<File> {
  if (file.type !== 'image/gif') {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      })
      if (compressed.size <= MAX_SEND_BYTES) return new File([compressed], file.name, { type: compressed.type })
    } catch (err) {
      console.error('[UploadForm] photo compression error:', err)
    }
  }
  if (file.size <= MAX_SEND_BYTES) return file
  throw new Error('PHOTO_TOO_LARGE')
}

function GoogleSignInButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/my` },
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center justify-center gap-3 w-full border border-subtle px-4 py-3 text-sm font-medium text-fg hover:border-fg transition-colors disabled:opacity-50"
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

type SavedData = {
  uploadId: string
  editToken: string | null
  isLoggedIn: boolean
  storagePath: string | null
  textContent: string | null
  guestName: string | null
  photoPublicUrl: string | null
}

function SuccessView({
  isLoggedIn,
  uploadId,
  editToken,
  slug,
  onEditAgain,
}: {
  isLoggedIn: boolean
  uploadId?: string
  editToken: string | null
  slug: string
  onEditAgain: () => void
}) {
  // 비회원 업로드 id + 수정 토큰을 sessionStorage에 저장 → /my에서 귀속 처리
  useEffect(() => {
    if (isLoggedIn || !uploadId || !editToken) return
    try {
      const raw: unknown = JSON.parse(sessionStorage.getItem('pendingUploads') ?? '[]')
      // 토큰 없는 예전 형식(string[]) 항목은 어차피 귀속 불가라 버린다
      const prev = (Array.isArray(raw) ? raw : []).filter(
        (p): p is PendingUpload => typeof p?.id === 'string' && typeof p?.token === 'string'
      )
      const next = prev.some((p) => p.id === uploadId) ? prev : [...prev, { id: uploadId, token: editToken }]
      sessionStorage.setItem('pendingUploads', JSON.stringify(next))
    } catch (e) {
      console.error('[UploadForm] sessionStorage 저장 실패:', e)
    }
  }, [isLoggedIn, uploadId, editToken])

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-fg text-bg text-xl mb-4">
          ✓
        </div>
        <h2 className="text-lg font-bold">업로드 완료!</h2>
        <p className="mt-1 text-sm text-secondary">
          {isLoggedIn
            ? '내 아카이브에도 자동으로 저장되었습니다.'
            : '이 업로드는 비회원으로 기록되었습니다.'}
        </p>
      </div>

      {isLoggedIn ? (
        <a
          href="/my"
          className="flex items-center justify-center w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg hover:bg-gray6 transition-colors"
        >
          내 아카이브에서 확인하기
        </a>
      ) : (
        <div className="border border-subtle bg-surface px-5 py-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-fg">
              내 아카이브에 저장하려면 로그인하세요
            </p>
            <p className="mt-1 text-xs text-secondary leading-relaxed">
              가입하면 방문한 전시의 기록이 쌓입니다.
            </p>
          </div>
          <GoogleSignInButton />
          <a
            href={`/signup?redirect=/my${uploadId ? `&uploadId=${uploadId}` : ''}`}
            className="flex items-center justify-center w-full border border-subtle px-4 py-3 text-sm font-medium text-fg hover:border-fg transition-colors"
          >
            이메일로 회원가입
          </a>
        </div>
      )}

      <a
        href={`/e/${slug}/gallery`}
        className="flex items-center justify-center w-full border border-subtle py-3 text-sm font-medium text-fg hover:border-fg transition-colors"
      >
        다른 사람들 리뷰도 보기
      </a>

      <button
        onClick={onEditAgain}
        className="w-full border border-subtle py-3 text-sm text-secondary hover:border-fg hover:text-fg transition-colors"
      >
        다시 업로드하기
      </button>
    </div>
  )
}

type NameMode = 'member' | 'anonymous' | 'nickname'

export function UploadForm({
  exhibitionId,
  isLoggedIn,
  userName,
  slug,
}: {
  exhibitionId: string
  isLoggedIn: boolean
  userName?: string | null
  slug: string
}) {
  const boundAction = useMemo(
    () => submitUpload.bind(null, exhibitionId, slug),
    [exhibitionId, slug]
  )
  const [state, formAction, pending] = useActionState<UploadState, FormData>(
    boundAction,
    {}
  )

  const [showSuccess, setShowSuccess] = useState(false)
  const [savedData, setSavedData] = useState<SavedData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editFormKey, setEditFormKey] = useState(0)

  const [preview, setPreview] = useState<string | null>(null)
  const [existingStoragePath, setExistingStoragePath] = useState<string | null>(null)
  const [hasText, setHasText] = useState(false)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [nameMode, setNameMode] = useState<NameMode>('member')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    console.log('[UploadForm] isLoggedIn:', isLoggedIn, '| userName:', userName)
  }, [isLoggedIn, userName])

  // nonce가 바뀔 때마다 새 성공 발생 (INSERT or UPDATE)
  useEffect(() => {
    if (!state.nonce) return
    setSavedData({
      uploadId: state.uploadId ?? '',
      editToken: state.editToken ?? null,
      isLoggedIn: state.isLoggedIn ?? isLoggedIn,
      storagePath: state.storagePath ?? null,
      textContent: state.textContent ?? null,
      guestName: state.guestName ?? null,
      photoPublicUrl: state.photoPublicUrl ?? null,
    })
    setShowSuccess(true)
    setIsEditing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce])

  // 편집 모드 진입 시 폼 초기화
  useEffect(() => {
    if (!isEditing || !savedData) return
    setPreview(savedData.photoPublicUrl)
    setHasPhoto(!!savedData.photoPublicUrl)
    setExistingStoragePath(savedData.storagePath)
    setHasText(!!savedData.textContent)
    setClientError(null)
    setEditFormKey((k) => k + 1)
    if (isLoggedIn) {
      if (savedData.guestName === null) {
        setNameMode('anonymous')
      } else if (savedData.guestName === (userName ?? '')) {
        setNameMode('member')
      } else {
        setNameMode('nickname')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  if (showSuccess && savedData) {
    return (
      <SuccessView
        isLoggedIn={savedData.isLoggedIn}
        uploadId={savedData.uploadId}
        editToken={savedData.editToken}
        slug={slug}
        onEditAgain={() => {
          setShowSuccess(false)
          setIsEditing(true)
        }}
      />
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null)
    const file = e.target.files?.[0]
    if (!file) { setHasPhoto(false); setPreview(null); setExistingStoragePath(null); return }

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
    setExistingStoragePath(null)
  }

  function removePhoto() {
    setPreview(null)
    setHasPhoto(false)
    setExistingStoragePath(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const error = clientError ?? state.error

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!hasPhoto && !hasText) {
      setClientError('사진 또는 텍스트 중 하나는 입력해야 합니다.')
      return
    }
    setClientError(null)

    const fd = new FormData(e.currentTarget)
    const photo = fd.get('photo')
    if (photo instanceof File && photo.size > 0) {
      setCompressing(true)
      try {
        fd.set('photo', await preparePhoto(photo))
      } catch {
        setClientError('사진을 처리할 수 없습니다. JPG 또는 PNG 사진으로 다시 시도해 주세요.')
        return
      } finally {
        setCompressing(false)
      }
    }
    startTransition(() => formAction(fd))
  }

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit}
    >
      {/* 편집 모드 hidden fields */}
      {isEditing && savedData && (
        <>
          <input type="hidden" name="upload_id" value={savedData.uploadId} />
          {savedData.editToken && (
            <input type="hidden" name="edit_token" value={savedData.editToken} />
          )}
          {existingStoragePath && (
            <input type="hidden" name="existing_storage_path" value={existingStoragePath} />
          )}
        </>
      )}

      {/* 사진 업로드 */}
      <div className="space-y-1.5">
        <label
          htmlFor="photo-file-input"
          className="block text-xs font-medium uppercase tracking-widest text-secondary"
        >
          사진 <span className="text-muted">(선택)</span>
        </label>

        {/*
          파일 입력을 항상 DOM에 유지. preview가 보일 때 조건부로 숨기면
          form submit 시 파일 데이터가 formData에 포함되지 않아 서버에서 누락됨.
        */}
        <input
          ref={fileInputRef}
          id="photo-file-input"
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
              className="w-full max-h-72 object-cover border border-subtle"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute top-2 right-2 bg-bg/60 text-fg text-xs px-2 py-1 hover:bg-bg transition-colors"
            >
              제거
            </button>
          </div>
        ) : (
          <label
            htmlFor="photo-file-input"
            className="block cursor-pointer group"
          >
            <div className="border-2 border-dashed border-subtle group-hover:border-fg transition-colors flex flex-col items-center justify-center py-10 gap-2">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted group-hover:text-secondary transition-colors" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm text-secondary group-hover:text-fg transition-colors">
                사진 추가
              </span>
              <span className="text-xs text-muted">최대 {MAX_MB}MB</span>
            </div>
          </label>
        )}
      </div>

      {/* 텍스트 입력 */}
      <div className="space-y-1.5">
        <label
          htmlFor="text_content"
          className="block text-xs font-medium uppercase tracking-widest text-secondary"
        >
          텍스트 <span className="text-muted">(선택)</span>
        </label>
        <textarea
          key={`text-${editFormKey}`}
          id="text_content"
          name="text_content"
          rows={4}
          defaultValue={isEditing ? (savedData?.textContent ?? '') : ''}
          placeholder="전시에 남길 글을 자유롭게 써주세요."
          onChange={(e) => setHasText(e.target.value.trim().length > 0)}
          className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* 이름 */}
      <div className="space-y-2.5">
        <span className="block text-xs font-medium uppercase tracking-widest text-secondary">
          {isLoggedIn ? '이름' : '닉네임'} <span className="text-muted">(선택)</span>
        </span>

        {isLoggedIn ? (
          <>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  { value: 'member', label: '회원명' },
                  { value: 'anonymous', label: '익명으로 남기기' },
                  { value: 'nickname', label: '닉네임으로 남기기' },
                ] as { value: NameMode; label: string }[]
              ).map(({ value, label }) => (
                <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="_name_mode"
                    value={value}
                    checked={nameMode === value}
                    onChange={() => setNameMode(value)}
                    className="accent-white"
                  />
                  <span className="text-sm text-fg">{label}</span>
                </label>
              ))}
            </div>

            {nameMode === 'member' && (
              <>
                <input type="hidden" name="guest_name" value={userName ?? ''} />
                <p className="text-sm text-secondary border border-subtle bg-surface px-3 py-2.5">
                  {userName ?? '(이름 없음)'}
                </p>
              </>
            )}

            {nameMode === 'nickname' && (
              <input
                key={`nick-${editFormKey}`}
                name="guest_name"
                type="text"
                defaultValue={isEditing ? (savedData?.guestName ?? '') : ''}
                placeholder="닉네임을 입력하세요"
                className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
              />
            )}

            {/* 익명: "익명" 문자열로 저장 (null은 비로그인 미입력 구분용) */}
            {nameMode === 'anonymous' && (
              <input type="hidden" name="guest_name" value="익명" />
            )}
          </>
        ) : (
          <input
            key={`guestname-${editFormKey}`}
            name="guest_name"
            type="text"
            defaultValue={isEditing ? (savedData?.guestName ?? '') : ''}
            placeholder="닉네임을 입력하세요 (미입력 시 익명으로 표시)"
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || compressing}
        className="w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg hover:bg-gray6 transition-colors disabled:opacity-40"
      >
        {compressing
          ? '사진 처리 중…'
          : pending ? (isEditing ? '수정 중…' : '업로드 중…') : (isEditing ? '수정하기' : '업로드하기')}
      </button>
    </form>
  )
}
