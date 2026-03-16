use wasm_bindgen::prelude::*;

// ── Manual JsValue helpers (replaces serde) ──

fn get_prop(obj: &JsValue, key: &str) -> JsValue {
    js_sys::Reflect::get(obj, &JsValue::from_str(key)).unwrap_or(JsValue::UNDEFINED)
}

fn as_string(v: &JsValue) -> Option<String> {
    v.as_string()
}

fn as_bool(v: &JsValue) -> Option<bool> {
    v.as_bool()
}

fn as_string_vec(v: &JsValue) -> Option<Vec<String>> {
    if v.is_undefined() || v.is_null() || !js_sys::Array::is_array(v) {
        return None;
    }
    let arr = js_sys::Array::from(v);
    let mut out = Vec::with_capacity(arr.length() as usize);
    for i in 0..arr.length() {
        if let Some(s) = arr.get(i).as_string() {
            out.push(s);
        }
    }
    Some(out)
}

fn as_u8_vec(v: &JsValue) -> Option<Vec<u8>> {
    if v.is_undefined() || v.is_null() || !js_sys::Array::is_array(v) {
        return None;
    }
    let arr = js_sys::Array::from(v);
    let mut out = Vec::with_capacity(arr.length() as usize);
    for i in 0..arr.length() {
        if let Some(n) = arr.get(i).as_f64() {
            out.push(n as u8);
        }
    }
    Some(out)
}

fn js_object_entries(v: &JsValue) -> Option<Vec<(String, JsValue)>> {
    if v.is_undefined() || v.is_null() {
        return None;
    }
    let entries = js_sys::Object::entries(&js_sys::Object::from(v.clone()));
    let mut out = Vec::with_capacity(entries.length() as usize);
    for i in 0..entries.length() {
        let pair = js_sys::Array::from(&entries.get(i));
        if let Some(key) = pair.get(0).as_string() {
            out.push((key, pair.get(1)));
        }
    }
    Some(out)
}

fn js_string_vec(v: &JsValue) -> Option<Vec<(String, String)>> {
    let entries = js_object_entries(v)?;
    let mut out = Vec::with_capacity(entries.len());
    for (k, v) in entries {
        if let Some(s) = v.as_string() {
            out.push((k, s));
        }
    }
    Some(out)
}

// ── Options parsing ──

fn parse_options(options: &JsValue) -> mdream::types::HTMLToMarkdownOptions {
    if options.is_undefined() || options.is_null() {
        return mdream::types::HTMLToMarkdownOptions::default();
    }

    let origin = as_string(&get_prop(options, "origin"));
    let clean_urls = as_bool(&get_prop(options, "cleanUrls")).unwrap_or(false);

    let plugins_val = get_prop(options, "plugins");
    let plugins = if plugins_val.is_undefined() || plugins_val.is_null() {
        None
    } else {
        Some(parse_plugins(&plugins_val))
    };

    mdream::types::HTMLToMarkdownOptions {
        origin,
        clean_urls,
        clean: None,
        plugins,
    }
}

fn parse_plugins(p: &JsValue) -> mdream::types::PluginConfig {
    let filter_val = get_prop(p, "filter");
    let filter = if filter_val.is_undefined() || filter_val.is_null() {
        None
    } else {
        Some(mdream::types::FilterConfig {
            include: as_string_vec(&get_prop(&filter_val, "include")),
            exclude: as_string_vec(&get_prop(&filter_val, "exclude")),
            process_children: as_bool(&get_prop(&filter_val, "processChildren")),
        })
    };

    let isolate_val = get_prop(p, "isolateMain");
    let isolate_main = as_bool(&isolate_val)
        .and_then(|v| if v { Some(mdream::types::IsolateMainConfig {}) } else { None });

    let fm_val = get_prop(p, "frontmatter");
    let frontmatter = if fm_val.is_undefined() || fm_val.is_null() {
        None
    } else {
        Some(mdream::types::FrontmatterConfig {
            additional_fields: js_string_vec(&get_prop(&fm_val, "additionalFields")),
            meta_fields: as_string_vec(&get_prop(&fm_val, "metaFields")),
        })
    };

    let tailwind = as_bool(&get_prop(p, "tailwind"))
        .and_then(|v| if v { Some(mdream::types::TailwindConfig {}) } else { None });

    let ext_val = get_prop(p, "extraction");
    let extraction = if ext_val.is_undefined() || ext_val.is_null() {
        None
    } else {
        as_string_vec(&get_prop(&ext_val, "selectors")).map(|selectors| {
            mdream::types::ExtractionConfig { selectors }
        })
    };

    let overrides_val = get_prop(p, "tagOverrides");
    let tag_overrides = if overrides_val.is_undefined() || overrides_val.is_null() {
        None
    } else {
        js_object_entries(&overrides_val).map(|entries| {
            entries.into_iter().map(|(tag_name, ov)| {
                let alias = as_string(&get_prop(&ov, "alias"));
                let alias_tag_id = alias.as_ref().and_then(|a| mdream::consts::get_tag_id(a));
                let spacing_vec = as_u8_vec(&get_prop(&ov, "spacing"));
                let config = mdream::types::TagOverrideConfig {
                    enter: as_string(&get_prop(&ov, "enter")),
                    exit: as_string(&get_prop(&ov, "exit")),
                    spacing: spacing_vec.and_then(|s| if s.len() >= 2 { Some([s[0], s[1]]) } else { None }),
                    is_inline: as_bool(&get_prop(&ov, "isInline")),
                    is_self_closing: as_bool(&get_prop(&ov, "isSelfClosing")),
                    collapses_inner_white_space: as_bool(&get_prop(&ov, "collapsesInnerWhiteSpace")),
                    alias_tag_id,
                };
                (tag_name, config)
            }).collect()
        })
    };

    mdream::types::PluginConfig {
        filter,
        isolate_main,
        frontmatter,
        tailwind,
        extraction,
        tag_overrides,
    }
}

// ── WASM exports ──

#[wasm_bindgen(js_name = "htmlToMarkdown")]
pub fn html_to_markdown(html: &str, options: JsValue) -> String {
    let opts = parse_options(&options);
    mdream::html_to_markdown(html, opts)
}

#[wasm_bindgen(js_name = "htmlToMarkdownResult")]
pub fn html_to_markdown_result(html: &str, options: JsValue) -> JsValue {
    let opts = parse_options(&options);
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
        let opts = parse_options(&options);
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
