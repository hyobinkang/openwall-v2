'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { UploadModal, type ModalUploadItem } from '@/app/components/UploadModal'
import { DeleteUploadButton } from '@/app/components/DeleteUploadButton'

export type MyUploadCardItem = ModalUploadItem & { id: string }

export function MyUploadsSection({ items: initialItems }: { items: MyUploadCardItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [selected, setSelected] = useState<MyUploadCardItem | null>(null)
  const close = useCallback(() => setSelected(null), [])

  function handleDelete(id: string) {
    setSelected(null)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  if (items.length === 0) return null

  return (
    <>
      <div className="space-y-2">
        {items.map((u) => {
          if (u.type === 'text') {
            return (
              <div key={u.id} className="relative">
                <button
                  type="button"
                  onClick={() => setSelected(u)}
                  className="w-full text-left border border-subtle bg-surface px-4 py-3 hover:border-fg transition-colors"
                >
                  {u.textContent && (
                    <p className="text-sm text-fg leading-relaxed line-clamp-3 break-words">
                      {u.textContent}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-secondary">
                    {u.displayName} · {u.createdAt}
                  </p>
                </button>
                <div className="absolute top-2 right-2 bg-surface/80 px-1.5 py-0.5">
                  <DeleteUploadButton uploadId={u.id} onDeleted={() => handleDelete(u.id)} />
                </div>
              </div>
            )
          }

          return (
            <div key={u.id} className="relative">
              <button
                type="button"
                onClick={() => setSelected(u)}
                className="w-full text-left border border-subtle bg-surface flex gap-4 p-3 hover:border-fg transition-colors"
              >
                {u.publicUrl && (
                  <div className="relative w-16 h-16 flex-shrink-0 bg-bg">
                    <Image
                      src={u.publicUrl}
                      alt="업로드 사진"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  {u.textContent && (
                    <p className="text-sm text-fg leading-relaxed line-clamp-2 break-words">
                      {u.textContent}
                    </p>
                  )}
                  <p className="text-xs text-secondary mt-1">
                    {u.displayName} · {u.createdAt}
                  </p>
                </div>
              </button>
              <div className="absolute top-2 right-2 bg-surface/80 px-1.5 py-0.5">
                <DeleteUploadButton uploadId={u.id} onDeleted={() => handleDelete(u.id)} />
              </div>
            </div>
          )
        })}
      </div>
      {selected && <UploadModal item={selected} onClose={close} />}
    </>
  )
}
