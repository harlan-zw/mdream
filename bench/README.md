# Benchmark Methodology

This document describes how mdream benchmarks are conducted to ensure transparency and reproducibility.

## Libraries Compared

| Library | Version | Notes |
|---------|---------|-------|
| [mdream](https://github.com/harlan-zw/mdream) | latest | Base `htmlToMarkdown()` with no plugins |
| [turndown](https://github.com/mixmark-io/turndown) | ^7.2.0 | With [GFM plugin](https://github.com/mixmark-io/turndown-plugin-gfm) (GitHub Flavored Markdown: tables, strikethrough, task lists) |
| [node-html-markdown](https://github.com/crosstype/node-html-markdown) | ^1.3.0 | Default settings |

### Why These Libraries?

These are the most popular JavaScript HTML-to-Markdown converters:
- **Turndown**: Industry standard, used by many projects including Obsidian
- **node-html-markdown**: Marketed as a faster alternative to Turndown

We excluded:
- **html-to-markdown** (Go library): Not JavaScript, different runtime
- **Readability + Turndown**: Different use case (article extraction)

## Test Fixtures

Real-world HTML documents from popular websites:

| Fixture | Size | Source | Content Type |
|---------|------|--------|--------------|
| `wikipedia-small.html` | 166 KB | [Wikipedia: Order (biology)](https://en.wikipedia.org/wiki/Order_(biology)) | Simple article |
| `github-markdown-complete.html` | 420 KB | [GitHub Docs: Basic formatting](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) | Documentation with code |
| `wikipedia-largest.html` | 1.8 MB | [Wikipedia: Elon Musk](https://en.wikipedia.org/wiki/Elon_Musk) | Large article with tables, infoboxes |

### Why These Fixtures?

1. **Real HTML**: Not synthetic benchmarks - actual pages users would convert
2. **Varied sizes**: Tests performance scaling from small to large documents
3. **Varied complexity**: Simple text, code blocks, tables, nested structures
4. **Public sources**: Anyone can verify and update fixtures

## Fair Comparison Methodology

### Equivalent Feature Configuration

All libraries are configured with equivalent features enabled:

```typescript
// mdream: Base conversion (GFM tables/strikethrough built-in)
htmlToMarkdown(html)

// turndown: With GFM plugin for tables/strikethrough
const turndown = new TurndownService({
  headingStyle: 'atx', // # style headings (same as mdream)
  codeBlockStyle: 'fenced' // ``` style code blocks (same as mdream)
})
turndown.use(gfm) // Enable GFM tables/strikethrough
turndown.turndown(html)

// node-html-markdown: Default settings
const nhm = new NodeHtmlMarkdown()
nhm.translate(html)
```

### What We're NOT Comparing

- **mdream's LLM preset**: The `withMinimalPreset()` adds content filtering, frontmatter extraction, and main content isolation. This does extra work that competitors don't do, so it's benchmarked separately.
- **Streaming performance**: mdream supports streaming; competitors don't. Not a fair comparison.
- **Output quality**: This benchmark measures speed only, not output quality or token efficiency.

## Benchmark Tooling

### Vitest Bench

We use [Vitest's benchmark mode](https://vitest.dev/guide/features.html#benchmarking) which provides:

- **Statistical rigor**: Multiple iterations with warmup
- **Metrics**: ops/sec, mean, min, max, percentiles (p75, p99, p995, p999)
- **Relative margin of error (rme)**: Confidence in results

### Default Configuration

Vitest bench runs each benchmark for a minimum time window, collecting enough samples for statistical significance:

- Warmup iterations before measurement
- Minimum 10 samples per benchmark
- Results include margin of error (±%)

## Running Benchmarks

### Prerequisites

```bash
pnpm install
```

### Run All Benchmarks

```bash
pnpm bench
```

### Expected Output

```
 ✓ bench/compare.bench.ts > small HTML (166 KB - Wikipedia)
     name                hz      min      max     mean      p75      p99    rme  samples
   · mdream           304.53   2.98ms   5.15ms   3.28ms   3.36ms   4.82ms  ±1.5%     153
   · turndown (gfm)    84.37   9.91ms  20.43ms  11.85ms  13.19ms  20.43ms  ±5.3%      43
   · node-html-markdown 79.14  11.73ms  16.43ms  12.64ms  12.86ms  16.43ms  ±2.2%      40
```

**Reading the results:**
- `hz`: Operations per second (higher = faster)
- `mean`: Average time per operation (lower = faster)
- `rme`: Relative margin of error (lower = more consistent)

## Results Interpretation

### Performance Scaling

| Input Size | mdream | vs Turndown | vs node-html-markdown |
|------------|--------|-------------|----------------------|
| 166 KB | 3.3ms | 3.6x faster | 3.8x faster |
| 420 KB | 6.5ms | 2.2x faster | 1.5x faster |
| 1.8 MB | 58ms | 4.8x faster | 452x faster |

### Why mdream is Faster

1. **Custom HTML parser**: Hand-optimized for markdown conversion, not general DOM manipulation
2. **Single-pass processing**: No intermediate DOM tree construction
3. **TAG_* constants**: Integer IDs for fast tag lookups (avoids string comparison)
4. **Uint8Array depth tracking**: O(1) nesting depth lookups per tag type
5. **No regex in hot paths**: String operations optimized for V8

### Why node-html-markdown Degrades on Large Files

The 428x slowdown on 1.8MB files suggests O(n²) or worse algorithmic complexity. This is likely due to:
- Repeated string concatenation
- DOM tree traversal patterns
- Memory allocation patterns

This is not a bug in our benchmark - you can verify by running the benchmark yourself.

## Reproducing Results

Results will vary based on:
- **Hardware**: CPU speed, cache size, memory bandwidth
- **Node.js version**: V8 optimizations differ between versions
- **System load**: Other processes affect timing

To get comparable results:
1. Close other applications
2. Run multiple times and compare
3. Focus on relative performance (X times faster) not absolute times

## Updating Fixtures

To refresh fixtures with current website content:

```bash
# Wikipedia small
curl -s "https://en.wikipedia.org/wiki/Order_(biology)" > packages/mdream/test/fixtures/wikipedia-small.html

# GitHub docs
curl -s "https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax" > packages/mdream/test/fixtures/github-markdown-complete.html

# Wikipedia large
curl -s "https://en.wikipedia.org/wiki/Elon_Musk" > packages/mdream/test/fixtures/wikipedia-largest.html
```

## Questions or Concerns?

If you believe these benchmarks are unfair or misleading:

1. [Open an issue](https://github.com/harlan-zw/mdream/issues) with specific concerns
2. Suggest alternative configurations or fixtures
3. Submit a PR with improved methodology

We're committed to honest, reproducible benchmarks.
