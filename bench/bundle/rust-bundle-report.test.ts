import { describe, expect, it } from 'vitest'
import { renderRustBundleReport } from './rust-bundle-report'

function bundle(id: string, gzippedSize: number, baseGzippedSize = 0) {
  return { id, name: id, size: gzippedSize * 2, gzippedSize, baseGzippedSize }
}

describe('renderRustBundleReport', () => {
  it('reports when every static format drops runtime code', () => {
    const report = renderRustBundleReport([
      bundle('baseline', 1_000),
      bundle('markdown', 4_000),
      bundle('text', 3_000),
      bundle('safe-html', 3_500),
      bundle('runtime-format', 5_000),
    ])

    expect(report).toContain('Every static format binary is smaller')
    expect(report).toContain('| markdown | 3.9 kB | +2.9 kB | +1 kB |')
  })

  it('warns when all static formats match the runtime selector', () => {
    const report = renderRustBundleReport([
      bundle('baseline', 1_000),
      bundle('markdown', 5_000),
      bundle('text', 4_950),
      bundle('safe-html', 5_100),
      bundle('runtime-format', 5_000),
    ])

    expect(report).toContain('Output modes remain linked')
  })
})
