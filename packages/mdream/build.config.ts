import { readFileSync, statSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineBuildConfig } from 'obuild/config'
import { rolldown as createBundle } from 'rolldown'

const rolldown = {
  external: [/\.\.\/napi\//],
}

const rolldownWasm = {
  external: [/\.\.\/wasm\//, /\.\.\/wasm-bundler\//, /\.\.\/napi\//],
}

// `obuild --stub` (dev:prepare) runs before the WASM exists, so it skips the IIFE.
let stub = false

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: './src/index.ts', rolldown },
    { type: 'bundle', input: './src/browser.ts', rolldown: rolldownWasm },
    // The root `browser` condition; no export condition reads its types.
    { type: 'bundle', input: './src/browser-stub.ts', dts: false },
    { type: 'bundle', input: './src/edge.ts', rolldown: rolldownWasm },
    { type: 'bundle', input: './src/wasm.ts', rolldown: rolldownWasm },
  ],
  hooks: {
    entries(entries) {
      stub = entries.every(entry => entry.stub)
    },
    async end(ctx) {
      const cwd = ctx?.cwd || process.cwd()

      // wasm-pack emits a catch-all .gitignore in its out dirs; pnpm/npm pack
      // respect nested .gitignore files, which would strip wasm/ from the tarball
      for (const stray of ['wasm/.gitignore', 'wasm-bundler/.gitignore']) {
        try {
          unlinkSync(resolve(cwd, stray))
        }
        catch {}
      }

      if (stub)
        return

      // The CDN script (`dist/iife.js`): src/iife.ts and the wasm-bindgen glue
      // in one minified IIFE, with the WASM binary inlined as base64. A
      // missing binary or a failed bundle fails the build.
      const wasmBase64 = readFileSync(resolve(cwd, 'wasm/mdream_edge_bg.wasm')).toString('base64')
      const bundle = await createBundle({
        input: resolve(cwd, 'src/iife.ts'),
        platform: 'browser',
        transform: { define: { __MDREAM_WASM_BASE64__: JSON.stringify(wasmBase64) } },
      })
      const outputPath = resolve(cwd, 'dist/iife.js')
      try {
        await bundle.write({ file: outputPath, format: 'iife', minify: true })
      }
      finally {
        await bundle.close()
      }
      const size = statSync(outputPath).size
      const gzSize = gzipSync(readFileSync(outputPath)).length
      console.log(`Browser IIFE bundle (wasm inlined): ${outputPath} (${Math.round(size / 1024)}kB, ${Math.round(gzSize / 1024 * 10) / 10}kB gzip)`)
    },
  },
})
