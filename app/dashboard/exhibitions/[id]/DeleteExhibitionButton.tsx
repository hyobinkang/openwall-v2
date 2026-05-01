'use client'

import { useTransition, useState } from 'react'
import { deleteExhibition } from '@/app/actions/exhibitions'

export function DeleteExhibitionButton({
  exhibitionId,
  uploadCount,
}: {
  exhibitionId: string
  uploadCount: number
}) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleClick() {
    if (uploadCount > 0) {
      alert('관람객 기록이 있는 전시는 삭제할 수 없습니다.')
      return
    }
    setConfirming(true)
  }

  function handleConfirm() {
    startTransition(async () => {
      await deleteExhibition(exhibitionId)
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-secondary">정말 삭제할까요?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={handleConfirm}
          className="text-xs border border-red-500/50 text-red-400 px-3 py-1.5 hover:border-red-400 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {isPending ? '삭제 중…' : '삭제'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="text-xs text-secondary hover:text-fg disabled:opacity-40 transition-colors"
        >
          취소
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 text-xs border border-subtle text-secondary px-3 py-1.5 hover:border-fg hover:text-fg transition-colors whitespace-nowrap"
    >
      삭제
    </button>
  )
}
