/**
 * Single source of truth for building the edge WASM artifact.
 * Every consumer (CI tests, release, bundle-size bench) must build through
 * this script so the shipped artifact matches the measured one.
 *
 * Pipeline: wasm-pack (release, opt-level=s) -> wasm-opt -Oz
 * opt-level=s measured 20% smaller than the default opt-level=3 at a 3-7%
 * throughput cost; opt-level=z was 29% slower on large documents.
 */
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
function argValue(name, fallback) {
  const i = args.indexOf(name)
  if (i === -1) {
    if (fallback === undefined)
      throw new Error(`Missing required argument ${name}`)
    return fallback
  }
  return args[i + 1]
}

const target = argValue('--target')
const outDir = resolve(argValue('--out-dir'))
const outName = argValue('--out-name', 'mdream_edge')
const edgeDir = resolve(import.meta.dirname, '../crates/edge')

execFileSync('wasm-pack', ['build', '--target', target, '--out-dir', outDir, '--out-name', outName], {
  cwd: edgeDir,
  stdio: 'inherit',
  env: { ...process.env, CARGO_PROFILE_RELEASE_OPT_LEVEL: 's' },
})

const wasmFile = resolve(outDir, `${outName}_bg.wasm`)
const rawSize = statSync(wasmFile).size
execFileSync('wasm-opt', [
  '-Oz',
  '--enable-bulk-memory',
  '--enable-nontrapping-float-to-int',
  '--strip-producers',
  wasmFile,
  '-o',
  wasmFile,
], { stdio: 'inherit' })

const optSize = statSync(wasmFile).size
console.log(`${wasmFile}: ${rawSize} -> ${optSize} bytes (wasm-opt -Oz)`)
