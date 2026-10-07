import { expect, it } from 'vitest'
import { utf8Chunks } from './fixtures.ts'
import { cpuRows, normalizedCpuRows, scalingRows, statistics } from './run.ts'

it('keeps multibyte characters intact across small transport chunks', () => {
  const source = 'A東京🙂éZ'
  for (const width of [1, 2, 3, 4, 8]) {
    const chunks = utf8Chunks(source, width)
    expect(chunks.join('')).toBe(source)
    expect(chunks.every(chunk => !chunk.includes('�'))).toBe(true)
  }
  expect(() => utf8Chunks(source, 0)).toThrow('positive integer')
})
it('uses paired ratios when runner speed drifts between batches', () => {
  const [base, head] = cpuRows('cpu', 'CPU', [10, 20, 30], [5, 10, 15])
  expect(base.value).toBe(20)
  expect(head.value).toBe(10)
  expect(head.comparisonRatio).toBe(0.5)
  expect(head.comparisonRme).toBe(0)
  expect(() => statistics([0, 1])).toThrow('positive finite')
  expect(() => cpuRows('cpu', 'CPU', [1, 2], [1])).toThrow('equal lengths')
})
it('reports CPU growth for adjacent input sizes without treating it as a speed verdict', () => {
  const cases = [1, 2, 4].map(size => ({ id: `quote-${size}`, name: `quote ${size}`, operation: 'stream' as const, chunks: [], options: 'default' as const, format: 'markdown' as const, inputBytes: size * 1024, scaling: { group: 'quote', size } }))
  const rows = scalingRows(cases, [1, 2, 4].map(size => ({ id: `native-quote-${size}-cpu`, name: '', kind: 'time' as const, value: size * size })))
  expect(rows.map(row => row.value)).toEqual([4, 4])
  expect(rows.every(row => row.informational)).toBe(true)
})

it('normalizes CPU cost by input bytes without creating another regression verdict', () => {
  const fixture = { id: 'page', name: 'page', operation: 'convert' as const, html: 'x', options: 'default' as const, format: 'markdown' as const, inputBytes: 512 * 1024 }
  const rows = normalizedCpuRows([fixture], [{ id: 'native-page-cpu', name: 'Page CPU', kind: 'time', value: 3, samples: [2, 4] }])
  expect(rows[0]?.value).toBe(6)
  expect(rows[0]?.samples).toEqual([4, 8])
  expect(rows[0]?.informational).toBe(true)
})
