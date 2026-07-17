// Standalone perf harness for CI. Run base and PR on the SAME runner and diff the
// JSON it prints on stdout, so cross-machine variance cancels. Three signals per bench:
//  - main-thread CPU time (mean ms + 95% RME). Process-wide cpuUsage() is ~3x noisier
//    here because V8's background GC/JIT threads get counted; threadCpuUsage() (Node
//    24+) excludes them AND excludes descheduling, so it's the gated authority.
//  - wall time (mean ms + 95% RME; informational only, never drives the verdict)
//  - allocated bytes per convert (near-deterministic; surfaces marginal gains that
//    noisy timing hides). For the Rust build the memory signal is peak WASM linear
//    memory instead, which is exactly deterministic.
//
// Allocation is measured in TWO modes because TurboFan's escape analysis can
// eliminate several MiB per convert, and whether it kicks in depends on inlining
// heuristics that flip with unrelated code-size changes, minifier output, node
// minor and CPU arch (PR #137 false-alarmed +5.8% from exactly this):
//  - default run: JIT-optimized alloc, what shipped users see — informational only
//  - --alloc-only run (workflow adds --no-opt): what the code semantically
//    allocates, deterministic to ~0.03% — this is the gated memory signal
//
// It imports the built bundle dist on purpose (measures shipped output). Point
// MDREAM_PERF_DIST at another dist dir (e.g. the base branch build) to measure it
// with this same harness and fixture.
//
// Requires: node --expose-gc --min-semi-space-size=256 --max-semi-space-size=256
// The pinned semi-space keeps the biggest single run (a stream drain allocates
// ~156 MB) inside new-space so no scavenge fires mid-run, making heapUsed delta ==
// bytes allocated. Output is a single JSON line; keep stdout clean.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import v8 from 'node:v8'

if (typeof globalThis.gc !== 'function')
  throw new TypeError('Run with node --expose-gc so allocation can be measured.')

const newSpace = v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space')
if (!newSpace || newSpace.space_size < 200 * 1024 * 1024)
  throw new TypeError('Run with --min-semi-space-size=256 --max-semi-space-size=256 so allocation stays in new-space.')

const currentDir = dirname(fileURLToPath(import.meta.url))
const distDir = process.env.MDREAM_PERF_DIST || resolve(currentDir, 'bundle/dist')
const bundle = name => import(pathToFileURL(resolve(distDir, name)).href)

// the fixture always comes from the PR checkout so base and PR chew identical input
const html = readFileSync(resolve(currentDir, 'bundle/wiki.html'), 'utf8')
const htmlBytes = new TextEncoder().encode(html)
const STREAM_CHUNK_SIZE = 16 * 1024

function forceGC() {
  globalThis.gc()
  globalThis.gc()
}

function stats(samples) {
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (samples.length - 1)
  const sem = Math.sqrt(variance) / Math.sqrt(samples.length)
  return { value: mean, rme: (sem * 1.96 / mean) * 100 } // 95% CI as a percentage of the mean
}

// per batch, record both wall time and main-thread CPU time (user+system); the
// latter excludes background V8 threads and descheduling, so it's the steadier signal
async function measureTimes(fn, { warmup = 3, reps = 16, runs = 3 } = {}) {
  for (let i = 0; i < warmup; i++) await fn()
  const wall = []
  const cpu = []
  for (let r = 0; r < reps; r++) {
    forceGC()
    const c0 = process.threadCpuUsage()
    const t0 = performance.now()
    for (let i = 0; i < runs; i++) await fn()
    wall.push((performance.now() - t0) / runs)
    const c = process.threadCpuUsage(c0)
    cpu.push((c.user + c.system) / 1000 / runs) // microseconds -> ms per convert
  }
  return { wall: stats(wall), cpu: stats(cpu) }
}

// bytes allocated per convert. With the pinned semi-space nothing is collected during
// a run, so heapUsed delta == bytes allocated. Samples land in two tight clusters
// (to-space accounting alternates); the MINIMUM is the clean floor and reproduces
// across processes to ~0.1%, so marginal wins that noisy timing hides show up here.
async function measureAlloc(fn, { warmup = 3, reps = 9 } = {}) {
  for (let i = 0; i < warmup; i++) await fn()
  let min = Infinity
  for (let r = 0; r < reps; r++) {
    forceGC()
    const before = process.memoryUsage().heapUsed
    await fn()
    const delta = process.memoryUsage().heapUsed - before
    if (delta < min)
      min = delta
  }
  return { value: min }
}

async function timeBenches(id, name, fn, timeOpts) {
  const times = await measureTimes(fn, timeOpts)
  return [
    { id: `${id}-cpu`, name: `${name} (CPU)`, kind: 'time', value: times.cpu.value, rme: times.cpu.rme },
    { id: `${id}-wall`, name: `${name} (wall)`, kind: 'time', value: times.wall.value, rme: times.wall.rme, informational: true },
  ]
}

async function bench(id, name, fn, timeOpts) {
  const times = await timeBenches(id, name, fn, timeOpts)
  const alloc = await measureAlloc(fn)
  return [
    ...times,
    // JIT-optimized allocation reflects shipped behavior but sits on escape-analysis
    // cliffs (see header); the --alloc-only no-opt run carries the gated signal
    { id: `${id}-alloc-jit`, name: `${name} allocated (JIT)`, kind: 'alloc', value: alloc.value, informational: true },
  ]
}

// Rust edge (WASM) build. wasm-pack --target web glue: init with the raw bytes.
// Tolerate absence — an older base dist may predate the Rust bundle, in which case
// the PR's Rust benches surface as new instead of failing the base run.
async function rustBenches() {
  let glue, wasmBytes
  try {
    wasmBytes = readFileSync(resolve(distDir, 'rust/mdream_edge_bg.wasm'))
    glue = await import(pathToFileURL(resolve(distDir, 'rust/mdream_edge.js')).href)
  }
  catch (e) {
    if (e?.code === 'ENOENT' || e?.code === 'MODULE_NOT_FOUND' || e?.code === 'ERR_MODULE_NOT_FOUND')
      return []
    throw e
  }
  const instance = await glue.default({ module_or_path: wasmBytes })
  const convertRust = () => glue.htmlToMarkdown(html, undefined)
  const times = await timeBenches('rust-wiki', 'Rust edge (WASM) · wiki', convertRust, { warmup: 5, reps: 16, runs: 8 })
  // linear memory only grows, and after the timed warm runs it has hit its plateau,
  // so this is a deterministic peak (exact byte-for-byte across runs), not a sample
  return [
    ...times,
    { id: 'rust-wiki-mem', name: 'Rust edge (WASM) · wiki linear memory (peak)', kind: 'alloc', value: instance.memory.buffer.byteLength },
  ]
}

async function main() {
  const { convert } = await bundle('core/fixtures/core.mjs')
  const { convert: convertMinimal } = await bundle('minimal/fixtures/minimal.mjs')
  const { convertStream } = await bundle('stream/fixtures/stream.mjs')

  async function drainStream() {
    let offset = 0
    const stream = new ReadableStream({
      pull(controller) {
        if (offset < htmlBytes.length) {
          controller.enqueue(htmlBytes.subarray(offset, offset + STREAM_CHUNK_SIZE))
          offset += STREAM_CHUNK_SIZE
        }
        else {
          controller.close()
        }
      },
    })
    let total = 0
    for await (const chunk of convertStream(stream))
      total += chunk.length
    return total
  }

  const JS_BENCHES = [
    ['core-wiki', 'JS htmlToMarkdown · wiki (1.8 MB)', () => convert(html), undefined],
    ['minimal-wiki', 'JS minimal preset · wiki', () => convertMinimal(html), { reps: 12, runs: 1 }],
    ['stream-wiki', 'JS stream drain · wiki', drainStream, undefined],
  ]

  // gated memory signal: run under --no-opt so escape analysis can't make the
  // number depend on inlining luck; measures what the code semantically allocates
  if (process.argv.includes('--alloc-only')) {
    const benches = []
    for (const [id, name, fn] of JS_BENCHES) {
      const alloc = await measureAlloc(fn)
      benches.push({ id: `${id}-alloc`, name: `${name} allocated`, kind: 'alloc', value: alloc.value })
    }
    process.stdout.write(`${JSON.stringify({ benches })}\n`)
    return
  }

  const benches = []
  for (const [id, name, fn, timeOpts] of JS_BENCHES)
    benches.push(...await bench(id, name, fn, timeOpts))
  benches.push(...await rustBenches())

  process.stdout.write(`${JSON.stringify({ benches })}\n`)
}

main()
