// 전시 기간 판단 공통 유틸
// starts_at / ends_at은 사용자가 고른 "한국 날짜"다. DB(timestamptz)에는 2026-09-30T00:00:00+00:00처럼
// UTC 자정으로 저장되지만, 시각 부분은 의미가 없으므로 YYYY-MM-DD만 꺼내 KST 기준 경계로 다시 만든다.
// 서버(UTC)·브라우저 시간대와 무관하게 동일한 결과를 낸다.

export type ExhibitionPhase = 'draft' | 'upcoming' | 'ongoing' | 'ended'

const KST_OFFSET = '+09:00'

/** 저장된 값("2026-09-30", "2026-09-30T00:00:00+00:00" 등)에서 YYYY-MM-DD만 추출 */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? match[0] : null
}

/** 시작일 KST 00:00:00.000 */
export function startOfKstDay(value: string | null | undefined): Date | null {
  const day = toDateOnly(value)
  return day ? new Date(`${day}T00:00:00.000${KST_OFFSET}`) : null
}

/** 종료일 KST 23:59:59.999 */
export function endOfKstDay(value: string | null | undefined): Date | null {
  const day = toDateOnly(value)
  return day ? new Date(`${day}T23:59:59.999${KST_OFFSET}`) : null
}

export function getExhibitionPhase(
  ex: { status: string; startsAt: string | null; endsAt: string | null },
  now: Date = new Date()
): ExhibitionPhase {
  if (ex.status === 'draft') return 'draft'
  if (ex.status === 'closed') return 'ended'
  const end = endOfKstDay(ex.endsAt)
  if (end && now > end) return 'ended'
  const start = startOfKstDay(ex.startsAt)
  if (start && now < start) return 'upcoming'
  return 'ongoing'
}

const PHASE_INFO: Record<ExhibitionPhase, { label: string; className: string }> = {
  draft: { label: '임시저장', className: 'border border-white text-white bg-black' },
  ended: { label: '종료', className: 'border border-gray-500 text-gray-500 bg-black' },
  upcoming: { label: '진행 전', className: 'border border-blue-400 text-blue-400 bg-black' },
  ongoing: { label: '진행 중', className: 'border border-green-400 text-green-400 bg-black' },
}

export function getExhibitionStatusInfo(
  ex: { status: string; startsAt: string | null; endsAt: string | null },
  now: Date = new Date()
) {
  return PHASE_INFO[getExhibitionPhase(ex, now)]
}

/** 날짜 부분만으로 표시 — "2026년 9월 30일"(long) / "2026.09.30"(dot). Date 변환을 거치지 않아 하루 밀리지 않음 */
export function formatExhibitionDate(
  value: string | null | undefined,
  style: 'long' | 'dot' = 'long'
): string | null {
  const day = toDateOnly(value)
  if (!day) return null
  const [y, m, d] = day.split('-')
  return style === 'long' ? `${y}년 ${Number(m)}월 ${Number(d)}일` : `${y}.${m}.${d}`
}
