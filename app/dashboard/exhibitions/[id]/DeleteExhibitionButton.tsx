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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(timer)
  }, [error])

  // 삭제 가능 여부(다른 관람객 기록 유무)는 서버 액션이 판단한다
  function handleClick() {
    const message =
      uploadCount > 0
        ? `정말 삭제하시겠습니까?\n업로드 ${uploadCount}개와 사진 파일도 함께 삭제됩니다.`
        : '정말 삭제하시겠습니까?'
    if (!confirm(message)) return
    startTransition(async () => {
      const result = await deleteExhibition(exhibitionId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs border border-subtle text-secondary px-3 py-1.5 hover:border-fg hover:text-fg disabled:opacity-40 transition-colors whitespace-nowrap"
      >
        {isPending ? '삭제 중…' : '삭제'}
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 text-xs text-red-400 whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  )
}
