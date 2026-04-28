'use client'

import { useEffect } from 'react'
import Image from 'next/image'

export type ModalUploadItem = {
  type: 'photo' | 'text'
  publicUrl: string | null
  textContent: string | null
  displayName: string
  createdAt: string
}

export function UploadModal({ item, onClose }: { item: ModalUploadItem; onClose: () => void }) {
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
                alt="업로드 사진"
                fill
                sizes="(max-width: 640px) 100vw, 512px"
                className="object-contain"
              />
            </div>
          )}

          {item.textContent && (
            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap break-words">
              {item.textContent}
            </p>
          )}

          <p className="text-xs text-secondary border-t border-subtle pt-3">
            {item.displayName} · {item.createdAt}
          </p>
        </div>
      </div>
    </div>
  )
}
