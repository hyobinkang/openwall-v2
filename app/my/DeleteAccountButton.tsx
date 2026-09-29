'use client'

import { useState } from 'react'
import { deleteAccount } from '@/app/actions/account'

export function DeleteAccountButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    const confirmed = window.confirm(
      '탈퇴하면 주최한 전시와 그 전시의 업로드가 영구 삭제되며 복구할 수 없습니다. 다른 전시에 남긴 업로드는 익명으로 유지됩니다. 계속할까요?'
    )
    if (!confirmed) return

    setPending(true)
    setError(null)
    const result = await deleteAccount()
    if (result?.error) {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <div className="text-center">
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <button
        onClick={handleClick}
        disabled={pending}
        className="text-xs text-muted hover:text-secondary transition-colors disabled:opacity-40"
      >
        {pending ? '처리 중…' : '회원 탈퇴'}
      </button>
    </div>
  )
}
