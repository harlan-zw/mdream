import type { Buffer } from 'node:buffer'
import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { dirname, resolve } from 'pathe'
import { BUNDLES } from './bundles.ts'

const currentDir = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(currentDir, 'dist')

export interface BundleData {
  name: string
  size: number
  gzippedSize: number
  baseSize: number
  baseGzippedSize: number
}

type Status = 'new' | 'grew' | 'shrank' | 'same'

// Minifiers can produce tiny byte-level differences without a meaningful change.
const GZIP_NOISE_BYTES = 16

function formatSize(size: number): string {
  return `${Math.round(size / 102.4) / 10} kB`
}

function formatDelta(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const absolute = Math.abs(bytes)
  const sign = bytes > 0 ? '+' : '-'
  return absolute < 100 ? `${sign}${absolute} B` : `${sign}${formatSize(absolute)}`
}

function formatPercent(diff: number, base: number): string {
  if (base <= 0)
    return ''
  const value = (diff / base) * 100
  return ` (${value > 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}%)`
}

function statusOf(item: BundleData): Status {
  if (item.baseSize === 0 && item.baseGzippedSize === 0)
    return 'new'

  const difference = item.gzippedSize - item.baseGzippedSize
  if (Math.abs(difference) < GZIP_NOISE_BYTES)
    return 'same'
  return difference > 0 ? 'grew' : 'shrank'
}

function deltaCell(item: BundleData, status: Status): string {
  if (status === 'new')
    return '🆕 new'
  if (status === 'same')
    return '—'

  const difference = item.gzippedSize - item.baseGzippedSize
  const marker = difference > 0 ? '🔴' : '🟢'
  return `${marker} ${formatDelta(difference)}${formatPercent(difference, item.baseGzippedSize)}`
}

export function renderBundleReport(data: BundleData[]): string {
  const rows = data.map(item => ({ item, status: statusOf(item) }))
  const changed = rows.filter(row => row.status === 'grew' || row.status === 'shrank')
  const grew = changed.filter(row => row.status === 'grew')
  const newBundles = rows.filter(row => row.status === 'new')
  const netGzip = changed.reduce(
    (total, row) => total + row.item.gzippedSize - row.item.baseGzippedSize,
    0,
  )

  const verdict: string[] = []
  if (grew.length) {
    verdict.push(`⚠️ **${grew.length} bundle${grew.length > 1 ? 's' : ''} grew** · net ${formatDelta(netGzip)} gzip`)
  }
  else if (changed.length) {
    verdict.push(`🟢 **${changed.length} smaller** · net ${formatDelta(netGzip)} gzip`)
  }
  else {
    verdict.push('✅ **No notable changes**')
  }
  if (newBundles.length)
    verdict.push(`🆕 ${newBundles.length} new bundle${newBundles.length > 1 ? 's' : ''} tracked`)

  const output = ['### 📦 Bundle Size', '', verdict.join(' · ')]

  if (changed.length) {
    output.push('', '| Bundle | Gzipped | Δ |', '|---|---|---|')
    for (const { item, status } of changed) {
      output.push(
        `| **${item.name}** | ${formatSize(item.baseGzippedSize)} → ${formatSize(item.gzippedSize)} | ${deltaCell(item, status)} |`,
      )
    }
  }

  output.push(
    '',
    `<details><summary>All bundles (${data.length})</summary>`,
    '',
    '| Bundle | Gzipped | Raw | |',
    '|---|---|---|---|',
  )
  for (const { item, status } of rows) {
    const marker = status === 'new' ? '🆕' : status === 'grew' ? '🔴' : status === 'shrank' ? '🟢' : '✅'
    output.push(`| ${item.name} | ${formatSize(item.gzippedSize)} | ${formatSize(item.size)} | ${marker} |`)
  }
  output.push('', '</details>')

  return output.join('\n')
}

function gzipSize(contents: Buffer): number {
  return zlib.gzipSync(contents).length
}

function readBundle(directory: string, file: string): Buffer | null {
  const bundlePath = resolve(directory, file)
  return fs.existsSync(bundlePath) ? fs.readFileSync(bundlePath) : null
}

export function collectBundleData(): BundleData[] {
  const baseDist = process.env.BASE_DIST
  const lastStats: Record<string, { size: number, gz: number }> | null = baseDist
    ? null
    : JSON.parse(fs.readFileSync(resolve(currentDir, 'last.json'), 'utf8'))

  return BUNDLES.map((spec) => {
    const current = readBundle(distDir, spec.file)
    if (!current)
      throw new Error(`Missing required bundle: ${spec.file}`)

    let baseSize = 0
    let baseGzippedSize = 0
    if (baseDist) {
      const base = readBundle(baseDist, spec.file)
      if (base) {
        baseSize = base.length
        baseGzippedSize = gzipSize(base)
      }
    }
    else if (lastStats?.[spec.id]) {
      baseSize = lastStats[spec.id].size
      baseGzippedSize = lastStats[spec.id].gz
    }

    return {
      name: spec.name,
      size: current.length,
      gzippedSize: gzipSize(current),
      baseSize,
      baseGzippedSize,
    }
  })
}
