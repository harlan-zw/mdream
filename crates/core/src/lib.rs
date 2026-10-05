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
#[cfg(feature = "markdown")]
pub fn html_to_markdown(html: &str, options: HTMLToMarkdownOptions) -> String {
  html_to_format(html, options, OutputFormat::Markdown)
}

/// Convert HTML to readable plain text in a single pass.
#[cfg(feature = "text")]
pub fn html_to_text(html: &str, options: HTMLToMarkdownOptions) -> String {
  html_to_format(html, options, OutputFormat::Text)
}

/// Convert HTML to allowlisted semantic HTML in a single pass.
#[cfg(feature = "html")]
pub fn html_to_html(html: &str, options: HTMLToMarkdownOptions) -> String {
  html_to_format(html, options, OutputFormat::Html)
}

/// Convert HTML to the requested output format in a single pass.
pub fn html_to_format(html: &str, options: HTMLToMarkdownOptions, format: OutputFormat) -> String {
  html_to_format_result(html, options, format).markdown
}

/// Convert HTML to Markdown with full results (extraction, frontmatter).
#[cfg(feature = "markdown")]
pub fn html_to_markdown_result(html: &str, options: HTMLToMarkdownOptions) -> MdreamResult {
  html_to_format_result(html, options, OutputFormat::Markdown)
}

/// Convert HTML to plain text with full results (extraction, frontmatter).
#[cfg(feature = "text")]
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
  let consumed = state.process_html(html);
  state.finalize(&html[consumed..]);

  let extracted = take_extracted(&mut state);
  let frontmatter = state.frontmatter();

  MdreamResult {
    markdown: state.get_markdown(),
    extracted,
    frontmatter,
    truncated: state.truncated,
  }
}

fn take_extracted(state: &mut ConvertState) -> Option<Vec<types::ExtractedElement>> {
  if !state.has_extraction {
    return None;
  }
  let results = std::mem::take(&mut state.extraction_results);
  if results.is_empty() {
    None
  } else {
    Some(results)
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
  #[cfg(feature = "markdown")]
  pub fn new(options: HTMLToMarkdownOptions) -> Self {
    Self::new_with_format(options, OutputFormat::Markdown)
  }

  /// Create a streaming converter for the requested output format.
  pub fn new_with_format(options: HTMLToMarkdownOptions, format: OutputFormat) -> Self {
    let mut state = ConvertState::new(options, 4096, format);
    // One-shot conversion does not pay for link hold bookkeeping.
    state.streaming = true;
    Self {
      state,
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
      let consumed = self.state.process_html(chunk);
      self.buffer.push_str(&chunk[consumed..]);
    } else {
      self.buffer.push_str(chunk);
      // Draining only what was consumed leaves a token still waiting for its
      // terminator in place, rather than recopying it every chunk.
      let consumed = self.state.process_html(&self.buffer);
      self.buffer.drain(..consumed);
    }
    self.state.get_markdown_chunk()
  }

  /// Whether [`HTMLToMarkdownOptions::max_node_bytes`] has fired so far. `false`
  /// guarantees the output matches an uncapped conversion; `true` is conservative,
  /// since dropping an unemitted attribute costs no output.
  pub fn truncated(&self) -> bool {
    self.state.truncated
  }

  /// Frontmatter entries the frontmatter plugin collected. `None` when the
  /// plugin is off. Complete once `finish()` returns.
  pub fn frontmatter(&self) -> Option<Vec<(String, String)>> {
    self.state.frontmatter()
  }

  /// Elements the extraction plugin matched, drained on each call. `None`
  /// when nothing matched. Complete once `finish()` returns.
  pub fn take_extracted(&mut self) -> Option<Vec<types::ExtractedElement>> {
    take_extracted(&mut self.state)
  }

  pub fn finish(&mut self) -> String {
    let buffer = std::mem::take(&mut self.buffer);
    let consumed = if buffer.is_empty() {
      0
    } else {
      self.state.process_html(&buffer)
    };
    self.state.finalize(&buffer[consumed..]);
    self.state.get_final_markdown_chunk()
  }
}

#[cfg(fuzzing)]
pub mod fuzz_bridge {
  use super::{HTMLToMarkdownOptions, MarkdownStreamProcessor, OutputFormat};

  pub fn new_drain_disabled(
    options: HTMLToMarkdownOptions,
    format: OutputFormat,
  ) -> MarkdownStreamProcessor {
    let mut processor = MarkdownStreamProcessor::new_with_format(options, format);
    processor.state.disable_drain = true;
    processor
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
    // A block between the anchors keeps both open at once, so the link hold
    // must cover the outer bracket too, not just the innermost one.
    r##"<h2><a href="#x">pre<div><a href="/b">y</a></a></div></h2>"##,
    // Nested deep enough that the continuation indent alone outgrows the
    // retained tail: the cut then lands inside the indent the block separation
    // reads, and the paragraph break collapses to a space.
    "<li><ul><li><ul><li><ul><li><ul><li><ul><li><p>q<br>\n<p>X",
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

#[cfg(test)]
mod dropped_raw_text {
  use super::MarkdownStreamProcessor;
  use super::types::HTMLToMarkdownOptions;

  fn stream(parts: &[&str], keep: bool) -> String {
    let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    processor.state.keep_dropped_raw_text = keep;
    let mut out = String::new();
    for part in parts {
      out.push_str(&processor.process_chunk(part));
    }
    out.push_str(&processor.finish());
    out
  }

  // Skipping means the text node a buffered run would complete never exists;
  // its absence must not reach the output.
  #[test]
  fn skipping_dropped_raw_text_never_changes_output() {
    let bodies = [
      "",
      " ",
      " \n\t ",
      "x",
      " x ",
      "a &amp; b",
      "é",
      " é ",
      "1 < 2",
      "</x>",
      "<p>t</p>",
    ];
    let wrappers = [
      ("", ""),
      ("x", "y"),
      ("<p>a ", " b</p>"),
      ("<p>", "</p>"),
      ("<li>", "c</li>"),
      ("<pre>", "\nx</pre>"),
      ("<blockquote>", " q</blockquote>"),
      ("<a href=\"/x\">", "t</a>"),
      ("<h2>", " h</h2>"),
      ("<table><tr><td>", " c</td></tr></table>"),
    ];
    let mut docs = Vec::new();
    for tag in [
      "noscript", "iframe", "noframes", "noembed", "datalist", "style",
    ] {
      for body in bodies {
        for (open, close) in wrappers {
          docs.push(format!("{open}<{tag}>{body}</{tag}>{close}<p> after</p>"));
        }
      }
      docs.push(format!("<p>a<{tag}>x</{}  >b</p>", tag.to_uppercase()));
      docs.push(format!("<p>a <{tag}> </{tag}><{tag}>x</{tag}> b</p>"));
      docs.push(format!("<p>a<{tag}>x</{tag}x>y"));
      docs.push(format!("<p>a<{tag}>x</{}", &tag[..tag.len() - 1]));
    }
    for html in &docs {
      for split in (0..=html.len()).filter(|&split| html.is_char_boundary(split)) {
        let parts = [&html[..split], &html[split..]];
        assert_eq!(
          stream(&parts, false),
          stream(&parts, true),
          "html={html:?} split={split}"
        );
      }
    }
  }
}

#[cfg(test)]
mod ignored_declarations {
  use super::MarkdownStreamProcessor;
  use super::types::HTMLToMarkdownOptions;

  pub(super) fn stream(parts: &[&str], cap: usize) -> (String, bool, usize) {
    let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions {
      max_node_bytes: cap,
      ..Default::default()
    });
    let mut out = String::new();
    let mut carried = 0;
    for part in parts {
      out.push_str(&processor.process_chunk(part));
      carried = carried.max(processor.buffer.len());
    }
    out.push_str(&processor.finish());
    (out, processor.truncated(), carried)
  }

  // Carrying the declaration would make every chunk re-read it from `<!`.
  #[test]
  fn a_huge_declaration_is_not_carried() {
    let body = "x".repeat(1536 * 1024);
    for (open, close) in [
      ("<!--", "-->"),
      ("<!DOCTYPE ", ">"),
      ("<!x", ">"),
      ("<![CDATA[", "]]>"),
    ] {
      let html = format!("<p>a</p>{open}{body}{close}<p>b</p>");
      for cap in [0, 1024 * 1024] {
        for chunk in [1000, 4096] {
          let parts: Vec<&str> = html
            .as_bytes()
            .chunks(chunk)
            .map(|c| std::str::from_utf8(c).unwrap())
            .collect();
          let (out, truncated, carried) = stream(&parts, cap);
          let case = format!("{open} cap={cap} chunk={chunk}");
          assert_eq!(out, "a\n\nb", "{case}");
          assert!(!truncated, "{case}");
          assert!(carried <= "<![CDATA".len(), "{case}: carried {carried}");
        }
      }
    }
  }

  // Skipping resumes a different scanner than a one-shot parse, so every split
  // of every short body must end the declaration at the same byte.
  #[test]
  fn a_declaration_ends_at_the_same_byte_at_every_split() {
    for (open, alphabet) in [("<!--", "-!>a"), ("<!x", "-!>a"), ("<![CDATA[", "]>a-")] {
      let mut bodies = vec![String::new()];
      let mut last = bodies.clone();
      for _ in 0..6 {
        last = last
          .iter()
          .flat_map(|b| alphabet.chars().map(move |c| format!("{b}{c}")))
          .collect();
        bodies.extend(last.iter().cloned());
      }
      for body in &bodies {
        let html = format!("a{open}{body}b");
        let expected = stream(&[&html], 0);
        for split in 0..=html.len() {
          let actual = stream(&[&html[..split], &html[split..]], 0);
          assert_eq!(actual.0, expected.0, "html={html:?} split={split}");
          assert!(!actual.1, "html={html:?} split={split}");
        }
      }
    }
  }

  #[test]
  fn comment_text_inside_rawtext_stays_text() {
    for html in [
      "<textarea>a<!--b</textarea>c",
      "<textarea>a<!--b-->c</textarea>d",
    ] {
      let expected = stream(&[html], 0);
      assert!(
        expected.0.contains("<!--b"),
        "html={html:?}: {:?}",
        expected.0
      );
      for split in 0..=html.len() {
        let actual = stream(&[&html[..split], &html[split..]], 0);
        assert_eq!(actual.0, expected.0, "html={html:?} split={split}");
      }
    }
  }
}

#[cfg(test)]
mod end_tag_junk {
  use super::ignored_declarations::stream;

  fn parts(html: &str, chunk: usize) -> Vec<&str> {
    html
      .as_bytes()
      .chunks(chunk)
      .map(|c| std::str::from_utf8(c).unwrap())
      .collect()
  }

  // Past its name an end tag is waiting only for `>`, so carrying it would make
  // every chunk re-read it from `</`.
  #[test]
  fn junk_after_an_end_tag_name_is_not_carried() {
    let junk = "x".repeat(1536 * 1024);
    for html in [
      format!("<p>a</p {junk}>b"),
      format!("<p>a</p q=\"{junk}>\">b"),
      format!("<div><p>a</div {junk}>b"),
      format!("<textarea>a</textarea {junk}>b"),
    ] {
      let expected = stream(&[&html], 0).0;
      for cap in [0, 1024 * 1024] {
        for chunk in [1000, 4096] {
          let (out, truncated, carried) = stream(&parts(&html, chunk), cap);
          let case = format!("{:.24} cap={cap} chunk={chunk}", html);
          assert_eq!(out, expected, "{case}");
          assert!(!truncated, "{case}");
          assert!(carried <= "</textarea".len(), "{case}: carried {carried}");
        }
      }
    }
  }

  // Dropping resumes a different scanner than a one-shot parse, so every split
  // must end the tag at the same byte, and input ending inside it loses nothing.
  #[test]
  fn an_end_tag_ends_at_the_same_byte_at_every_split() {
    for (open, close) in [
      ("<p>", "</p"),
      ("<div><p>", "</div"),
      ("<textarea>", "</textarea"),
    ] {
      for junk in ["", " ", "/", " a", " a=\">\"", " a='>'", " \"", "/ '>"] {
        for tail in [">b", ""] {
          let html = format!("{open}a{close}{junk}{tail}");
          let expected = stream(&[&html], 0);
          for split in 0..=html.len() {
            let actual = stream(&[&html[..split], &html[split..]], 0);
            assert_eq!(actual.0, expected.0, "html={html:?} split={split}");
            assert!(!actual.1, "html={html:?} split={split}");
          }
        }
      }
    }
  }
}
