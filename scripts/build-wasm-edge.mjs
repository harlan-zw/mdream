/**
 * Single source of truth for building the edge WASM artifact.
 * Every consumer (CI tests, release, bundle-size bench) must build through
 * this script so the shipped artifact matches the measured one.
 *
 * Pipeline: wasm-pack (release, opt-level=s)
 *        -> wasm-opt -O3 --converge --low-memory-unused
 * opt-level=s measured 20% smaller than the default opt-level=3 at a 3-7%
 * throughput cost; opt-level=z was 29% slower on large documents.
 *
 * On the wasm-opt side the win comes from --converge. Benchmark this flag set
 * on arm64, which the perf gate uses: it is worth 4.3% there and only ~1.4% on
 * x86_64, so a local x86 run reads as noise.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
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
// Test-only cargo features (e.g. panic-probe). Released artifacts pass none.
const features = argValue('--features', '')
const edgeDir = resolve(import.meta.dirname, '../crates/edge')

const cargoArgs = features ? ['--', '--features', features] : []

execFileSync('wasm-pack', ['build', '--target', target, '--out-dir', outDir, '--out-name', outName, ...cargoArgs], {
  cwd: edgeDir,
  stdio: 'inherit',
  env: { ...process.env, CARGO_PROFILE_RELEASE_OPT_LEVEL: 's' },
})

const OPT_FLAGS = ['-O3', '--converge', '--low-memory-unused']

const wasmFile = resolve(outDir, `${outName}_bg.wasm`)
const rawSize = statSync(wasmFile).size
execFileSync('wasm-opt', [
  ...OPT_FLAGS,
  '--enable-bulk-memory',
  '--enable-nontrapping-float-to-int',
  '--strip-producers',
  wasmFile,
  '-o',
  wasmFile,
], { stdio: 'inherit' })

const optSize = statSync(wasmFile).size
console.log(`${wasmFile}: ${rawSize} -> ${optSize} bytes (wasm-opt ${OPT_FLAGS.join(' ')})`)

// wasm-bindgen attaches `Symbol.dispose` to each class in a top-level
// statement after the class. A bundler must keep that statement, so it keeps
// the class in every bundle, even a bundle that never uses it. A class method
// does the same job and lets an unused class tree-shake. On a runtime without
// `Symbol.dispose`, the method key becomes the string "undefined". Class
// methods are not enumerable and `using` does not exist there, so that extra
// method is harmless.
const DISPOSE_ASSIGN_RE = /^if \(Symbol\.dispose\) (\w+)\.prototype\[Symbol\.dispose\] = \1\.prototype\.free;\n/gm
const glueFile = resolve(outDir, target === 'bundler' ? `${outName}_bg.js` : `${outName}.js`)
let glue = readFileSync(glueFile, 'utf8')
const disposeClasses = Array.from(glue.matchAll(DISPOSE_ASSIGN_RE), match => match[1])
// A wasm-bindgen upgrade that changes this statement must fail the build.
if (!disposeClasses.length)
  throw new Error(`No wasm-bindgen Symbol.dispose assignment in ${glueFile}`)
glue = glue.replace(DISPOSE_ASSIGN_RE, '')
for (const name of disposeClasses) {
  const classHead = `export class ${name} {\n`
  if (!glue.includes(classHead))
    throw new Error(`No \`${classHead.trim()}\` in ${glueFile}`)
  glue = glue.replace(classHead, `${classHead}    [Symbol.dispose]() {\n        this.free();\n    }\n`)
}
writeFileSync(glueFile, glue)

// Nitro imports instantiated exports. Wrangler imports a compiled Module.
// Keep the bundler sidecar available for Nitro and initialize either form.
if (target === 'bundler') {
  const entryFile = resolve(outDir, `${outName}.js`)
  const wasmPath = `./${outName}_bg.wasm`
  const gluePath = `./${outName}_bg.js`
  const source = readFileSync(entryFile, 'utf8')
  const originalImport = `import * as wasm from "${wasmPath}";`
  if (!source.includes(originalImport))
    throw new Error(`Unexpected wasm-bindgen entry import in ${entryFile}`)
  const moduleImport = `import wasmModule from "${wasmPath}";
import * as imports from "${gluePath}";
const wasm = wasmModule instanceof WebAssembly.Module
  ? new WebAssembly.Instance(wasmModule, { "${gluePath}": imports }).exports
  : wasmModule;`
  writeFileSync(entryFile, source.replace(originalImport, moduleImport))
}
