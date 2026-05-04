'use client'

import { useTransition, useRef, useState } from 'react'
import Image from 'next/image'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { updateExhibition } from '@/app/actions/exhibitions'

const MAX_COVERS = 9

const STATUS_OPTIONS = [
  { value: 'active', label: '진행 중' },
  { value: 'draft', label: '임시저장' },
  { value: 'closed', label: '종료' },
] as const

type InitialCover = { path: string; url: string }

type NewCoverItem = {
  id: string
  preview: string
  path: string | null
  uploading: boolean
  uploadError: boolean
}

function toSlug(title: string): string {
  if (!title.trim()) return ''
  const ascii = title
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
  return ascii
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

export function EditExhibitionForm({
  id,
  title: initialTitle,
  description: initialDescription,
  slug: initialSlug,
  startsAt: initialStartsAt,
  endsAt: initialEndsAt,
  status: initialStatus,
  initialCovers,
}: {
  id: string
  title: string | null
  description: string | null
  slug: string
  startsAt: string
  endsAt: string
  status: 'draft' | 'active' | 'closed'
  initialCovers: InitialCover[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isTempSlug = !initialSlug || initialSlug.startsWith('temp-') || initialSlug.startsWith('ex-')
  const [slug, setSlug] = useState(isTempSlug ? toSlug(initialTitle ?? '') : initialSlug)
  const [slugTouched, setSlugTouched] = useState(!isTempSlug)
  const isDraft = initialStatus === 'draft'

  const [startsAt, setStartsAt] = useState(initialStartsAt)

  const [existingCovers, setExistingCovers] = useState<InitialCover[]>(initialCovers)
  const [newCovers, setNewCovers] = useState<NewCoverItem[]>([])
  const coverPickerRef = useRef<HTMLInputElement>(null)

  const totalCovers = existingCovers.length + newCovers.length
  const isUploading = newCovers.some((c) => c.uploading)
  const slugValid = isValidSlug(slug)

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (isDraft && !slugTouched) {
      setSlug(toSlug(val))
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true)
    setSlug(e.target.value)
  }

  function handleEndsAtChange(e: React.ChangeEvent<HTMLInputElement>) {
    const endsAt = e.target.value
    if (startsAt && endsAt && endsAt < startsAt) {
      setError('종료일은 시작일 이후여야 합니다.')
    } else {
      setError(null)
    }
  }

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return

    if (totalCovers + files.length > MAX_COVERS) {
      setError(`최대 ${MAX_COVERS}장까지 업로드할 수 있습니다.`)
      return
    }

    setError(null)

    const newItems: NewCoverItem[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      preview: URL.createObjectURL(f),
      path: null,
      uploading: true,
      uploadError: false,
    }))

    setNewCovers((prev) => [...prev, ...newItems])

    files.forEach((file, i) => {
      const itemId = newItems[i].id
      uploadToStorage(file)
        .then((path) => {
          setNewCovers((prev) =>
            prev.map((c) => (c.id === itemId ? { ...c, path, uploading: false } : c))
          )
        })
        .catch((err) => {
          console.error('[EditExhibitionForm] cover upload error:', err)
          setNewCovers((prev) =>
            prev.map((c) =>
              c.id === itemId ? { ...c, uploading: false, uploadError: true } : c
            )
          )
        })
    })
  }

  function removeExisting(path: string) {
    setExistingCovers((prev) => prev.filter((c) => c.path !== path))
  }

  function removeNew(id: string) {
    setNewCovers((prev) => {
      const item = prev.find((c) => c.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((c) => c.id !== id)
    })
  }

  function buildFormData(form: HTMLFormElement, overrideStatus?: string): FormData {
    const fd = new FormData(form)

    if (overrideStatus) {
      fd.set('status', overrideStatus)
    }

    const keptPaths = new Set(existingCovers.map((c) => c.path))
    for (const { path } of initialCovers) {
      if (!keptPaths.has(path)) fd.append('remove_cover', path)
    }

    for (const cover of newCovers) {
      if (cover.path) fd.append('new_cover_path', cover.path)
    }

    return fd
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = buildFormData(e.currentTarget)

    const endsAt = fd.get('ends_at') as string
    const startsAtVal = fd.get('starts_at') as string
    if (startsAtVal && endsAt && endsAt < startsAtVal) {
      setError('종료일은 시작일 이후여야 합니다.')
      return
    }

    startTransition(async () => {
      try {
        const result = await updateExhibition(fd)
        if (result?.error) setError(result.error)
      } catch (err: unknown) {
        const digest = (err as { digest?: string })?.digest
        if (digest?.startsWith('NEXT_REDIRECT')) return
        console.error('[EditExhibitionForm] updateExhibition threw:', err)
        setError('저장 중 오류가 발생했습니다. 다시 시도해 주세요.')
      }
    })
  }

  function handlePublish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!slugValid) {
      setError('올바른 슬러그를 입력해 주세요.')
      return
    }

    const fd = buildFormData(e.currentTarget, 'active')

    const endsAt = fd.get('ends_at') as string
    const startsAtVal = fd.get('starts_at') as string
    if (startsAtVal && endsAt && endsAt < startsAtVal) {
      setError('종료일은 시작일 이후여야 합니다.')
      return
    }

    startTransition(async () => {
      try {
        const result = await updateExhibition(fd)
        if (result?.error) setError(result.error)
      } catch (err: unknown) {
        const digest = (err as { digest?: string })?.digest
        if (digest?.startsWith('NEXT_REDIRECT')) return
        console.error('[EditExhibitionForm] publish threw:', err)
        setError('생성 중 오류가 발생했습니다. 다시 시도해 주세요.')
      }
    })
  }

  return (
    <form
      onSubmit={isDraft ? handlePublish : handleSubmit}
      className="space-y-6"
    >
      <input type="hidden" name="id" value={id} />

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
          defaultValue={initialTitle ?? ''}
          placeholder="전시 제목"
          onChange={handleTitleChange}
          className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
        />
      </div>

      {/* 슬러그 */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium uppercase tracking-widest text-secondary">
          슬러그 {isDraft && <span className="text-red-400">*</span>}
        </span>
        {isDraft ? (
          <>
            <div className="flex items-center">
              <span className="border border-r-0 border-subtle bg-surface px-3 py-2.5 text-sm text-secondary whitespace-nowrap select-none">
                /e/
              </span>
              <input
                name="slug"
                type="text"
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
          </>
        ) : (
          <>
            <div className="flex items-center">
              <span className="border border-subtle bg-surface px-3 py-2.5 text-sm text-secondary whitespace-nowrap select-none">
                /e/
              </span>
              <span className="flex-1 border border-l-0 border-subtle bg-bg px-3 py-2.5 text-sm font-mono text-secondary">
                {initialSlug}
              </span>
            </div>
            <p className="text-xs text-muted">슬러그는 수정할 수 없습니다. QR URL이 변경됩니다.</p>
          </>
        )}
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
          defaultValue={initialDescription ?? ''}
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
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
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
            defaultValue={initialEndsAt}
            onChange={handleEndsAtChange}
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg focus:border-fg focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* 상태 (비임시저장 전시만) */}
      {!isDraft && (
        <div className="space-y-1.5">
          <label
            htmlFor="status"
            className="block text-xs font-medium uppercase tracking-widest text-secondary"
          >
            상태
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initialStatus}
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg focus:border-fg focus:outline-none transition-colors"
          >
            {STATUS_OPTIONS.filter((o) => o.value !== 'draft').map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 임시저장인 경우 hidden status */}
      {isDraft && (
        <input type="hidden" name="status" value="draft" />
      )}

      {/* 커버 이미지 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-secondary">
            커버 이미지 <span className="text-muted">(최대 {MAX_COVERS}장)</span>
          </span>
          {totalCovers > 0 && (
            <span className="text-xs text-secondary">{totalCovers}/{MAX_COVERS}</span>
          )}
        </div>

        {(existingCovers.length > 0 || newCovers.length > 0) && (
          <div className="grid grid-cols-3 gap-2">
            {existingCovers.map((cover) => (
              <div key={cover.path} className="relative aspect-square bg-bg overflow-hidden">
                <Image
                  src={cover.url}
                  alt="커버"
                  fill
                  sizes="(max-width: 512px) 33vw, 160px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExisting(cover.path)}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-bg/70 text-fg text-xs hover:bg-bg transition-colors"
                  aria-label="제거"
                >
                  ×
                </button>
              </div>
            ))}
            {newCovers.map((cover) => (
              <div key={cover.id} className="relative aspect-square bg-bg overflow-hidden">
                <Image
                  src={cover.preview}
                  alt="새 커버"
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
                      onClick={() => removeNew(cover.id)}
                      className="text-xs text-secondary underline"
                    >
                      제거
                    </button>
                  </div>
                )}
                {!cover.uploading && !cover.uploadError && (
                  <button
                    type="button"
                    onClick={() => removeNew(cover.id)}
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

        {totalCovers < MAX_COVERS && (
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

      {isDraft ? (
        <button
          type="submit"
          disabled={isPending || isUploading || (slug.length > 0 && !slugValid)}
          className="w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg transition-colors hover:bg-gray6 disabled:opacity-40"
        >
          {isPending ? '생성 중…' : isUploading ? '사진 업로드 중…' : '전시 생성하기'}
        </button>
      ) : (
        <button
          type="submit"
          disabled={isPending || isUploading}
          className="w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg transition-colors hover:bg-gray6 disabled:opacity-40"
        >
          {isPending ? '저장 중…' : isUploading ? '사진 업로드 중…' : '저장하기'}
        </button>
      )}
    </form>
  )
}
