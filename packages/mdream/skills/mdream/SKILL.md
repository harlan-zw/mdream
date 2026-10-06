---
name: mdream
description: Convert HTML to Markdown, plain text, or safe HTML with mdream, the Rust engine for Node, edge, and the browser. Use when a task mentions mdream, htmlToMarkdown, streamHtmlToMarkdown, the minimal preset, frontmatter or extraction callbacks, tagOverrides, clean options, the mdream CLI, or errors such as "Custom hook plugins require @mdream/js" or ERR_PACKAGE_PATH_NOT_EXPORTED for mdream/plugins.
---

# mdream

This Skill covers `mdream` 2.0.0-beta.0. The package wraps a Rust converter: NAPI in Node, WASM on edge runtimes and in the browser.
`@mdream/js` is a separate pure JS engine. It has hook plugins, the splitter, `llms.txt` generation, and content negotiation. Its option shape differs; see [Traps](#traps).

## Setup

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = htmlToMarkdown('<main><h1>Docs</h1></main>', {
  origin: 'https://example.com',
  minimal: true,
})
```

- `htmlToMarkdown` is synchronous in Node and on edge runtimes. It returns a string.
- Set `origin` to make relative `href` and `src` values absolute. Without it, they stay relative.
- If a bundler fails on the native binding, mark `mdream` as external. In Next.js, add it to `serverExternalPackages`. `@mdream/vite` does this for you.

## Automatic behaviour

Default output keeps everything: navigation, forms, footers, and text hidden with CSS classes.
The `<title>` text never appears in the body. Read it with `frontmatter` or `extraction`.

`minimal: true` turns on these options. Each one is off without it.

| Option | Effect under `minimal` |
|---|---|
| `frontmatter` | YAML frontmatter from `<title>` and `<meta>`. |
| `isolateMain` | Keeps `<main>`, else the content from the first heading to the first `<footer>`. |
| `tailwind` | `font-bold` becomes `**bold**`. `hidden` and `absolute` content is dropped. |
| `filter` | Excludes `form`, `fieldset`, `object`, `embed`, `footer`, `aside`, `iframe`, `input`, `textarea`, `select`, `button`, `nav`. |
| `clean` | All cleanup: tracking parameters, `#` links, images without alt, and more. |

To turn one off, pass it as `false`: `{ minimal: true, frontmatter: false, clean: false }`.
A `filter` under `minimal` adds to the excludes above: `{ minimal: true, filter: { exclude: ['h1'] } }` drops `h1` and every default tag. `filter: false` keeps forms and `nav`.

## Common tasks

Read metadata and matched elements in one pass:

```ts
import { htmlToMarkdown } from 'mdream'

const links: string[] = []
let title = ''
const markdown = htmlToMarkdown('<html><head><title>T</title></head><body><a href="/a">A</a></body></html>', {
  frontmatter: (fm) => { title = fm.title ?? '' },
  extraction: {
    'a[href]': (el) => { links.push(el.attributes.href ?? '') },
  },
})
```

Stream a large response. The stream takes the same options, and the callbacks run once, after the last chunk is read:

```ts
import { streamHtmlToMarkdown } from 'mdream'

const response = await fetch('https://example.com')
let markdown = ''
let title = ''
for await (const chunk of streamHtmlToMarkdown(response.body, {
  origin: 'https://example.com',
  minimal: true,
  frontmatter: (fm) => { title = fm.title ?? '' },
})) {
  markdown += chunk
}
```

Render a custom element with Markdown semantics. Unknown tags output only their text.

```ts
import { htmlToMarkdown } from 'mdream'

htmlToMarkdown('<x-heading>Title</x-heading><callout>Read this</callout>', {
  tagOverrides: {
    'x-heading': 'h2',
    'callout': { enter: '> **Note:** ', exit: '', spacing: [2, 2] },
  },
})
// ## Title\n\n> **Note:** Read this
```

Other output: `format: 'text'` gives plain text, `format: 'html'` gives allowlisted semantic HTML. `wrapWidth: 80` wraps prose only, never code, tables, or headings.

CLI: `curl -s URL | mdream --origin URL --preset minimal`. It streams stdin to stdout. Flags: `--format`, `--text`, `--wrap-width`.

## Traps

- **Hook plugins are not in this package.** An array in `plugins` throws `Custom hook plugins require @mdream/js`. Use `@mdream/js` with `plugins: [createPlugin({...})]` from `@mdream/js/plugins`.
- **`@mdream/js` takes plugins as an array.** It throws a `TypeError` on `minimal`, `format`, `frontmatter`, `isolateMain`, `tailwind`, `filter`, or `extraction` at the top level. Use `withMinimalPreset()` from `@mdream/js/preset/minimal`, or `{ plugins: [frontmatterPlugin()] }` from `@mdream/js/plugins`. For text or HTML output, use `@mdream/js/text` or `@mdream/js/html`.
- **Emphasis is `*`, not `_`.** Headings are ATX, bullets are `-`, rules are `---`. Only `tagOverrides` changes a delimiter, for example `em: { enter: '_', exit: '_', isInline: true }`.
- **Filter selectors also drop inline `position: absolute` and `position: fixed` elements.**
- **Browser bundles import `mdream/browser`.** In a browser bundle, the root `mdream` entry throws a `TypeError` when called. Every entry takes the same options and produces the same string. `mdream/browser` and the CDN script return `Promise<string>`, so `await` them. Read [references/runtimes.md](references/runtimes.md) before you use `mdream` outside Node or a Cloudflare Worker.

## Version limits

Code from mdream 0.x fails on 1.x and 2.x. The subpaths `mdream/plugins`, `mdream/preset/minimal`, `mdream/splitter`, `mdream/llms-txt`, and `mdream/negotiate` throw `ERR_PACKAGE_PATH_NOT_EXPORTED`.

```ts
// Old (0.x):
// import { htmlToMarkdown } from 'mdream'
// import { withMinimalPreset } from 'mdream/preset/minimal'
// htmlToMarkdown(html, withMinimalPreset({ origin }))

import { htmlToMarkdown } from 'mdream'

// New:
htmlToMarkdown('<p>x</p>', { minimal: true, origin: 'https://example.com' })
```

The splitter, `llms.txt` generation, and `shouldServeMarkdown` moved to `@mdream/js/splitter`, `@mdream/js/llms-txt`, and `@mdream/js/negotiate`.

## Config

Options: `origin`, `minimal`, `clean` (`true` or per rule), `frontmatter`, `isolateMain`, `tailwind`, `filter`, `extraction`, `tagOverrides`, `wrapWidth`, `format`. Types: `MdreamOptions` in the [package README](https://github.com/harlan-zw/mdream/tree/main/packages/mdream#options).
