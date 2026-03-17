# @mdream/crawl

Multi-page website crawler that generates comprehensive llms.txt files by following internal links and processing entire websites using mdream HTML-to-Markdown conversion.

> **Note**: For single-page HTML-to-Markdown conversion, use the [`mdream`](../mdream) binary instead. `@mdream/crawl` is specifically designed for crawling entire websites with multiple pages.

## Installation

```bash
npm install @mdream/crawl@beta
```

## Usage

Simply run the command to start the interactive multi-page website crawler:

```bash
npx @mdream/crawl@beta
```

The crawler will automatically discover and follow internal links to crawl entire websites. The interactive interface provides:
- ✨ Beautiful prompts powered by Clack
- 🎯 Step-by-step configuration guidance
- ✅ Input validation and helpful hints
- 📋 Configuration summary before crawling
- 🎉 Clean result display with progress indicators
- 🧹 Automatic cleanup of crawler storage

## Programmatic Usage

You can also use @mdream/crawl programmatically in your Node.js applications:

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

// Crawl entire websites programmatically
const results = await crawlAndGenerate({
  urls: ['https://docs.example.com'], // Starting URLs for website crawling
  outputDir: './output',
  maxRequestsPerCrawl: 100, // Maximum pages per website
  generateLlmsTxt: true,
  followLinks: true, // Follow internal links to crawl entire site
  maxDepth: 3, // How deep to follow links
  driver: 'http', // or 'playwright' for JS-heavy sites
  verbose: true
})
```

> **Note**: llms.txt artifact generation is handled by [`@mdream/js/llms-txt`](../js). The crawl package uses it internally when `generateLlmsTxt: true`.

## Output

The crawler generates comprehensive output from entire websites:

1. **Markdown files** - One `.md` file per crawled page with clean markdown content
2. **llms.txt** - Comprehensive site overview file following the [llms.txt specification](https://llmstxt.org/)

### Example llms.txt output

```markdown
# example.com

## Pages

- [Example Domain](https---example-com-.md): https://example.com/
- [About Us](https---example-com-about.md): https://example.com/about
```

## Features

- ✅ **Multi-Page Website Crawling**: Designed specifically for crawling entire websites by following internal links
- ✅ **Purely Interactive**: No complex command-line options to remember
- ✅ **Dual Crawler Support**: Fast HTTP crawler (default) + Playwright for JavaScript-heavy sites
- ✅ **Smart Link Discovery**: Uses mdream's extraction plugin to find and follow internal links
- ✅ **Rich Metadata Extraction**: Extracts titles, descriptions, keywords, and author info from all pages
- ✅ **Comprehensive llms.txt Generation**: Creates complete site documentation files
- ✅ **Configurable Depth Crawling**: Follow links with customizable depth limits (1-10 levels)
- ✅ **Clean Markdown Conversion**: Powered by mdream's HTML-to-Markdown engine
- ✅ **Performance Optimized**: HTTP crawler is 5-10x faster than browser-based crawling
- ✅ **Beautiful Output**: Clean result display with progress indicators
- ✅ **Automatic Cleanup**: Purges crawler storage after completion
- ✅ **TypeScript Support**: Full type definitions with excellent IDE support

## Use Cases

Perfect for:
- 📚 **Documentation Sites**: Crawl entire documentation websites (GitBook, Docusaurus, etc.)
- 🏢 **Company Websites**: Generate comprehensive site overviews for LLM context
- 📝 **Blogs**: Process entire blog archives with proper categorization
- 🔗 **Multi-Page Resources**: Any website where you need all pages, not just one

**Not suitable for**: Single-page conversions (use `mdream` binary instead)

## License

MIT
