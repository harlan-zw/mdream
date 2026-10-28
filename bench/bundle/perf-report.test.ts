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
      expect(report).toContain(`| ${name} | 90.6 KiB | ℹ️ +371.5% (base informational) | — |`)
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

it('marks changed output while retaining the measurements and verdict', () => {
  const row = { id: 'cpu', name: 'Page CPU', kind: 'time' as const, value: 100 }
  const report = renderPerfReport({ benches: [row] }, { benches: [{ ...row, value: 150, outputChanged: true }] })
  expect(report).toContain('Page CPU (output changed)')
  expect(report).toContain('150.00 ms')
  expect(report).toContain('1 slower')
  expect(report).toContain('Measurements marked "output changed" compare different output or metadata between base and PR.')
})
