'use client'

import { useState, useRef } from 'react'
import QRCode from 'react-qr-code'

interface Props {
  url: string
  slug: string
  title: string
  startsAt: string | null
  endsAt: string | null
}

function formatPosterDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function svgToImage(svgEl: SVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const encoded = btoa(unescape(encodeURIComponent(svgData)))
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;base64,${encoded}`
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export function QRCodeDisplay({ url, slug, title, startsAt, endsAt }: Props) {
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  async function copyUrl() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function downloadPoster() {
    const svgEl = qrRef.current?.querySelector('svg')
    if (!svgEl) return

    const W = 2480
    const H = 3508
    const margin = 140
    const innerPad = 120
    const borderX = margin
    const borderY = margin
    const borderW = W - margin * 2
    const borderH = H - margin * 2
    const contentX = borderX + innerPad
    const contentW = borderW - innerPad * 2
    const sansFont = '-apple-system, "Helvetica Neue", Arial, "Noto Sans KR", sans-serif'

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // Border
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 4
    ctx.strokeRect(borderX, borderY, borderW, borderH)

    // Title
    ctx.fillStyle = '#000000'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.font = `bold 88px ${sansFont}`
    const titleLines = wrapText(ctx, title, contentW)
    const titleLineHeight = 88 * 1.35
    let y = borderY + innerPad + 80

    for (const line of titleLines) {
      ctx.fillText(line, contentX, y)
      y += titleLineHeight
    }

    // Date
    const startStr = formatPosterDate(startsAt)
    const endStr = formatPosterDate(endsAt)
    const dateStr =
      startStr && endStr ? `${startStr} — ${endStr}`
      : startStr || endStr || ''

    if (dateStr) {
      y += 20
      ctx.font = `400 52px ${sansFont}`
      ctx.fillStyle = '#555555'
      ctx.fillText(dateStr, contentX, y)
      y += 52 * 1.4
    }

    // QR code (centered, ~55% of content width)
    const qrSize = Math.round(contentW * 0.55)
    const qrX = Math.round((W - qrSize) / 2)
    const remainingTop = y + 80
    const remainingBottom = borderY + borderH - innerPad - 120 // reserve space for instruction + openwall.co
    const qrY = Math.round((remainingTop + remainingBottom) / 2 - qrSize / 2)

    const qrImg = await svgToImage(svgEl as unknown as SVGElement)
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    // Instruction below QR
    ctx.font = `400 52px ${sansFont}`
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('Scan to add to the wall.', W / 2, qrY + qrSize + 64)

    // "openwall.co" — bottom-right inside border
    ctx.font = `400 38px -apple-system, "Helvetica Neue", Arial, sans-serif`
    ctx.fillStyle = '#aaaaaa'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('openwall.co', borderX + borderW - innerPad, borderY + borderH - innerPad)

    canvas.toBlob((blob) => {
      if (!blob) return
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `openwall-qr-${slug}.png`
      a.click()
      URL.revokeObjectURL(blobUrl)
    }, 'image/png')
  }

  return (
    <div className="flex flex-col items-center">
      <div ref={qrRef} className="bg-white p-6 inline-block">
        <QRCode value={url} size={200} />
      </div>

      <div className="mt-4 w-full max-w-xs">
        <p className="text-center text-xs font-mono text-secondary break-all bg-surface border border-subtle px-3 py-2">
          {url}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={copyUrl}
          className="text-sm border border-subtle text-fg px-4 py-2 hover:border-fg transition-colors"
        >
          {copied ? '✓ 복사됨' : 'URL 복사'}
        </button>
        <button
          onClick={downloadPoster}
          className="text-sm bg-fg text-bg px-4 py-2 hover:bg-gray6 transition-colors"
        >
          QR 다운로드
        </button>
      </div>
    </div>
  )
}
