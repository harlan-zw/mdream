import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import v8 from 'node:v8'

if (typeof globalThis.gc !== 'function')
  throw new TypeError('Run with node --expose-gc so timing starts from equal heap states.')

const newSpace = v8.getHeapSpaceStatistics().find(space => space.space_name === 'new_space')
if (!newSpace || newSpace.space_size < 200 * 1024 * 1024)
  throw new TypeError('Set both semi-space sizes to 256 MiB so collection stays outside timed work.')

const args = process.argv.slice(2)
function argValue(name) {
  const index = args.indexOf(name)
  if (index === -1 || !args[index + 1])
    throw new TypeError(`Missing required argument ${name}`)
  return args[index + 1]
}

const baseDist = resolve(argValue('--base-dist'))
const prDist = resolve(argValue('--pr-dist'))
const baseOut = resolve(argValue('--base-out'))
const prOut = resolve(argValue('--pr-out'))
const html = readFileSync(new URL('./bundle/wiki.html', import.meta.url), 'utf8')
const encoder = new TextEncoder()
const chunks = splitAfterAnchors(html).map(chunk => encoder.encode(chunk))

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

function drainByteChunks(glue) {
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
    }
    if (decoder) {
      const tail = decoder.decode()
      if (tail)
        outputLength += stream.processChunk(tail).length
    }
    outputLength += stream.finish().length
    return outputLength
  }
  finally {
    stream.free()
  }
}

function forceGC() {
  globalThis.gc()
  globalThis.gc()
}

function measure(fn, runs) {
  forceGC()
  const cpuStart = process.threadCpuUsage()
  const wallStart = performance.now()
  for (let index = 0; index < runs; index++)
    fn()
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

function pairedBenches(baseFn, prFn) {
  for (let index = 0; index < 3; index++) {
    baseFn()
    prFn()
  }

  const base = { cpu: [], wall: [] }
  const pr = { cpu: [], wall: [] }
  for (let sample = 0; sample < 16; sample++) {
    const order = sample % 2 === 0
      ? [[base, baseFn], [pr, prFn]]
      : [[pr, prFn], [base, baseFn]]
    for (const [result, fn] of order) {
      const measured = measure(fn, 3)
      result.cpu.push(measured.cpu)
      result.wall.push(measured.wall)
    }
  }

  return { base, pr }
}

function perfRun(samples, comparisons) {
  const cpu = stats(samples.cpu)
  const wall = stats(samples.wall)
  return {
    benches: [
      {
        id: 'rust-ssr-wiki-bytes-cpu',
        name: 'Rust SSR stream (WASM) · wiki byte chunks at link boundaries',
        kind: 'time',
        ...cpu,
        samples: samples.cpu,
        comparisonRme: comparisons ? stats(comparisons.cpu).rme : undefined,
      },
      {
        id: 'rust-ssr-wiki-bytes-wall',
        name: 'Rust SSR stream (WASM) · wiki byte chunks at link boundaries (wall)',
        kind: 'time',
        ...wall,
        samples: samples.wall,
        comparisonRme: comparisons ? stats(comparisons.wall).rme : undefined,
        informational: true,
      },
    ],
  }
}

async function main() {
  const baseGlue = await loadRust(baseDist, 'paired-base')
  const prGlue = await loadRust(prDist, 'paired-pr')
  const baseFn = () => drainByteChunks(baseGlue)
  const prFn = () => drainByteChunks(prGlue)
  if (baseFn() !== prFn())
    throw new TypeError('Base and PR produced different output lengths for the paired fixture.')

  const paired = pairedBenches(baseFn, prFn)
  const comparisons = {
    cpu: paired.pr.cpu.map((value, index) => value / paired.base.cpu[index]),
    wall: paired.pr.wall.map((value, index) => value / paired.base.wall[index]),
  }
  writeFileSync(baseOut, `${JSON.stringify(perfRun(paired.base))}\n`)
  writeFileSync(prOut, `${JSON.stringify(perfRun(paired.pr, comparisons))}\n`)
}

main()
