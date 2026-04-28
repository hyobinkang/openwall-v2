'use client'

import { useState, useTransition } from 'react'
import { updateProfileName } from '@/app/actions/profile'

export function ProfileSection({
  initialName,
  joinedAt,
}: {
  initialName: string | null
  joinedAt: string
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
    <div className="border border-neutral-100 px-5 py-4 mb-10">
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
              className="flex-1 border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-medium text-neutral-900 hover:text-black disabled:opacity-40 transition-colors"
            >
              {isPending ? '저장 중…' : '저장'}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-neutral-900">
              {name || '(이름 없음)'}
            </span>
            <button
              onClick={handleEdit}
              className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              수정
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1 text-xs text-neutral-400">Joined {joined}</p>
    </div>
  )
}
