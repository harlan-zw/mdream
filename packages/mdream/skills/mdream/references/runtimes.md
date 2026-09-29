# mdream outside Node

`mdream` picks an entry by export condition. Only two entries resolve the full option set.

| Import | Resolved by | Returns | Resolves `minimal` and callbacks |
|---|---|---|---|
| `mdream` | Node | `string` | Yes |
| `mdream` | `workerd`, `edge-light` | `string` | Yes |
| `mdream` | `browser` | `Promise<{ markdown }>` | No |
| `mdream/worker` | direct import | `Promise<string>` | No |
| `mdream/wasm` | direct import | `string` | No |
| `dist/iife.js` (CDN) | script tag | `{ markdown }` | No |

The TypeScript types always describe the Node entry. A browser build type checks as a synchronous string, but it gets a Promise at runtime.

## Cloudflare Workers and Vercel Edge

The `workerd` and `edge-light` conditions load the WASM build and instantiate it at import. The API matches Node.

```ts
import { htmlToMarkdown } from 'mdream'

export default {
  async fetch(request: Request): Promise<Response> {
    const html = await request.text()
    return new Response(htmlToMarkdown(html, { minimal: true }))
  },
}
```

A Rust panic becomes a normal `Error` with the message `mdream WASM panic, please report this at ...`. The instance stays usable, so catch it per request.

## Browser bundles

In a Vite, webpack, or esbuild client build, `import { htmlToMarkdown } from 'mdream'` resolves the `browser` entry. That entry:

- returns `Promise<{ markdown, frontmatter?, extracted? }>`, so `await` it and read `.markdown`;
- ignores `minimal`, `frontmatter`, `isolateMain`, `filter`, `extraction`, and `tagOverrides` at the top level.

For browser code, prefer `@mdream/js`. It is synchronous, returns a string, and has no WASM.

## Web Worker, raw WASM, and CDN

- `mdream/worker`: call `initWorker(wasmUrl)` first, then `await htmlToMarkdown(html)`. Call `terminateWorker()` when done. Options go to the engine as is, so `minimal` has no effect.
- `mdream/wasm`: the raw wasm-bindgen build. Await the default export `init({ module_or_path })` before the first `htmlToMarkdown(html)` call.
- `https://unpkg.com/mdream/dist/iife.js`: the WASM is inlined and ready at load. `window.mdream` has only `htmlToMarkdown`. There is no `init()`. The call returns `{ markdown }`, not a string.
