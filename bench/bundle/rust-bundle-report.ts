import type { Buffer } from 'node:buffer'
import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { dirname, resolve } from 'pathe'

const currentDir = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(currentDir, 'dist')

const RUST_BUNDLES = [
  { id: 'baseline', name: 'Baseline' },
  { id: 'markdown', name: 'Markdown' },
  { id: 'text', name: 'Text' },
  { id: 'safe-html', name: 'Safe HTML' },
  { id: 'runtime-format', name: 'Runtime format' },
] as const

export interface RustBundleData {
  id: string
  name: string
  size: number
  gzippedSize: number
  baseGzippedSize: number
}

const GZIP_NOISE_BYTES = 128

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
  const staticFormats = ['markdown', 'text', 'safe-html'].map(id => requireBundle(data, id))
  const smallerStaticFormats = staticFormats.filter(
    item => runtime.gzippedSize - item.gzippedSize > GZIP_NOISE_BYTES,
  )
  const hasBase = data.some(item => item.baseGzippedSize > 0)

  const output = [
    '### 🦀 Rust Dead Code Elimination',
    '',
    smallerStaticFormats.length === staticFormats.length
      ? '✅ **Every static format binary is smaller than the runtime selector.**'
      : smallerStaticFormats.length === 0
        ? '⚠️ **Static format binaries match the runtime selector. Output modes remain linked.**'
        : '⚠️ **Some static format binaries still retain runtime format code.**',
    '',
    '`runtime-format` hides the selected format from LLVM.',
    'This comparison shows whether fat LTO removes unreachable branches.',
    '',
    hasBase
      ? '| Consumer | Gzipped | Above baseline | Saved vs runtime | PR change |'
      : '| Consumer | Gzipped | Above baseline | Saved vs runtime |',
    hasBase
      ? '|---|---:|---:|---:|---:|'
      : '|---|---:|---:|---:|',
  ]

  for (const item of data) {
    const aboveBaseline = item.id === 'baseline'
      ? '—'
      : formatDelta(item.gzippedSize - baseline.gzippedSize)
    const savedVsRuntime = item.id === 'baseline' || item.id === 'runtime-format'
      ? '—'
      : formatDelta(runtime.gzippedSize - item.gzippedSize)
    const cells = [item.name, formatSize(item.gzippedSize), aboveBaseline, savedVsRuntime]
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
