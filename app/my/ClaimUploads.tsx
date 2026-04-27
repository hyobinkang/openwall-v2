'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { claimUploads } from '@/app/actions/uploads'

export function ClaimUploads() {
  const router = useRouter()

  useEffect(() => {
    async function run() {
      const raw = sessionStorage.getItem('pendingUploads')
      console.log('[ClaimUploads] 실행됨. sessionStorage pendingUploads:', raw)

      try {
        if (!raw) {
          console.log('[ClaimUploads] pendingUploads 없음 — 종료')
          return
        }
        const ids: string[] = JSON.parse(raw)
        if (!ids.length) {
          console.log('[ClaimUploads] ids 배열 비어있음 — 종료')
          return
        }
        console.log('[ClaimUploads] claimUploads 호출 시작:', ids)
        sessionStorage.removeItem('pendingUploads')
        await claimUploads(ids)
        console.log('[ClaimUploads] claimUploads 완료, router.refresh() 호출')
        router.refresh()
      } catch (e) {
        console.error('[ClaimUploads] 오류:', e)
      }
    }
    run()
  }, [router])

  return null
}
