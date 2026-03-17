import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineBuildConfig } from 'obuild/config'

const EXPORT_RE = /export\s*\{[^}]+\};\s*$/m

const rolldown = {
  external: [/\.\.\/napi\//],
}

const rolldownWasm = {
  external: [/\.\.\/wasm\//, /\.\.\/napi\//],
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
      rolldown: rolldownWasm,
    },
  ],
  hooks: {
    end(ctx) {
      const cwd = ctx?.cwd || process.cwd()
      const iifeMjsPath = resolve(cwd, 'dist/iife.mjs')
      try {
        const wasmBindingsJs = readFileSync(resolve(cwd, 'wasm/mdream_edge.js'), 'utf-8')
        const wasmBinary = readFileSync(resolve(cwd, 'wasm/mdream_edge_bg.wasm'))
        const wasmBase64 = wasmBinary.toString('base64')

        // Strip exports, async init (uses import.meta.url), and load helper from wasm-bindgen JS
        const bindingsCode = wasmBindingsJs
          .replace(/export \{ initSync.*\n?/g, '')
          .replace(/export class /g, 'class ')
          .replace(/export function /g, 'function ')
          .replace(/export async function /g, 'async function ')
          .replace(/async function __wbg_init\b[\s\S]*?^\}/m, '')
          .replace(/async function __wbg_load\b[\s\S]*?^\}/m, '')

        const iifeContent = `(function(){
'use strict';
// Inline WASM binary (base64)
var _wasmBase64="${wasmBase64}";
function _decodeBase64(s){var e=atob(s),n=e.length,a=new Uint8Array(n);for(var i=0;i<n;i++)a[i]=e.charCodeAt(i);return a.buffer}
// wasm-bindgen runtime
${bindingsCode}
// Auto-init with inlined WASM
initSync({module:_decodeBase64(_wasmBase64)});
// Public API
function htmlToMarkdown(html,options){return htmlToMarkdownResult(html,options||{})}
if(typeof window!=='undefined'){window.mdream={htmlToMarkdown:htmlToMarkdown}}
})();`

        try { unlinkSync(iifeMjsPath) }
        catch {}
        try { unlinkSync(iifeMjsPath.replace('.mjs', '.d.mts')) }
        catch {}

        const outputPath = resolve(cwd, 'dist/iife.js')
        mkdirSync(resolve(cwd, 'dist'), { recursive: true })
        writeFileSync(outputPath, iifeContent)
        const gzSize = gzipSync(iifeContent).length
        console.log(`Browser IIFE bundle (wasm inlined): ${outputPath} (${Math.round(iifeContent.length / 1024)}kB, ${Math.round(gzSize / 1024 * 10) / 10}kB gzip)`)
      }
      catch (e: any) {
        console.warn('Could not create IIFE bundle:', e.message)
      }
    },
  },
})
