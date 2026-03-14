use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use serde::Deserialize;

// ── Serde types for JS interop ──

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FilterOptions {
    include: Option<Vec<String>>,
    exclude: Option<Vec<String>>,
    process_children: Option<bool>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FrontmatterOptions {
    additional_fields: Option<HashMap<String, String>>,
    meta_fields: Option<Vec<String>>,
}

#[derive(Deserialize, Default)]
struct ExtractionOptions {
    selectors: Vec<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct TagOverride {
    enter: Option<String>,
    exit: Option<String>,
    spacing: Option<Vec<u8>>,
    is_inline: Option<bool>,
    is_self_closing: Option<bool>,
    collapses_inner_white_space: Option<bool>,
    alias: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PluginOptions {
    filter: Option<FilterOptions>,
    isolate_main: Option<bool>,
    frontmatter: Option<FrontmatterOptions>,
    tailwind: Option<bool>,
    extraction: Option<ExtractionOptions>,
    tag_overrides: Option<HashMap<String, TagOverride>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct HtmlToMarkdownOptions {
    origin: Option<String>,
    clean_urls: Option<bool>,
    plugins: Option<PluginOptions>,
}

// ── Type conversion ──

fn to_core_opts(options: HtmlToMarkdownOptions) -> mdream::types::HTMLToMarkdownOptions {
    mdream::types::HTMLToMarkdownOptions {
        origin: options.origin,
        clean_urls: options.clean_urls.unwrap_or(false),
        plugins: options.plugins.map(|p| mdream::types::PluginConfig {
            filter: p.filter.map(|f| mdream::types::FilterConfig {
                include: f.include,
                exclude: f.exclude,
                process_children: f.process_children,
            }),
            isolate_main: p.isolate_main.and_then(|v| if v { Some(mdream::types::IsolateMainConfig {}) } else { None }),
            frontmatter: p.frontmatter.map(|f| mdream::types::FrontmatterConfig {
                additional_fields: f.additional_fields,
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
        }),
    }
}

fn parse_options(options: JsValue) -> HtmlToMarkdownOptions {
    if options.is_undefined() || options.is_null() {
        return HtmlToMarkdownOptions::default();
    }
    serde_wasm_bindgen::from_value(options).unwrap_or_default()
}

// ── WASM exports ──

#[wasm_bindgen(js_name = "htmlToMarkdown")]
pub fn html_to_markdown(html: &str, options: JsValue) -> String {
    let opts = to_core_opts(parse_options(options));
    mdream::html_to_markdown(html, opts)
}

#[wasm_bindgen(js_name = "htmlToMarkdownResult")]
pub fn html_to_markdown_result(html: &str, options: JsValue) -> JsValue {
    let opts = to_core_opts(parse_options(options));
    let result = mdream::html_to_markdown_result(html, opts);

    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &"markdown".into(), &result.markdown.into()).unwrap_or_default();

    if let Some(extracted) = result.extracted {
        let arr = js_sys::Array::new();
        for e in extracted {
            let elem = js_sys::Object::new();
            js_sys::Reflect::set(&elem, &"selector".into(), &e.selector.into()).unwrap_or_default();
            js_sys::Reflect::set(&elem, &"tagName".into(), &e.tag_name.into()).unwrap_or_default();
            js_sys::Reflect::set(&elem, &"textContent".into(), &e.text_content.into()).unwrap_or_default();
            let attrs = js_sys::Object::new();
            for (k, v) in e.attributes {
                js_sys::Reflect::set(&attrs, &k.into(), &v.into()).unwrap_or_default();
            }
            js_sys::Reflect::set(&elem, &"attributes".into(), &attrs).unwrap_or_default();
            arr.push(&elem);
        }
        js_sys::Reflect::set(&obj, &"extracted".into(), &arr).unwrap_or_default();
    }

    if let Some(frontmatter) = result.frontmatter {
        let fm = js_sys::Object::new();
        for (k, v) in frontmatter {
            js_sys::Reflect::set(&fm, &k.into(), &v.into()).unwrap_or_default();
        }
        js_sys::Reflect::set(&obj, &"frontmatter".into(), &fm).unwrap_or_default();
    }

    obj.into()
}

#[wasm_bindgen]
pub struct MarkdownStream {
    inner: mdream::MarkdownStreamProcessor,
}

#[wasm_bindgen]
impl MarkdownStream {
    #[wasm_bindgen(constructor)]
    pub fn new(options: JsValue) -> Self {
        let opts = to_core_opts(parse_options(options));
        Self {
            inner: mdream::MarkdownStreamProcessor::new(opts),
        }
    }

    #[wasm_bindgen(js_name = "processChunk")]
    pub fn process_chunk(&mut self, chunk: &str) -> String {
        self.inner.process_chunk(chunk)
    }

    pub fn finish(&mut self) -> String {
        self.inner.finish()
    }
}
