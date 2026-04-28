'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

export type UploadItem = {
  id: string
  type: 'photo' | 'text'
  publicUrl: string | null
  text_content: string | null
  caption: string | null
  uploaderLabel: string
  createdAt: string // KST 포맷된 문자열
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
        {/* 닫기 버튼 */}
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
          {/* 사진 */}
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

          {/* 텍스트 */}
          {item.text_content && (
            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap break-words">
              {item.text_content}
            </p>
          )}

          {/* 캡션 */}
          {item.caption && (
            <p className="text-xs text-secondary italic border-t border-subtle pt-3">
              {item.caption}
            </p>
          )}

          {/* 메타 */}
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
}: {
  item: UploadItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface border border-subtle hover:border-fg transition-colors w-full overflow-hidden"
    >
      {/* 이미지 섹션 */}
      {item.type === 'photo' && item.publicUrl && (
        <div className="relative w-full aspect-[4/3] bg-bg">
          <Image
            src={item.publicUrl}
            alt={item.caption ?? '업로드 사진'}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      )}

      {/* 텍스트 카드 헤더 (텍스트 전용) */}
      {item.type === 'text' && (
        <div className="bg-surface px-4 py-5 min-h-[100px] flex items-start">
          <p className="text-sm text-fg leading-relaxed line-clamp-3">
            {item.text_content}
          </p>
        </div>
      )}

      {/* 하단 정보 */}
      <div className="px-3 py-2.5 space-y-0.5">
        {/* 캡션 또는 텍스트 미리보기 */}
        {item.type === 'photo' && (item.caption || item.text_content) && (
          <p className="text-xs text-secondary line-clamp-2">
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
  )
}

// ─── 그리드 ────────────────────────────────────────────────
export function UploadsGrid({ items }: { items: UploadItem[] }) {
  const [selected, setSelected] = useState<UploadItem | null>(null)
  const close = useCallback(() => setSelected(null), [])

  if (items.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map((item) => (
          <UploadCard key={item.id} item={item} onClick={() => setSelected(item)} />
        ))}
      </div>
      {selected && <Modal item={selected} onClose={close} />}
    </>
  )
}
