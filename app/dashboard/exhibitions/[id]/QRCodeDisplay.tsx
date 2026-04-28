'use client'

import { useState, useRef } from 'react'
import QRCode from 'react-qr-code'

interface Props {
  url: string
  slug: string
}

export function QRCodeDisplay({ url, slug }: Props) {
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  async function copyUrl() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadSvg() {
    const svgEl = qrRef.current?.querySelector('svg')
    if (!svgEl) return
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `openwall-qr-${slug}.svg`
    a.click()
    URL.revokeObjectURL(blobUrl)
  }

  return (
    <div className="flex flex-col items-center">
      {/* QR 코드 */}
      <div
        ref={qrRef}
        className="bg-white p-6 inline-block"
      >
        <QRCode value={url} size={200} />
      </div>

      {/* URL */}
      <div className="mt-4 w-full max-w-xs">
        <p className="text-center text-xs font-mono text-gray-400 break-all bg-black border border-white px-3 py-2">
          {url}
        </p>
      </div>

      {/* 버튼 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={copyUrl}
          className="text-sm border border-white text-white px-4 py-2 hover:border-white transition-colors"
        >
          {copied ? '✓ 복사됨' : 'URL 복사'}
        </button>
        <button
          onClick={downloadSvg}
          className="text-sm bg-white text-black px-4 py-2 hover:bg-gray-100 transition-colors"
        >
          QR 다운로드
        </button>
      </div>
    </div>
  )
}
