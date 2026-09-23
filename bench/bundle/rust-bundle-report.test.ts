import { describe, expect, it } from 'vitest'
import { renderRustBundleReport } from './rust-bundle-report'

function bundle(id: string, gzippedSize: number, baseGzippedSize = 0) {
  return { id, name: id, size: gzippedSize * 2, gzippedSize, baseGzippedSize }
}

describe('renderRustBundleReport', () => {
  it('shows single-format savings as negative deltas', () => {
    const report = renderRustBundleReport([
      bundle('baseline', 1_000),
      bundle('markdown', 4_000),
      bundle('text', 3_000),
      bundle('safe-html', 3_500),
      bundle('runtime-format', 5_000),
    ])

    expect(report).toContain('Every single-format build is smaller')
    expect(report).toContain('| markdown | 3.9 kB | 2.9 kB | -1 kB |')
    expect(report).toContain('| runtime-format | 4.9 kB | 3.9 kB | — |')
  })

  it('names each single-format build that is not meaningfully smaller', () => {
    const report = renderRustBundleReport([
      bundle('baseline', 1_000),
      bundle('markdown', 4_900),
      bundle('text', 3_000),
      bundle('safe-html', 5_100),
      bundle('runtime-format', 5_000),
    ])

    expect(report).toContain('Not smaller than runtime selection: markdown, safe-html.')
    expect(report).toContain('| safe-html | 5 kB | 4 kB | +0.1 kB |')
  })

  it('adds the PR change against the base build', () => {
    const report = renderRustBundleReport([
      bundle('baseline', 1_000, 1_000),
      bundle('markdown', 4_000, 5_000),
      bundle('text', 3_000, 5_000),
      bundle('safe-html', 3_500, 5_000),
      bundle('runtime-format', 5_000, 5_000),
    ])

    expect(report).toContain('| PR change |')
    expect(report).toContain('| markdown | 3.9 kB | 2.9 kB | -1 kB | -1 kB |')
  })
})
