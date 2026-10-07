import type { PerfBench, PerfRun } from '../bundle/perf-report.ts'
import type { Workload } from './fixtures.ts'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { conversionOptions, workloads } from './fixtures.ts'

export function statistics(samples: number[]) {
  if (samples.length < 2 || samples.some(value => !Number.isFinite(value) || value <= 0))
    throw new Error('CPU samples must contain at least two positive finite values.')
  const value = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  const variance = samples.reduce((sum, sample) => sum + (sample - value) ** 2, 0) / (samples.length - 1)
  return { value, rme: Math.sqrt(variance / samples.length) * 1.96 / value * 100 }
}

export function cpuRows(id: string, name: string, base: number[], head: number[]): [PerfBench, PerfBench] {
  assert.equal(base.length, head.length, 'Paired samples must have equal lengths.')
  const comparison = statistics(head.map((sample, index) => sample / base[index]!))
  return [
    { id, name, kind: 'time', ...statistics(base), samples: base },
    { id, name, kind: 'time', ...statistics(head), samples: head, comparisonRatio: comparison.value, comparisonRme: comparison.rme },
  ]
}

type Mode = 'verify' | 'cpu' | 'alloc'
function nativeRunner(binary: string, manifest: string) {
  const child = spawn(binary, [manifest], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  const exit = new Promise<void>((accept, reject) => {
    child.once('error', reject)
    child.stdin.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`Native benchmark exited: ${code ?? signal}`)))
  })
  // Attach a handler immediately; requests and close still propagate the original failure.
  void exit.catch(() => {})
  return {
    async request(index: number, mode: Mode, iterations = 1): Promise<unknown> {
      child.stdin.write(`${JSON.stringify({ case: index, mode, iterations })}\n`)
      const line = await Promise.race([lines.next(), exit.then(() => {
        throw new Error('Native benchmark closed before its response.')
      })])
      if (line.done)
        throw new Error('Native benchmark returned no response.')
      return JSON.parse(line.value)
    },
    async close() {
      child.stdin.end()
      await exit
    },
    kill() { child.kill() },
  }
}
function numberField(value: unknown, field: string): number {
  const n = (value as Record<string, unknown>)?.[field]
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0)
    throw new Error(`Native benchmark returned an invalid ${field}.`)
  return n
}

interface PluginData {
  frontmatter?: Record<string, string>
  extracted?: unknown[]
}
interface Glue {
  htmlToMarkdown: (html: string, options: unknown) => string
  htmlToMarkdownResult: (html: string, options: unknown) => PluginData & { markdown: string }
  MarkdownStream: new (options: unknown) => {
    processChunk: (chunk: string) => string
    finish: () => string
    takeData: () => PluginData
    free: () => void
  }
}
async function loadWasm(dist: string, instance: string): Promise<{ glue: Glue, memory: WebAssembly.Memory }> {
  const url = pathToFileURL(resolve(dist, 'rust/mdream_edge.js'))
  url.searchParams.set('benchmark', instance)
  // wasm-bindgen initializes module state. A unique URL gives each measurement an isolated instance.
  const glue = await import(url.href)
  const wasm = await glue.default({ module_or_path: readFileSync(resolve(dist, 'rust/mdream_edge_bg.wasm')) })
  return { glue, memory: wasm.memory }
}
function wasmRun(glue: Glue, fixture: Workload, verify = false) {
  const options = conversionOptions(fixture.options, fixture.format)
  if (fixture.operation === 'split')
    throw new Error('The edge binding does not export the splitter.')
  if (fixture.operation === 'convert') {
    if (verify) {
      const { markdown, ...metadata } = glue.htmlToMarkdownResult(fixture.html, options)
      return { output: markdown, metadata }
    }
    const output = glue.htmlToMarkdown(fixture.html, options)
    return output.length
  }
  const stream = new glue.MarkdownStream(options)
  let output = ''
  let length = 0
  const extracted: unknown[] = []
  let frontmatter: Record<string, string> | undefined
  function observe(data: PluginData) {
    if (!verify)
      return
    if (data.frontmatter)
      frontmatter = data.frontmatter
    extracted.push(...data.extracted ?? [])
  }
  try {
    for (const chunk of fixture.chunks) {
      const part = stream.processChunk(chunk)
      length += part.length
      if (verify)
        output += part
      const data = stream.takeData()
      observe(data)
    }
    const tail = stream.finish()
    length += tail.length
    const data = stream.takeData()
    observe(data)
    return verify ? { output: output + tail, metadata: { frontmatter, extracted } } : length
  }
  finally { stream.free() }
}

export function normalizedCpuRows(cases: Workload[], benches: PerfBench[]): PerfBench[] {
  return cases.flatMap(fixture => ['native', 'wasm'].flatMap((runtime) => {
    const row = benches.find(item => item.id === `${runtime}-${fixture.id}-cpu`)
    if (!row || fixture.inputBytes === 0)
      return []
    const factor = 1024 * 1024 / fixture.inputBytes
    return [{ ...row, id: `${row.id}-per-mib`, name: `${row.name} / MiB`, value: row.value * factor, samples: row.samples?.map(value => value * factor), informational: true }]
  }))
}

export function scalingRows(cases: Workload[], benches: PerfBench[]): PerfBench[] {
  return cases.flatMap((fixture) => {
    if (!fixture.scaling || fixture.scaling.size === 1)
      return []
    const prior = cases.find(item => item.scaling?.group === fixture.scaling!.group && item.scaling.size * 2 === fixture.scaling!.size)
    if (!prior)
      return []
    return ['native', 'wasm'].flatMap((runtime) => {
      const current = benches.find(row => row.id === `${runtime}-${fixture.id}-cpu`)
      const smaller = benches.find(row => row.id === `${runtime}-${prior.id}-cpu`)
      if (!current || !smaller)
        return []
      return [{ id: `${runtime}-${fixture.id}-scaling`, name: `${runtime} ${fixture.name} / ${prior.name} CPU`, kind: 'ratio' as const, value: current.value / smaller.value, informational: true }]
    })
  })
}

async function main() {
  const [baseDist, headDist, outputDir] = process.argv.slice(2)
  if (!baseDist || !headDist || !outputDir)
    throw new Error('Pass base dist, PR dist, and output directory.')
  // Separate processes must use the same CPU, including on heterogeneous runners.
  const allowedCpu = readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(\d+)/m)?.[1]
  if (!allowedCpu)
    throw new Error('Run this benchmark on Linux with a permitted CPU.')
  execFileSync('taskset', ['--pid', '--cpu-list', allowedCpu, String(process.pid)], { stdio: 'ignore' })
  const samples = Number(process.env.RUST_PERF_SAMPLES || 12)
  if (!Number.isInteger(samples) || samples < 2)
    throw new Error('Sample count must be at least two.')
  const cases = workloads(process.cwd(), process.argv.includes('--full')).filter(item => !process.env.RUST_PERF_FILTER || item.id.includes(process.env.RUST_PERF_FILTER))
  if (!cases.length)
    throw new Error('No benchmark matches the filter.')
  mkdirSync(outputDir, { recursive: true })
  const manifest = resolve(outputDir, 'fixtures.json')
  const serialized = JSON.stringify(cases)
  writeFileSync(manifest, serialized)
  const builds = [baseDist, headDist].map(dist => JSON.parse(readFileSync(resolve(dist, 'rust-perf/build.json'), 'utf8')))
  const results: [PerfRun, PerfRun] = [{ benches: [] }, { benches: [] }]
  const nativeOnly = process.argv.includes('--native-only')
  if (!nativeOnly && !globalThis.gc)
    throw new Error('Run WASM benchmarks with node --expose-gc.')
  const runners = [baseDist, headDist].map(dist => ({
    cpu: nativeRunner(resolve(dist, 'rust-perf/cpu'), manifest),
    alloc: nativeRunner(resolve(dist, 'rust-perf/alloc'), manifest),
  }))
  const verification: Record<string, string> = {}
  try {
    const wasm = nativeOnly ? [] : await Promise.all([loadWasm(baseDist, 'base'), loadWasm(headDist, 'head')])
    for (const [index, fixture] of cases.entries()) {
      process.stderr.write(`Benchmark ${index + 1}/${cases.length}: ${fixture.id}\n`)
      const observations = await Promise.all(runners.map(runner => runner.cpu.request(index, 'verify')))
      assert.deepEqual(observations[0], observations[1], `${fixture.id}: native output differs`)
      verification[fixture.id] = createHash('sha256').update(JSON.stringify(observations[1])).digest('hex')
      for (const [side, runner] of runners.entries()) {
        assert.deepEqual(await runner.alloc.request(index, 'verify'), observations[side], `${fixture.id}: instrumented output differs`)
        const counts = await runner.alloc.request(index, 'alloc')
        assert.deepEqual(await runner.alloc.request(index, 'alloc'), counts, `${fixture.id}: allocation counts vary`)
        for (const field of ['calls', 'reallocations', 'bytes', 'peak']) {
          results[side]!.benches.push({ id: `native-${fixture.id}-${field}`, name: `native ${fixture.name} ${field}`, kind: field === 'calls' || field === 'reallocations' ? 'count' : 'alloc', value: numberField(counts, field) })
        }
      }
      const warm = await Promise.all(runners.map(runner => runner.cpu.request(index, 'cpu', 10)))
      const batch = Math.min(1000, Math.max(5, Math.ceil(10 / Math.min(...warm.map(value => numberField(value, 'cpu'))))))
      const times: [number[], number[]] = [[], []]
      for (let sample = 0; sample < samples; sample++) {
        for (const side of sample % 2 ? [1, 0] : [0, 1])
          times[side]!.push(numberField(await runners[side]!.cpu.request(index, 'cpu', batch), 'cpu'))
      }
      const rows = cpuRows(`native-${fixture.id}-cpu`, `native ${fixture.name} CPU`, times[0], times[1])
      rows.forEach((row, side) => results[side]!.benches.push(row))
      if (fixture.operation !== 'split' && wasm.length) {
        const wasmOutputs = wasm.map(runtime => wasmRun(runtime.glue, fixture, true))
        assert.deepEqual(wasmOutputs[0], wasmOutputs[1], `${fixture.id}: WASM output differs`)
        for (const [side, observed] of wasmOutputs.entries()) {
          const output = typeof observed === 'string' ? observed : (observed as { output: string }).output
          assert.equal(output, (observations[side] as { output: string }).output, `${fixture.id}: native and WASM output differ`)
        }
        for (const runtime of wasm) {
          const until = performance.now() + 100
          do {
            wasmRun(runtime.glue, fixture)
          } while (performance.now() < until)
        }
        const samplesBySide: [number[], number[]] = [[], []]
        let consumed = 0
        for (let sample = 0; sample < samples; sample++) {
          for (const side of sample % 2 ? [1, 0] : [0, 1]) {
            globalThis.gc?.()
            const start = process.threadCpuUsage()
            for (let iteration = 0; iteration < batch; iteration++) consumed += wasmRun(wasm[side]!.glue, fixture) as number
            const time = process.threadCpuUsage(start)
            samplesBySide[side]!.push((time.user + time.system) / 1000 / batch)
          }
        }
        assert.ok(consumed > 0, 'WASM produced no output.')
        const wasmRows = cpuRows(`wasm-${fixture.id}-cpu`, `WASM ${fixture.name} CPU`, samplesBySide[0], samplesBySide[1])
        wasmRows.forEach((row, side) => results[side]!.benches.push(row))
        for (const [side, dist] of [baseDist, headDist].entries()) {
          const fresh = await loadWasm(dist, `memory-${index}-${side}`)
          wasmRun(fresh.glue, fixture)
          results[side]!.benches.push({ id: `wasm-${fixture.id}-memory`, name: `WASM ${fixture.name} linear memory`, kind: 'alloc', value: fresh.memory.buffer.byteLength })
        }
      }
    }
    for (const [side, label] of ['base', 'pr'].entries()) {
      const result = results[side]!
      result.benches.push(...scalingRows(cases, result.benches), ...normalizedCpuRows(cases, result.benches))
      writeFileSync(resolve(outputDir, `${label}-rust-perf.json`), JSON.stringify({ ...result, build: builds[side], cpu: allowedCpu, architecture: process.arch, fixtureDigest: createHash('sha256').update(serialized).digest('hex'), verification, cases: cases.map(({ id, inputBytes, options, format, scaling }) => ({ id, inputBytes, options, format, scaling })) }))
    }
    for (const runner of runners) {
      await runner.cpu.close()
      await runner.alloc.close()
    }
  }
  finally {
    for (const runner of runners) {
      runner.cpu.kill()
      runner.alloc.kill()
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
