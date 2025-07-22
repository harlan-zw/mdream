# @mdream/nuxt

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Nuxt module for converting HTML pages to Markdown using [mdream](https://github.com/unjs/mdream).

Mdream provides a Nuxt module that enables seamless HTML to Markdown conversion for Nuxt 3 applications.

- **🚀 On-Demand Generation**: Access any route with `.md` extension (e.g., `/about` → `/about.md`)
- **📄 LLMs.txt Generation**: Creates `llms.txt` and `llms-full.txt` artifacts during prerendering

### Installation

```bash
npm install @mdream/nuxt
# or
pnpm add @mdream/nuxt
# or
yarn add @mdream/nuxt
```

### Usage

Add the module to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    '@mdream/nuxt'
  ],
})
```

Done! Add the `.md` to any file path to access markdown.

When statically generating your site with `nuxi generate` it will create `llms.txt` artifacts.

## Configuration

Configure the module in your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  mdream: {
    // Enable/disable the module
    enabled: true,

    // Pass options to mdream
    mdreamOptions: {
      // mdream conversion options
    },

    // Cache configuration (production only)
    cache: {
      maxAge: 3600, // 1 hour
      swr: true // Stale-while-revalidate
    }
  }
})
```

### Options

- `enabled` (boolean): Enable or disable the module. Default: `true`
- `mdreamOptions` (object): Options passed to mdream's `htmlToMarkdown` function
- `cache.maxAge` (number): Cache duration in seconds. Default: `3600` (1 hour)
- `cache.swr` (boolean): Enable stale-while-revalidate. Default: `true`

## Robot Meta Tag Support

The module respects the `robots` meta tag. Pages with `noindex` will return a 404 error when accessed as markdown:

```vue
<script setup>
useHead({
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})
</script>
```

## Static Generation

When using `nuxt generate` or static hosting, the module automatically:

1. Generates `.md` files for all pages
2. Creates `llms.txt` with page listings
3. Creates `llms-full.txt` with full content

These files are placed in the `public/` directory and served as static assets.

## License

[MIT License](./LICENSE)

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@mdream/nuxt/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@mdream/nuxt

[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@mdream/nuxt

[license-src]: https://img.shields.io/npm/l/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@mdream/nuxt

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
