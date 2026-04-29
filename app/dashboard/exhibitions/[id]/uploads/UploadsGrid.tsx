'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { DeleteUploadButton } from '@/app/components/DeleteUploadButton'

export type UploadItem = {
  id: string
  type: 'photo' | 'text'
  publicUrl: string | null
  text_content: string | null
  caption: string | null
  uploaderLabel: string
  createdAt: string
}

// ─── 모달 ──────────────────────────────────────────────────
function Modal({ item, onClose }: { item: UploadItem; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-4"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-4 pt-4">
          <button
            onClick={onClose}
            className="text-secondary hover:text-fg transition-colors text-lg leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {item.type === 'photo' && item.publicUrl && (
            <div className="relative w-full aspect-[4/3]">
              <Image
                src={item.publicUrl}
                alt={item.caption ?? '업로드 사진'}
                fill
                sizes="(max-width: 640px) 100vw, 512px"
                className="object-contain"
              />
            </div>
          )}

          {item.text_content && (
            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap break-words">
              {item.text_content}
            </p>
          )}

          {item.caption && (
            <p className="text-xs text-secondary italic border-t border-subtle pt-3">
              {item.caption}
            </p>
          )}

          <p className="text-xs text-secondary border-t border-subtle pt-3">
            {item.uploaderLabel} · {item.createdAt}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── 카드 ──────────────────────────────────────────────────
function UploadCard({
  item,
  onClick,
  onDelete,
}: {
  item: UploadItem
  onClick: () => void
  onDelete?: () => void
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="text-left bg-surface border border-subtle hover:border-fg transition-colors w-full aspect-square overflow-hidden flex flex-col"
      >
        {item.type === 'photo' && item.publicUrl && (
          <div className="relative flex-1 bg-bg">
            <Image
              src={item.publicUrl}
              alt={item.caption ?? '업로드 사진'}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        )}

        {item.type === 'text' && (
          <div className="flex-1 px-4 py-4 overflow-hidden">
            <p className="text-sm text-fg leading-relaxed line-clamp-4">
              {item.text_content}
            </p>
          </div>
        )}

        <div className="shrink-0 px-3 py-2 border-t border-subtle space-y-0.5">
          {item.type === 'photo' && (item.caption || item.text_content) && (
            <p className="text-xs text-secondary line-clamp-1">
              {item.caption ?? item.text_content}
            </p>
          )}
          {item.type === 'text' && item.caption && (
            <p className="text-xs text-secondary italic line-clamp-1">{item.caption}</p>
          )}
          <p className="text-xs text-secondary">
            {item.uploaderLabel} · {item.createdAt}
          </p>
        </div>
      </button>

      {onDelete && (
        <div className="absolute top-2 right-2 z-10 bg-bg/70 px-1.5 py-0.5">
          <DeleteUploadButton uploadId={item.id} onDeleted={onDelete} />
        </div>
      )}
    </div>
  )
}

// ─── 그리드 ────────────────────────────────────────────────
export function UploadsGrid({
  items: initialItems,
  showDelete = false,
}: {
  items: UploadItem[]
  showDelete?: boolean
}) {
  const [items, setItems] = useState(initialItems)
  const [selected, setSelected] = useState<UploadItem | null>(null)
  const close = useCallback(() => setSelected(null), [])

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setSelected((prev) => (prev?.id === id ? null : prev))
  }

  if (items.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map((item) => (
          <UploadCard
            key={item.id}
            item={item}
            onClick={() => setSelected(item)}
            onDelete={showDelete ? () => handleDelete(item.id) : undefined}
          />
        ))}
      </div>
      {selected && <Modal item={selected} onClose={close} />}
    </>
  )
}
