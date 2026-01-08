# @mdream/vite

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

Vite plugin for HTML to Markdown conversion with on-demand generation support.

## Features

- **🚀 On-Demand Generation**: Access any HTML page as `.md` for instant markdown conversion
- **🤖 Smart Client Detection**: Automatically serves markdown to LLM bots based on Accept headers
- **⚡ Multi-Environment**: Works in development, preview, and production
- **📦 Build Integration**: Generate static markdown files during build
- **💾 Smart Caching**: Intelligent caching for optimal performance
- **🎯 URL Pattern Matching**: Simple `.md` suffix for any HTML route
- **🔧 Configurable**: Full control over processing and output

## Installation

```bash
pnpm add @mdream/vite
```

## Usage

Add the plugin to your `vite.config.js`:

```javascript
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      // Optional configuration
      include: ['**/*.html'],
      exclude: ['**/node_modules/**'],
      outputDir: 'markdown',
      cacheEnabled: true,
      mdreamOptions: {
        // mdream configuration options
        plugins: []
      }
    })
  ]
})
```

## URL Pattern

The plugin enables accessing any HTML path with a `.md` extension:

- `/about` → `/about.md` (converts on-demand)
- `/docs/guide.html` → `/docs/guide.md`
- `/blog/post` → `/blog/post.md`

### Smart Client Detection

The plugin automatically detects LLM bots and serves markdown without requiring the `.md` extension:

- ✅ **Serves markdown** when `Accept` header contains `*/*` or `text/markdown` (but not `text/html`)
- ❌ **Serves HTML** to browsers (checks for `text/html` in Accept header or `sec-fetch-dest: document`)

This means LLM bots automatically receive optimized markdown responses, reducing token usage by ~10x compared to HTML.

## Configuration Options

```ts
interface ViteHtmlToMarkdownOptions {
  /**
   * Glob patterns to include HTML files for processing
   * @default ['**\/*.html']
   */
  include?: string[]

  /**
   * Glob patterns to exclude from processing
   * @default ['*
   */node_modules/**
    ']
                  */
  exclude?: string[]

  /**
   * Output directory for generated markdown files
   * @default 'markdown'
   */
  outputDir?: string

  /**
   * Enable in-memory caching for development
   * @default true
   */
  cacheEnabled?: boolean

  /**
   * Options to pass to mdream's htmlToMarkdown function
   */
  mdreamOptions?: HtmlToMarkdownOptions

  /**
   * Whether to preserve directory structure in output
   * @default true
   */
  preserveStructure?: boolean

  /**
   * Custom cache TTL in milliseconds for production
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number

  /**
   * Whether to log conversion activities
   * @default false
   */
  verbose?: boolean
}
```

## How It Works

### Development (`vite dev`)
- **Middleware**: Intercepts `.md` requests via `configureServer`
- **Transform Pipeline**: Uses Vite's transform system for HTML content
- **Fallbacks**: Tries multiple path variations including SPA fallback
- **Caching**: Memory cache with no-cache headers

### Build Time (`vite build`)
- **Bundle Processing**: Processes HTML files via `generateBundle` hook
- **Static Generation**: Creates `.md` files alongside HTML output
- **Pattern Matching**: Respects include/exclude patterns

### Preview (`vite preview`)
- **File System**: Reads from build output directory
- **Caching**: Aggressive caching with TTL
- **Multiple Paths**: Tries various file locations

## Examples

### Basic Setup

```javascript
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin()
  ]
})
```

### Advanced Configuration

```javascript
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      include: ['pages/**/*.html', 'docs/**/*.html'],
      exclude: ['**/admin/**', '**/private/**'],
      outputDir: 'public/markdown',
      verbose: true,
      mdreamOptions: {
        plugins: [
          // Custom mdream plugins
        ]
      }
    })
  ]
})
```

### With Custom mdream Options

```javascript
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { filterPlugin, isolateMainPlugin } from 'mdream/plugins'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      mdreamOptions: {
        plugins: [
          isolateMainPlugin(),
          filterPlugin({ exclude: ['nav', '.sidebar'] })
        ]
      }
    })
  ]
})
```

## Integration with SSR

For production SSR applications, you can extend your Express server:

```javascript
import express from 'express'
import { createServer as createViteServer } from 'vite'

const app = express()

// In production, handle .md requests
app.use(async (req, res, next) => {
  if (req.path.endsWith('.md')) {
    // Your custom SSR markdown handling
    // The plugin provides the foundation
  }
  next()
})
```

## License

[MIT License](./LICENSE)

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@mdream/vite/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/@mdream/vite

[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/vite.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npm.chart.dev/@mdream/vite

[license-src]: https://img.shields.io/npm/l/@mdream/vite.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://npmjs.com/package/@mdream/vite
