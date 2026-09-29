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
The `<title>` text appears as the first line of plain text when frontmatter is off.

`minimal: true` turns on these options. Each one is off without it.

| Option | Effect under `minimal` |
|---|---|
| `frontmatter` | YAML frontmatter from `<title>` and `<meta>`. The title line leaves the body. |
| `isolateMain` | Keeps `<main>`, else the content from the first heading to the first `<footer>`. |
| `tailwind` | `font-bold` becomes `**bold**`. `hidden` and `absolute` content is dropped. |
| `filter` | Excludes `form`, `fieldset`, `object`, `embed`, `footer`, `aside`, `iframe`, `input`, `textarea`, `select`, `button`, `nav`. |
| `clean` | All cleanup: tracking parameters, `#` links, images without alt, and more. |

To turn one off, pass it as `false`: `{ minimal: true, frontmatter: false, clean: false }`.

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

Stream a large response:

```ts
import { streamHtmlToMarkdown } from 'mdream'

const response = await fetch('https://example.com')
let markdown = ''
for await (const chunk of streamHtmlToMarkdown(response.body, { origin: 'https://example.com', minimal: true })) {
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

- **The stream API never calls callbacks.** `streamHtmlToMarkdown` ignores the `frontmatter` function and the `extraction` handlers. The frontmatter still appears in the output. Use `htmlToMarkdown` when you need the data.
- **A `filter` replaces the `minimal` exclude list.** `{ minimal: true, filter: { exclude: ['h1'] } }` keeps forms and `nav` again. Repeat the default tags in your list.
- **Hook plugins are not in this package.** An array in `plugins` throws `Custom hook plugins require @mdream/js`. Use `@mdream/js` with `hooks: [createPlugin({...})]` from `@mdream/js/plugins`.
- **`@mdream/js` nests options under `plugins`.** It ignores `minimal`, `frontmatter`, `filter`, and `isolateMain` at the top level, with no error in JavaScript. Use `withMinimalPreset()` from `@mdream/js/preset/minimal`, or `{ plugins: { frontmatter: true } }`.
- **Emphasis is `*`, not `_`.** Headings are ATX, bullets are `-`, rules are `---`. Only `tagOverrides` changes a delimiter, for example `em: { enter: '_', exit: '_', isInline: true }`.
- **Filter selectors also drop inline `position: absolute` and `position: fixed` elements.**
- **Browser, worker, CDN, and raw WASM entries differ from the Node API.** They return a Promise or an object, and they ignore `minimal`. Read [references/runtimes.md](references/runtimes.md) before you use `mdream` outside Node or a Cloudflare Worker.

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
