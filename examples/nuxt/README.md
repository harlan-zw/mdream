# @mdream/nuxt Example

A minimal example demonstrating the `@mdream/nuxt` module functionality.

## Features Demonstrated

- ✨ HTML to Markdown conversion via `.md` extension
- 🤖 Robots meta tag respect (noindex pages return 404)
- 📄 Multiple page types (home, about, blog, noindex)
- 🎨 Clean, responsive design
- 📝 Real-world content examples

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Generate static site
pnpm generate
```

## Testing the Module

Once the development server is running, test these URLs:

### ✅ Working Markdown Conversions
- [http://localhost:3000/index.md](http://localhost:3000/index.md) - Home page as Markdown
- [http://localhost:3000/about.md](http://localhost:3000/about.md) - About page as Markdown
- [http://localhost:3000/blog.md](http://localhost:3000/blog.md) - Blog page as Markdown

### ❌ Expected 404 (Noindex)
- [http://localhost:3000/noindex.md](http://localhost:3000/noindex.md) - Should return 404

## Static Generation

When you run `pnpm generate`, the module will:

1. Generate `.md` files for all indexable pages in the `dist/` directory
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
    },
    cache: {
      maxAge: 3600, // 1 hour
      swr: true
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
- **Production**: Static markdown files are generated during build
- **Robots Compliance**: Pages with `noindex` meta tags return 404 for `.md` requests
- **Clean Output**: Well-formatted markdown with proper headings, lists, and formatting
