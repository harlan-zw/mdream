pub mod consts;
pub(crate) mod convert;
pub(crate) mod entities;
pub(crate) mod scan;
pub(crate) mod selector;
pub mod splitter;
pub(crate) mod tags;
pub(crate) mod tailwind;
pub mod types;
pub(crate) mod url;

use convert::ConvertState;

// Re-export the public option/config types at the crate root so `use mdream::*`
// pulls in everything needed to call `html_to_markdown` without reaching into
// the `types` module.
pub use types::{
  CleanConfig, ExtractionConfig, FilterConfig, FrontmatterConfig, HTMLToMarkdownOptions,
  IsolateMainConfig, MdreamResult, OutputFormat, PluginConfig, TagOverrideConfig, TailwindConfig,
};

// Re-export `get_tag_id` so callers can resolve tag names to IDs (for
// `TagOverrideConfig::alias_tag_id`) without reaching into `consts` directly.
pub use consts::get_tag_id;

/// Convert HTML to Markdown in a single pass.
pub fn html_to_markdown(html: &str, options: HTMLToMarkdownOptions) -> String {
  html_to_format(html, options, OutputFormat::Markdown)
}

/// Convert HTML to readable plain text in a single pass.
pub fn html_to_text(html: &str, options: HTMLToMarkdownOptions) -> String {
  html_to_format(html, options, OutputFormat::Text)
}

/// Convert HTML to the requested output format in a single pass.
pub fn html_to_format(html: &str, options: HTMLToMarkdownOptions, format: OutputFormat) -> String {
  html_to_format_result(html, options, format).markdown
}

/// Convert HTML to Markdown with full results (extraction, frontmatter).
pub fn html_to_markdown_result(html: &str, options: HTMLToMarkdownOptions) -> MdreamResult {
  html_to_format_result(html, options, OutputFormat::Markdown)
}

/// Convert HTML to plain text with full results (extraction, frontmatter).
pub fn html_to_text_result(html: &str, options: HTMLToMarkdownOptions) -> MdreamResult {
  html_to_format_result(html, options, OutputFormat::Text)
}

/// Convert HTML to the requested format with full results (extraction, frontmatter).
pub fn html_to_format_result(
  html: &str,
  options: HTMLToMarkdownOptions,
  format: OutputFormat,
) -> MdreamResult {
  let capacity = (html.len() / 3).clamp(1024, 256 * 1024);
  let mut state = ConvertState::new(options, capacity, format);
  let leftover = state.process_html(html);
  state.finalize(&leftover);

  let extracted = if state.has_extraction {
    let results = std::mem::take(&mut state.extraction_results);
    if results.is_empty() {
      None
    } else {
      Some(results)
    }
  } else {
    None
  };

  let frontmatter = state.frontmatter();

  MdreamResult {
    markdown: state.get_markdown(),
    extracted,
    frontmatter,
  }
}

/// Streaming HTML-to-Markdown converter.
///
/// Feed chunks of HTML via `process_chunk()`, then call `finish()` for remaining output.
pub struct MarkdownStreamProcessor {
  state: ConvertState,
  buffer: String,
}

impl MarkdownStreamProcessor {
  pub fn new(options: HTMLToMarkdownOptions) -> Self {
    Self::new_with_format(options, OutputFormat::Markdown)
  }

  /// Create a streaming converter for the requested output format.
  pub fn new_with_format(options: HTMLToMarkdownOptions, format: OutputFormat) -> Self {
    Self {
      state: ConvertState::new(options, 4096, format),
      buffer: String::new(),
    }
  }

  /// Like `new`, but with draining disabled (drain-transparency test only).
  #[cfg(test)]
  pub(crate) fn new_drain_disabled(options: HTMLToMarkdownOptions) -> Self {
    let mut me = Self::new(options);
    me.state.disable_drain = true;
    me
  }

  pub fn process_chunk(&mut self, chunk: &str) -> String {
    if self.buffer.is_empty() {
      self.buffer = self.state.process_html(chunk);
    } else {
      self.buffer.push_str(chunk);
      let full = std::mem::take(&mut self.buffer);
      self.buffer = self.state.process_html(&full);
    }
    self.state.get_markdown_chunk()
  }

  pub fn finish(&mut self) -> String {
    let leftover = if self.buffer.is_empty() {
      String::new()
    } else {
      let chunk = std::mem::take(&mut self.buffer);
      self.state.process_html(&chunk)
    };
    self.state.finalize(&leftover);
    self.state.get_markdown_chunk()
  }
}

#[cfg(test)]
mod drain_equiv {
  //! Draining must be byte-transparent: same streamed output with it on or off,
  //! for any input at any chunk size. The corpus includes the rewrite-after-yield
  //! constructs (autolink text==url, self-link headings, redundant `[url](url)`)
  //! that diverge from one-shot but must stay drain-invariant.

  use super::MarkdownStreamProcessor;
  use super::types::{CleanConfig, HTMLToMarkdownOptions};

  const CORPUS: &[&str] = &[
    // Breadth: chunk-invariant cases.
    "<h1>Title</h1><p>Para one.</p><p>Para <strong>two</strong>.</p>",
    "<ul><li>a</li><li>b<ul><li>b1</li><li>b2</li></ul></li></ul>",
    r#"<p>See <a href="https://example.com">Example</a> and <a href="https://x.io">the X site</a>.</p>"#,
    "<blockquote><p>quote</p><blockquote><p>nested</p></blockquote></blockquote><p>after</p>",
    "<pre><code>let x = 1;\nlet y = 2;</code></pre><p>done</p>",
    "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>",
    r#"<h2>Section</h2><p>text with a <a href="/rel">relative</a> link</p>"#,
    // Rewrite-after-yield constructs.
    r#"<p>Visit <a href="https://x.io">https://x.io</a> today.</p>"#,
    r##"<h2><a href="#section">Section</a></h2><p>body</p>"##,
    r#"<p>link <a href="https://example.com">https://example.com</a> end</p>"#,
  ];

  fn stream(html: &str, chunk: usize, opts: HTMLToMarkdownOptions, disable_drain: bool) -> String {
    let mut p = if disable_drain {
      MarkdownStreamProcessor::new_drain_disabled(opts)
    } else {
      MarkdownStreamProcessor::new(opts)
    };
    let mut out = String::new();
    for c in html.as_bytes().chunks(chunk) {
      out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
    }
    out.push_str(&p.finish());
    out
  }

  fn safe_clean() -> CleanConfig {
    // Everything except `fragments`, which needs the whole buffer (drain gated off).
    CleanConfig {
      urls: true,
      fragments: false,
      empty_links: true,
      blank_lines: true,
      redundant_links: true,
      self_link_headings: true,
      empty_images: true,
      empty_link_text: true,
    }
  }

  #[test]
  fn drain_is_byte_transparent() {
    for &html in CORPUS {
      for opts in [
        HTMLToMarkdownOptions::default(),
        HTMLToMarkdownOptions::default().with_wrap_width(12),
        HTMLToMarkdownOptions {
          clean: Some(safe_clean()),
          ..Default::default()
        },
      ] {
        for chunk in [1usize, 3, 7, 64, html.len().max(1)] {
          let drained = stream(html, chunk, opts.clone(), false);
          let undrained = stream(html, chunk, opts.clone(), true);
          assert_eq!(
            drained, undrained,
            "drain changed output: chunk={chunk} html={html:?}"
          );
        }
      }
    }
  }

  #[test]
  fn closing_a_skipped_link_releases_the_yielded_prefix() {
    let options = HTMLToMarkdownOptions {
      clean: Some(safe_clean()),
      ..Default::default()
    };
    let mut processor = MarkdownStreamProcessor::new(options);

    for _ in 0..10_000 {
      let _ = processor.process_chunk(r##"<a href="#">x<span></span>"##);
      let _ = processor.process_chunk("</a>");
    }

    assert!(
      processor.state.buffer.len() < 1024,
      "yielded skipped links accumulated {} buffered bytes",
      processor.state.buffer.len()
    );
  }
}
