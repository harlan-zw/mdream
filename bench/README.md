# Benchmark Methodology

This document describes how mdream benchmarks are conducted to ensure transparency and reproducibility.

## Libraries Compared

| Library | Version | Language | Notes |
|---------|---------|----------|-------|
| [mdream](https://github.com/harlan-zw/mdream) | latest | JavaScript | Base `htmlToMarkdown()` with no plugins |
| [html-to-markdown](https://github.com/nickmass/html2md-rs) | 2.20.0 | Rust (native) | Via `@kreuzberg/html-to-markdown-node` napi-rs bindings |
| [turndown](https://github.com/mixmark-io/turndown) | 7.2.2 | JavaScript | With [GFM plugin](https://github.com/mixmark-io/turndown-plugin-gfm) (tables, strikethrough, task lists) |
| [node-html-markdown](https://github.com/crosstype/node-html-markdown) | 2.0.0 | JavaScript | Default settings |

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
- **Streaming performance**: mdream supports streaming; competitors don't. Streaming is benchmarked as a mdream-only comparison (stream vs string) to show overhead.
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

| Input Size | html-to-markdown (Rust) | mdream | Turndown | node-html-markdown |
|------------|-------------------------|--------|----------|-------------------|
| 166 KB | 1.4ms | 4.3ms | 11.7ms | 13.3ms |
| 420 KB | 1.9ms | 6.4ms | 13.7ms | 9.9ms |
| 1.8 MB | 20ms | 60ms | 275ms | 27,000ms |

**Key findings:**
- Rust native is ~3x faster than mdream (expected for native code)
- mdream is 3-4x faster than Turndown (fastest pure JS)
- node-html-markdown has O(n²) complexity issues on large files

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

## Cross-Language CLI Benchmark

Separate from the JavaScript benchmark, we also compare CLI performance against Go and Rust alternatives using [hyperfine](https://github.com/sharkdp/hyperfine).

### Tools Compared

| Tool | Language | Install |
|------|----------|---------|
| mdream | Node.js | `npm i -g mdream` |
| mdream (Bun binary) | JS → compiled | `bun build --compile` (auto-built by benchmark) |
| [html-to-markdown](https://github.com/nickmass/html2md-rs) | Rust | `cargo install html-to-markdown-cli` |
| [html2md](https://github.com/JohannesKaufmann/html-to-markdown) | Go | `go install github.com/JohannesKaufmann/html-to-markdown/v2/cmd/html2md@latest` |

### CLI Results

```
Small HTML (166 KB)
  html-to-markdown (Rust)    2.9 ms
  mdream (Bun)              37.0 ms   (13x slower)
  mdream (Node.js)          49.1 ms   (17x slower)

Medium HTML (420 KB)
  html-to-markdown (Rust)    3.3 ms
  mdream (Bun)              47.0 ms   (14x slower)
  mdream (Node.js)          76.3 ms   (23x slower)

Large HTML (1.8 MB)
  html-to-markdown (Rust)   30.1 ms
  mdream (Bun)             130.2 ms   (4.3x slower)
  mdream (Node.js)         138.9 ms   (4.6x slower)
```

### Understanding CLI Results

**Important:** CLI benchmarks include process startup overhead:
- **Node.js startup**: ~40ms baseline before any code runs
- **Bun runtime startup**: ~30ms (faster than Node)
- **Bun compiled binary**: ~5-10ms (eliminates most JS runtime overhead)
- **Rust startup**: ~1-2ms (compiled binary)

The Bun compiled binary (`bun build --compile`) provides the fairest comparison against Rust/Go by eliminating JS runtime startup overhead. The benchmark script automatically compiles this binary when Bun is available.

For the **large file** where startup is less significant:
- Rust actual conversion: ~28ms
- mdream actual conversion: ~58ms (from JS benchmark)
- **Real conversion gap: ~2x**, not 4.6x

**Bun vs Node.js:**
- Small files: Bun 25% faster (startup matters more)
- Large files: Similar (~6% faster)
- Bun binary: Closest to actual conversion speed (minimal startup)

### When to Use What

| Use Case | Recommendation |
|----------|----------------|
| **JavaScript/Browser apps** | mdream (native, no FFI overhead) |
| **CLI pipelines (speed critical)** | Rust html-to-markdown (fastest) |
| **CLI pipelines (JS ecosystem)** | mdream Bun binary (near-native startup) |
| **Streaming large files** | mdream (streaming support) |
| **LLM-optimized output** | mdream (minimal preset, token reduction) |

### Running CLI Benchmarks

```bash
# Install alternatives first
cargo install html-to-markdown-cli
# go install github.com/JohannesKaufmann/html-to-markdown/v2/cmd/html2md@latest

# Run benchmark
pnpm bench:cli
```

## Questions or Concerns?

If you believe these benchmarks are unfair or misleading:

1. [Open an issue](https://github.com/harlan-zw/mdream/issues) with specific concerns
2. Suggest alternative configurations or fixtures
3. Submit a PR with improved methodology

We're committed to honest, reproducible benchmarks.
