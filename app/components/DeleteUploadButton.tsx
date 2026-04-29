'use client'

import { useTransition, useState } from 'react'
import { deleteUpload } from '@/app/actions/uploads'

export function DeleteUploadButton({
  uploadId,
  onDeleted,
}: {
  uploadId: string
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUpload(uploadId)
      if (!result.error) onDeleted()
    })
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        >
          {isPending ? '삭제 중…' : '확인'}
        </button>
        <span className="text-xs text-muted">·</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="text-xs text-secondary hover:text-fg transition-colors"
        >
          취소
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-secondary hover:text-red-400 transition-colors"
    >
      삭제
    </button>
  )
}
