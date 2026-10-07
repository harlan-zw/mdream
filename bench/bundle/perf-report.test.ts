import { describe, expect, it } from 'vitest'
import { renderPerfReport } from './perf-report.ts'

describe('performance report', () => {
  it('reports allocation counts without applying a byte threshold', () => {
    const base = { benches: [{ id: 'calls', name: 'Allocation calls', kind: 'count' as const, value: 10000 }] }
    const head = { benches: [{ ...base.benches[0]!, value: 12 }] }
    const report = renderPerfReport(base, head)
    expect(report).toContain('1 faster')
    expect(report).toContain('10000 calls → 12 calls')
    expect(report).toContain('-99.9%')
    expect(report).not.toContain('KiB')
  })
  it('shows a small timing delta without declaring a speedup', () => {
    const row = { id: 'cpu', name: 'CPU', kind: 'time' as const, value: 100 }
    const report = renderPerfReport({ benches: [row] }, { benches: [{ ...row, value: 97 }] })
    expect(report).toContain('No significant change')
    expect(report).toContain('-3.0% (within noise)')
  })
  it('shows new costs from a zero baseline as absolute counts', () => {
    const row = { id: 'calls', name: 'Calls', kind: 'count' as const, value: 0 }
    const report = renderPerfReport({ benches: [row] }, { benches: [{ ...row, value: 50 }] })
    expect(report).toContain('1 slower')
    expect(report).toContain('+50 calls')
    expect(report).not.toContain('+0.0%')
  })
  it('keeps scaling ratios informational', () => {
    const row = { id: 'scale', name: 'Doubling', kind: 'ratio' as const, value: 2, informational: true }
    const report = renderPerfReport({ benches: [row] }, { benches: [{ ...row, value: 4 }] })
    expect(report).toContain('No significant change')
    expect(report).toContain('4.00×')
  })
})
