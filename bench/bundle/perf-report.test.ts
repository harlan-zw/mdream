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
  it('keeps comparable regressions visible beside changed outputs', () => {
    const changed = { id: 'changed', name: 'Changed output', kind: 'time' as const, value: 100, rme: 1 }
    const comparable = { id: 'same-output', name: 'Equivalent output', kind: 'time' as const, value: 100, rme: 1 }
    const report = renderPerfReport({ benches: [changed, comparable] }, {
      benches: [
        { ...changed, value: 1, comparisonRme: 0.1, comparisonUnavailableReason: 'output changed' },
        { ...comparable, value: 120 },
      ],
    })
    expect(report).toContain('1 slower')
    expect(report).toContain('1 benchmark not comparable')
    expect(report).toContain('| Changed output | 100.00 ms | 1.00 ms | not comparable: output changed | n/a |')
    expect(report).toContain('+20.0%')
    expect(report).not.toContain('-99.0%')
    expect(report).not.toContain('paired')
  })
  it('does not claim unchanged performance when all outputs changed', () => {
    const row = { id: 'cpu', name: 'CPU', kind: 'time' as const, value: 100 }
    const report = renderPerfReport({ benches: [row] }, {
      benches: [{ ...row, value: 100, comparisonUnavailableReason: 'output changed', comparisonRme: 0.1 }],
    })
    expect(report).toContain('No comparable benchmarks')
    expect(report).toContain('1 benchmark not comparable')
    expect(report).not.toMatch(/No significant change|within noise|paired|[+-]\d+\.\d+%|faster|slower/)
  })
  it('respects a comparison marker supplied only by the base', () => {
    const row = { id: 'calls', name: 'Calls', kind: 'count' as const, value: 0 }
    const report = renderPerfReport({ benches: [{ ...row, comparisonUnavailableReason: 'output changed' }] }, {
      benches: [{ ...row, value: 50 }],
    })
    expect(report).toContain('| Calls | 0 calls | 50 calls | not comparable: output changed | n/a |')
    expect(report).toContain('No comparable benchmarks')
    expect(report).not.toContain('+50 calls')
  })
  it('keeps normalized and scaling measurements incomparable when marked', () => {
    const rows = [
      { id: 'normalized', name: 'CPU per MiB', kind: 'time' as const, value: 50, informational: true },
      { id: 'scaling', name: 'Doubling', kind: 'ratio' as const, value: 2, informational: true },
    ]
    const report = renderPerfReport({ benches: rows }, {
      benches: rows.map(row => ({ ...row, value: row.value * 2, comparisonUnavailableReason: 'output changed', comparisonRme: 1 })),
    })
    expect(report).toContain('2 benchmarks not comparable')
    expect(report).toContain('| CPU per MiB | 50.00 ms | 100.00 ms | not comparable: output changed | n/a |')
    expect(report).toContain('| Doubling | 2.00× | 4.00× | not comparable: output changed | n/a |')
    expect(report).not.toMatch(/No significant change|within noise|paired|[+-]\d+\.\d+%|faster|slower/)
  })
  it('shows the reason even when no base measurement exists', () => {
    const report = renderPerfReport(null, {
      benches: [{ id: 'cpu', name: 'CPU', kind: 'time', value: 100, comparisonUnavailableReason: 'output changed' }],
    })
    expect(report).toContain('not comparable: output changed')
    expect(report).toContain('No comparable benchmarks')
    expect(report).not.toContain('🆕 new')
  })
})
