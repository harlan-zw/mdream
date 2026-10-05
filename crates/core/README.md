# mdream

Fastest HTML-to-Markdown converter. Zero dependencies, streaming support.

## Install

```sh
cargo add mdream@2.0.0-beta.1
```

Or as a CLI:

```sh
cargo install mdream --version 2.0.0-beta.1
```

## Usage

### Library

```rust
use mdream::{html_to_html, html_to_markdown, types::HTMLToMarkdownOptions};

let html = "<h1>Hello</h1><p>World</p>";
let md = html_to_markdown(html, HTMLToMarkdownOptions::default());
assert_eq!(md, "# Hello\n\nWorld");

let html_output = html_to_html(
    "<h1>Hello</h1><p>World</p>",
    HTMLToMarkdownOptions::default(),
);
assert_eq!(html_output, "<h1 id=\"hello\">Hello</h1><p>World</p>");
```

### Streaming

```rust
use mdream::MarkdownStreamProcessor;
use mdream::types::HTMLToMarkdownOptions;

let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
let chunk1 = stream.process_chunk("<h1>Hello</h1>");
let chunk2 = stream.process_chunk("<p>World</p>");
let remaining = stream.finish();
```

### CLI

```sh
curl -s https://example.com | mdream

# HTML output
curl -s https://example.com | mdream --format html
```

## Output format features

These features come from [#276](https://github.com/harlan-zw/mdream/pull/276), merged after `2.0.0-beta.1`.
For dependency builds, select a release that includes that change.

Each output format is a cargo feature: `markdown`, `text`, and `html`. All three are on by default.

From the repository root, turn off the defaults to build a smaller Markdown-only binary:

```sh
cargo build --manifest-path crates/core/Cargo.toml --release --no-default-features --features markdown
```

A build with one format drops the code for the others. `OutputFormat` keeps only the variants you enable.

## Migrating from v1

The v2 crate changes `Attributes` and `ElementNode` in [#216](https://github.com/harlan-zw/mdream/pull/216).
Conversion functions keep their options. If you access parser nodes directly, update these calls:

| v1 access | v2 access |
|---|---|
| Attribute capacity allocation | `Attributes::new()`, then `reserve(capacity)` |
| Insert a known attribute by name | `insert_known(ATTR_HREF, value)` using the matching `ATTR_*` constant |
| Insert a custom attribute | `insert_custom(name.into(), value)` with a lowercase name |
| Attribute iteration | `iter()` yields `(&str, &str)` |
| `node.custom_name` | `node.custom_name()` |
| `node.tailwind` | `node.tailwind()`; write with `node.set_tailwind(data)` |
| `usize` node indices | `index`, `current_walk_index`, and `child_text_node_index` use `u32` |

`<title>` text no longer appears in the body. Enable frontmatter or extraction to read it.
Review snapshots that relied on the title as visible text.
For optional format builds, see [Output format features](#output-format-features).

## License

MIT
