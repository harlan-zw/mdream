#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use napi::bindgen_prelude::*;

// Re-export core types for the binary
pub use mdream::types::HTMLToMarkdownOptions;

// ── NAPI types (thin wrappers over mdream types) ──

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
pub struct ExtractionOptions {
    pub selectors: Vec<String>,
}

#[napi(object)]
pub struct TagOverrideNapi {
    pub enter: Option<String>,
    pub exit: Option<String>,
    pub spacing: Option<Vec<u8>>,
    #[napi(js_name = "isInline")]
    pub is_inline: Option<bool>,
    #[napi(js_name = "isSelfClosing")]
    pub is_self_closing: Option<bool>,
    #[napi(js_name = "collapsesInnerWhiteSpace")]
    pub collapses_inner_white_space: Option<bool>,
    pub alias: Option<String>,
}

#[napi(object)]
pub struct PluginOptions {
    pub filter: Option<FilterOptions>,
    #[napi(js_name = "isolateMain")]
    pub isolate_main: Option<bool>,
    pub frontmatter: Option<FrontmatterOptions>,
    pub tailwind: Option<bool>,
    pub extraction: Option<ExtractionOptions>,
    #[napi(js_name = "tagOverrides", ts_type = "Record<string, TagOverrideNapi>")]
    pub tag_overrides: Option<std::collections::HashMap<String, TagOverrideNapi>>,
}

#[napi(object)]
pub struct ExtractedElementNapi {
    pub selector: String,
    #[napi(js_name = "tagName")]
    pub tag_name: String,
    #[napi(js_name = "textContent")]
    pub text_content: String,
    #[napi(ts_type = "Record<string, string>")]
    pub attributes: std::collections::HashMap<String, String>,
}

#[napi(object)]
pub struct MdreamNapiResult {
    pub markdown: String,
    pub extracted: Option<Vec<ExtractedElementNapi>>,
    #[napi(ts_type = "Record<string, string>")]
    pub frontmatter: Option<std::collections::HashMap<String, String>>,
}

#[napi(object)]
pub struct CleanOptionsNapi {
    pub urls: Option<bool>,
    pub fragments: Option<bool>,
    #[napi(js_name = "emptyLinks")]
    pub empty_links: Option<bool>,
    #[napi(js_name = "blankLines")]
    pub blank_lines: Option<bool>,
    #[napi(js_name = "redundantLinks")]
    pub redundant_links: Option<bool>,
    #[napi(js_name = "selfLinkHeadings")]
    pub self_link_headings: Option<bool>,
    #[napi(js_name = "emptyImages")]
    pub empty_images: Option<bool>,
    #[napi(js_name = "emptyLinkText")]
    pub empty_link_text: Option<bool>,
}

#[napi(object)]
pub struct HtmlToMarkdownOptions {
    pub origin: Option<String>,
    #[napi(js_name = "cleanUrls")]
    pub clean_urls: Option<bool>,
    pub clean: Option<CleanOptionsNapi>,
    pub plugins: Option<PluginOptions>,
}

// ── Type conversion (NAPI → core) ──

fn to_core_opts(options: Option<HtmlToMarkdownOptions>) -> mdream::types::HTMLToMarkdownOptions {
    let clean = options.as_ref().and_then(|o| o.clean.as_ref()).map(|c| mdream::types::CleanConfig {
        urls: c.urls.unwrap_or(false),
        fragments: c.fragments.unwrap_or(false),
        empty_links: c.empty_links.unwrap_or(false),
        blank_lines: c.blank_lines.unwrap_or(false),
        redundant_links: c.redundant_links.unwrap_or(false),
        self_link_headings: c.self_link_headings.unwrap_or(false),
        empty_images: c.empty_images.unwrap_or(false),
        empty_link_text: c.empty_link_text.unwrap_or(false),
    });
    mdream::types::HTMLToMarkdownOptions {
        origin: options.as_ref().and_then(|o| o.origin.clone()),
        clean_urls: options.as_ref().and_then(|o| o.clean_urls).unwrap_or(false),
        clean,
        plugins: options.and_then(|o| {
            o.plugins.map(|p| mdream::types::PluginConfig {
                filter: p.filter.map(|f| mdream::types::FilterConfig {
                    include: f.include,
                    exclude: f.exclude,
                    process_children: f.process_children,
                }),
                isolate_main: p.isolate_main.and_then(|v| if v { Some(mdream::types::IsolateMainConfig {}) } else { None }),
                frontmatter: p.frontmatter.map(|f| mdream::types::FrontmatterConfig {
                    additional_fields: f.additional_fields.map(|m| m.into_iter().collect()),
                    meta_fields: f.meta_fields,
                }),
                tailwind: p.tailwind.and_then(|v| if v { Some(mdream::types::TailwindConfig {}) } else { None }),
                extraction: p.extraction.map(|e| mdream::types::ExtractionConfig {
                    selectors: e.selectors,
                }),
                tag_overrides: p.tag_overrides.map(|overrides| {
                    overrides.into_iter().map(|(tag_name, ov)| {
                        let alias_tag_id = ov.alias.as_ref().and_then(|a| mdream::consts::get_tag_id(a));
                        let config = mdream::types::TagOverrideConfig {
                            enter: ov.enter,
                            exit: ov.exit,
                            spacing: ov.spacing.and_then(|s| if s.len() >= 2 { Some([s[0], s[1]]) } else { None }),
                            is_inline: ov.is_inline,
                            is_self_closing: ov.is_self_closing,
                            collapses_inner_white_space: ov.collapses_inner_white_space,
                            alias_tag_id,
                        };
                        (tag_name, config)
                    }).collect()
                }),
            })
        }),
    }
}

// ── Helpers ──

fn result_to_napi(result: mdream::types::MdreamResult) -> MdreamNapiResult {
    MdreamNapiResult {
        markdown: result.markdown,
        extracted: result.extracted.map(|elems| {
            elems.into_iter().map(|e| ExtractedElementNapi {
                selector: e.selector,
                tag_name: e.tag_name,
                text_content: e.text_content,
                attributes: e.attributes.into_iter().collect(),
            }).collect()
        }),
        frontmatter: result.frontmatter.map(|v| v.into_iter().collect()),
    }
}

fn catch_panic<F: FnOnce() -> Result<T> + std::panic::UnwindSafe, T>(f: F) -> Result<T> {
    match std::panic::catch_unwind(f) {
        Ok(r) => r,
        Err(e) => {
            let msg = if let Some(s) = e.downcast_ref::<&str>() {
                format!("mdream internal error: {s}")
            } else if let Some(s) = e.downcast_ref::<String>() {
                format!("mdream internal error: {s}")
            } else {
                "mdream internal error: unknown panic".to_string()
            };
            Err(napi::Error::new(napi::Status::GenericFailure, msg))
        }
    }
}

// ── NAPI exports ──

#[napi(js_name = "htmlToMarkdown")]
pub fn html_to_markdown(html: String, options: Option<HtmlToMarkdownOptions>) -> Result<MdreamNapiResult> {
    catch_panic(move || {
        let opts = to_core_opts(options);
        let result = mdream::html_to_markdown_result(&html, opts);
        Ok(result_to_napi(result))
    })
}

#[napi(js_name = "htmlToMarkdownBytes")]
pub fn html_to_markdown_bytes(html: &[u8], options: Option<HtmlToMarkdownOptions>) -> Result<MdreamNapiResult> {
    let text = std::str::from_utf8(html)
        .map_err(|e| napi::Error::new(napi::Status::InvalidArg, format!("Invalid UTF-8: {e}")))?;
    let text = text.to_string();
    catch_panic(move || {
        let opts = to_core_opts(options);
        let result = mdream::html_to_markdown_result(&text, opts);
        Ok(result_to_napi(result))
    })
}

#[napi]
pub struct MarkdownStream {
    inner: mdream::MarkdownStreamProcessor,
}

#[napi]
impl MarkdownStream {
    #[napi(constructor)]
    pub fn new(options: Option<HtmlToMarkdownOptions>) -> Self {
        let opts = to_core_opts(options);
        Self {
            inner: mdream::MarkdownStreamProcessor::new(opts),
        }
    }

    #[napi]
    #[allow(clippy::needless_pass_by_value)]
    pub fn process_chunk(&mut self, chunk: String) -> String {
        self.inner.process_chunk(&chunk)
    }

    #[napi(js_name = "processChunkBytes")]
    pub fn process_chunk_bytes(&mut self, chunk: &[u8]) -> Result<String> {
        let text = std::str::from_utf8(chunk)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, format!("Invalid UTF-8: {e}")))?;
        Ok(self.inner.process_chunk(text))
    }

    #[napi]
    pub fn finish(&mut self) -> String {
        self.inner.finish()
    }
}

// ── Splitter types ──

#[napi(object)]
pub struct ChunkLocNapi {
    pub from: u32,
    pub to: u32,
}

#[napi(object)]
pub struct ChunkMetadataNapi {
    #[napi(ts_type = "Record<string, string>")]
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub code: Option<String>,
    pub loc: Option<ChunkLocNapi>,
}

#[napi(object)]
pub struct MarkdownChunkNapi {
    pub content: String,
    pub metadata: ChunkMetadataNapi,
}

#[napi(object)]
pub struct SplitterOptionsNapi {
    #[napi(js_name = "headersToSplitOn")]
    pub headers_to_split_on: Option<Vec<u32>>,
    #[napi(js_name = "returnEachLine")]
    pub return_each_line: Option<bool>,
    #[napi(js_name = "stripHeaders")]
    pub strip_headers: Option<bool>,
    #[napi(js_name = "chunkSize")]
    pub chunk_size: Option<u32>,
    #[napi(js_name = "chunkOverlap")]
    pub chunk_overlap: Option<u32>,
}

fn to_core_splitter_opts(options: Option<SplitterOptionsNapi>) -> Result<mdream::splitter::SplitterOptions> {
    let defaults = mdream::splitter::SplitterOptions::default();
    match options {
        None => Ok(defaults),
        Some(opts) => Ok(mdream::splitter::SplitterOptions {
            headers_to_split_on: opts.headers_to_split_on
                .map(|v| v.into_iter().map(|x| u8::try_from(x).map_err(|_| napi::Error::new(napi::Status::InvalidArg, format!("headersToSplitOn value {x} exceeds u8 range (0-255)")))).collect::<Result<Vec<u8>>>())
                .transpose()?
                .unwrap_or(defaults.headers_to_split_on),
            return_each_line: opts.return_each_line.unwrap_or(defaults.return_each_line),
            strip_headers: opts.strip_headers.unwrap_or(defaults.strip_headers),
            chunk_size: opts.chunk_size.map_or(defaults.chunk_size, |v| v as usize),
            chunk_overlap: opts.chunk_overlap.map_or(defaults.chunk_overlap, |v| v as usize),
        }),
    }
}

#[allow(clippy::cast_possible_truncation)]
fn chunk_to_napi(chunk: mdream::splitter::MarkdownChunk) -> MarkdownChunkNapi {
    MarkdownChunkNapi {
        content: chunk.content,
        metadata: ChunkMetadataNapi {
            headers: chunk.metadata.headers.map(|v| v.into_iter().collect()),
            code: chunk.metadata.code,
            loc: chunk.metadata.loc.map(|loc| ChunkLocNapi {
                from: loc.from as u32,
                to: loc.to as u32,
            }),
        },
    }
}

#[napi(js_name = "splitMarkdown")]
pub fn split_markdown(markdown: String, options: Option<SplitterOptionsNapi>) -> Result<Vec<MarkdownChunkNapi>> {
    catch_panic(move || {
        let opts = to_core_splitter_opts(options)?;
        let chunks = mdream::splitter::split_markdown(&markdown, &opts);
        Ok(chunks.into_iter().map(chunk_to_napi).collect())
    })
}

#[napi(js_name = "htmlToMarkdownChunks")]
pub fn html_to_markdown_chunks(
    html: String,
    options: Option<HtmlToMarkdownOptions>,
    splitter_options: Option<SplitterOptionsNapi>,
) -> Result<Vec<MarkdownChunkNapi>> {
    catch_panic(move || {
        let md_opts = to_core_opts(options);
        let split_opts = to_core_splitter_opts(splitter_options)?;
        let chunks = mdream::splitter::html_to_markdown_chunks(&html, md_opts, &split_opts);
        Ok(chunks.into_iter().map(chunk_to_napi).collect())
    })
}
