import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mdreamDir = path.resolve(root, '../../packages/mdream')

const WASI_DIR = 'wasm32-wasi'

// napi <3.8 wrote the wasi build to `rust.wasm`; napi >=3.8 writes
// `rust.wasm32-wasi.wasm`. Resolving the name instead of hardcoding it keeps a
// napi CLI bump from silently skipping the copy (which shipped a stale wasm) or
// breaking the release wasm-opt step (mdream#194).
const wasmVariants = [
  { candidates: ['rust.wasm', `rust.${WASI_DIR}.wasm`], dest: `rust.${WASI_DIR}.wasm`, required: true },
  { candidates: ['rust.debug.wasm', `rust.${WASI_DIR}.debug.wasm`], dest: `rust.${WASI_DIR}.debug.wasm`, required: false },
]
// Glue emitted alongside the wasm; copied verbatim. `rust.wasi.d.cts` is new in
// napi 3.8 and carries the types for the CJS entry.
const wasmGlue = [
  { name: 'rust.wasi-browser.js', required: true },
  { name: 'rust.wasi.cjs', required: true },
  { name: 'rust.wasi.d.cts', required: false },
  { name: 'wasi-worker-browser.mjs', required: true },
  { name: 'wasi-worker.mjs', required: true },
]

const entries = new Set(await fs.readdir(root))
const requireWasm = process.argv.includes('--require-wasm')

function resolveReleaseWasm() {
  const [release] = wasmVariants
  return release.candidates.find(name => entries.has(name))
}

// `--print-release-wasm` lets CI feed wasm-opt the right filename without
// duplicating napi's naming rules in a shell script.
if (process.argv.includes('--print-release-wasm')) {
  const found = resolveReleaseWasm()
  if (!found) {
    console.error(`No napi wasm artifact in ${root}. Looked for: ${wasmVariants[0].candidates.join(', ')}.`)
    process.exit(1)
  }
  console.log(found)
  process.exit(0)
}

const missing = []

// Move napi platform artifacts into sub packages
let platformCount = 0
for (const file of entries) {
  if (file.startsWith('rust.') && file.endsWith('.node')) {
    const target = file.replace('rust.', '').replace('.node', '')
    await fs.cp(
      path.join(root, file),
      path.join(root, 'npm', target, file),
    )
    // Also copy to packages/mdream/napi for local workspace resolution
    await fs.mkdir(path.join(mdreamDir, 'napi'), { recursive: true })
    await fs.cp(
      path.join(root, file),
      path.join(mdreamDir, 'napi', file),
    )
    platformCount++
    console.log(`Moved ${file} to npm/${target} and packages/mdream/napi`)
  }
}

// Copy napi JS/TS bindings to packages/mdream/napi for workspace resolution
const napiBindings = ['index.js', 'index.d.ts']
for (const file of napiBindings) {
  const src = path.join(root, file)
  try {
    await fs.access(src)
    await fs.mkdir(path.join(mdreamDir, 'napi'), { recursive: true })
    // napi generates index.js but mdream imports index.mjs
    if (file === 'index.js') {
      await fs.cp(src, path.join(mdreamDir, 'napi', 'index.mjs'))
      console.log(`Copied ${file} to packages/mdream/napi/index.mjs`)
    }
    await fs.cp(src, path.join(mdreamDir, 'napi', file))
    // Also create .d.mts for ESM resolution
    if (file === 'index.d.ts') {
      await fs.cp(src, path.join(mdreamDir, 'napi', 'index.d.mts'))
      console.log(`Copied ${file} to packages/mdream/napi/index.d.mts`)
    }
    console.log(`Copied ${file} to packages/mdream/napi/${file}`)
  }
  catch {}
}

// Move napi wasm artifacts into sub package
const wasiDir = path.join(root, 'npm', WASI_DIR)
let wasmCount = 0
for (const { candidates, dest, required } of wasmVariants) {
  const src = candidates.find(name => entries.has(name))
  if (!src) {
    if (required && requireWasm)
      missing.push(`${dest} (looked for ${candidates.join(', ')})`)
    continue
  }
  await fs.cp(path.join(root, src), path.join(wasiDir, dest))
  wasmCount++
  console.log(`Moved ${src} to npm/${WASI_DIR}/${dest}`)
}
for (const { name, required } of wasmGlue) {
  if (!entries.has(name)) {
    if (required && requireWasm)
      missing.push(name)
    continue
  }
  await fs.cp(path.join(root, name), path.join(wasiDir, name))
  console.log(`Moved ${name} to npm/${WASI_DIR}`)
}

if (missing.length > 0) {
  console.error(`napi produced no ${missing.join(', ')} in ${root}. The napi CLI likely renamed its output; update wasmVariants/wasmGlue in this script.`)
  process.exit(1)
}

if (platformCount === 0 && wasmCount === 0) {
  console.error(`No napi artifacts found in ${root}. Run a napi build before this script.`)
  process.exit(1)
}
