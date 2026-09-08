import { describe, expect, it } from 'vitest'
import { renderPerfReport } from '../../../../bench/bundle/perf-report'

describe('renderPerfReport', () => {
  it('uses paired uncertainty for a paired timing comparison', () => {
    const base = { benches: [{ id: 'ssr', name: 'SSR', kind: 'time' as const, value: 20, rme: 10 }] }
    const pr = { benches: [{ id: 'ssr', name: 'SSR', kind: 'time' as const, value: 18, rme: 10, comparisonRme: 1 }] }

    expect(renderPerfReport(base, pr)).toContain('🟢 -10.0%')
  })
})
