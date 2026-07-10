import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { transformSync } from 'esbuild'
import { defineBuildConfig } from 'obuild/config'

const STRIP_EXPORT_NAMED_RE = /export \{ initSync.*\n?/g
const STRIP_EXPORT_CLASS_RE = /export class /g
const STRIP_EXPORT_FN_RE = /export function /g
const STRIP_EXPORT_ASYNC_FN_RE = /export async function /g
const STRIP_WBG_INIT_RE = /async function __wbg_init\b[\s\S]+?^\}/m
const STRIP_WBG_LOAD_RE = /async function __wbg_load\b[\s\S]+?^\}/m
const STRIP_ESM_EXPORT_RE = /^export /gm

/**
 * Transpile the shared option-normalizer to plain JS and strip its ESM
 * `export`s so it can be inlined into the self-contained IIFE bundle. Keeping a
 * single source of truth (src/resolve-options.ts) means the browser global
 * honours the same `minimal`/`isolateMain`/`filter` normalization as the Node
 * and edge builds instead of drifting behind a hand-copied version.
 */
function inlineResolveOptions(cwd: string): string {
  const source = readFileSync(resolve(cwd, 'src/resolve-options.ts'), 'utf-8')
  const { code } = transformSync(source, { loader: 'ts', format: 'esm' })
  return code.replace(STRIP_ESM_EXPORT_RE, '')
}

const rolldown = {
  external: [/\.\.\/napi\//],
}

const rolldownWasm = {
  external: [/\.\.\/wasm\//, /\.\.\/wasm-bundler\//, /\.\.\/napi\//],
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
          .replace(STRIP_EXPORT_NAMED_RE, '')
          .replace(STRIP_EXPORT_CLASS_RE, 'class ')
          .replace(STRIP_EXPORT_FN_RE, 'function ')
          .replace(STRIP_EXPORT_ASYNC_FN_RE, 'async function ')
          .replace(STRIP_WBG_INIT_RE, '')
          .replace(STRIP_WBG_LOAD_RE, '')

        const iifeContent = `(function(){
'use strict';
// Inline WASM binary (base64)
var _wasmBase64="${wasmBase64}";
function _decodeBase64(s){var e=atob(s),n=e.length,a=new Uint8Array(n);for(var i=0;i<n;i++)a[i]=e.charCodeAt(i);return a.buffer}
// wasm-bindgen runtime
${bindingsCode}
// Auto-init with inlined WASM
initSync({module:_decodeBase64(_wasmBase64)});
// Shared user-option → engine normalization (src/resolve-options.ts)
${inlineResolveOptions(cwd)}
// Public API
function htmlToMarkdown(html,options){
  options=options||{};
  assertNoHookPlugins(options);
  var resolved=resolveOptions(options);
  var result=htmlToMarkdownResult(html,resolved.napiOpts);
  if(result.frontmatter&&resolved.frontmatterCallback)resolved.frontmatterCallback(result.frontmatter);
  if(result.extracted&&result.extracted.length&&resolved.extractionHandlers){for(var i=0;i<result.extracted.length;i++){var el=result.extracted[i];var h=resolved.extractionHandlers[el.selector];if(h)h(el)}}
  return result;
}
if(typeof window!=='undefined'){window.mdream={htmlToMarkdown:htmlToMarkdown}}
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
        console.warn('Could not create IIFE bundle:', e.message)
      }
    },
  },
})
