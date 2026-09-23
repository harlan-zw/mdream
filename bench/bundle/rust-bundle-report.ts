import type { Buffer } from 'node:buffer'
import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { dirname, resolve } from 'pathe'

const currentDir = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(currentDir, 'dist')

const RUST_BUNDLES = [
  { id: 'baseline', name: 'std baseline (no mdream)' },
  { id: 'markdown', name: 'Markdown only' },
  { id: 'text', name: 'Text only' },
  { id: 'safe-html', name: 'Safe HTML only' },
  { id: 'runtime-format', name: 'Runtime selection (all formats)' },
] as const

export interface RustBundleData {
  id: string
  name: string
  size: number
  gzippedSize: number
  baseGzippedSize: number
}

// A single-format build must beat runtime selection by more than this to count
// as smaller. Gzip output shifts by a few bytes between otherwise equal builds.
const MIN_SAVING_BYTES = 256

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

function requireBundle(data: RustBundleData[], id: string): RustBundleData {
  const bundle = data.find(item => item.id === id)
  if (!bundle)
    throw new Error(`Missing Rust bundle measurement: ${id}`)
  return bundle
}

export function renderRustBundleReport(data: RustBundleData[]): string {
  const baseline = requireBundle(data, 'baseline')
  const runtime = requireBundle(data, 'runtime-format')
  const singleFormats = ['markdown', 'text', 'safe-html'].map(id => requireBundle(data, id))
  const notSmaller = singleFormats.filter(
    item => runtime.gzippedSize - item.gzippedSize <= MIN_SAVING_BYTES,
  )
  const hasBase = data.some(item => item.baseGzippedSize > 0)

  const output = [
    '### 🦀 Rust Output Format Features',
    '',
    notSmaller.length === 0
      ? '✅ **Every single-format build is smaller than runtime selection.**'
      : `⚠️ **Not smaller than runtime selection: ${notSmaller.map(item => item.name).join(', ')}.** Check the \`mdream\` features in \`bench/rust-bundle\`.`,
    '',
    'Each single-format binary enables one `mdream` output feature.',
    'Runtime selection enables all of them and picks the format at run time.',
    'Sizes are gzipped native release binaries. A negative delta means smaller.',
    '',
    hasBase
      ? '| Consumer | Gzipped | mdream above std baseline | vs runtime selection | PR change |'
      : '| Consumer | Gzipped | mdream above std baseline | vs runtime selection |',
    hasBase
      ? '|---|---:|---:|---:|---:|'
      : '|---|---:|---:|---:|',
  ]

  for (const item of data) {
    const aboveBaseline = item.id === 'baseline'
      ? '—'
      : formatSize(item.gzippedSize - baseline.gzippedSize)
    const vsRuntime = item.id === 'baseline' || item.id === 'runtime-format'
      ? '—'
      : formatDelta(item.gzippedSize - runtime.gzippedSize)
    const cells = [item.name, formatSize(item.gzippedSize), aboveBaseline, vsRuntime]
    if (hasBase) {
      cells.push(item.baseGzippedSize > 0
        ? formatDelta(item.gzippedSize - item.baseGzippedSize)
        : '🆕')
    }
    output.push(`| ${cells.join(' | ')} |`)
  }

  return output.join('\n')
}

function readBundle(directory: string, id: string): Buffer | null {
  const extension = process.platform === 'win32' ? '.exe' : ''
  const path = resolve(directory, 'rust-native', `${id}${extension}`)
  return fs.existsSync(path) ? fs.readFileSync(path) : null
}

export function collectRustBundleData(): RustBundleData[] {
  const baseDist = process.env.BASE_DIST

  return RUST_BUNDLES.map((spec) => {
    const current = readBundle(distDir, spec.id)
    if (!current)
      throw new Error(`Missing required Rust bundle: rust-native/${spec.id}`)
    const base = baseDist ? readBundle(baseDist, spec.id) : null
    return {
      ...spec,
      size: current.length,
      gzippedSize: zlib.gzipSync(current).length,
      baseGzippedSize: base ? zlib.gzipSync(base).length : 0,
    }
  })
}
