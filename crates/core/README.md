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
use mdream::{try_html_to_markdown, types::HTMLToMarkdownOptions};

let html = "<h1>Hello</h1><p>World</p>";
let md = try_html_to_markdown(html, HTMLToMarkdownOptions::default())?;
assert_eq!(md, "# Hello\n\nWorld");
# Ok::<(), mdream::ConversionError>(())
```

Use the `try_*` APIs for untrusted HTML. The convenience APIs panic on bounded
parser failures. Fallible splitter equivalents are also available:
`try_html_to_markdown_chunks` and `try_html_to_format_chunks`.

Full-result APIs expose `MdreamResult::degraded`. A `true` value means parsing
crossed the 512-element materialization boundary. Content and later siblings
were preserved with the bounded compact stack, but deeply nested formatting,
tables, links, or images may have reduced fidelity.

### Streaming

```rust
use mdream::MarkdownStreamProcessor;
use mdream::types::HTMLToMarkdownOptions;

let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
let chunk1 = stream.try_process_chunk("<h1>Hello</h1>")?;
let chunk2 = stream.try_process_chunk("<p>World</p>")?;
let remaining = stream.try_finish()?;
# Ok::<(), mdream::ConversionError>(())
```

### CLI

```sh
curl -s https://example.com | mdream
```

## License

MIT
