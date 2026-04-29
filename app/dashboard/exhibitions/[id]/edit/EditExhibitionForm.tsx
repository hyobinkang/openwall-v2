'use client'

import { useTransition, useRef, useState } from 'react'
import Image from 'next/image'
import { updateExhibition } from '@/app/actions/exhibitions'

const MAX_COVERS = 9
const MAX_COVER_MB = 10

const STATUS_OPTIONS = [
  { value: 'active', label: '진행 중' },
  { value: 'draft', label: '초안' },
  { value: 'closed', label: '종료' },
] as const

type InitialCover = { path: string; url: string }

export function EditExhibitionForm({
  id,
  title: initialTitle,
  description: initialDescription,
  slug,
  startsAt,
  endsAt,
  status: initialStatus,
  initialCovers,
}: {
  id: string
  title: string
  description: string | null
  slug: string
  startsAt: string
  endsAt: string
  status: 'draft' | 'active' | 'closed'
  initialCovers: InitialCover[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [existingCovers, setExistingCovers] = useState<InitialCover[]>(initialCovers)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const coverPickerRef = useRef<HTMLInputElement>(null)

  const totalCovers = existingCovers.length + newFiles.length

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return

    if (totalCovers + files.length > MAX_COVERS) {
      setError(
        `최대 ${MAX_COVERS}장까지 업로드할 수 있습니다.`
      )
      return
    }

    const oversized = files.find((f) => f.size > MAX_COVER_MB * 1024 * 1024)
    if (oversized) {
      setError(`파일 크기는 ${MAX_COVER_MB}MB 이하여야 합니다.`)
      return
    }

    setError(null)
    setNewFiles((prev) => [...prev, ...files])
    setNewPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
  }

  function removeExisting(path: string) {
    setExistingCovers((prev) => prev.filter((c) => c.path !== path))
  }

  function removeNew(i: number) {
    URL.revokeObjectURL(newPreviews[i])
    setNewFiles((prev) => prev.filter((_, idx) => idx !== i))
    setNewPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)

    const keptPaths = new Set(existingCovers.map((c) => c.path))
    for (const { path } of initialCovers) {
      if (!keptPaths.has(path)) fd.append('remove_cover', path)
    }

    for (const f of newFiles) fd.append('covers', f)

    console.log('[EditExhibitionForm] submitting', {
      id: fd.get('id'),
      title: fd.get('title'),
      newFiles: newFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      removePaths: fd.getAll('remove_cover'),
    })

    startTransition(async () => {
      try {
        const result = await updateExhibition(fd)
        if (result?.error) setError(result.error)
      } catch (err) {
        console.error('[EditExhibitionForm] updateExhibition threw:', err)
        setError('저장 중 오류가 발생했습니다. 다시 시도해 주세요.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          defaultValue={initialTitle}
          className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none transition-colors"
        />
      </div>

      {/* 슬러그 (읽기 전용) */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium uppercase tracking-widest text-secondary">
          슬러그
        </span>
        <div className="flex items-center">
          <span className="border border-subtle bg-surface px-3 py-2.5 text-sm text-secondary whitespace-nowrap select-none">
            /e/
          </span>
          <span className="flex-1 border border-l-0 border-subtle bg-bg px-3 py-2.5 text-sm font-mono text-secondary">
            {slug}
          </span>
        </div>
        <p className="text-xs text-muted">슬러그는 수정할 수 없습니다. QR URL이 변경됩니다.</p>
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
            defaultValue={startsAt}
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
            defaultValue={endsAt}
            className="w-full border border-subtle bg-surface px-3 py-2.5 text-sm text-fg focus:border-fg focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* 상태 */}
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
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

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

        {(existingCovers.length > 0 || newPreviews.length > 0) && (
          <div className="grid grid-cols-3 gap-2">
            {existingCovers.map((cover) => (
              <div key={cover.path} className="relative aspect-square bg-bg">
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
            {newPreviews.map((url, i) => (
              <div key={`new-${i}`} className="relative aspect-square bg-bg">
                <Image
                  src={url}
                  alt={`새 커버 ${i + 1}`}
                  fill
                  sizes="(max-width: 512px) 33vw, 160px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNew(i)}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-bg/70 text-fg text-xs hover:bg-bg transition-colors"
                  aria-label="제거"
                >
                  ×
                </button>
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

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-fg py-3 text-sm font-medium tracking-wide text-bg transition-colors hover:bg-gray6 disabled:opacity-40"
      >
        {isPending ? '저장 중…' : '저장하기'}
      </button>
    </form>
  )
}
