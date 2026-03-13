import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mdreamDir = path.resolve(root, '../../packages/mdream')

// Move napi platform artifacts into sub packages
for (const file of await fs.readdir(root)) {
  if (file.startsWith('engine-rust.') && file.endsWith('.node')) {
    const target = file.replace('engine-rust.', '').replace('.node', '')
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
    console.log(`Moved ${file} to npm/${target} and packages/mdream/napi`)
  }
}

// Move napi wasm artifacts into sub package
const wasmArtifacts = {
  'engine-rust.debug.wasm': 'engine-rust.wasm32-wasi.debug.wasm',
  'engine-rust.wasm': 'engine-rust.wasm32-wasi.wasm',
  'engine-rust.wasi-browser.js': 'engine-rust.wasi-browser.js',
  'engine-rust.wasi.cjs': 'engine-rust.wasi.cjs',
  'wasi-worker-browser.mjs': 'wasi-worker-browser.mjs',
  'wasi-worker.mjs': 'wasi-worker.mjs',
}
for (const file of await fs.readdir(root)) {
  if (!wasmArtifacts[file])
    continue
  await fs.cp(
    path.join(root, file),
    path.join(root, 'npm', 'wasm32-wasi', wasmArtifacts[file]),
  )
  console.log(`Moved ${file} to npm/wasm32-wasi`)
}
