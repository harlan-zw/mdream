import type { OutputChunk, RollupOutput } from 'rollup'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'

// These tests live in @mdream/vite because they need Vite. They bundle mdream
// the way a Vite client build and a Workers SSR build do.
const root = fileURLToPath(new URL('../fixtures/mdream-client', import.meta.url))

let outDir: string | undefined

afterEach(() => {
  if (outDir)
    rmSync(outDir, { recursive: true, force: true })
  outDir = undefined
})

async function clientModules(entry: string): Promise<string[]> {
  const output = await build({
    root,
    logLevel: 'silent',
    configFile: false,
    resolve: { preserveSymlinks: true },
    build: { write: false, lib: { entry, formats: ['es'], fileName: 'entry' } },
  }) as RollupOutput[]
  return output.flatMap(({ output }) => output)
    .filter((file): file is OutputChunk => file.type === 'chunk')
    .flatMap(chunk => chunk.moduleIds)
}

function isMdreamModule(id: string): boolean {
  return id.includes('/packages/mdream/') || id.includes('/node_modules/mdream/')
}

// A Workers build keeps the `.wasm` import external, and the runtime provides
// it as a compiled WebAssembly.Module. To run the bundle in Node, the import
// points at a module beside it that compiles the file.
const WASM_LOADER = './wasm-module.mjs'
const wasmFile = fileURLToPath(new URL('../../../mdream/wasm-bundler/mdream_edge_bg.wasm', import.meta.url))

describe('mdream in a Vite client build', () => {
  it('drops mdream when shared code never calls it in the browser', async () => {
    expect((await clientModules('shared.js')).filter(isMdreamModule)).toEqual([])
  })

  it('keeps the browser engine when client code calls it', async () => {
    expect((await clientModules('used.js')).some(isMdreamModule)).toBe(true)
  })
})

describe('mdream in a Vite workerd build', () => {
  it('keeps the WASM engine initialized', async () => {
    outDir = mkdtempSync(join(tmpdir(), 'mdream-workerd-'))
    await build({
      root,
      logLevel: 'silent',
      configFile: false,
      // Resolve through node_modules, as an installed mdream does, not the workspace path.
      resolve: { preserveSymlinks: true },
      environments: { ssr: { resolve: { conditions: ['workerd', 'worker', 'module', 'import', 'default'], externalConditions: ['workerd'], noExternal: true, preserveSymlinks: true } } },
      build: {
        ssr: 'edge.js',
        outDir,
        emptyOutDir: true,
        rollupOptions: { external: id => id.endsWith('.wasm'), output: { paths: id => id.endsWith('.wasm') ? WASM_LOADER : id } },
      },
    })
    writeFileSync(join(outDir, WASM_LOADER), `import { readFileSync } from 'node:fs'\nexport default new WebAssembly.Module(readFileSync(${JSON.stringify(wasmFile)}))\n`)
    const { convert } = await import(pathToFileURL(join(outDir, 'edge.js')).href)
    expect(convert('<h1>Hi</h1>')).toBe('# Hi')
  })
})
