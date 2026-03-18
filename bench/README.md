# Benchmark Methodology

This document describes how mdream benchmarks are conducted to ensure transparency and reproducibility.

## Libraries Compared

| Library | Version | Language | Notes |
|---------|---------|----------|-------|
| [mdream (JS)](https://github.com/harlan-zw/mdream) | latest | JavaScript | Base `htmlToMarkdown()` with the default JS engine |
| [mdream (Rust)](https://github.com/harlan-zw/mdream) | latest | Rust | Base `htmlToMarkdown()` with the native Rust engine via NAPI |
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
   · mdream                 309.82   3.04ms   4.62ms   3.23ms   3.29ms   3.95ms  ±0.92%    155
   · mdream-rust           1935.22   0.49ms   1.08ms   0.52ms   0.52ms   0.71ms  ±0.46%    968
   · html-to-markdown       252.22   3.85ms   4.24ms   3.96ms   4.01ms   4.21ms  ±0.36%    127
   · turndown (gfm)          77.29  10.53ms  20.96ms  12.94ms  14.18ms  20.96ms  ±5.07%     39
   · node-html-markdown      62.24  14.70ms  18.66ms  16.07ms  16.34ms  18.66ms  ±1.81%     32
```

**Reading the results:**
- `hz`: Operations per second (higher = faster)
- `mean`: Average time per operation (lower = faster)
- `rme`: Relative margin of error (lower = more consistent)

## Results Interpretation

### Performance Scaling

| Input Size | mdream (rust) | mdream (js) | html-to-markdown (rust) | Turndown (js) | node-html-markdown (js) |
|------------|---------------|-------------|-------------------------|---------------|-------------------------|
| **166 KB** | 🏆 **0.52ms** | 3.23ms | 3.96ms *(7.6x)* | 12.94ms *(24.9x)* | 16.07ms *(30.9x)* |
| **420 KB** | 🏆 **0.76ms** | 6.82ms | 7.44ms *(9.8x)* | 13.41ms *(17.6x)* | 17.09ms *(22.5x)* |
| **1.8 MB** | 🏆 **7.10ms** | 56.5ms | 85.3ms *(12.0x)* | 270.4ms *(38.1x)* | 💀 26,002ms *(3662x)* |

**Key findings:**
- mdream (rust) is the fastest HTML to markdown converter, 8-12x faster than the next best Rust NAPI binding
- mdream (js) is 2-4x faster than Turndown (fastest pure JS competitor)
- node-html-markdown has O(n²) complexity issues on large files

### Why mdream is Faster

1. **Custom HTML parser**: Hand-optimized single-pass parser, no intermediate DOM tree
2. **Batch ASCII scanning**: Copies runs of plain text in bulk via `push_str` instead of byte-by-byte
3. **Turbo-skip excluded content**: Jumps over `<script>`, `<style>`, `<noscript>` content in O(1) instead of processing every byte
4. **TAG_* constants**: Integer IDs for O(1) tag lookups (avoids string comparison)
5. **Depth tracking array**: O(1) nesting depth lookups per tag type
6. **Pre-computed prefixes**: Static blockquote/list/heading strings avoid allocation
7. **Node pooling**: Reuses element allocations instead of repeated heap alloc/dealloc
8. **Zero-copy where possible**: Cow<str> for URLs, entity decoding, tag names
9. **Compiled with `opt-level = 3`**: Maximum speed optimization with LTO
10. **Profile-Guided Optimization (PGO)**: ~20% additional throughput from LLVM branch prediction, inlining, and code layout tuned to real HTML workloads

### Why node-html-markdown Degrades on Large Files

The 3496x slowdown on 1.8MB files indicates O(n²) or worse algorithmic complexity, likely from repeated string concatenation or DOM tree traversal patterns. This is not a bug in our benchmark — you can verify by running it yourself.

## Native Rust Benchmark

Separate from the JavaScript benchmark, we compare mdream's Rust engine against other Rust HTML-to-Markdown crates using release-optimized builds with LTO.

### Crates Compared

| Crate | Version | Notes |
|-------|---------|-------|
| [mdream (engine-rust)](https://github.com/harlan-zw/mdream) | latest | Single-pass, zero-dependency parser |
| [htmd](https://crates.io/crates/htmd) | 0.1 | |
| [html2md](https://crates.io/crates/html2md) | 0.2 | Extremely slow on large inputs |
| [html2md-rs](https://crates.io/crates/html2md-rs) | 0.10 | Panics on some inputs |
| [mdka](https://crates.io/crates/mdka) | 1.5 | |
| [html_to_markdown](https://crates.io/crates/html_to_markdown) | 0.1 | kreuzberg crate |
| [fast_html2md](https://crates.io/crates/fast_html2md) | 0.0 | Isolated in separate crate (lib name conflicts with html2md) |

### Results

| Input Size | mdream | htmd | html2md | html2md-rs | mdka | html_to_markdown |
|------------|--------|------|---------|------------|------|------------------|
| **166 KB** | 🏆 **0.34ms** | 2.13ms *(6.3x)* | 2.71ms *(8.0x)* | 💀 panicked | 2.65ms *(7.8x)* | 1.72ms *(5.1x)* |
| **420 KB** | 🏆 **0.41ms** | 3.50ms *(8.6x)* | 4.25ms *(10.4x)* | 1.54ms *(3.8x)* | 3.56ms *(8.7x)* | 2.72ms *(6.7x)* |
| **1.8 MB** | 🏆 **5.20ms** | 34.4ms *(6.6x)* | 💀 >30s | 35.5ms *(6.8x)* | 37.6ms *(7.2x)* | 28.5ms *(5.5x)* |

**Key findings:**
- mdream is fastest across all input sizes (4-10x faster than all competitors)
- html2md and html2md-rs have reliability issues (>30s timeouts, panics on valid HTML)

### Running Native Rust Benchmarks

```bash
# Main benchmark (6 crates)
cd bench/rust-compare && cargo run --release

# fast_html2md (isolated due to lib name conflict)
cd bench/rust-compare-fast && cargo run --release

# Internal benchmark (mdream only, with clean mode comparison)
cd crates && cargo bench --bench convert_bench
```

## Reproducing Results

Results will vary based on:
- **Hardware**: CPU speed, cache size, memory bandwidth
- **Node.js version**: V8 optimizations differ between versions
- **Rust version**: Newer compilers produce better optimized code
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
