'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

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

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex border-b border-neutral-800 mb-8">
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
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 주최한 전시 */}
      {tab === 'hosted' && (
        hosted.length === 0 ? (
          <p className="text-sm text-neutral-500 py-16 text-center">아직 주최한 전시가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {hosted.map((ex) => (
              <Link
                key={ex.id}
                href={`/dashboard/exhibitions/${ex.id}`}
                className="flex items-center justify-between border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white">{ex.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{formatDate(ex.createdAt)}</p>
                </div>
                <span className="text-xs text-neutral-400 ml-4 shrink-0">
                  {STATUS_LABEL[ex.status] ?? ex.status}
                </span>
              </Link>
            ))}
          </div>
        )
      )}

      {/* 참여한 전시 */}
      {tab === 'participated' && (
        participated.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-neutral-500">아직 참여한 전시가 없습니다.</p>
            <p className="mt-1 text-xs text-neutral-600">
              전시 QR 코드를 스캔하고 사진이나 글을 남겨보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {participated.map((group) => (
              <section key={group.exhibitionId}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                  <Link
                    href={`/e/${group.slug}/gallery`}
                    className="text-xs text-neutral-500 hover:text-white transition-colors"
                  >
                    전체 업로드 보기 →
                  </Link>
                </div>

                <div className="space-y-3">
                  {group.items.map((u) => {
                    if (u.type === 'text') {
                      return (
                        <div key={u.id} className="border border-neutral-800 px-4 py-3">
                          {u.textContent && (
                            <p className="text-sm text-neutral-200 leading-relaxed line-clamp-3 break-words">
                              {u.textContent}
                            </p>
                          )}
                          <p className="text-xs text-neutral-500 mt-1.5">
                            {u.displayName} · {u.createdAt}
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div key={u.id} className="border border-neutral-800 flex gap-4 p-3">
                        {u.publicUrl && (
                          <div className="relative w-20 h-20 flex-shrink-0 bg-neutral-800">
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
                            <p className="text-sm text-neutral-200 leading-relaxed line-clamp-2 break-words">
                              {u.textContent}
                            </p>
                          )}
                          <p className="text-xs text-neutral-500 mt-1">
                            {u.displayName} · {u.createdAt}
                          </p>
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
    </div>
  )
}
