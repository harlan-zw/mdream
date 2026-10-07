# @mdream/nuxt Example

This example serves Nuxt pages as Markdown with `@mdream/nuxt`.

## Features Demonstrated

- HTML to Markdown conversion through the `.md` extension.
- HTTP 404 responses for pages with a `noindex` robots meta tag.
- Home, about, blog, and noindex pages.

## Quick Start

```bash
# From the repository root
cd examples/nuxt

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm run _build

# Generate static site
pnpm generate
```

## Testing the Module

Once the development server is running, test these URLs:

### ✅ Working Markdown Conversions

- [http://localhost:3000/index.md](http://localhost:3000/index.md): Home page as Markdown.
- [http://localhost:3000/about.md](http://localhost:3000/about.md): About page as Markdown.
- [http://localhost:3000/blog.md](http://localhost:3000/blog.md): Blog page as Markdown.

### ❌ Expected 404 (Noindex)

- [http://localhost:3000/noindex.md](http://localhost:3000/noindex.md): Returns HTTP 404.

## Static Generation

When you run `pnpm generate`, the module will:

1. Generate `.md` files for all indexable pages in the `.output/public/` directory
2. Create `llms.txt` and `llms-full.txt` files
3. Respect robots meta tags during generation

## Configuration

The module is configured in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  mdream: {
    enabled: true,
    mdreamOptions: {
      // You can add mdream-specific options here
      minimal: true
    }
  }
})
```

## Project Structure

```
.
├── pages/
│   ├── index.vue      # Home page
│   ├── about.vue      # About page
│   ├── blog.vue       # Blog page
│   └── noindex.vue    # Noindex test page
├── app.vue            # Root component
├── nuxt.config.ts     # Nuxt configuration
└── package.json       # Dependencies
```

## What to Expect

- **Development**: Markdown is generated dynamically on each request
- **Static generation**: `pnpm generate` writes Markdown files to `.output/public/`.
- **Robots metadata**: Pages with `noindex` meta tags return HTTP 404 for `.md` requests.
