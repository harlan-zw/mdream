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
  describe('retained heap with unstable samples', () => {
    // Bundle Size Analysis run 39367804677 (PR #398): the base minimum came from
    // one low sample while the first samples of both sides agreed.
    const name = 'JS stream · style · 1 MiB retained heap (sampled peak)'
    const unstable = { id: 'retained', name, kind: 'alloc' as const, value: 19672, samples: [104496, 19672], informational: true }
    const stable = { id: 'retained', name, kind: 'alloc' as const, value: 92760, samples: [104592, 92760], informational: false }

    it('does not gate a growth against an informational base', () => {
      const report = renderPerfReport({ benches: [unstable] }, { benches: [stable] })
      expect(report).toContain('No gated significant change')
      expect(report).not.toContain('within CI noise')
      expect(report).toContain('ℹ️ **1 inconclusive** · past the gate, but the base measurement is informational')
      expect(report).not.toContain('slower')
      expect(report).toContain(`| ${name} | 19.2 KiB | 90.6 KiB | ℹ️ +371.5% (base informational) | — |`)
    })
    it('does not gate a reduction against an informational base', () => {
      const report = renderPerfReport(
        { benches: [{ ...stable, informational: true }] },
        { benches: [{ ...unstable, informational: false }] },
      )
      expect(report).toContain('No gated significant change')
      expect(report).toContain('1 inconclusive')
      expect(report).not.toContain('faster')
      expect(report).toContain('ℹ️ -78.8% (base informational)')
    })
    it('does not gate an informational PR side', () => {
      const report = renderPerfReport({ benches: [stable] }, { benches: [{ ...unstable, value: 192760 }] })
      expect(report).toContain('No significant change')
      expect(report).toContain('ℹ️ +107.8% |')
      expect(report).not.toContain('base informational')
      expect(report).not.toContain('inconclusive')
    })
    it('still gates when neither side has a flag', () => {
      const flagless = { id: 'retained', name, kind: 'alloc' as const }
      const report = renderPerfReport({ benches: [{ ...flagless, value: 19672 }] }, { benches: [{ ...flagless, value: 92760 }] })
      expect(report).toContain('1 slower')
      expect(report).toContain('🔴 +71.4 KiB (+371.5%)')
    })
    it('still gates when both flags are false', () => {
      const report = renderPerfReport({ benches: [{ ...unstable, informational: false }] }, { benches: [stable] })
      expect(report).toContain('1 slower')
      expect(report).not.toContain('inconclusive')
      expect(report).toContain(`| **${name}** | 19.2 KiB → 90.6 KiB | 🔴 +71.4 KiB (+371.5%) |`)
    })
  })
})
