# Benchmark Methodology

This document describes how mdream benchmarks are conducted to ensure transparency and reproducibility.

## Libraries Compared

| Library | Version | Language | Notes |
|---------|---------|----------|-------|
| [mdream (JS)](https://github.com/harlan-zw/mdream) | latest | JavaScript | Base `htmlToMarkdown()` with the default JS engine |
| [mdream (Rust)](https://github.com/harlan-zw/mdream) | latest | Rust | Base `htmlToMarkdown()` with the new fast native Rust engine |
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

```text
 ✓ bench/compare.bench.ts > small HTML (166 KB - Wikipedia)
     name                      hz      min      max     mean      p75      p99    rme  samples
   · mdream                 301.56   3.15ms   4.76ms   3.32ms   3.34ms   4.10ms  ±0.95%    151
   · mdream-rust           1149.08   0.83ms   1.39ms   0.87ms   0.87ms   1.05ms  ±0.43%    575
   · html-to-markdown       259.47   3.76ms   4.22ms   3.85ms   3.89ms   4.15ms  ±0.34%    130
   · turndown (gfm)          86.41   9.72ms  19.86ms  11.57ms  12.73ms  19.86ms  ±4.97%     44
   · node-html-markdown      70.20  13.22ms  16.12ms  14.25ms  14.54ms  16.12ms  ±1.39%     36
```

**Reading the results:**
- `hz`: Operations per second (higher = faster)
- `mean`: Average time per operation (lower = faster)
- `rme`: Relative margin of error (lower = more consistent)

## Results Interpretation

### Performance Scaling

| Input Size | mdream (rust) | mdream (js) | html-to-markdown (rust) | Turndown (js) | node-html-markdown (js) |
|------------|---------------|-------------|-------------------------|---------------|-------------------------|
| **166 KB** | 🏆 **0.87ms** | 3.32ms | 🦀 3.85ms *(4.4x)* | 11.57ms *(13.3x)* | 14.25ms *(16.4x)* |
| **420 KB** | 🏆 **1.56ms** | 6.32ms | 🦀 7.45ms *(4.8x)* | 13.55ms *(8.7x)* | 16.76ms *(10.8x)* |
| **1.8 MB** | 🏆 **9.78ms** | 58.1ms | 🦀 81.1ms *(8.3x)* | 261.1ms *(26.7x)* | 💀 23,789ms *(2431x)* |

**Key findings:**
- mdream (rust) is the fastest HTML to markdown converter, 4-8x faster than the next best Rust NAPI binding on all inputs
- mdream (js) is 2-4.5x faster than Turndown (fastest pure JS competitor)
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

## Native Rust Benchmark

Separate from the JavaScript benchmark, we compare mdream's Rust engine against other Rust HTML-to-Markdown crates using release-optimized builds with LTO.

### Crates Compared

| Crate | Version | Notes |
|-------|---------|-------|
| [mdream (engine-rust)](https://github.com/harlan-zw/mdream) | latest | Custom zero-alloc parser |
| [htmd](https://crates.io/crates/htmd) | 0.1 | |
| [html2md](https://crates.io/crates/html2md) | 0.2 | Extremely slow on large inputs |
| [html2md-rs](https://crates.io/crates/html2md-rs) | 0.10 | Panics on some inputs |
| [mdka](https://crates.io/crates/mdka) | 1.5 | |
| [html_to_markdown](https://crates.io/crates/html_to_markdown) | 0.1 | kreuzberg crate |
| [fast_html2md](https://crates.io/crates/fast_html2md) | 0.0 | Isolated in separate crate (lib name conflicts with html2md) |

### Results

| Input Size | mdream | htmd | html2md | html2md-rs | mdka | html_to_markdown | fast_html2md |
|------------|--------|------|---------|------------|------|------------------|--------------|
| **166 KB** | 🏆 **0.43ms** | 2.08ms *(4.8x)* | 2.64ms *(6.2x)* | 💀 panicked | 2.61ms *(6.1x)* | 1.63ms *(3.8x)* | 1.34ms *(3.3x)* |
| **420 KB** | 🏆 **0.81ms** | 3.45ms *(4.2x)* | 4.09ms *(5.0x)* | 1.52ms *(1.9x)* | 3.25ms *(4.0x)* | 2.45ms *(3.0x)* | 1.13ms *(1.5x)* |
| **1.8 MB** | 🏆 **5.03ms** | 27.7ms *(5.5x)* | 💀 >30s | 28.9ms *(5.7x)* | 30.8ms *(6.1x)* | 18.6ms *(3.7x)* | 16.6ms *(3.2x)* |

**Key findings:**
- mdream is fastest across all input sizes (3-6x faster than all competitors)
- On medium inputs, fast_html2md and html2md-rs are closer but both degrade at scale
- html2md and html2md-rs have reliability issues (>30s timeouts, panics on valid HTML)

### Running Native Rust Benchmarks

```bash
# Main benchmark (6 crates)
cd bench/rust-compare && cargo run --release

# fast_html2md (isolated due to lib name conflict)
cd bench/rust-compare-fast && cargo run --release
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

```text
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
