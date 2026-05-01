'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import Image from 'next/image'
import { deleteUploads } from '@/app/actions/uploads'

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
  selectMode,
  isSelected,
}: {
  item: UploadItem
  onClick: () => void
  selectMode: boolean
  isSelected: boolean
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className={`text-left bg-surface border transition-colors w-full aspect-square overflow-hidden flex flex-col ${
          isSelected ? 'border-fg' : 'border-subtle hover:border-fg'
        }`}
      >
        {item.type === 'photo' && item.publicUrl && (
          <div className="relative flex-1 bg-bg">
            <Image
              src={item.publicUrl}
              alt={item.caption ?? '업로드 사진'}
              fill
              sizes="(max-width: 768px) 33vw, 17vw"
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

      {selectMode && (
        <div
          className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center pointer-events-none ${
            isSelected ? 'bg-fg border-fg' : 'bg-bg/80 border-fg/50'
          }`}
        >
          {isSelected && <span className="text-bg text-[10px] leading-none font-bold">✓</span>}
        </div>
      )}
    </div>
  )
}

// ─── 그리드 ────────────────────────────────────────────────
export function UploadsGrid({
  items: initialItems,
  allowSelect = false,
}: {
  items: UploadItem[]
  allowSelect?: boolean
}) {
  const [items, setItems] = useState(initialItems)
  const [modalItem, setModalItem] = useState<UploadItem | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, startDeleteTransition] = useTransition()
  const closeModal = useCallback(() => setModalItem(null), [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function handleCardClick(item: UploadItem) {
    if (selectMode) {
      toggleSelect(item.id)
    } else {
      setModalItem(item)
    }
  }

  function handleDeleteSelected() {
    const ids = Array.from(selectedIds)
    startDeleteTransition(async () => {
      const result = await deleteUploads(ids)
      if (!result.error) {
        setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)))
        exitSelectMode()
      }
    })
  }

  if (items.length === 0) return null

  return (
    <>
      {allowSelect && (
        <div className="flex items-center justify-end gap-4 mb-4 min-h-[24px]">
          {selectMode ? (
            <>
              <span className="text-xs text-secondary">{selectedIds.size}개 선택됨</span>
              <button
                type="button"
                onClick={exitSelectMode}
                disabled={isDeleting}
                className="text-xs text-secondary hover:text-fg disabled:opacity-40 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0 || isDeleting}
                onClick={handleDeleteSelected}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
              >
                {isDeleting ? '삭제 중…' : `${selectedIds.size}개 삭제`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="text-xs text-secondary hover:text-fg transition-colors"
            >
              선택 삭제
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {items.map((item) => (
          <UploadCard
            key={item.id}
            item={item}
            onClick={() => handleCardClick(item)}
            selectMode={selectMode}
            isSelected={selectedIds.has(item.id)}
          />
        ))}
      </div>

      {!selectMode && modalItem && <Modal item={modalItem} onClose={closeModal} />}
    </>
  )
}
