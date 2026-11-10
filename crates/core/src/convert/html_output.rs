use super::output::parse_bounded_u32;
use super::*;
use crate::url::is_safe_html_url;

#[cfg(feature = "html")]
pub(super) enum HtmlFrame {
  Heading {
    level: u8,
    output: String,
    text: String,
  },
  Pre {
    depth: usize,
    language: String,
    /// Mirrors the Markdown fence owner: a `<code>` can still supply the
    /// language until text or another element opens the `<pre>`'s own fence.
    language_pending: bool,
    output: String,
  },
}

/// Returns whether any byte is `&`, `<`, or `>` using byte-parallel zero detection.
#[inline]
fn has_html_text_escape(word: u64) -> bool {
  const ONES: u64 = 0x0101_0101_0101_0101;
  const HIGH: u64 = 0x8080_8080_8080_8080;
  let amp = word ^ (ONES * u64::from(b'&'));
  let lt = word ^ (ONES * u64::from(b'<'));
  let gt = word ^ (ONES * u64::from(b'>'));
  ((amp.wrapping_sub(ONES) & !amp) | (lt.wrapping_sub(ONES) & !lt) | (gt.wrapping_sub(ONES) & !gt))
    & HIGH
    != 0
}

/// Escapes text or attribute values while preserving UTF-8 slice boundaries.
/// Plain text skips escape-free words; attributes and bracket escaping scan every byte.
fn push_escaped_inner<const ESCAPE_BRACKETS: bool>(
  output: &mut String,
  value: &str,
  attribute: bool,
) {
  let mut copied = 0usize;
  let bytes = value.as_bytes();
  let mut scanned = 0;
  if !attribute && !ESCAPE_BRACKETS && bytes.len() >= 16 {
    while let Some(word) = bytes.get(scanned..scanned + 8) {
      if has_html_text_escape(u64::from_le_bytes(word.try_into().unwrap())) {
        break;
      }
      scanned += 8;
    }
  }
  // Prefixes can end inside UTF-8; only ASCII escapes become string slice bounds.
  for (offset, byte) in bytes[scanned..].iter().copied().enumerate() {
    let index = scanned + offset;
    let replacement = match byte {
      b'&' => Some("&amp;"),
      b'<' => Some("&lt;"),
      b'>' => Some("&gt;"),
      b'"' if attribute => Some("&quot;"),
      b'[' if ESCAPE_BRACKETS => Some("&#91;"),
      b']' if ESCAPE_BRACKETS => Some("&#93;"),
      _ => None,
    };
    if let Some(replacement) = replacement {
      output.push_str(&value[copied..index]);
      output.push_str(replacement);
      copied = index + 1;
    }
  }
  output.push_str(&value[copied..]);
}

fn push_escaped(output: &mut String, value: &str, attribute: bool) {
  push_escaped_inner::<false>(output, value, attribute);
}

fn push_raw_anchor_attribute(output: &mut String, value: &str) {
  push_escaped_inner::<true>(output, value, true);
}

/// Elements the HTML output renames to their semantic equivalent.
const fn canonical_name(tag_id: u8) -> Option<&'static str> {
  match tag_id {
    TAG_B => Some("strong"),
    TAG_I => Some("em"),
    TAG_S | TAG_STRIKE => Some("del"),
    _ => None,
  }
}

/// Elements the HTML output keeps under their own name.
const fn keeps_own_name(tag_id: u8) -> bool {
  canonical_name(tag_id).is_none()
    && matches!(
    tag_id,
    TAG_DETAILS
      | TAG_SUMMARY
      | TAG_H1..=TAG_A
      | TAG_TABLE..=TAG_TFOOT
      | TAG_NAV
      | TAG_KBD
      | TAG_FOOTER
      | TAG_ARTICLE
      | TAG_SECTION
      | TAG_ABBR..=TAG_SMALL
      | TAG_ASIDE..=TAG_TIME
        | TAG_RUBY..=TAG_FIGURE
        | TAG_MAIN..=TAG_CAPTION
    )
}

/// Bits in one word of a tag set.
const TAG_SET_WORD_BITS: u8 = 64;

/// One bit per tag id: every element opens and closes through
/// `html_tag_name`, and a bit test is cheaper there than the range chain.
static KEEPS_OWN_NAME: [u64; (u8::MAX as usize + 1) / TAG_SET_WORD_BITS as usize] = {
  let mut set = [0u64; (u8::MAX as usize + 1) / TAG_SET_WORD_BITS as usize];
  let mut tag_id = 0u8;
  loop {
    if keeps_own_name(tag_id) {
      set[(tag_id / TAG_SET_WORD_BITS) as usize] |= 1 << (tag_id % TAG_SET_WORD_BITS);
    }
    if tag_id == u8::MAX {
      break;
    }
    tag_id += 1;
  }
  set
};

fn html_tag_name(tag_id: u8) -> Option<&'static str> {
  if KEEPS_OWN_NAME[(tag_id / TAG_SET_WORD_BITS) as usize] >> (tag_id % TAG_SET_WORD_BITS) & 1 != 0
  {
    return Some(TAG_NAMES[tag_id as usize]);
  }
  canonical_name(tag_id)
}

fn resolve_html_url<'a>(
  url: &'a str,
  image: bool,
  origin: Option<&str>,
  clean_urls: bool,
) -> Option<Cow<'a, str>> {
  if !is_safe_html_url(url, image) {
    return None;
  }
  let resolved = resolve_url(url, origin, clean_urls);
  is_safe_html_url(resolved.as_ref(), image).then_some(resolved)
}

/// Where HTML output goes: the innermost open heading or `<pre>`, else the
/// document buffer. Takes the fields apart so a caller can keep reading the
/// node stack while it writes.
#[cfg(feature = "html")]
fn html_sink<'a>(frames: &'a mut [HtmlFrame], buffer: &'a mut String) -> &'a mut String {
  match frames.last_mut() {
    Some(HtmlFrame::Heading { output, .. } | HtmlFrame::Pre { output, .. }) => output,
    None => buffer,
  }
}

/// Writes the opening or closing tag of an allowlisted element. Returns false,
/// with nothing written, for an element the HTML output does not keep.
fn write_html_element(
  output: &mut String,
  node: &ElementNode,
  entering: bool,
  protect_markdown: bool,
  origin: Option<&str>,
  clean_urls: bool,
) -> bool {
  let Some((tag_id, name)) = node
    .tag_id
    .and_then(|tag_id| Some((tag_id, html_tag_name(tag_id)?)))
  else {
    return false;
  };
  // An anchor is kept only with a safe href, on both of its tags. Decide
  // before the first byte is written so a rejected one leaves no partial tag.
  let href = if tag_id == TAG_A {
    let resolved = node
      .attributes
      .get_bit(ATTR_HREF)
      .and_then(|href| resolve_html_url(href, false, origin, clean_urls));
    if resolved.is_none() {
      return false;
    }
    resolved
  } else {
    None
  };
  if !entering {
    output.push_str("</");
    output.push_str(name);
    output.push('>');
    return true;
  }
  output.push('<');
  output.push_str(name);
  match tag_id {
    TAG_A => {
      // `href` is set for every anchor that reaches this point.
      let resolved = href.as_deref().unwrap_or_default();
      output.push_str(" href=\"");
      if protect_markdown {
        push_raw_anchor_attribute(output, resolved);
      } else {
        push_escaped(output, resolved, true);
      }
      output.push('"');
      if let Some(title) = node.attributes.get_bit(ATTR_TITLE) {
        output.push_str(" title=\"");
        if protect_markdown {
          push_raw_anchor_attribute(output, title);
        } else {
          push_escaped(output, title, true);
        }
        output.push('"');
      }
    }
    TAG_OL => {
      if let Some(start) = node
        .attributes
        .get_bit(ATTR_START)
        .and_then(|value| parse_bounded_u32(value, u32::MAX))
      {
        output.push_str(" start=\"");
        super::output::push_decimal(output, start);
        output.push('"');
      }
    }
    TAG_CODE => {
      let language = ConvertState::get_language_from_attributes(node);
      if !language.is_empty() {
        output.push_str(" class=\"language-");
        push_escaped(output, language, true);
        output.push('"');
      }
    }
    TAG_TH | TAG_TD => {
      if let Some(colspan) = node
        .attributes
        .get_bit(ATTR_COLSPAN)
        .and_then(|value| parse_bounded_u32(value, u32::MAX))
        && colspan > 0
      {
        output.push_str(" colspan=\"");
        super::output::push_decimal(output, colspan);
        output.push('"');
      }
      if tag_id == TAG_TH
        && let Some(align) = node.attributes.get_bit(ATTR_ALIGN)
      {
        let normalized = if align.eq_ignore_ascii_case("left") {
          "left"
        } else if align.eq_ignore_ascii_case("center") {
          "center"
        } else if align.eq_ignore_ascii_case("right") {
          "right"
        } else {
          ""
        };
        if !normalized.is_empty() {
          output.push_str(" align=\"");
          output.push_str(normalized);
          output.push('"');
        }
      }
    }
    _ => {}
  }
  output.push('>');
  true
}

/// Bytes of `<a href="…">` around a typical URL.
const RAW_ANCHOR_OPEN_CAPACITY: usize = 64;

impl ConvertState {
  #[cfg(feature = "html")]
  fn html_output_mut(&mut self) -> &mut String {
    html_sink(&mut self.html_frames, &mut self.buffer)
  }

  #[cfg(feature = "html")]
  fn push_html(&mut self, value: &str) {
    self.html_output_mut().push_str(value);
  }

  #[cfg(feature = "html")]
  fn push_html_text(&mut self, value: &str) {
    if let Some(HtmlFrame::Pre {
      language_pending, ..
    }) = self.html_frames.last_mut()
      && *language_pending
      && !value.trim_ascii().is_empty()
    {
      *language_pending = false;
    }
    for frame in self.html_frames.iter_mut().rev() {
      if let HtmlFrame::Heading { text, .. } = frame {
        text.push_str(value);
        break;
      }
    }
    push_escaped(self.html_output_mut(), value, false);
  }

  /// The tag as an owned string, for the Markdown path's raw-HTML anchors.
  pub(super) fn html_element_output(
    &self,
    node: &ElementNode,
    entering: bool,
    protect_markdown: bool,
  ) -> Option<String> {
    // An opening tag gets its room up front: growing from empty reallocates
    // once per attribute.
    let mut output = String::with_capacity(if entering {
      RAW_ANCHOR_OPEN_CAPACITY
    } else {
      0
    });
    write_html_element(
      &mut output,
      node,
      entering,
      protect_markdown,
      self.options.origin.as_deref(),
      self.clean_urls,
    )
    .then_some(output)
  }

  // Out of line: the Markdown path shares the caller and must not grow with it.
  #[cfg(feature = "html")]
  #[inline(never)]
  pub(super) fn emit_html_enter(&mut self) {
    let Some(node) = self.stack.last() else {
      return;
    };
    let tag_id = node.tag_id;
    if let Some(HtmlFrame::Pre {
      depth,
      language,
      language_pending,
      output,
    }) = self.html_frames.last_mut()
    {
      if *language_pending
        && tag_id != Some(TAG_PRE)
        && !tag_id.is_some_and(suppresses_formatting_in_pre)
      {
        *language_pending = false;
        let stack_len = self.stack.len();
        if code_owns_pending_pre_fence(&self.stack) && self.stack[stack_len - 2].depth == *depth {
          let code_language = Self::get_language_from_attributes(node);
          if !code_language.is_empty() {
            *language = code_language.to_string();
          }
        }
      }
      if tag_id == Some(TAG_BR) {
        output.push('\n');
      }
      return;
    }

    if let Some(level) = tag_id.filter(|id| id.wrapping_sub(TAG_H1) < 6) {
      self.html_frames.push(HtmlFrame::Heading {
        level: level - TAG_H1 + 1,
        output: String::new(),
        text: String::new(),
      });
      return;
    }
    if tag_id == Some(TAG_PRE) {
      self.html_frames.push(HtmlFrame::Pre {
        depth: node.depth,
        language: Self::get_language_from_attributes(node).to_string(),
        language_pending: true,
        output: String::new(),
      });
      return;
    }
    if tag_id == Some(TAG_BR) {
      self.push_html("<br>");
      return;
    }
    if tag_id == Some(TAG_HR) {
      self.push_html("<hr>");
      return;
    }
    let origin = self.options.origin.as_deref();
    let output = html_sink(&mut self.html_frames, &mut self.buffer);
    if tag_id == Some(TAG_IMG) {
      let resolved = node
        .attributes
        .get_bit(ATTR_SRC)
        .and_then(|src| resolve_html_url(src, true, origin, self.clean_urls));
      if let Some(resolved) = resolved {
        output.push_str("<img src=\"");
        push_escaped(output, resolved.as_ref(), true);
        output.push_str("\" alt=\"");
        push_escaped(
          output,
          node.attributes.get_bit(ATTR_ALT).unwrap_or(""),
          true,
        );
        output.push('"');
        if let Some(title) = node.attributes.get_bit(ATTR_TITLE) {
          output.push_str(" title=\"");
          push_escaped(output, title, true);
          output.push('"');
        }
        output.push('>');
        self.mark_rendered_child_content();
      }
      return;
    }
    write_html_element(output, node, true, false, origin, self.clean_urls);
  }

  // Out of line: the Markdown path shares the caller and must not grow with it.
  #[cfg(feature = "html")]
  #[inline(never)]
  pub(super) fn emit_html_exit(&mut self, node: &ElementNode) {
    if let Some(frame) = self.html_frames.last() {
      let in_pre = matches!(frame, HtmlFrame::Pre { .. });
      let closes_frame = match frame {
        HtmlFrame::Heading { .. } => node.tag_id.is_some_and(|id| id.wrapping_sub(TAG_H1) < 6),
        HtmlFrame::Pre { depth, .. } => *depth == node.depth && node.tag_id == Some(TAG_PRE),
      };
      if closes_frame {
        let frame = self.html_frames.pop().unwrap();
        // The frame is off the stack, so this is the enclosing sink.
        let sink = self.html_output_mut();
        match frame {
          HtmlFrame::Heading {
            level,
            output,
            text,
            ..
          } => {
            let slug = slugify_heading(&text);
            let level = u32::from(level);
            sink.push_str("<h");
            super::output::push_decimal(sink, level);
            if !slug.is_empty() {
              sink.push_str(" id=\"");
              sink.push_str(&slug);
              sink.push('"');
            }
            sink.push('>');
            sink.push_str(&output);
            sink.push_str("</h");
            super::output::push_decimal(sink, level);
            sink.push('>');
          }
          HtmlFrame::Pre {
            language, output, ..
          } => {
            sink.push_str("<pre tabindex=\"0\"><code");
            if !language.is_empty() {
              sink.push_str(" class=\"language-");
              push_escaped(sink, &language, true);
              sink.push('"');
            }
            sink.push('>');
            sink.push_str(&output);
            sink.push_str("</code></pre>");
          }
        }
        return;
      }
      if in_pre {
        return;
      }
    }
    if matches!(node.tag_id, Some(TAG_BR | TAG_HR | TAG_IMG | TAG_PRE)) {
      return;
    }
    let origin = self.options.origin.as_deref();
    let output = html_sink(&mut self.html_frames, &mut self.buffer);
    write_html_element(output, node, false, false, origin, self.clean_urls);
  }

  #[cfg(feature = "html")]
  pub(super) fn emit_html_text(&mut self, text: &str) {
    if !text.is_empty() {
      self.push_html_text(text);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn scalar_escaped_inner<const ESCAPE_BRACKETS: bool>(
    output: &mut String,
    value: &str,
    attribute: bool,
  ) {
    let mut copied = 0usize;
    for (index, byte) in value.bytes().enumerate() {
      let replacement = match byte {
        b'&' => Some("&amp;"),
        b'<' => Some("&lt;"),
        b'>' => Some("&gt;"),
        b'"' if attribute => Some("&quot;"),
        b'[' if ESCAPE_BRACKETS => Some("&#91;"),
        b']' if ESCAPE_BRACKETS => Some("&#93;"),
        _ => None,
      };
      if let Some(replacement) = replacement {
        output.push_str(&value[copied..index]);
        output.push_str(replacement);
        copied = index + 1;
      }
    }
    output.push_str(&value[copied..]);
  }

  #[test]
  fn escape_words_match_every_byte_in_every_lane() {
    for fill in [
      *b"abcdefgh",
      *b"&&<<>>>>",
      *b"x&x<x>x&",
      [0; 8],
      [0xff; 8],
      [0x80; 8],
      [0x26; 8],
      [0xc3, 0xa9, 0xe6, 0x9d, 0xb1, 0xe4, 0xba, 0xac],
    ] {
      for lane in 0..8 {
        for byte in 0..=255u8 {
          let mut word = fill;
          word[lane] = byte;
          assert_eq!(
            has_html_text_escape(u64::from_le_bytes(word)),
            word.iter().any(|b| matches!(b, b'&' | b'<' | b'>')),
            "{word:?}"
          );
        }
      }
    }
  }

  #[test]
  fn prefix_escape_matches_scalar_at_boundaries() {
    for prefix in ["x", "東京", "é", "🙂", "xé東🙂", "ééé€"] {
      for length in 0..=40 {
        for suffix in [
          "",
          "&",
          "<",
          ">",
          "&&<>&",
          "\"[]",
          "é&東<🙂>",
          "é東京🙂",
          "ééé€&",
          "ééé€<",
          "ééé€>",
        ] {
          let value = format!("{}{suffix}", prefix.repeat(length));
          for attribute in [false, true] {
            let mut actual = String::from("prefix:");
            let mut expected = actual.clone();
            push_escaped_inner::<false>(&mut actual, &value, attribute);
            scalar_escaped_inner::<false>(&mut expected, &value, attribute);
            assert_eq!(actual, expected, "{value:?}, attribute {attribute}");
            actual.clear();
            expected.clear();
            push_escaped_inner::<true>(&mut actual, &value, attribute);
            scalar_escaped_inner::<true>(&mut expected, &value, attribute);
            assert_eq!(
              actual, expected,
              "brackets {value:?}, attribute {attribute}"
            );
          }
        }
      }
    }
  }

  #[test]
  fn html_tag_allowlist_is_exact() {
    const ALLOWED: &[&str] = &[
      "details",
      "summary",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "strong",
      "b",
      "em",
      "i",
      "del",
      "sub",
      "sup",
      "ins",
      "blockquote",
      "code",
      "ul",
      "li",
      "a",
      "table",
      "thead",
      "tr",
      "th",
      "td",
      "ol",
      "pre",
      "p",
      "div",
      "span",
      "tbody",
      "tfoot",
      "nav",
      "kbd",
      "footer",
      "article",
      "section",
      "abbr",
      "mark",
      "q",
      "samp",
      "small",
      "aside",
      "u",
      "cite",
      "dfn",
      "var",
      "time",
      "ruby",
      "rt",
      "rp",
      "dd",
      "dt",
      "address",
      "dl",
      "figure",
      "main",
      "header",
      "figcaption",
      "caption",
      "s",
      "strike",
    ];

    for (tag_id, name) in TAG_NAMES.iter().enumerate() {
      assert_eq!(
        html_tag_name(u8::try_from(tag_id).expect("tag ID fits in u8")).is_some(),
        ALLOWED.contains(name),
        "tag={name}",
      );
    }
  }
}
