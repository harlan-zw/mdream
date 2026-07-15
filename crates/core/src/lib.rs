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
