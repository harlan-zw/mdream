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

/// Plugin data a stream collected: frontmatter and extracted elements.
#[napi(object)]
pub struct MdreamStreamData {
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
  pub clean: Option<CleanOptionsNapi>,
  pub plugins: Option<PluginOptions>,
  #[napi(js_name = "wrapWidth")]
  pub wrap_width: Option<u32>,
  #[napi(ts_type = "\"markdown\" | \"text\" | \"html\"")]
  pub format: Option<String>,
}

// ── Type conversion (NAPI → core) ──

fn to_core_opts(
  options: Option<HtmlToMarkdownOptions>,
) -> (
  mdream::types::HTMLToMarkdownOptions,
  mdream::types::OutputFormat,
) {
  let clean = options
    .as_ref()
    .and_then(|o| o.clean.as_ref())
    .map(|c| mdream::types::CleanConfig {
      urls: c.urls.unwrap_or(false),
      fragments: c.fragments.unwrap_or(false),
      empty_links: c.empty_links.unwrap_or(false),
      redundant_links: c.redundant_links.unwrap_or(false),
      self_link_headings: c.self_link_headings.unwrap_or(false),
      empty_images: c.empty_images.unwrap_or(false),
      empty_link_text: c.empty_link_text.unwrap_or(false),
    });
  let format = match options.as_ref().and_then(|o| o.format.as_deref()) {
    Some("text") => mdream::types::OutputFormat::Text,
    Some("html") => mdream::types::OutputFormat::Html,
    _ => mdream::types::OutputFormat::Markdown,
  };

  let core_options = mdream::types::HTMLToMarkdownOptions {
    origin: options.as_ref().and_then(|o| o.origin.clone()),
    clean,
    wrap_width: options
      .as_ref()
      .and_then(|o| o.wrap_width)
      .map_or(0, |w| w as usize),
    // Not exposed through the bindings yet: the JS engine has no equivalent cap.
    max_node_bytes: 0,
    plugins: options.and_then(|o| {
      o.plugins.map(|p| mdream::types::PluginConfig {
        filter: p.filter.map(|f| mdream::types::FilterConfig {
          include: f.include,
          exclude: f.exclude,
          process_children: f.process_children,
        }),
        isolate_main: p.isolate_main.and_then(|v| {
          if v {
            Some(mdream::types::IsolateMainConfig {})
          } else {
            None
          }
        }),
        frontmatter: p.frontmatter.map(|f| mdream::types::FrontmatterConfig {
          additional_fields: f.additional_fields.map(|m| m.into_iter().collect()),
          meta_fields: f.meta_fields,
        }),
        tailwind: p.tailwind.and_then(|v| {
          if v {
            Some(mdream::types::TailwindConfig {})
          } else {
            None
          }
        }),
        extraction: p.extraction.map(|e| mdream::types::ExtractionConfig {
          selectors: e.selectors,
        }),
        tag_overrides: p.tag_overrides.map(|overrides| {
          overrides
            .into_iter()
            .map(|(tag_name, ov)| {
              let alias_tag_id = ov.alias.as_ref().and_then(|a| mdream::get_tag_id(a));
              let config = mdream::types::TagOverrideConfig {
                enter: ov.enter,
                exit: ov.exit,
                spacing: ov.spacing.and_then(|s| {
                  if s.len() >= 2 {
                    Some([s[0], s[1]])
                  } else {
                    None
                  }
                }),
                is_inline: ov.is_inline,
                is_self_closing: ov.is_self_closing,
                collapses_inner_white_space: ov.collapses_inner_white_space,
                alias_tag_id,
              };
              (tag_name, config)
            })
            .collect()
        }),
      })
    }),
  };
  (core_options, format)
}

// ── Helpers ──

fn extracted_to_napi(
  extracted: Option<Vec<mdream::types::ExtractedElement>>,
) -> Option<Vec<ExtractedElementNapi>> {
  extracted.map(|elems| {
    elems
      .into_iter()
      .map(|e| ExtractedElementNapi {
        selector: e.selector,
        tag_name: e.tag_name,
        text_content: e.text_content,
        attributes: e.attributes.into_iter().collect(),
      })
      .collect()
  })
}

fn result_to_napi(result: mdream::types::MdreamResult) -> MdreamNapiResult {
  MdreamNapiResult {
    markdown: result.markdown,
    extracted: extracted_to_napi(result.extracted),
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
pub fn html_to_markdown(
  html: String,
  options: Option<HtmlToMarkdownOptions>,
) -> Result<MdreamNapiResult> {
  catch_panic(move || {
    let (opts, format) = to_core_opts(options);
    let result = mdream::html_to_format_result(&html, opts, format);
    Ok(result_to_napi(result))
  })
}

#[napi(js_name = "htmlToMarkdownBytes")]
pub fn html_to_markdown_bytes(
  html: &[u8],
  options: Option<HtmlToMarkdownOptions>,
) -> Result<MdreamNapiResult> {
  let text = std::str::from_utf8(html)
    .map_err(|e| napi::Error::new(napi::Status::InvalidArg, format!("Invalid UTF-8: {e}")))?;
  let text = text.to_string();
  catch_panic(move || {
    let (opts, format) = to_core_opts(options);
    let result = mdream::html_to_format_result(&text, opts, format);
    Ok(result_to_napi(result))
  })
}

#[napi]
pub struct MarkdownStream {
  inner: mdream::MarkdownStreamProcessor,
  utf8_carry: Vec<u8>,
}

#[napi]
impl MarkdownStream {
  #[napi(constructor)]
  pub fn new(options: Option<HtmlToMarkdownOptions>) -> Self {
    let (opts, format) = to_core_opts(options);
    Self {
      inner: mdream::MarkdownStreamProcessor::new_with_format(opts, format),
      utf8_carry: Vec::new(),
    }
  }

  #[napi]
  #[allow(clippy::needless_pass_by_value)]
  pub fn process_chunk(&mut self, chunk: String) -> Result<String> {
    if !self.utf8_carry.is_empty() {
      return Err(napi::Error::new(
        napi::Status::InvalidArg,
        "Cannot process a string chunk while an incomplete UTF-8 byte sequence is buffered",
      ));
    }
    Ok(self.inner.process_chunk(&chunk))
  }

  #[napi(js_name = "processChunkBytes")]
  pub fn process_chunk_bytes(&mut self, chunk: &[u8]) -> Result<String> {
    if self.utf8_carry.is_empty() {
      return match std::str::from_utf8(chunk) {
        Ok(text) => Ok(self.inner.process_chunk(text)),
        Err(error) if error.error_len().is_none() => {
          let valid_up_to = error.valid_up_to();
          if valid_up_to == 0 {
            self.utf8_carry.extend_from_slice(chunk);
            return Ok(String::new());
          }
          let text = std::str::from_utf8(&chunk[..valid_up_to])
            .expect("valid_up_to must end at a UTF-8 boundary");
          let markdown = self.inner.process_chunk(text);
          self.utf8_carry.extend_from_slice(&chunk[valid_up_to..]);
          Ok(markdown)
        }
        Err(error) => Err(napi::Error::new(
          napi::Status::InvalidArg,
          format!("Invalid UTF-8: {error}"),
        )),
      };
    }

    self.utf8_carry.extend_from_slice(chunk);
    let valid_up_to = match std::str::from_utf8(&self.utf8_carry) {
      Ok(text) => text.len(),
      Err(error) if error.error_len().is_none() => error.valid_up_to(),
      Err(error) => {
        return Err(napi::Error::new(
          napi::Status::InvalidArg,
          format!("Invalid UTF-8: {error}"),
        ));
      }
    };
    if valid_up_to == 0 {
      return Ok(String::new());
    }

    let text = std::str::from_utf8(&self.utf8_carry[..valid_up_to])
      .expect("valid_up_to must end at a UTF-8 boundary");
    let markdown = self.inner.process_chunk(text);
    self.utf8_carry.drain(..valid_up_to);
    Ok(markdown)
  }

  #[napi]
  pub fn finish(&mut self) -> Result<String> {
    if !self.utf8_carry.is_empty() {
      return Err(napi::Error::new(
        napi::Status::InvalidArg,
        "Stream ended with an incomplete UTF-8 byte sequence",
      ));
    }
    Ok(self.inner.finish())
  }

  /// Frontmatter and extracted elements collected so far. Call after
  /// `finish()` for the complete data. Extracted elements drain on each call.
  #[napi(js_name = "takeData")]
  pub fn take_data(&mut self) -> MdreamStreamData {
    MdreamStreamData {
      extracted: extracted_to_napi(self.inner.take_extracted()),
      frontmatter: self.inner.frontmatter().map(|v| v.into_iter().collect()),
    }
  }
}
