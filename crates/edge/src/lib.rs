use std::cell::Cell;

use wasm_bindgen::prelude::*;

// ── Panic reporting ──
//
// wasm32-unknown-unknown always aborts on panic: the std shipped by rustup
// builds `panic_unwind` with the abort strategy, so `-Cpanic=unwind` fails to
// link (`the crate panic_unwind does not have the panic strategy unwind`) and
// the workspace `panic = "unwind"` profile setting is ignored for this target.
// Unwinding needs a nightly `-Zbuild-std` rebuild plus wasm exception handling,
// which measured +8.8% wasm and 6-7% slower conversions.
//
// An abort reaches JS as a bare `RuntimeError: unreachable` trap. The trap is
// catchable and leaves the instance usable, so the only thing actually missing
// is the message: capture it in a panic hook and let the JS glue re-throw it as
// a real `Error`. Every panic runs the hook, unlike a hook that throws (that
// leaves std's panic counter raised, so later panics abort before the hook).
//
// `Cell` rather than `RefCell`: a hook running inside a panic must not be able
// to panic itself on a conflicting borrow.
thread_local! {
  static PANIC_MESSAGE: Cell<Option<String>> = const { Cell::new(None) };
}

#[wasm_bindgen(start)]
pub fn install_panic_hook() {
  std::panic::set_hook(Box::new(|info| {
    PANIC_MESSAGE.with(|slot| slot.set(Some(info.to_string())));
  }));
}

/// Consumes the message of the panic that aborted the last export call.
#[wasm_bindgen(js_name = "__mdreamTakePanicMessage")]
pub fn take_panic_message() -> Option<String> {
  PANIC_MESSAGE.with(Cell::take)
}

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

fn parse_clean(v: &JsValue) -> Option<mdream::types::CleanConfig> {
  if v.is_undefined() || v.is_null() {
    return None;
  }
  Some(mdream::types::CleanConfig {
    urls: as_bool(&get_prop(v, "urls")).unwrap_or(false),
    fragments: as_bool(&get_prop(v, "fragments")).unwrap_or(false),
    empty_links: as_bool(&get_prop(v, "emptyLinks")).unwrap_or(false),
    blank_lines: as_bool(&get_prop(v, "blankLines")).unwrap_or(false),
    redundant_links: as_bool(&get_prop(v, "redundantLinks")).unwrap_or(false),
    self_link_headings: as_bool(&get_prop(v, "selfLinkHeadings")).unwrap_or(false),
    empty_images: as_bool(&get_prop(v, "emptyImages")).unwrap_or(false),
    empty_link_text: as_bool(&get_prop(v, "emptyLinkText")).unwrap_or(false),
  })
}

// ── Options parsing ──

fn parse_options(
  options: &JsValue,
) -> (
  mdream::types::HTMLToMarkdownOptions,
  mdream::types::OutputFormat,
) {
  if options.is_undefined() || options.is_null() {
    return (
      mdream::types::HTMLToMarkdownOptions::default(),
      mdream::types::OutputFormat::Markdown,
    );
  }

  let origin = as_string(&get_prop(options, "origin"));

  // Test-only trigger for the panic reporting regression test (#195); compiled
  // out of every released artifact.
  #[cfg(feature = "panic-probe")]
  if origin.as_deref() == Some("__mdream_panic_probe__") {
    panic!("panic probe: intentional panic");
  }

  let clean_urls = as_bool(&get_prop(options, "cleanUrls")).unwrap_or(false);
  let clean = parse_clean(&get_prop(options, "clean"));

  let plugins_val = get_prop(options, "plugins");
  let plugins = if plugins_val.is_undefined() || plugins_val.is_null() {
    None
  } else {
    Some(parse_plugins(&plugins_val))
  };

  let wrap_width = get_prop(options, "wrapWidth")
    .as_f64()
    .filter(|n| n.is_finite() && *n >= 0.0 && *n <= usize::MAX as f64)
    .map_or(0, |n| n as usize);
  let format = match as_string(&get_prop(options, "format")).as_deref() {
    Some("text") => mdream::types::OutputFormat::Text,
    Some("html") => mdream::types::OutputFormat::Html,
    _ => mdream::types::OutputFormat::Markdown,
  };

  let core_options = mdream::types::HTMLToMarkdownOptions {
    origin,
    clean_urls,
    clean,
    plugins,
    wrap_width,
    // Not exposed through the bindings yet: the JS engine has no equivalent cap.
    max_node_bytes: 0,
  };
  (core_options, format)
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
  let isolate_main = as_bool(&isolate_val).and_then(|v| {
    if v {
      Some(mdream::types::IsolateMainConfig {})
    } else {
      None
    }
  });

  let fm_val = get_prop(p, "frontmatter");
  let frontmatter = if fm_val.is_undefined() || fm_val.is_null() {
    None
  } else {
    Some(mdream::types::FrontmatterConfig {
      additional_fields: js_string_vec(&get_prop(&fm_val, "additionalFields")),
      meta_fields: as_string_vec(&get_prop(&fm_val, "metaFields")),
    })
  };

  let tailwind = as_bool(&get_prop(p, "tailwind")).and_then(|v| {
    if v {
      Some(mdream::types::TailwindConfig {})
    } else {
      None
    }
  });

  let ext_val = get_prop(p, "extraction");
  let extraction = if ext_val.is_undefined() || ext_val.is_null() {
    None
  } else {
    as_string_vec(&get_prop(&ext_val, "selectors"))
      .map(|selectors| mdream::types::ExtractionConfig { selectors })
  };

  let overrides_val = get_prop(p, "tagOverrides");
  let tag_overrides = if overrides_val.is_undefined() || overrides_val.is_null() {
    None
  } else {
    js_object_entries(&overrides_val).map(|entries| {
      entries
        .into_iter()
        .map(|(tag_name, ov)| {
          let alias = as_string(&get_prop(&ov, "alias"));
          let alias_tag_id = alias.as_ref().and_then(|a| mdream::consts::get_tag_id(a));
          let spacing_vec = as_u8_vec(&get_prop(&ov, "spacing"));
          let config = mdream::types::TagOverrideConfig {
            enter: as_string(&get_prop(&ov, "enter")),
            exit: as_string(&get_prop(&ov, "exit")),
            spacing: spacing_vec.and_then(|s| {
              if s.len() >= 2 {
                Some([s[0], s[1]])
              } else {
                None
              }
            }),
            is_inline: as_bool(&get_prop(&ov, "isInline")),
            is_self_closing: as_bool(&get_prop(&ov, "isSelfClosing")),
            collapses_inner_white_space: as_bool(&get_prop(&ov, "collapsesInnerWhiteSpace")),
            alias_tag_id,
          };
          (tag_name, config)
        })
        .collect()
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
  let (opts, format) = parse_options(&options);
  mdream::html_to_format(html, opts, format)
}

/// Bytes in, string out: skips the transcode (~14% of a convert) for a
/// caller already holding UTF-8 bytes. Encoding a string to get here
/// measures 1-16% *slower* than [`html_to_markdown`] — only worth it when
/// the bytes are already in hand.
#[wasm_bindgen(js_name = "htmlToMarkdownBytes")]
pub fn html_to_markdown_bytes(html: &[u8], options: JsValue) -> String {
  let (opts, format) = parse_options(&options);
  let html = html.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(html);
  // Valid input costs one strict pass; only invalid bytes pay the lossy
  // chunker, which replaces each maximal invalid subsequence with U+FFFD.
  match std::str::from_utf8(html) {
    Ok(text) => mdream::html_to_format(text, opts, format),
    Err(_) => mdream::html_to_format(&String::from_utf8_lossy(html), opts, format),
  }
}

#[wasm_bindgen(js_name = "htmlToMarkdownResult")]
pub fn html_to_markdown_result(html: &str, options: JsValue) -> JsValue {
  let (opts, format) = parse_options(&options);
  let result = mdream::html_to_format_result(html, opts, format);

  let obj = js_sys::Object::new();
  js_sys::Reflect::set(&obj, &"markdown".into(), &result.markdown.into()).unwrap_or_default();

  if let Some(extracted) = result.extracted {
    let arr = js_sys::Array::new();
    for e in extracted {
      let elem = js_sys::Object::new();
      js_sys::Reflect::set(&elem, &"selector".into(), &e.selector.into()).unwrap_or_default();
      js_sys::Reflect::set(&elem, &"tagName".into(), &e.tag_name.into()).unwrap_or_default();
      js_sys::Reflect::set(&elem, &"textContent".into(), &e.text_content.into())
        .unwrap_or_default();
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
  /// A multi-byte sequence split across a chunk boundary; 1-3 bytes, byte
  /// entry points only.
  tail: Vec<u8>,
  at_start: bool,
}

#[wasm_bindgen]
impl MarkdownStream {
  #[wasm_bindgen(constructor)]
  pub fn new(options: JsValue) -> Self {
    let (opts, format) = parse_options(&options);
    Self {
      inner: mdream::MarkdownStreamProcessor::new_with_format(opts, format),
      tail: Vec::new(),
      at_start: true,
    }
  }

  /// A carried byte tail cannot be completed by a string chunk, so it is
  /// flushed first. Byte and string chunks may be mixed freely.
  #[wasm_bindgen(js_name = "processChunk")]
  pub fn process_chunk(&mut self, chunk: &str) -> String {
    if self.tail.is_empty() {
      return self.inner.process_chunk(chunk);
    }
    let mut out = self.flush_tail();
    out.push_str(&self.inner.process_chunk(chunk));
    out
  }

  pub fn finish(&mut self) -> String {
    if self.tail.is_empty() {
      return self.inner.finish();
    }
    let mut out = self.flush_tail();
    out.push_str(&self.inner.finish());
    out
  }

  /// Byte chunk in, string out, skipping the transcode per chunk. A sequence
  /// split across chunks carries to the next call rather than decoding early,
  /// matching `TextDecoder({ stream: true })`; invalid bytes become U+FFFD.
  #[wasm_bindgen(js_name = "processChunkBytes")]
  pub fn process_chunk_bytes(&mut self, chunk: &[u8]) -> String {
    // Fast path: nothing held back, chunk valid or cut short at its end;
    // neither case allocates or copies.
    if self.tail.is_empty() {
      match std::str::from_utf8(chunk) {
        Ok(text) => return self.process_decoded_bytes(text),
        Err(error) if error.error_len().is_none() => {
          let (head, rest) = chunk.split_at(error.valid_up_to());
          // `head` is valid by construction: it is what `valid_up_to` reports.
          let out = match std::str::from_utf8(head) {
            Ok(text) => self.process_decoded_bytes(text),
            Err(_) => String::new(),
          };
          self.tail.extend_from_slice(rest);
          return out;
        }
        Err(_) => {}
      }
    }
    self.process_joined(chunk)
  }
}

impl MarkdownStream {
  fn process_decoded_bytes(&mut self, text: &str) -> String {
    if self.at_start && !text.is_empty() {
      self.at_start = false;
      return self
        .inner
        .process_chunk(text.strip_prefix("\u{FEFF}").unwrap_or(text));
    }
    self.inner.process_chunk(text)
  }

  /// A tail still incomplete becomes U+FFFD, matching `TextDecoder`'s final
  /// `decode()`. Caller checks emptiness.
  fn flush_tail(&mut self) -> String {
    let tail = std::mem::take(&mut self.tail);
    self.process_decoded_bytes(&String::from_utf8_lossy(&tail))
  }

  /// Slow path: rejoin a carried tail, or replace invalid bytes.
  fn process_joined(&mut self, chunk: &[u8]) -> String {
    let mut buffer = std::mem::take(&mut self.tail);
    buffer.extend_from_slice(chunk);

    // Walk errors only to find a trailing incomplete sequence; everything
    // before it goes to `from_utf8_lossy` (borrows when clean, else replaces).
    let mut consumed = 0;
    let split = loop {
      match std::str::from_utf8(&buffer[consumed..]) {
        Ok(_) => break buffer.len(),
        Err(error) => match error.error_len() {
          Some(invalid) => consumed += error.valid_up_to() + invalid,
          None => break consumed + error.valid_up_to(),
        },
      }
    };

    let out = self.process_decoded_bytes(&String::from_utf8_lossy(&buffer[..split]));
    // Drain rather than reallocate, so the tail keeps its capacity.
    buffer.drain(..split);
    self.tail = buffer;
    out
  }
}

#[cfg(test)]
mod tests {
  use super::MarkdownStream;
  use mdream::types::HTMLToMarkdownOptions;

  fn test_stream() -> MarkdownStream {
    MarkdownStream {
      inner: mdream::MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default()),
      tail: Vec::new(),
      at_start: true,
    }
  }

  #[test]
  fn split_multibyte_across_byte_chunks_survives() {
    let mut stream = test_stream();
    let mut out = String::new();
    out += &stream.process_chunk_bytes(b"<p>");
    // 🎉 is 4 bytes; cut it across three calls so both the fast path and the
    // rejoin path have to carry an incomplete sequence.
    out += &stream.process_chunk_bytes(&[0xF0]);
    out += &stream.process_chunk_bytes(&[0x9F, 0x8E]);
    out += &stream.process_chunk_bytes(&[0x89, 0x3C, 0x2F, 0x70, 0x3E]); // `</p>`
    out += &stream.finish();

    assert!(out.contains('\u{1F389}'), "emoji lost in {out:?}");
    assert!(
      !out.contains('\u{FFFD}'),
      "replacement char leaked into {out:?}"
    );
  }

  #[test]
  fn string_chunk_after_carried_tail_flushes_tail_as_replacement() {
    let mut stream = test_stream();
    let mut out = String::new();
    out += &stream.process_chunk_bytes(b"<p>\xF0\x9F\x8E");
    // A string chunk cannot complete a byte tail: it is flushed first, so the
    // replacement char must land before the string chunk's own content.
    out += &stream.process_chunk("</p>x<p>ok</p>");
    out += &stream.finish();

    let flush = out.find('\u{FFFD}').expect("carried tail not flushed");
    let string_content = out.find('x').expect("string chunk lost");
    assert!(
      flush < string_content,
      "tail flushed after string chunk: {out:?}"
    );
  }

  #[test]
  fn finish_flushes_pending_tail_as_replacement() {
    let mut stream = test_stream();
    stream.process_chunk_bytes(b"<p>\xF0\x9F");
    let out = stream.finish();

    assert!(out.contains('\u{FFFD}'), "pending tail dropped in {out:?}");
  }

  #[test]
  fn invalid_bytes_become_replacement_chars() {
    let mut stream = test_stream();
    let out = stream.process_chunk_bytes(b"<p>a\xFFb</p>") + &stream.finish();

    assert!(
      out.contains("a\u{FFFD}b"),
      "invalid byte mishandled in {out:?}"
    );
  }

  #[test]
  fn mixed_string_and_byte_chunks_convert_clean_html() {
    let mut stream = test_stream();
    let mut out = String::new();
    out += &stream.process_chunk("<h1>Tit");
    out += &stream.process_chunk_bytes(b"le</h1><p>bo");
    out += &stream.process_chunk("dy</p>");
    out += &stream.finish();

    assert!(out.contains("# Title"), "heading lost in {out:?}");
    assert!(out.contains("body"), "paragraph lost in {out:?}");
    assert!(
      !out.contains('\u{FFFD}'),
      "replacement char leaked into {out:?}"
    );
  }
}
