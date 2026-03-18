pub mod consts;
pub(crate) mod convert;
pub(crate) mod helpers;
pub mod splitter;
pub(crate) mod tags;
pub mod types;

use convert::ConvertState;
use types::{HTMLToMarkdownOptions, MdreamResult};

/// Convert HTML to Markdown in a single pass.
pub fn html_to_markdown(html: &str, options: HTMLToMarkdownOptions) -> String {
    html_to_markdown_result(html, options).markdown
}

/// Convert HTML to Markdown with full results (extraction, frontmatter).
pub fn html_to_markdown_result(html: &str, options: HTMLToMarkdownOptions) -> MdreamResult {
    let capacity = (html.len() / 3).clamp(1024, 256 * 1024);
    let mut state = ConvertState::new(options, capacity);
    state.process_html(html);

    let extracted = if state.has_extraction {
        let results = std::mem::take(&mut state.extraction_results);
        if results.is_empty() { None } else { Some(results) }
    } else {
        None
    };

    let frontmatter = if state.has_frontmatter {
        let mut entries: Vec<(String, String)> = Vec::new();
        if let Some(title) = &state.frontmatter_title {
            entries.push(("title".to_string(), title.clone()));
        }
        for (k, v) in &state.frontmatter_meta {
            entries.push((k.clone(), v.clone()));
        }
        if let Some(add) = state.options.plugins.as_ref()
            .and_then(|p| p.frontmatter.as_ref())
            .and_then(|f| f.additional_fields.as_ref()) {
            for (k, v) in add {
                entries.push((k.clone(), v.clone()));
            }
        }
        Some(entries)
    } else {
        None
    };

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
        Self {
            state: ConvertState::new(options, 4096),
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
        if !self.buffer.is_empty() {
            let chunk = std::mem::take(&mut self.buffer);
            self.state.process_html(&chunk);
        }
        self.state.get_markdown_chunk()
    }
}
