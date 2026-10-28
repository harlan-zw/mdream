import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { utf8Chunks } from './fixtures.ts'
import { assertWasmMetadata, cpuRows, main, normalizedCpuRows, outputVerification, scalingRows, statistics, wasmRun } from './run.ts'

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

it('records each revision output without rejecting an intentional change', () => {
  const base = { output: '- a\n- b', metadata: {} }
  const head = { output: '- a\n\n* b', metadata: {} }
  const changed = outputVerification(base, head)
  expect(changed.changed).toBe(true)
  expect(changed.hashes[0]).not.toBe(changed.hashes[1])
  const same = outputVerification(base, { ...base })
  expect(same.changed).toBe(false)
  expect(same.hashes[0]).toBe(same.hashes[1])
  expect(outputVerification(base, { ...base, metadata: { title: 'page' } }).changed).toBe(true)
})

it('carries output changes into normalized and scaling measurements', () => {
  const cases = [1, 2, 4].map(size => ({ id: `quote-${size}`, name: `quote ${size}`, operation: 'stream' as const, chunks: [], options: 'default' as const, format: 'markdown' as const, inputBytes: size * 1024, scaling: { group: 'quote', size } }))
  const benches = [1, 2, 4].map(size => ({ id: `native-quote-${size}-cpu`, name: '', kind: 'time' as const, value: size, outputChanged: size === 2 }))
  expect(normalizedCpuRows(cases, benches).map(row => row.outputChanged)).toEqual([false, true, false])
  expect(scalingRows(cases, benches).map(row => row.outputChanged)).toEqual([true, true])
})

it('uses serialized observations for both the change flag and digests', () => {
  const base = { output: 'same', metadata: {} }
  const reordered = outputVerification(base, { metadata: {}, output: 'same' })
  expect(reordered.changed).toBe(true)
  expect(reordered.hashes[0]).not.toBe(reordered.hashes[1])
  const omitted = outputVerification(base, { ...base, absent: undefined })
  expect(omitted.changed).toBe(false)
  expect(omitted.hashes[0]).toBe(omitted.hashes[1])
})

// Protocol sources: bench/rust-perf/src/main.rs::run/extracted_values,
// crates/edge/src/lib.rs::set_plugin_data and run.ts::wasmRun.
function metadataObservation(operation: 'convert' | 'stream', title = 'page') {
  const element = { selector: 'h2', tag: 'h2', text: title, attributes: [['id', 'intro'], ['class', 'title']] }
  const native = { output: title, truncated: false, frontmatter: [['title', title]], [operation === 'stream' ? 'metadata' : 'extracted']: [element] }
  const wasm = { output: title, metadata: { frontmatter: { title }, extracted: [{ selector: 'h2', tagName: 'h2', textContent: title, attributes: { class: 'title', id: 'intro' } }] } }
  return { native, wasm }
}

describe.each(['convert', 'stream'] as const)('same-revision WASM metadata (%s)', (operation) => {
  it('checks the actual wasmRun result shape with protocol-shaped glue', () => {
    const { native, wasm } = metadataObservation(operation)
    let drained = false
    let freed = false
    const glue = {
      htmlToMarkdown: () => wasm.output,
      htmlToMarkdownResult: () => ({ markdown: wasm.output, ...wasm.metadata }),
      MarkdownStream: class {
        processChunk() { return wasm.output }
        finish() { return '' }
        takeData() {
          if (drained)
            return {}
          drained = true
          return wasm.metadata
        }

        free() { freed = true }
      },
    }
    const fixture = operation === 'convert'
      ? { id: 'page', name: 'page', operation, html: '<h2>page</h2>', options: 'metadata' as const, format: 'markdown' as const, inputBytes: 13 }
      : { id: 'page', name: 'page', operation, chunks: ['<h2>page</h2>'], options: 'metadata' as const, format: 'markdown' as const, inputBytes: 13 }
    const observed = wasmRun(glue, fixture, true)
    expect(observed).toEqual(wasm)
    expect(() => assertWasmMetadata([native, native], [observed, observed], 'page', operation)).not.toThrow()
    expect(freed).toBe(operation === 'stream')
  })

  it('allows matching metadata changes in both runtimes and marks the revision change', () => {
    const base = metadataObservation(operation, 'before')
    const head = metadataObservation(operation, 'after')
    expect(() => assertWasmMetadata([base.native, head.native], [base.wasm, head.wasm], 'page', operation)).not.toThrow()
    expect(outputVerification(base.native, head.native).changed).toBe(true)
  })

  it('marks a matching metadata-only change while Markdown stays the same', () => {
    const base = metadataObservation(operation, 'before')
    const head = metadataObservation(operation, 'after')
    for (const row of [base, head]) {
      row.native.output = 'same'
      row.wasm.output = 'same'
    }
    expect(() => assertWasmMetadata([base.native, head.native], [base.wasm, head.wasm], 'page', operation)).not.toThrow()
    expect(outputVerification(base.native, head.native).changed).toBe(true)
  })

  it.each([0, 1])('rejects a WASM-only mismatch on revision %s even when native metadata changes', (side) => {
    const observations = [metadataObservation(operation, 'before'), metadataObservation(operation, 'after')]
    observations[side]!.wasm.metadata.frontmatter.title = 'broken'
    expect(() => assertWasmMetadata(observations.map(row => row.native), observations.map(row => row.wasm), 'page', operation)).toThrow('native and WASM metadata differ')
  })

  it.each([0, 1])('rejects a native-only mismatch on revision %s even when native metadata changes', (side) => {
    const observations = [metadataObservation(operation, 'before'), metadataObservation(operation, 'after')]
    observations[side]!.native.frontmatter = [['title', 'broken']]
    expect(() => assertWasmMetadata(observations.map(row => row.native), observations.map(row => row.wasm), 'page', operation)).toThrow('native and WASM metadata differ')
  })

  it('rejects the same incorrect WASM metadata in both revisions', () => {
    const { native, wasm } = metadataObservation(operation)
    wasm.metadata.extracted[0]!.textContent = 'broken'
    expect(() => assertWasmMetadata([native, native], [wasm, wasm], 'page', operation)).toThrow('native and WASM metadata differ')
  })

  it.each(['selector', 'tagName', 'textContent', 'attributes'] as const)('checks extraction %s rather than only frontmatter', (field) => {
    const { native, wasm } = metadataObservation(operation)
    const element = { ...wasm.metadata.extracted[0], [field]: field === 'attributes' ? { id: 'broken' } : 'broken' }
    const broken = { ...wasm, metadata: { ...wasm.metadata, extracted: [element] } }
    expect(() => assertWasmMetadata([native, native], [wasm, broken], 'page', operation)).toThrow('native and WASM metadata differ')
  })

  it.each([null, undefined, []])('normalizes absent or empty native plugin data (%s)', (empty) => {
    const native = { output: 'same', truncated: true, frontmatter: empty, [operation === 'stream' ? 'metadata' : 'extracted']: empty }
    // Convert omits absent data; wasmRun streaming always collects an array.
    const wasm = { output: 'same', metadata: operation === 'stream' ? { frontmatter: undefined, extracted: [] } : {} }
    expect(() => assertWasmMetadata([native, native], [wasm, wasm], 'empty', operation)).not.toThrow()
    const emptyObjects = { output: 'same', metadata: { frontmatter: {}, extracted: [] } }
    expect(() => assertWasmMetadata([native, native], [emptyObjects, emptyObjects], 'empty', operation)).not.toThrow()
  })

  it('rejects absent WASM data when native data is nonempty', () => {
    const { native, wasm } = metadataObservation(operation)
    const absentFrontmatter = { ...wasm, metadata: { extracted: wasm.metadata.extracted } }
    const absentExtraction = { ...wasm, metadata: { frontmatter: wasm.metadata.frontmatter } }
    for (const observed of [absentFrontmatter, absentExtraction])
      expect(() => assertWasmMetadata([native, native], [wasm, observed], 'page', operation)).toThrow('native and WASM metadata differ')
  })

  it('normalizes empty extraction attributes and frontmatter pairs', () => {
    const native = { output: 'same', truncated: false, frontmatter: [], [operation === 'stream' ? 'metadata' : 'extracted']: [{ selector: 'h2', tag: 'h2', text: '', attributes: [] }] }
    const wasm = { output: 'same', metadata: { frontmatter: {}, extracted: [{ selector: 'h2', tagName: 'h2', textContent: '', attributes: {} }] } }
    expect(() => assertWasmMetadata([native, native], [wasm, wasm], 'empty', operation)).not.toThrow()
  })

  it('preserves unexpected observation, metadata and extraction fields', () => {
    const { native, wasm } = metadataObservation(operation)
    const broken = [
      { ...wasm, actualmetadata: 'unexpected' },
      { ...wasm, metadata: { ...wasm.metadata, actualmetadata: 'unexpected' } },
      { ...wasm, metadata: { ...wasm.metadata, extracted: [{ ...wasm.metadata.extracted[0], actualmetadata: 'unexpected' }] } },
    ]
    for (const observed of broken)
      expect(() => assertWasmMetadata([native, native], [wasm, observed], 'page', operation)).toThrow('native and WASM metadata differ')
    expect(() => assertWasmMetadata([native, { ...native, actualmetadata: 'unexpected' }], [wasm, wasm], 'page', operation)).toThrow('native and WASM metadata differ')
    const key = operation === 'stream' ? 'metadata' : 'extracted'
    const unexpectedExtraction = { ...native, [key]: [{ selector: 'h2', tag: 'h2', text: 'page', attributes: [['class', 'title'], ['id', 'intro']], actualmetadata: 'unexpected' }] }
    expect(() => assertWasmMetadata([native, unexpectedExtraction], [wasm, wasm], 'page', operation)).toThrow('native and WASM metadata differ')
  })
})

it.each([false, true])('marks every written fixture row only when output changes (%s)', async (changed) => {
  const root = mkdtempSync(join(tmpdir(), 'mdream-fixture-loop-'))
  vi.stubEnv('RUST_PERF_SAMPLES', '2')
  vi.stubEnv('RUST_PERF_FILTER', '')
  try {
    const base = join(root, 'base')
    const head = join(root, 'head')
    const out = join(root, 'results')
    for (const dist of [base, head]) {
      mkdirSync(join(dist, 'rust-perf'), { recursive: true })
      writeFileSync(join(dist, 'rust-perf/build.json'), '{}')
    }
    let closed = 0
    let killed = 0
    const fixture = { id: 'page', name: 'page', operation: 'convert' as const, html: '<p>page</p>', options: 'default' as const, format: 'markdown' as const, inputBytes: 11 }
    await main([base, head, out, '--native-only'], {
      pinCpu: () => 'synthetic',
      workloads: () => [fixture],
      nativeRunner(binary, manifest) {
        expect(JSON.parse(readFileSync(manifest, 'utf8'))).toEqual([fixture])
        const output = changed && binary.startsWith(head) ? 'after' : 'before'
        return {
          async request(_index, mode) {
            if (mode === 'verify')
              return { output, frontmatter: null, extracted: [], truncated: false }
            if (mode === 'alloc')
              return { calls: 1, reallocations: 0, bytes: 10, peak: 10 }
            return { cpu: 1 }
          },
          async close() { closed++ },
          kill() { killed++ },
        }
      },
    })
    const runs = ['base', 'pr'].map(side => JSON.parse(readFileSync(join(out, `${side}-rust-perf.json`), 'utf8')))
    for (const run of runs) {
      expect(run.benches.map((row: { id: string }) => row.id)).toEqual(['calls', 'reallocations', 'bytes', 'peak', 'cpu', 'cpu-per-mib'].map(metric => `native-page-${metric}`))
      for (const row of run.benches)
        expect(Boolean(row.outputChanged)).toBe(changed)
    }
    expect(runs[0].verification.page === runs[1].verification.page).toBe(!changed)
    expect(closed).toBe(4)
    expect(killed).toBe(4)
  }
  finally {
    vi.unstubAllEnvs()
    rmSync(root, { recursive: true, force: true })
  }
})

function streamingMetadataProtocol(title: string, unexpectedStage?: 'chunk' | 'final', opaque = false) {
  const calls: unknown[][] = []
  const nativeElement = (text: string) => ({ selector: 'h2', tag: 'h2', text, attributes: [['id', text]] })
  const wasmElement = (text: string) => ({ selector: 'h2', tagName: 'h2', textContent: text, attributes: { id: text } })
  const first = `${title}-chunk`
  const last = `${title}-final`
  const native = { output: 'same', truncated: false, frontmatter: [['title', title]], metadata: [nativeElement(first), nativeElement(last)] }
  const fixture = { id: 'page', name: 'page', operation: 'stream' as const, chunks: ['first', 'second'], options: 'metadata' as const, format: 'markdown' as const, inputBytes: 11 }
  const schedule = [
    { frontmatter: { title: 'partial' }, extracted: [wasmElement(first)] },
    { frontmatter: { title }, extracted: [] },
    { extracted: [wasmElement(last)] },
  ]
  let chunk = 0
  let dataIndex = 0
  const glue = {
    htmlToMarkdown: () => '',
    htmlToMarkdownResult: () => ({ markdown: '' }),
    MarkdownStream: class {
      constructor(options: unknown) { calls.push(['new', options]) }
      processChunk(value: string) {
        calls.push(['chunk', value])
        return chunk++ === 0 ? 's' : 'ame'
      }

      finish() {
        calls.push(['finish'])
        return ''
      }

      takeData() {
        calls.push(['takeData'])
        const index = dataIndex++
        const data = schedule[index]!
        if (opaque) {
          return new Proxy(data, {
            ownKeys() { throw new Error('Timed path scanned metadata') },
            get() { throw new Error('Timed path read metadata') },
          })
        }
        return index === (unexpectedStage === 'chunk' ? 0 : unexpectedStage === 'final' ? 2 : -1)
          ? { ...data, unexpected: 'broken' }
          : data
      }

      free() { calls.push(['free']) }
    },
  }
  return { glue, fixture, native, calls }
}

const streamingMetadataCalls = [
  ['new', { format: 'markdown', plugins: { frontmatter: true, extraction: { selectors: ['h2'] } } }],
  ['chunk', 'first'],
  ['takeData'],
  ['chunk', 'second'],
  ['takeData'],
  ['finish'],
  ['takeData'],
  ['free'],
]

it('collects legitimate changing streaming metadata through the final takeData', () => {
  const rows = ['before', 'after'].map(title => streamingMetadataProtocol(title))
  const observations = rows.map(row => wasmRun(row.glue, row.fixture, true))
  expect(() => assertWasmMetadata(rows.map(row => row.native), observations, 'page', 'stream')).not.toThrow()
  expect(outputVerification(rows[0]!.native, rows[1]!.native).changed).toBe(true)
  for (const row of rows)
    expect(row.calls).toEqual(streamingMetadataCalls)
})

describe.each([0, 1])('unexpected streaming metadata on revision %s', (side) => {
  it.each(['chunk', 'final'] as const)('rejects a field from the %s takeData before parity can accept it', (stage) => {
    const rows = ['before', 'after'].map((title, index) => streamingMetadataProtocol(title, index === side ? stage : undefined))
    expect(() => {
      const observations = rows.map(row => wasmRun(row.glue, row.fixture, true))
      assertWasmMetadata(rows.map(row => row.native), observations, 'page', 'stream')
    }).toThrow('Unexpected WASM stream metadata field: unexpected')
    for (let index = 0; index <= side; index++) {
      const calls = index === side && stage === 'chunk'
        ? [...streamingMetadataCalls.slice(0, 3), ['free']]
        : streamingMetadataCalls
      expect(rows[index]!.calls).toEqual(calls)
    }
  })
})

it('does not inspect takeData objects on the timed streaming path', () => {
  const row = streamingMetadataProtocol('page', undefined, true)
  expect(wasmRun(row.glue, row.fixture, false)).toBe(4)
  expect(row.calls).toEqual(streamingMetadataCalls)
})
