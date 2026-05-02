'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { closeExhibition } from '@/app/actions/exhibitions'

export function CloseExhibitionButton({ exhibitionId }: { exhibitionId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    if (!confirm('정말 종료하시겠습니까?')) return
    startTransition(async () => {
      await closeExhibition(exhibitionId)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs border border-subtle text-secondary px-3 py-1.5 hover:border-fg hover:text-fg disabled:opacity-40 transition-colors whitespace-nowrap"
    >
      {isPending ? '종료 중…' : '종료'}
    </button>
  )
}
