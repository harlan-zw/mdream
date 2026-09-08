import { describe, expect, it } from 'vitest'
import { renderPerfReport } from '../../../../bench/bundle/perf-report.ts'

describe('renderPerfReport', () => {
  it('uses paired uncertainty for a paired timing comparison', () => {
    const base = { benches: [{ id: 'ssr', name: 'SSR', kind: 'time' as const, value: 20, rme: 10 }] }
    const pr = { benches: [{ id: 'ssr', name: 'SSR', kind: 'time' as const, value: 18, rme: 10, comparisonRme: 1 }] }

    expect(renderPerfReport(base, pr)).toContain('🟢 -10.0%')
  })

  it('scales ratio-relative uncertainty before comparing it with the base', () => {
    const base = { benches: [{ id: 'ssr', name: 'SSR', kind: 'time' as const, value: 100 }] }
    const pr = {
      benches: [{
        id: 'ssr',
        name: 'SSR',
        kind: 'time' as const,
        value: 92,
        comparisonRatio: 0.92,
        comparisonRme: 4,
      }],
    }

    expect(renderPerfReport(base, pr)).toContain('🟢 -8.0%')
  })
})
