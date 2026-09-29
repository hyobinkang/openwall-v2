'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateProfileName } from '@/app/actions/profile'

export function ProfileSection({
  initialName,
  joinedAt,
  settingsHref,
}: {
  initialName: string | null
  joinedAt: string
  settingsHref?: string
}) {
  const [name, setName] = useState(initialName ?? '')
  const [inputValue, setInputValue] = useState(initialName ?? '')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const joined = new Date(joinedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  function handleEdit() {
    setInputValue(name)
    setError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    setInputValue(name)
    setError(null)
    setIsEditing(false)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateProfileName(inputValue)
      if (result.error) {
        setError(result.error)
      } else {
        setName(inputValue.trim())
        setIsEditing(false)
        setError(null)
      }
    })
  }

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3">
        {isEditing ? (
          <>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              className="flex-1 bg-surface border border-subtle px-2 py-1 text-sm text-fg focus:border-fg focus:outline-none transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-medium text-fg hover:text-secondary disabled:opacity-40 transition-colors"
            >
              {isPending ? '저장 중…' : '저장'}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-secondary hover:text-secondary transition-colors"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span className="text-base font-semibold text-fg">
              {name || '(이름 없음)'}
            </span>
            {settingsHref ? (
              <Link
                href={settingsHref}
                className="text-xs text-secondary hover:text-fg transition-colors"
              >
                설정
              </Link>
            ) : (
              <button
                onClick={handleEdit}
                className="text-xs text-secondary hover:text-secondary transition-colors"
              >
                수정
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <p className="mt-1 text-xs text-secondary">Joined {joined}</p>
    </div>
  )
}
