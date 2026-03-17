import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mdreamDir = path.resolve(root, '../../packages/mdream')

// Move napi platform artifacts into sub packages
for (const file of await fs.readdir(root)) {
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
const wasmArtifacts = {
  'rust.debug.wasm': 'rust.wasm32-wasi.debug.wasm',
  'rust.wasm': 'rust.wasm32-wasi.wasm',
  'rust.wasi-browser.js': 'rust.wasi-browser.js',
  'rust.wasi.cjs': 'rust.wasi.cjs',
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
