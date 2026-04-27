'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { claimUploads } from '@/app/actions/uploads'

export function ClaimUploads() {
  const router = useRouter()

  useEffect(() => {
    async function run() {
      try {
        const raw = sessionStorage.getItem('pendingUploads')
        if (!raw) return
        const ids: string[] = JSON.parse(raw)
        if (!ids.length) return
        sessionStorage.removeItem('pendingUploads')
        await claimUploads(ids)
        router.refresh()
      } catch {}
    }
    run()
  }, [router])

  return null
}
