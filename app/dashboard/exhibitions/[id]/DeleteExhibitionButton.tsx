'use client'

import { useTransition, useState, useEffect } from 'react'
import { deleteExhibition } from '@/app/actions/exhibitions'

export function DeleteExhibitionButton({
  exhibitionId,
  uploadCount,
}: {
  exhibitionId: string
  uploadCount: number
}) {
  const [isPending, startTransition] = useTransition()
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (!showError) return
    const timer = setTimeout(() => setShowError(false), 3000)
    return () => clearTimeout(timer)
  }, [showError])

  function handleClick() {
    if (uploadCount > 0) {
      setShowError(true)
      return
    }
    if (!confirm('정말 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteExhibition(exhibitionId)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs border border-subtle text-secondary px-3 py-1.5 hover:border-fg hover:text-fg disabled:opacity-40 transition-colors whitespace-nowrap"
      >
        {isPending ? '삭제 중…' : '삭제'}
      </button>
      {showError && (
        <p className="text-xs text-red-400 whitespace-nowrap">
          관람객 기록이 있는 전시는 삭제할 수 없습니다.
        </p>
      )}
    </div>
  )
}
