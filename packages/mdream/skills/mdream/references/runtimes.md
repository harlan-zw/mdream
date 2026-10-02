# mdream outside Node

`mdream` picks an entry by export condition. Every entry takes the same `MdreamOptions`: `minimal`, `frontmatter`, `filter`, `extraction`, `tagOverrides`, and the callbacks work everywhere. Every entry produces a Markdown string. Some return it in a Promise.

| Import | Resolved by | Returns |
|---|---|---|
| `mdream` | Node | `string` |
| `mdream` | `workerd`, `edge-light` | `string` |
| `mdream` | `browser` | `Promise<string>` |
| `mdream/worker` | direct import | `Promise<string>` |
| `mdream/wasm` | direct import | `string`, after `init()` |
| `dist/iife.js` (CDN) | script tag | `Promise<string>` |

Each export condition ships its own types. TypeScript reads the `browser` types only when it resolves that condition, for example with `customConditions: ["browser"]` or a bundler that sets it. Otherwise it shows the Node types, a synchronous string.

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

In a Vite, webpack, or esbuild client build, `import { htmlToMarkdown } from 'mdream'` resolves the `browser` entry. That entry fetches the WASM binary on first use and returns `Promise<string>`, so `await` it. The options and callbacks work as in Node.

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = await htmlToMarkdown(html, { minimal: true })
```

For browser code that wants a plain string with no WASM, `@mdream/js` is synchronous. Its options nest under `plugins`.

## Web Worker, raw WASM, and CDN

- `mdream/worker`: call `initWorker(wasmUrl)` first, then `await htmlToMarkdown(html, options)`. Call `terminateWorker()` when done. Options resolve on the main thread, and the callbacks run there.
- `mdream/wasm`: the wasm-bindgen build. Await the default export `init({ module_or_path })` before the first `htmlToMarkdown(html, options)` call. Its `MarkdownStream` runs the callbacks in `finish()`.
- `https://unpkg.com/mdream/dist/iife.js`: the WASM is inlined and ready at load. `window.mdream` has only `htmlToMarkdown`. There is no `init()`. The call returns `Promise<string>`, the same as the browser bundle.
