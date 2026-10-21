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

export function cpuRows(id: string, name: string, base: number[], head: number[], comparisonUnavailableReason?: string): [PerfBench, PerfBench] {
  assert.equal(base.length, head.length, 'Paired samples must have equal lengths.')
  const rows: [PerfBench, PerfBench] = [
    { id, name, kind: 'time', ...statistics(base), samples: base, comparisonUnavailableReason },
    { id, name, kind: 'time', ...statistics(head), samples: head, comparisonUnavailableReason },
  ]
  if (!comparisonUnavailableReason) {
    const comparison = statistics(head.map((sample, index) => sample / base[index]!))
    rows[1].comparisonRatio = comparison.value
    rows[1].comparisonRme = comparison.rme
  }
  return rows
}

// A functional fix can change text. All other verification data must still agree.
export function verifyComparison(base: unknown, head: unknown, label: string): string | undefined {
  if (base && head && !Array.isArray(base) && !Array.isArray(head)
    && typeof (base as Record<string, unknown>).output === 'string'
    && typeof (head as Record<string, unknown>).output === 'string') {
    const { output: baseOutput, ...baseData } = base as Record<string, unknown>
    const { output: headOutput, ...headData } = head as Record<string, unknown>
    assert.deepEqual(baseData, headData, `${label}: metadata differs`)
    return baseOutput === headOutput ? undefined : 'output changed'
  }
  // Splitter output and malformed conversion observations remain strict.
  assert.deepEqual(base, head, `${label}: output differs`)
}

export function verifyWasmOutputs(native: unknown[], wasm: unknown[], label: string): void {
  assert.equal(native.length, 2, 'Expected base and PR native observations.')
  assert.equal(wasm.length, 2, 'Expected base and PR WASM observations.')
  for (const [side, observed] of wasm.entries()) {
    const output = (observed as { output?: unknown } | null)?.output
    const nativeOutput = (native[side] as { output?: unknown } | null)?.output
    assert.equal(typeof nativeOutput, 'string', `${label}: native observation ${side} must contain a string output`)
    assert.equal(typeof output, 'string', `${label}: WASM observation ${side} must contain a string output`)
    assert.equal(output, nativeOutput, `${label}: native and WASM output differ`)
  }
  verifyComparison(wasm[0], wasm[1], `${label}: WASM`)
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
      return [{ id: `${runtime}-${fixture.id}-scaling`, name: `${runtime} ${fixture.name} / ${prior.name} CPU`, kind: 'ratio' as const, value: current.value / smaller.value, informational: true, comparisonUnavailableReason: current.comparisonUnavailableReason ?? smaller.comparisonUnavailableReason }]
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
  const verification: [Record<string, string>, Record<string, string>] = [{}, {}]
  const outputDifferences: Record<string, { base: unknown, pr: unknown }> = {}
  try {
    const wasm = nativeOnly ? [] : await Promise.all([loadWasm(baseDist, 'base'), loadWasm(headDist, 'head')])
    for (const [index, fixture] of cases.entries()) {
      process.stderr.write(`Benchmark ${index + 1}/${cases.length}: ${fixture.id}\n`)
      const observations = await Promise.all(runners.map(runner => runner.cpu.request(index, 'verify')))
      const comparisonUnavailableReason = verifyComparison(observations[0], observations[1], `${fixture.id}: native`)
      for (const [side, observed] of observations.entries())
        verification[side]![fixture.id] = createHash('sha256').update(JSON.stringify(observed)).digest('hex')
      if (comparisonUnavailableReason) {
        process.stderr.write(`${fixture.id}: output changed; measuring both revisions without a performance comparison.\n`)
        outputDifferences[fixture.id] = { base: observations[0], pr: observations[1] }
      }
      for (const [side, runner] of runners.entries()) {
        assert.deepEqual(await runner.alloc.request(index, 'verify'), observations[side], `${fixture.id}: instrumented output differs`)
        const counts = await runner.alloc.request(index, 'alloc')
        assert.deepEqual(await runner.alloc.request(index, 'alloc'), counts, `${fixture.id}: allocation counts vary`)
        for (const field of ['calls', 'reallocations', 'bytes', 'peak']) {
          results[side]!.benches.push({ id: `native-${fixture.id}-${field}`, name: `native ${fixture.name} ${field}`, kind: field === 'calls' || field === 'reallocations' ? 'count' : 'alloc', value: numberField(counts, field), comparisonUnavailableReason })
        }
      }
      const warm = await Promise.all(runners.map(runner => runner.cpu.request(index, 'cpu', 10)))
      const batch = Math.min(1000, Math.max(5, Math.ceil(10 / Math.min(...warm.map(value => numberField(value, 'cpu'))))))
      const times: [number[], number[]] = [[], []]
      for (let sample = 0; sample < samples; sample++) {
        for (const side of sample % 2 ? [1, 0] : [0, 1])
          times[side]!.push(numberField(await runners[side]!.cpu.request(index, 'cpu', batch), 'cpu'))
      }
      const rows = cpuRows(`native-${fixture.id}-cpu`, `native ${fixture.name} CPU`, times[0], times[1], comparisonUnavailableReason)
      rows.forEach((row, side) => results[side]!.benches.push(row))
      if (fixture.operation !== 'split' && wasm.length) {
        const wasmOutputs = wasm.map(runtime => wasmRun(runtime.glue, fixture, true))
        verifyWasmOutputs(observations, wasmOutputs, fixture.id)
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
        const wasmRows = cpuRows(`wasm-${fixture.id}-cpu`, `WASM ${fixture.name} CPU`, samplesBySide[0], samplesBySide[1], comparisonUnavailableReason)
        wasmRows.forEach((row, side) => results[side]!.benches.push(row))
        for (const [side, dist] of [baseDist, headDist].entries()) {
          const fresh = await loadWasm(dist, `memory-${index}-${side}`)
          wasmRun(fresh.glue, fixture)
          results[side]!.benches.push({ id: `wasm-${fixture.id}-memory`, name: `WASM ${fixture.name} linear memory`, kind: 'alloc', value: fresh.memory.buffer.byteLength, comparisonUnavailableReason })
        }
      }
    }
    writeFileSync(resolve(outputDir, 'output-differences.json'), JSON.stringify(outputDifferences, null, 2))
    for (const [side, label] of ['base', 'pr'].entries()) {
      const result = results[side]!
      result.benches.push(...scalingRows(cases, result.benches), ...normalizedCpuRows(cases, result.benches))
      writeFileSync(resolve(outputDir, `${label}-rust-perf.json`), JSON.stringify({ ...result, build: builds[side], cpu: allowedCpu, architecture: process.arch, fixtureDigest: createHash('sha256').update(serialized).digest('hex'), verification: verification[side], cases: cases.map(({ id, inputBytes, options, format, scaling }) => ({ id, inputBytes, options, format, scaling })) }))
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
