# mdream

Fastest HTML-to-Markdown converter. Zero dependencies, streaming support.

## Install

```sh
cargo add mdream
```

Or as a CLI:

```sh
cargo install mdream
```

## Usage

### Library

```rust
use mdream::{html_to_markdown, types::HTMLToMarkdownOptions};

let html = "<h1>Hello</h1><p>World</p>";
let md = html_to_markdown(html, HTMLToMarkdownOptions::default());
assert_eq!(md, "# Hello\n\nWorld");
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
```

## License

MIT
