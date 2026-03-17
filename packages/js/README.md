# @mdream/js

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

JavaScript HTML-to-Markdown engine for mdream. Use this package when you need plugin hooks, custom transform plugins, or are targeting edge runtimes where the native Rust engine cannot run.

This package consolidates functionality previously split across `@mdream/core`, `@mdream/shared`, and `@mdream/llms-txt`.

> For most use cases, prefer the main `mdream` package which uses the Rust engine for significantly better performance. Reach for `@mdream/js` when you need hooks, custom plugins, or edge runtime compatibility.

## Installation

```bash
pnpm add @mdream/js@beta
```

## Entry Points

| Import | Description |
|---|---|
| `@mdream/js` | Core `htmlToMarkdown` and `streamHtmlToMarkdown` APIs |
| `@mdream/js/plugins` | Plugin utilities: `createPlugin`, `extractionPlugin`, `filterPlugin`, `frontmatterPlugin`, `isolateMainPlugin`, `tailwindPlugin` |
| `@mdream/js/preset/minimal` | `withMinimalPreset` -- declarative config for frontmatter, isolateMain, tailwind, and filter plugins |
| `@mdream/js/negotiate` | HTTP content negotiation: `shouldServeMarkdown`, `parseAcceptHeader` |
| `@mdream/js/parse` | Low-level HTML parser: `parseHtml`, `parseHtmlStream` |
| `@mdream/js/splitter` | Single-pass markdown splitter: `htmlToMarkdownSplitChunks`, `htmlToMarkdownSplitChunksStream` |
| `@mdream/js/llms-txt` | llms.txt artifact generation: `generateLlmsTxtArtifacts`, `createLlmsTxtStream` |

## Usage

### Basic Conversion

```typescript
import { htmlToMarkdown } from '@mdream/js'

const md = htmlToMarkdown('<h1>Hello</h1><p>World</p>')
// # Hello\n\nWorld
```

### Streaming

```typescript
import { streamHtmlToMarkdown } from '@mdream/js'

const stream = streamHtmlToMarkdown(response.body, {
  origin: 'https://example.com',
})

for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

### With Plugins

```typescript
import { htmlToMarkdown } from '@mdream/js'
import { createPlugin } from '@mdream/js/plugins'

const md = htmlToMarkdown(html, {
  hooks: [
    createPlugin({
      onNodeEnter(element) {
        if (element.name === 'aside')
          return '' // skip asides
      },
    }),
  ],
})
```

### Minimal Preset

```typescript
import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'

const md = htmlToMarkdown(html, withMinimalPreset({
  origin: 'https://example.com',
}))
```

### Content Negotiation

```typescript
import { shouldServeMarkdown } from '@mdream/js/negotiate'

// Returns true when Accept header prefers text/markdown over text/html
if (shouldServeMarkdown(request.headers.accept, request.headers['sec-fetch-dest'])) {
  return new Response(markdown, { headers: { 'content-type': 'text/markdown' } })
}
```

### llms.txt Generation

```typescript
import { generateLlmsTxtArtifacts } from '@mdream/js/llms-txt'

const result = await generateLlmsTxtArtifacts({
  files: processedPages,
  siteName: 'My Site',
  origin: 'https://example.com',
  generateFull: true,
})

// result.llmsTxt -- index file with links
// result.llmsFullTxt -- single file with all page content
```

### Markdown Splitter

```typescript
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'

const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 1000,
  origin: 'https://example.com',
})
```

## License

[MIT License](./LICENSE)

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@mdream/js/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/@mdream/js

[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/js.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npm.chart.dev/@mdream/js

[license-src]: https://img.shields.io/npm/l/@mdream/js.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://npmjs.com/package/@mdream/js
