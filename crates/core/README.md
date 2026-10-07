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

The examples follow the repository API, including changes merged after `2.0.0-beta.1`.
For an installed release, use the README at its release tag.
In `2.0.0-beta.1`, the options type is still `HTMLToMarkdownOptions`.

### Library

```rust
use mdream::{html_to_html, html_to_markdown, types::HtmlToMarkdownOptions};

let html = "<h1>Hello</h1><p>World</p>";
let md = html_to_markdown(html, HtmlToMarkdownOptions::default());
assert_eq!(md, "# Hello\n\nWorld");

let html_output = html_to_html(
    "<h1>Hello</h1><p>World</p>",
    HtmlToMarkdownOptions::default(),
);
assert_eq!(html_output, "<h1 id=\"hello\">Hello</h1><p>World</p>");
```

### Streaming

```rust
use mdream::MarkdownStreamProcessor;
use mdream::types::HtmlToMarkdownOptions;

let mut stream = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
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

Conversion functions still take HTML and options. Update code that uses the items below.
These changes also apply when you upgrade from `2.0.0-beta.1`.

| v1 code | v2 code |
|---|---|
| `HTMLToMarkdownOptions` | `HtmlToMarkdownOptions` |
| `mdream::consts::get_tag_id("em")` | `mdream::get_tag_id("em")` |
| `mdream::consts::TAG_*`, `ATTR_*`, and the other constants | No replacement. Resolve a tag name with `get_tag_id`. |
| `ElementNode`, `Attributes`, `Attr`, `TagHandler`, `NodeExtras`, `TailwindData`, `ParsedSelector` | No replacement. The parser types are private. |
| `HTMLToMarkdownOptions { clean_urls: true, .. }` | `HtmlToMarkdownOptions { clean: Some(CleanConfig { urls: true, ..Default::default() }), .. }` |
| `.with_clean_urls()` | `.with_clean(CleanConfig { urls: true, ..Default::default() })` |
| `CleanConfig { blank_lines: true, .. }` | Delete the field. It had no effect. |
| `SplitterOptions { headers_to_split_on: vec![TAG_H2, TAG_H3], .. }` | `SplitterOptions { headers_to_split_on: vec![2, 3], .. }` |

`headers_to_split_on` takes heading levels 1 to 6. The splitter ignores other values, so an old heading tag ID splits nothing.

`OutputFormat` is `#[non_exhaustive]`, so a `match` on it needs a `_` arm.
Each variant follows a cargo feature, and another crate in your build can turn a feature on.

`MdreamResult`, `ExtractedElement`, `MarkdownChunk`, `ChunkMetadata`, and `ChunkLoc` are `#[non_exhaustive]`.
You can read their fields. You cannot build them with a struct literal, and a pattern that destructures them needs `..`.

Use a conversion function to obtain `MdreamResult`, or a splitter function to obtain chunks.
If your own data model needs struct literals, define your own result type and copy the public fields.

`<title>` text no longer appears in the body. Enable frontmatter or extraction to read it.
Review snapshots that relied on the title as visible text.
Link text also loses trailing spaces before empty elements, as fixed in [#318](https://github.com/harlan-zw/mdream/pull/318).
For optional format builds, see [Output format features](#output-format-features).

## License

MIT
