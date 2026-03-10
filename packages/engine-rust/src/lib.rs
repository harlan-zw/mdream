#![deny(clippy::all)]

pub mod consts;
pub mod markdown_processor;
pub mod parse;
pub mod tags;
pub mod types;

#[macro_use]
extern crate napi_derive;

use napi::bindgen_prelude::*;

use markdown_processor::MarkdownProcessor;
use parse::{parse_html_chunk, ParseState};
use types::HTMLToMarkdownOptions;

#[napi(object)]
pub struct FilterOptions {
    pub include: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    #[napi(js_name = "processChildren")]
    pub process_children: Option<bool>,
}

#[napi(object)]
pub struct FrontmatterOptions {
    #[napi(ts_type = "Record<string, string>")]
    pub additional_fields: Option<std::collections::HashMap<String, String>>,
    #[napi(js_name = "metaFields")]
    pub meta_fields: Option<Vec<String>>,
}

#[napi(object)]
pub struct PluginOptions {
    pub filter: Option<FilterOptions>,
    #[napi(js_name = "isolateMain")]
    pub isolate_main: Option<bool>,
    pub frontmatter: Option<FrontmatterOptions>,
    pub tailwind: Option<bool>,
}

#[napi(object)]
pub struct HtmlToMarkdownOptions {
    pub origin: Option<String>,
    pub plugins: Option<PluginOptions>,
}

fn to_internal_opts(options: Option<HtmlToMarkdownOptions>) -> HTMLToMarkdownOptions {
    HTMLToMarkdownOptions {
        origin: options.as_ref().and_then(|o| o.origin.clone()),
        plugins: options.and_then(|o| {
            o.plugins.map(|p| crate::types::PluginConfig {
                filter: p.filter.map(|f| crate::types::FilterConfig {
                    include: f.include,
                    exclude: f.exclude,
                    process_children: f.process_children,
                }),
                isolate_main: p.isolate_main.and_then(|v| if v { Some(crate::types::IsolateMainConfig {}) } else { None }),
                frontmatter: p.frontmatter.map(|f| crate::types::FrontmatterConfig {
                    additional_fields: f.additional_fields,
                    meta_fields: f.meta_fields,
                }),
                tailwind: p.tailwind.and_then(|v| if v { Some(crate::types::TailwindConfig {}) } else { None }),
            })
        }),
    }
}

#[napi(js_name = "htmlToMarkdown")]
pub fn html_to_markdown(html: String, options: Option<HtmlToMarkdownOptions>) -> Result<String> {
    let opts = to_internal_opts(options);

    let mut processor = MarkdownProcessor::new(opts.clone());
    let mut state = ParseState::default();

    parse_html_chunk(&html, &mut state, Some(&opts), |event, ancestors| {
        processor.process_event(event, ancestors);
    });

    Ok(processor.get_markdown())
}

#[napi]
pub struct MarkdownStream {
    processor: MarkdownProcessor,
    state: ParseState,
    buffer: String,
}

#[napi]
impl MarkdownStream {
    #[napi(constructor)]
    pub fn new(options: Option<HtmlToMarkdownOptions>) -> Self {
        let opts = to_internal_opts(options);
        Self {
            processor: MarkdownProcessor::new(opts),
            state: ParseState::default(),
            buffer: String::new(),
        }
    }

    #[napi]
    pub fn process_chunk(&mut self, chunk: String) -> String {
        let full_chunk = format!("{}{}", self.buffer, chunk);
        self.buffer = parse_html_chunk(&full_chunk, &mut self.state, None, |event, ancestors| {
            self.processor.process_event(event, ancestors);
        });
        self.processor.get_markdown_chunk()
    }

    #[napi]
    pub fn finish(&mut self) -> String {
        if !self.buffer.is_empty() {
            let chunk = std::mem::take(&mut self.buffer);
            crate::parse::parse_html_chunk(&chunk, &mut self.state, None, |event, ancestors| {
                self.processor.process_event(event, ancestors);
            });
            // flush
            if !self.state.stack.is_empty() {
                // mock process text buffer? parse_html_chunk handles it mostly
            }
        }
        self.processor.get_markdown_chunk()
    }
}
