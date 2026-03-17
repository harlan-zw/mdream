import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineBuildConfig } from 'obuild/config'

const rolldown = {
  external: [/\.\.\/napi\//],
}

const rolldownWasm = {
  external: [/\.\.\/wasm\//],
}

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: './src/index.ts', rolldown },
    { type: 'bundle', input: './src/browser.ts', rolldown: rolldownWasm },
    { type: 'bundle', input: './src/edge.ts', rolldown: rolldownWasm },
    { type: 'bundle', input: './src/worker.ts' },
    {
      type: 'bundle',
      input: './src/iife.ts',
      minify: true,
      rolldown: {
        external: [/\.\.\/napi\//],
      },
    },
  ],
  hooks: {
    end(ctx) {
      const cwd = ctx?.cwd || process.cwd()
      const iifeMjsPath = resolve(cwd, 'dist/iife.mjs')
      try {
        const content = readFileSync(iifeMjsPath, 'utf-8')
        const iifeContent = `(function(){\n'use strict';\n${content.replace(/export\s*\{[^}]+\};\s*$/m, '')}\n})();`
        try { unlinkSync(iifeMjsPath) }
        catch {}
        try { unlinkSync(iifeMjsPath.replace('.mjs', '.d.mts')) }
        catch {}
        const outputPath = resolve(cwd, 'dist/iife.js')
        mkdirSync(resolve(cwd, 'dist'), { recursive: true })
        writeFileSync(outputPath, iifeContent)
        const gzSize = gzipSync(iifeContent).length
        console.log(`Browser IIFE bundle: ${outputPath} (${Math.round(iifeContent.length / 1024)}kB, ${Math.round(gzSize / 1024 * 10) / 10}kB gzip)`)
      }
      catch (e: any) {
        console.warn('Could not create IIFE bundle:', e.message)
      }
    },
  },
})
