'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UploadModal, type ModalUploadItem } from '@/app/components/UploadModal'
import { DeleteUploadButton } from '@/app/components/DeleteUploadButton'

export type HostedExhibition = {
  id: string
  title: string
  slug: string
  status: string
  createdAt: string
}

export type UploadItem = {
  id: string
  type: 'photo' | 'text'
  publicUrl: string | null
  textContent: string | null
  displayName: string
  createdAt: string
}

export type ParticipatedGroup = {
  exhibitionId: string
  title: string
  slug: string
  items: UploadItem[]
}

const STATUS_LABEL: Record<string, string> = {
  active: '진행 중',
  closed: '종료',
  draft: '준비 중',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function MyPageTabs({
  hosted,
  participated,
}: {
  hosted: HostedExhibition[]
  participated: ParticipatedGroup[]
}) {
  const [tab, setTab] = useState<'hosted' | 'participated'>('hosted')
  const [selected, setSelected] = useState<ModalUploadItem | null>(null)
  const [groups, setGroups] = useState(participated)
  const closeModal = useCallback(() => setSelected(null), [])

  function handleDelete(exhibitionId: string, uploadId: string) {
    setSelected(null)
    setGroups((prev) =>
      prev
        .map((g) =>
          g.exhibitionId === exhibitionId
            ? { ...g, items: g.items.filter((item) => item.id !== uploadId) }
            : g
        )
        .filter((g) => g.items.length > 0)
    )
  }

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex border-b border-subtle mb-8">
        {(
          [
            { key: 'hosted', label: '주최한 전시' },
            { key: 'participated', label: '참여한 전시' },
          ] as { key: 'hosted' | 'participated'; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-fg text-fg'
                : 'border-transparent text-secondary hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 주최한 전시 */}
      {tab === 'hosted' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-secondary">{hosted.length}개의 전시</p>
            <Link
              href="/dashboard/exhibitions/new"
              className="text-xs border border-subtle text-fg px-3 py-1.5 hover:border-fg transition-colors"
            >
              + 새 전시 만들기
            </Link>
          </div>
          {hosted.length === 0 ? (
            <p className="text-sm text-secondary py-16 text-center">아직 주최한 전시가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {hosted.map((ex) => (
                <Link
                  key={ex.id}
                  href={`/dashboard/exhibitions/${ex.id}`}
                  className="flex items-center justify-between border border-subtle px-4 py-3 hover:opacity-70 transition-opacity"
                >
                  <div>
                    <p className="text-sm font-medium text-fg">{ex.title}</p>
                    <p className="text-xs text-secondary mt-0.5">{formatDate(ex.createdAt)}</p>
                  </div>
                  <span className="text-xs text-secondary ml-4 shrink-0">
                    {STATUS_LABEL[ex.status] ?? ex.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* 참여한 전시 */}
      {tab === 'participated' && (
        groups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-secondary">아직 참여한 전시가 없습니다.</p>
            <p className="mt-1 text-xs text-secondary">
              전시 QR 코드를 스캔하고 사진이나 글을 남겨보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <section key={group.exhibitionId}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-sm font-semibold text-fg">{group.title}</h2>
                  <Link
                    href={`/e/${group.slug}/gallery`}
                    className="text-xs text-secondary hover:text-fg transition-colors"
                  >
                    전체 업로드 보기 →
                  </Link>
                </div>

                <div className="space-y-3">
                  {group.items.map((u) => {
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
                            <p className="text-xs text-secondary mt-1.5">
                              {u.displayName} · {u.createdAt}
                            </p>
                          </button>
                          <div className="absolute top-2 right-2 bg-surface/80 px-1.5 py-0.5">
                            <DeleteUploadButton
                              uploadId={u.id}
                              onDeleted={() => handleDelete(group.exhibitionId, u.id)}
                            />
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
                            <div className="relative w-20 h-20 flex-shrink-0 bg-bg">
                              <Image
                                src={u.publicUrl}
                                alt="업로드 사진"
                                fill
                                sizes="80px"
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
                          <DeleteUploadButton
                            uploadId={u.id}
                            onDeleted={() => handleDelete(group.exhibitionId, u.id)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {selected && <UploadModal item={selected} onClose={closeModal} />}
    </div>
  )
}
