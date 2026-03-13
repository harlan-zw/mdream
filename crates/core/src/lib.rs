#![deny(clippy::all)]

pub mod consts;
pub mod markdown_processor;
pub mod parse;
pub mod splitter;
pub mod tags;
pub mod types;

use markdown_processor::MarkdownProcessor;
use parse::{parse_html_chunk, ParseState};
use types::{HTMLToMarkdownOptions, MdreamResult};

/// Convert HTML to Markdown in a single pass.
pub fn html_to_markdown(html: &str, options: HTMLToMarkdownOptions) -> String {
    html_to_markdown_result(html, options).markdown
}

/// Convert HTML to Markdown with full results (extraction, frontmatter).
pub fn html_to_markdown_result(html: &str, options: HTMLToMarkdownOptions) -> MdreamResult {
    // Pre-allocate: markdown is typically ~30% of HTML size; cap initial allocation
    let capacity = (html.len() / 3).min(256 * 1024);
    let mut processor = MarkdownProcessor::with_capacity(options, capacity.max(1024));
    let mut state = ParseState::new(&processor.state.options);

    let opts_ref = &processor.state.options as *const HTMLToMarkdownOptions;
    // SAFETY: processor.state.options is not mutated during parsing
    let opts_borrow = unsafe { &*opts_ref };
    parse_html_chunk(html, &mut state, Some(opts_borrow), |event, ancestors, depth_map| {
        processor.process_event(event, ancestors, depth_map);
    });

    let extracted = if state.has_extraction {
        let results = state.extraction_results;
        if results.is_empty() { None } else { Some(results) }
    } else {
        None
    };

    let frontmatter = if state.has_frontmatter {
        let mut map = std::collections::HashMap::new();
        if let Some(title) = &state.frontmatter_title {
            map.insert("title".to_string(), title.clone());
        }
        for (k, v) in &state.frontmatter_meta {
            map.insert(k.clone(), v.clone());
        }
        if let Some(add) = processor.state.options.plugins.as_ref()
            .and_then(|p| p.frontmatter.as_ref())
            .and_then(|f| f.additional_fields.as_ref()) {
            for (k, v) in add {
                map.insert(k.clone(), v.clone());
            }
        }
        if map.is_empty() { None } else { Some(map) }
    } else {
        None
    };

    MdreamResult {
        markdown: processor.get_markdown(),
        extracted,
        frontmatter,
    }
}

/// Streaming HTML-to-Markdown converter.
///
/// Feed chunks of HTML via `process_chunk()`, then call `finish()` for remaining output.
pub struct MarkdownStreamProcessor {
    processor: MarkdownProcessor,
    state: ParseState,
    buffer: String,
}

impl MarkdownStreamProcessor {
    pub fn new(options: HTMLToMarkdownOptions) -> Self {
        Self {
            processor: MarkdownProcessor::new(options),
            state: ParseState::default(),
            buffer: String::new(),
        }
    }

    pub fn process_chunk(&mut self, chunk: &str) -> String {
        let full_chunk = format!("{}{}", self.buffer, chunk);
        self.buffer = parse_html_chunk(&full_chunk, &mut self.state, None, |event, ancestors, depth_map| {
            self.processor.process_event(event, ancestors, depth_map);
        });
        self.processor.get_markdown_chunk()
    }

    pub fn finish(&mut self) -> String {
        if !self.buffer.is_empty() {
            let chunk = std::mem::take(&mut self.buffer);
            parse_html_chunk(&chunk, &mut self.state, None, |event, ancestors, depth_map| {
                self.processor.process_event(event, ancestors, depth_map);
            });
        }
        self.processor.get_markdown_chunk()
    }
}
