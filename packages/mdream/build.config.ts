import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineBuildConfig } from 'obuild/config'

const STRIP_EXPORT_NAMED_RE = /export \{ initSync.*\n?/g
const STRIP_EXPORT_CLASS_RE = /export class /g
const STRIP_EXPORT_FN_RE = /export function /g
const STRIP_EXPORT_ASYNC_FN_RE = /export async function /g
const STRIP_WBG_INIT_RE = /async function __wbg_init\b[\s\S]+?^\}/m
const STRIP_WBG_LOAD_RE = /async function __wbg_load\b[\s\S]+?^\}/m
const WASM_IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*["']\.\.\/wasm\/mdream_edge\.js["'];?\s*$/gm
const ESM_EXPORT_RE = /^export\s*\{[^}]*\};?\s*$/gm
const IMPORT_AS_RE = /\s+as\s+/
const ESM_IMPORT_RE = /^import\s/m

/**
 * Turns the ESM build of src/iife.ts into a script body that runs inside the
 * scope nested in the wasm-bindgen runtime's: each binding import becomes a
 * local alias, and the module's exports are dropped.
 */
function toScriptBody(esm: string): string {
  const body = esm
    .replace(WASM_IMPORT_RE, (_, specifiers: string) => specifiers
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map((specifier) => {
        const [imported, local = imported] = specifier.split(IMPORT_AS_RE)
        return local === imported ? '' : `var ${local}=${imported};`
      })
      .join(''))
    .replace(ESM_EXPORT_RE, '')
  if (ESM_IMPORT_RE.test(body))
    throw new Error('dist/iife.mjs has an import the IIFE build cannot inline')
  return body
}

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
    { type: 'bundle', input: './src/worker.ts', rolldown },
    // Bundled as ESM with the WASM bindings external; the end hook inlines them.
    { type: 'bundle', input: './src/iife.ts', rolldown: rolldownWasm, dts: false },
  ],
  hooks: {
    entries(entries) {
      stub = entries.every(entry => entry.stub)
    },
    end(ctx) {
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

      const iifeMjsPath = resolve(cwd, 'dist/iife.mjs')
      try {
        const wasmBindingsJs = readFileSync(resolve(cwd, 'wasm/mdream_edge.js'), 'utf-8')
        const wasmBinary = readFileSync(resolve(cwd, 'wasm/mdream_edge_bg.wasm'))
        const wasmBase64 = wasmBinary.toString('base64')

        // Strip exports, async init (uses import.meta.url), and load helper from wasm-bindgen JS
        const bindingsCode = wasmBindingsJs
          .replace(STRIP_EXPORT_NAMED_RE, '')
          .replace(STRIP_EXPORT_CLASS_RE, 'class ')
          .replace(STRIP_EXPORT_FN_RE, 'function ')
          .replace(STRIP_EXPORT_ASYNC_FN_RE, 'async function ')
          .replace(STRIP_WBG_INIT_RE, '')
          .replace(STRIP_WBG_LOAD_RE, '')

        const apiCode = toScriptBody(readFileSync(iifeMjsPath, 'utf-8'))

        const iifeContent = `(function(){
'use strict';
// Inline WASM binary (base64)
var _wasmBase64="${wasmBase64}";
function _decodeBase64(s){var e=atob(s),n=e.length,a=new Uint8Array(n);for(var i=0;i<n;i++)a[i]=e.charCodeAt(i);return a.buffer}
// wasm-bindgen runtime
${bindingsCode}
// Auto-init with inlined WASM
initSync({module:_decodeBase64(_wasmBase64)});
// Public API (src/iife.ts), in its own scope so its names cannot clash with the runtime's
(function(){
${apiCode}
})();
})();`

        try {
          unlinkSync(iifeMjsPath)
        }
        catch {}
        try {
          unlinkSync(iifeMjsPath.replace('.mjs', '.d.mts'))
        }
        catch {}

        const outputPath = resolve(cwd, 'dist/iife.js')
        mkdirSync(resolve(cwd, 'dist'), { recursive: true })
        writeFileSync(outputPath, iifeContent)
        const gzSize = gzipSync(iifeContent).length
        console.log(`Browser IIFE bundle (wasm inlined): ${outputPath} (${Math.round(iifeContent.length / 1024)}kB, ${Math.round(gzSize / 1024 * 10) / 10}kB gzip)`)
      }
      catch (e: any) {
        // A missing or stale dist/iife.js must fail the build, not ship.
        console.error('Could not create IIFE bundle:', e.message)
        throw e
      }
    },
  },
})
