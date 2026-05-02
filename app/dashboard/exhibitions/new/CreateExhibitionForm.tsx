'use client'

import { useTransition, useRef, useState } from 'react'
import Image from 'next/image'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { createExhibition, saveDraft } from '@/app/actions/exhibitions'

const MAX_COVERS = 9

type CoverItem = {
  id: string
  preview: string
  path: string | null
  uploading: boolean
  uploadError: boolean
}

function toSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
  return ascii || `ex-${Date.now().toString(36)}`
}

function isValidSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0
}

async function uploadToStorage(file: File): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  })

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('covers').upload(path, compressed, {
    contentType: compressed.type || file.type,
  })
  if (error) throw error

  return path
}

export function CreateExhibitionForm() {
  const [isPending, startTransition] = useTransition()
  const [isDraftPending, startDraftTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  const [covers, setCovers] = useState<CoverItem[]>([])
  const coverPickerRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const slugValid = isValidSlug(slug)
  const isUploading = covers.some((c) => c.uploading)

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) setSlug(toSlug(e.target.value))
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true)
    setSlug(e.target.value)
  }

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    )
    e.target.value = ''
    if (!files.length) return

    if (covers.length + files.length > MAX_COVERS) {
      setError(`최대 ${MAX_COVERS}장까지 업로드할 수 있습니다.`)
      return
    }

    setError(null)
    const toAdd = files

    const newItems: CoverItem[] = toAdd.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      preview: URL.createObjectURL(f),
      path: null,
      uploading: true,
      uploadError: false,
    }))

    setCovers((prev) => [...prev, ...newItems])

    toAdd.forEach((file, i) => {
      const itemId = newItems[i].id
      uploadToStorage(file)
        .then((path) => {
          setCovers((prev) =>
            prev.map((c) => (c.id === itemId ? { ...c, path, uploading: false } : c))
          )
        })
        .catch((err) => {
          console.error('[CreateExhibitionForm] cover upload error:', err)
          setCovers((prev) =>
            prev.map((c) =>
              c.id === itemId ? { ...c, uploading: false, uploadError: true } : c
            )
          )
        })
    })
  }

  function removeCover(id: string) {
    setCovers((prev) => {
      const item = prev.find((c) => c.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((c) => c.id !== id)
    })
  }

  function buildFormData(form: HTMLFormElement): FormData {
    const fd = new FormData(form)
    for (const cover of covers) {
      if (cover.path) fd.append('cover_path', cover.path)
    }
    return fd
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!slugValid) {
      setError('올바른 슬러그를 입력해 주세요.')
      return
    }

    const fd = buildFormData(e.currentTarget)

    startTransition(async () => {
      const result = await createExhibition(fd)
      if (result?.error) setError(result.error)
    })
  }

  function handleDraftSave() {
    setError(null)
    if (!formRef.current) return

    const fd = buildFormData(formRef.current)

    startDraftTransition(async () => {
      const result = await saveDraft(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* 제목 */}
      <div className="space-y-1.5">
        <label
          htmlFor="title"
          className="block text-xs font-medium uppercase tracking-widest text-secondary"
        >
          전시 제목 <span className="text-red-400">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="예: 빛과 그림자 — 2024"
          onChange={handleTitleChange}
          className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
        />
      </div>

      {/* 슬러그 */}
      <div className="space-y-1.5">
        <label
          htmlFor="slug"
          className="block text-xs font-medium uppercase tracking-widest text-secondary"
        >
          슬러그 <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center">
          <span className="border border-r-0 border-subtle bg-surface px-3 py-2.5 text-sm text-secondary whitespace-nowrap select-none">
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
            className={`flex-1 border bg-surface text-fg px-3 py-2.5 text-sm font-mono placeholder:text-muted focus:outline-none transition-colors ${
              slug && !slugValid
                ? 'border-red-500 focus:border-red-400'
                : 'border-subtle focus:border-fg'
            }`}
          />
        </div>
        <p className="text-xs text-secondary">
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
          className="block text-xs font-medium uppercase tracking-widest text-secondary"
        >
          전시 설명 <span className="text-muted">(선택)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="전시에 대한 간단한 설명을 입력하세요."
          className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* 기간 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="starts_at"
            className="block text-xs font-medium uppercase tracking-widest text-secondary"
          >
            시작일 <span className="text-muted">(선택)</span>
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="date"
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg focus:border-fg focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="ends_at"
            className="block text-xs font-medium uppercase tracking-widest text-secondary"
          >
            종료일 <span className="text-muted">(선택)</span>
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="date"
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg focus:border-fg focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* 커버 이미지 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-secondary">
            커버 이미지 <span className="text-muted">(선택, 최대 {MAX_COVERS}장)</span>
          </span>
          {covers.length > 0 && (
            <span className="text-xs text-secondary">{covers.length}/{MAX_COVERS}</span>
          )}
        </div>

        {covers.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {covers.map((cover) => (
              <div key={cover.id} className="relative aspect-square bg-bg overflow-hidden">
                <Image
                  src={cover.preview}
                  alt="커버"
                  fill
                  sizes="(max-width: 512px) 33vw, 160px"
                  className="object-cover"
                />
                {cover.uploading && (
                  <div className="absolute top-1 right-1 w-5 h-5">
                    <div className="w-full h-full rounded-full border-2 border-fg/20 border-t-fg animate-spin" />
                  </div>
                )}
                {cover.uploadError && (
                  <div className="absolute inset-0 bg-bg/60 flex flex-col items-center justify-center gap-1">
                    <span className="text-xs text-red-400">실패</span>
                    <button
                      type="button"
                      onClick={() => removeCover(cover.id)}
                      className="text-xs text-secondary underline"
                    >
                      제거
                    </button>
                  </div>
                )}
                {!cover.uploading && !cover.uploadError && (
                  <button
                    type="button"
                    onClick={() => removeCover(cover.id)}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-bg/70 text-fg text-xs hover:bg-bg transition-colors"
                    aria-label="제거"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {covers.length < MAX_COVERS && (
          <>
            <input
              ref={coverPickerRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleCoverPick}
            />
            <button
              type="button"
              onClick={() => coverPickerRef.current?.click()}
              className="w-full border border-dashed border-subtle py-3 text-sm text-secondary hover:border-fg hover:text-fg transition-colors"
            >
              + 사진 추가
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleDraftSave}
        disabled={isDraftPending || isPending || isUploading}
        className="w-full border border-subtle py-3 text-sm font-medium tracking-wide text-fg transition-colors hover:border-fg disabled:opacity-40"
      >
        {isDraftPending ? '저장 중…' : '임시저장'}
      </button>

      <button
        type="submit"
        disabled={isPending || isDraftPending || isUploading || (slug.length > 0 && !slugValid)}
        className="w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg transition-colors hover:bg-gray6 disabled:opacity-40"
      >
        {isPending ? '생성 중…' : isUploading ? '사진 업로드 중…' : '전시 생성하기'}
      </button>
    </form>
  )
}
