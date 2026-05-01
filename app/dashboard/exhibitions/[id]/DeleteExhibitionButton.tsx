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
  const [state, setState] = useState<'idle' | 'blocked' | 'confirming'>('idle')

  function handleClick() {
    setState(uploadCount > 0 ? 'blocked' : 'confirming')
  }

  function handleConfirm() {
    startTransition(async () => {
      await deleteExhibition(exhibitionId)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      {state === 'confirming' ? (
        <>
          <span className="text-xs text-secondary whitespace-nowrap">정말 삭제하시겠습니까?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirm}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
            >
              {isPending ? '삭제 중…' : '확인'}
            </button>
            <span className="text-xs text-muted">·</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setState('idle')}
              className="text-xs text-secondary hover:text-fg disabled:opacity-40 transition-colors"
            >
              취소
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleClick}
            className="text-xs border border-subtle text-secondary px-3 py-1.5 hover:border-fg hover:text-fg transition-colors whitespace-nowrap"
          >
            삭제
          </button>
          {state === 'blocked' && (
            <p className="text-xs text-red-400">관람객 기록이 있는 전시는 삭제할 수 없습니다.</p>
          )}
        </>
      )}
    </div>
  )
}
