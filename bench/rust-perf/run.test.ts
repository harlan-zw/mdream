import { expect, it } from 'vitest'
import { utf8Chunks } from './fixtures.ts'
import { cpuRows, normalizedCpuRows, scalingRows, statistics, verifyComparison, verifyWasmOutputs } from './run.ts'

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

it('distinguishes changed conversion output from metadata or truncation failures', () => {
  const base = { output: '[Link](/x)Next', truncated: false, frontmatter: null, extracted: [] }
  const head = { ...base, output: '[Link](/x) Next' }
  expect(verifyComparison(base, base, 'page')).toBeUndefined()
  expect(verifyComparison(base, head, 'page')).toBe('output changed')
  for (const change of [
    { truncated: true },
    { frontmatter: { title: 'changed' } },
    { extracted: [{ text: 'changed' }] },
    { metadata: [] },
    { output: undefined },
  ]) {
    expect(() => verifyComparison(base, { ...head, ...change }, 'page')).toThrow()
  }
  // Splitter results must still agree completely.
  expect(verifyComparison([{ content: 'same' }], [{ content: 'same' }], 'split')).toBeUndefined()
  expect(() => verifyComparison([{ content: 'before' }], [{ content: 'after' }], 'split')).toThrow()
})

it('keeps native and WASM agreement strict for each revision with changed output', () => {
  const native = [{ output: 'before' }, { output: 'after' }]
  const wasm = native.map(observation => ({ ...observation, metadata: { extracted: [] } }))
  expect(() => verifyWasmOutputs(native, wasm, 'page')).not.toThrow()
  expect(() => verifyWasmOutputs(native, [wasm[0], { output: 'wrong', metadata: { extracted: [] } }], 'page')).toThrow('native and WASM output differ')
  expect(() => verifyWasmOutputs(native, [wasm[0], { ...wasm[1], metadata: { extracted: ['changed'] } }], 'page')).toThrow('metadata differs')
})

it('retains absolute CPU samples without paired comparisons when output changes', () => {
  const rows = cpuRows('cpu', 'CPU', [10, 20], [5, 10], 'output changed')
  expect(rows.map(row => row.value)).toEqual([15, 7.5])
  expect(rows.map(row => row.samples)).toEqual([[10, 20], [5, 10]])
  for (const row of rows) {
    expect(row.comparisonUnavailableReason).toBe('output changed')
    expect(row.comparisonRatio).toBeUndefined()
    expect(row.comparisonRme).toBeUndefined()
  }
})

it('propagates unavailable comparisons through normalization and either scaling input', () => {
  const cases = [1, 2, 4].map(size => ({ id: `page-${size}`, name: `page ${size}`, operation: 'convert' as const, html: 'x', options: 'default' as const, format: 'markdown' as const, inputBytes: size * 1024, scaling: { group: 'page', size } }))
  const benches = [1, 2, 4].map(size => ({ id: `native-page-${size}-cpu`, name: 'CPU', kind: 'time' as const, value: size, comparisonUnavailableReason: size === 2 ? 'output changed' : undefined }))
  expect(normalizedCpuRows(cases, benches).map(row => row.comparisonUnavailableReason)).toEqual([undefined, 'output changed', undefined])
  const scaling = scalingRows(cases, benches)
  expect(scaling.map(row => row.value)).toEqual([2, 2])
  expect(scaling.every(row => row.comparisonUnavailableReason === 'output changed')).toBe(true)
})
