'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { claimUploads, type PendingUpload } from '@/app/actions/uploads'

export function ClaimUploads() {
  const router = useRouter()

  useEffect(() => {
    async function run() {
      try {
        const raw: unknown = JSON.parse(sessionStorage.getItem('pendingUploads') ?? '[]')
        // 토큰이 있는 항목만 전송 — 예전 형식(id만 저장)은 서버에서도 귀속 불가
        const items = (Array.isArray(raw) ? raw : []).filter(
          (p): p is PendingUpload => typeof p?.id === 'string' && typeof p?.token === 'string'
        )
        sessionStorage.removeItem('pendingUploads')
        if (!items.length) return
        await claimUploads(items)
        router.refresh()
      } catch (e) {
        console.error('[ClaimUploads] 오류:', e)
      }
    }
    run()
  }, [router])

  return null
}
