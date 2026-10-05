import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import v8 from 'node:v8'
import { countJsStream, longLineFixture, observeJsStream, streamFixture, unicodeHtml } from './perf-fixtures.ts'

function argValue(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || !process.argv[index + 1])
    throw new TypeError(`Missing required argument ${name}`)
  return process.argv[index + 1]
}

function consumeByteChunks(glue, chunks, consume) {
  const stream = new glue.MarkdownStream(undefined)
  const acceptsBytes = typeof stream.processChunkBytes === 'function'
  const decoder = acceptsBytes ? null : new TextDecoder()
  let outputLength = 0
  try {
    for (const chunk of chunks) {
      const output = acceptsBytes
        ? stream.processChunkBytes(chunk)
        : stream.processChunk(decoder.decode(chunk, { stream: true }))
      outputLength += output.length
      consume(output)
    }
    if (decoder) {
      const tail = decoder.decode()
      if (tail) {
        const output = stream.processChunk(tail)
        outputLength += output.length
        consume(output)
      }
    }
    const output = stream.finish()
    outputLength += output.length
    consume(output)
    return outputLength
  }
  finally {
    stream.free()
  }
}

export function drainByteChunks(glue, chunks) {
  const hash = createHash('sha256')
  const length = consumeByteChunks(glue, chunks, (output) => {
    hash.update(output)
  })
  return { length, digest: hash.digest() }
}

export function countByteChunks(glue, chunks) {
  return consumeByteChunks(glue, chunks, () => {})
}

export function assertPairedOutputEquivalence(baseFn, prFn) {
  const base = baseFn()
  const pr = prFn()
  if (base.length !== pr.length)
    throw new TypeError('Base and PR produced different output lengths for the paired fixture.')
  if (!base.digest.equals(pr.digest))
    throw new TypeError('Base and PR produced different markdown output for the paired fixture.')
}

function forceGC() {
  globalThis.gc()
  globalThis.gc()
}

async function measure(fn, runs) {
  forceGC()
  const cpuStart = process.threadCpuUsage()
  const wallStart = performance.now()
  for (let index = 0; index < runs; index++)
    await fn()
  const wall = (performance.now() - wallStart) / runs
  const cpu = process.threadCpuUsage(cpuStart)
  return { cpu: (cpu.user + cpu.system) / 1000 / runs, wall }
}

function stats(samples) {
  const value = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  const variance = samples.reduce((sum, sample) => sum + (sample - value) ** 2, 0) / (samples.length - 1)
  const sem = Math.sqrt(variance) / Math.sqrt(samples.length)
  return { value, rme: sem * 1.96 / value * 100 }
}

async function pairedBenches(baseFn, prFn, { samples = 16, runs = 3 } = {}) {
  for (let index = 0; index < 3; index++) {
    await baseFn()
    await prFn()
  }

  const base = { cpu: [], wall: [] }
  const pr = { cpu: [], wall: [] }
  for (let sample = 0; sample < samples; sample++) {
    const order = sample % 2 === 0
      ? [[base, baseFn], [pr, prFn]]
      : [[pr, prFn], [base, baseFn]]
    for (const [result, fn] of order) {
      const measured = await measure(fn, runs)
      result.cpu.push(measured.cpu)
      result.wall.push(measured.wall)
    }
  }

  return { base, pr }
}

export function perfRun(samples, comparisons, descriptor = {
  id: 'rust-ssr-wiki-bytes',
  name: 'Rust SSR stream (WASM) · wiki byte chunks at link boundaries',
}) {
  const cpu = stats(samples.cpu)
  const wall = stats(samples.wall)
  const cpuComparison = comparisons ? stats(comparisons.cpu) : undefined
  const wallComparison = comparisons ? stats(comparisons.wall) : undefined
  return {
    benches: [
      {
        id: `${descriptor.id}-cpu`,
        name: descriptor.name,
        kind: 'time',
        ...cpu,
        samples: samples.cpu,
        comparisonRatio: cpuComparison?.value,
        comparisonRme: cpuComparison?.rme,
      },
      {
        id: `${descriptor.id}-wall`,
        name: `${descriptor.name} (wall)`,
        kind: 'time',
        ...wall,
        samples: samples.wall,
        comparisonRatio: wallComparison?.value,
        comparisonRme: wallComparison?.rme,
        informational: true,
      },
    ],
  }
}

function splitAfterAnchors(source) {
  const chunks = []
  let start = 0
  for (const match of source.matchAll(/<\/a\s*>/gi)) {
    const end = match.index + match[0].length
    chunks.push(source.slice(start, end))
    start = end
  }
  if (start < source.length)
    chunks.push(source.slice(start))
  return chunks
}

async function loadRust(distDir, instanceName) {
  const wasmBytes = readFileSync(resolve(distDir, 'rust/mdream_edge_bg.wasm'))
  const glueUrl = pathToFileURL(resolve(distDir, 'rust/mdream_edge.js'))
  glueUrl.searchParams.set('instance', instanceName)
  const glue = await import(glueUrl.href)
  await glue.default({ module_or_path: wasmBytes })
  return glue
}

async function main() {
  if (typeof globalThis.gc !== 'function')
    throw new TypeError('Run with node --expose-gc so timing starts from equal heap states.')
  const newSpace = v8.getHeapSpaceStatistics().find(space => space.space_name === 'new_space')
  if (!newSpace || newSpace.space_size < 200 * 1024 * 1024)
    throw new TypeError('Set both semi-space sizes to 256 MiB so collection stays outside timed work.')

  const baseDist = resolve(argValue('--base-dist'))
  const prDist = resolve(argValue('--pr-dist'))
  const baseOut = resolve(argValue('--base-out'))
  const prOut = resolve(argValue('--pr-out'))
  const html = readFileSync(new URL('./bundle/wiki.html', import.meta.url), 'utf8')
  const encoder = new TextEncoder()
  const chunks = splitAfterAnchors(html).map(chunk => encoder.encode(chunk))

  const baseGlue = await loadRust(baseDist, 'paired-base')
  const prGlue = await loadRust(prDist, 'paired-pr')
  const baseFn = () => drainByteChunks(baseGlue, chunks)
  const prFn = () => drainByteChunks(prGlue, chunks)
  assertPairedOutputEquivalence(baseFn, prFn)

  const cases = [{
    descriptor: { id: 'rust-ssr-wiki-bytes', name: 'Rust SSR stream (WASM) · wiki byte chunks at link boundaries' },
    baseFn: () => countByteChunks(baseGlue, chunks),
    prFn: () => countByteChunks(prGlue, chunks),
    samples: 16,
    runs: 3,
  }]
  let consumed = 0
  const source = unicodeHtml()
  const outputDigest = value => ({ length: value.length, digest: createHash('sha256').update(value).digest() })
  for (const format of ['markdown', 'text', 'html']) {
    const baseConvert = () => baseGlue.htmlToMarkdown(source, { format })
    const prConvert = () => prGlue.htmlToMarkdown(source, { format })
    assertPairedOutputEquivalence(() => outputDigest(baseConvert()), () => outputDigest(prConvert()))
    cases.push({
      descriptor: { id: `rust-unicode-${format}`, name: `Rust edge (WASM) · Unicode · ${format}` },
      baseFn: () => { consumed += baseConvert().length },
      prFn: () => { consumed += prConvert().length },
      samples: 8,
      runs: 4,
    })
    const entry = format === 'markdown' ? 'core' : format
    const loadJs = async dist => (await import(pathToFileURL(resolve(dist, `${entry}/fixtures/${entry}.mjs`)).href)).convert
    const baseJs = await loadJs(baseDist)
    const prJs = await loadJs(prDist)
    assertPairedOutputEquivalence(() => outputDigest(baseJs(source)), () => outputDigest(prJs(source)))
    cases.push({
      descriptor: { id: `js-unicode-${format}`, name: `JS · Unicode · ${format}` },
      baseFn: () => { consumed += baseJs(source).length },
      prFn: () => { consumed += prJs(source).length },
      samples: 8,
      runs: 4,
    })
  }

  const loadStream = async dist => (await import(pathToFileURL(resolve(dist, 'stream/fixtures/stream.mjs')).href)).convertStream
  const baseStream = await loadStream(baseDist)
  const prStream = await loadStream(prDist)
  const clock = {
    wall: () => performance.now(),
    cpu: () => {
      const usage = process.threadCpuUsage()
      return (usage.user + usage.system) / 1000
    },
  }
  const observations = { base: [], pr: [] }
  for (const bodyBytes of [2 * 1024 * 1024, 8 * 1024 * 1024]) {
    const fixture = streamFixture('quote', bodyBytes)
    const baseQuote = () => observeJsStream(baseStream, fixture.chunks(), { clock })
    const prQuote = () => observeJsStream(prStream, fixture.chunks(), { clock })
    const baseObserved = await baseQuote()
    const prObserved = await prQuote()
    assertPairedOutputEquivalence(() => baseObserved, () => prObserved)
    const id = `js-stream-quote-${bodyBytes / (1024 * 1024)}mib`
    const details = result => ({ id, bodyBytes: fixture.bodyBytes, inputChunks: result.inputChunks, firstOutput: result.firstOutput })
    observations.base.push(details(baseObserved))
    observations.pr.push(details(prObserved))
    cases.push({
      descriptor: { id, name: `JS stream · open quote · ${bodyBytes / (1024 * 1024)} MiB` },
      baseFn: async () => { consumed += await countJsStream(baseStream, fixture.chunks(), { clock }) },
      prFn: async () => { consumed += await countJsStream(prStream, fixture.chunks(), { clock }) },
      samples: 4,
      runs: 1,
    })
  }

  const longLine = longLineFixture()
  function* longLineBytes() {
    for (const chunk of longLine.chunks())
      yield encoder.encode(chunk)
  }
  const baseLongLine = () => observeJsStream(baseStream, longLine.chunks(), { clock })
  const prLongLine = () => observeJsStream(prStream, longLine.chunks(), { clock })
  const baseLongObserved = await baseLongLine()
  const prLongObserved = await prLongLine()
  assertPairedOutputEquivalence(() => baseLongObserved, () => prLongObserved)
  const longLineId = 'js-stream-quote-longline-1mib'
  const longDetails = result => ({ id: longLineId, bodyBytes: longLine.bodyBytes, inputChunks: result.inputChunks, firstOutput: result.firstOutput })
  observations.base.push(longDetails(baseLongObserved))
  observations.pr.push(longDetails(prLongObserved))
  cases.push({
    descriptor: { id: longLineId, name: 'JS stream · quoted line without newlines · 1 MiB spans' },
    baseFn: async () => { consumed += await countJsStream(baseStream, longLine.chunks(), { clock }) },
    prFn: async () => { consumed += await countJsStream(prStream, longLine.chunks(), { clock }) },
    samples: 4,
    runs: 1,
  })
  const baseRustLongLine = () => drainByteChunks(baseGlue, longLineBytes())
  const prRustLongLine = () => drainByteChunks(prGlue, longLineBytes())
  assertPairedOutputEquivalence(baseRustLongLine, prRustLongLine)
  cases.push({
    descriptor: { id: 'rust-stream-quote-longline-1mib', name: 'Rust edge stream (WASM) · quoted line without newlines · 1 MiB spans' },
    baseFn: () => { consumed += countByteChunks(baseGlue, longLineBytes()) },
    prFn: () => { consumed += countByteChunks(prGlue, longLineBytes()) },
    samples: 4,
    runs: 1,
  })

  const baseResults = { benches: [], observations: observations.base }
  const prResults = { benches: [], observations: observations.pr }
  for (const { descriptor, baseFn, prFn, samples, runs } of cases) {
    const paired = await pairedBenches(baseFn, prFn, { samples, runs })
    const comparisons = {
      cpu: paired.pr.cpu.map((value, index) => value / paired.base.cpu[index]),
      wall: paired.pr.wall.map((value, index) => value / paired.base.wall[index]),
    }
    baseResults.benches.push(...perfRun(paired.base, undefined, descriptor).benches)
    prResults.benches.push(...perfRun(paired.pr, comparisons, descriptor).benches)
  }
  // Keep timing runs observable without retaining converted output.
  baseResults.consumed = consumed
  prResults.consumed = consumed
  writeFileSync(baseOut, `${JSON.stringify(baseResults)}\n`)
  writeFileSync(prOut, `${JSON.stringify(prResults)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
