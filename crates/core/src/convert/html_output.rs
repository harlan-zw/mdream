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

fn html_tag_name(tag_id: u8) -> Option<&'static str> {
  let canonical = match tag_id {
    TAG_B => "strong",
    TAG_I => "em",
    TAG_S | TAG_STRIKE => "del",
    _ => "",
  };
  if !canonical.is_empty() {
    return Some(canonical);
  }
  let safe = matches!(
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
  );
  safe.then_some(TAG_NAMES[tag_id as usize])
}

impl ConvertState {
  fn resolve_html_url<'a>(&self, url: &'a str, image: bool) -> Option<Cow<'a, str>> {
    if !is_safe_html_url(url, image) {
      return None;
    }
    let resolved = resolve_url(url, self.options.origin.as_deref(), self.clean_urls);
    is_safe_html_url(resolved.as_ref(), image).then_some(resolved)
  }

  #[cfg(feature = "html")]
  fn html_output_mut(&mut self) -> &mut String {
    match self.html_frames.last_mut() {
      Some(HtmlFrame::Heading { output, .. } | HtmlFrame::Pre { output, .. }) => output,
      None => &mut self.buffer,
    }
  }

  #[cfg(feature = "html")]
  fn push_html(&mut self, value: &str) {
    self.html_output_mut().push_str(value);
  }

  #[cfg(feature = "html")]
  fn push_html_text(&mut self, value: &str) {
    for frame in self.html_frames.iter_mut().rev() {
      if let HtmlFrame::Heading { text, .. } = frame {
        text.push_str(value);
        break;
      }
    }
    push_escaped(self.html_output_mut(), value, false);
  }

  pub(super) fn html_element_output(
    &self,
    node: &ElementNode,
    entering: bool,
    protect_markdown: bool,
  ) -> Option<String> {
    let tag_id = node.tag_id?;
    let name = html_tag_name(tag_id)?;
    if !entering {
      if tag_id == TAG_A {
        let href = node.attributes.get_bit(ATTR_HREF)?;
        self.resolve_html_url(href, false)?;
      }
      return Some(format!("</{name}>"));
    }

    let mut output = String::with_capacity(name.len() + 24);
    output.push('<');
    output.push_str(name);
    match tag_id {
      TAG_A => {
        let href = node.attributes.get_bit(ATTR_HREF)?;
        let resolved = self.resolve_html_url(href, false)?;
        output.push_str(" href=\"");
        if protect_markdown {
          push_raw_anchor_attribute(&mut output, resolved.as_ref());
        } else {
          push_escaped(&mut output, resolved.as_ref(), true);
        }
        output.push('"');
        if let Some(title) = node.attributes.get_bit(ATTR_TITLE) {
          output.push_str(" title=\"");
          if protect_markdown {
            push_raw_anchor_attribute(&mut output, title);
          } else {
            push_escaped(&mut output, title, true);
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
          output.push_str(&start.to_string());
          output.push('"');
        }
      }
      TAG_CODE => {
        let language = Self::get_language_from_class(node.attributes.get_bit(ATTR_CLASS));
        if !language.is_empty() {
          output.push_str(" class=\"language-");
          push_escaped(&mut output, language, true);
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
          output.push_str(&colspan.to_string());
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
    Some(output)
  }

  #[cfg(feature = "html")]
  pub(super) fn emit_html_enter(&mut self) {
    let Some(node) = self.stack.last() else {
      return;
    };
    let tag_id = node.tag_id;
    if let Some(HtmlFrame::Pre {
      language, output, ..
    }) = self.html_frames.last_mut()
    {
      if tag_id == Some(TAG_CODE) && language.is_empty() {
        *language = Self::get_language_from_class(node.attributes.get_bit(ATTR_CLASS)).to_string();
      } else if tag_id == Some(TAG_BR) {
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
        language: Self::get_language_from_class(node.attributes.get_bit(ATTR_CLASS)).to_string(),
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
    if tag_id == Some(TAG_IMG) {
      let rendered = node.attributes.get_bit(ATTR_SRC).and_then(|src| {
        let resolved = self.resolve_html_url(src, true)?;
        let mut output = String::with_capacity(resolved.len() + 32);
        output.push_str("<img src=\"");
        push_escaped(&mut output, resolved.as_ref(), true);
        output.push_str("\" alt=\"");
        push_escaped(
          &mut output,
          node.attributes.get_bit(ATTR_ALT).unwrap_or(""),
          true,
        );
        output.push('"');
        if let Some(title) = node.attributes.get_bit(ATTR_TITLE) {
          output.push_str(" title=\"");
          push_escaped(&mut output, title, true);
          output.push('"');
        }
        output.push('>');
        Some(output)
      });
      if let Some(rendered) = rendered {
        self.push_html(&rendered);
        self.mark_rendered_child_content();
      }
      return;
    }
    let rendered = self.html_element_output(node, true, false);
    if let Some(rendered) = rendered {
      self.push_html(&rendered);
    }
  }

  #[cfg(feature = "html")]
  pub(super) fn emit_html_exit(&mut self, node: &ElementNode) {
    if let Some(frame) = self.html_frames.last() {
      let in_pre = matches!(frame, HtmlFrame::Pre { .. });
      let closes_frame = match frame {
        HtmlFrame::Heading { .. } => node.tag_id.is_some_and(|id| id.wrapping_sub(TAG_H1) < 6),
        HtmlFrame::Pre { depth, .. } => *depth == node.depth && node.tag_id == Some(TAG_PRE),
      };
      if closes_frame {
        let frame = self.html_frames.pop().unwrap();
        let rendered = match frame {
          HtmlFrame::Heading {
            level,
            output,
            text,
            ..
          } => {
            let slug = slugify_heading(&text);
            if slug.is_empty() {
              format!("<h{level}>{output}</h{level}>")
            } else {
              format!("<h{level} id=\"{slug}\">{output}</h{level}>")
            }
          }
          HtmlFrame::Pre {
            language, output, ..
          } => {
            let mut rendered = String::with_capacity(output.len() + language.len() + 48);
            rendered.push_str("<pre tabindex=\"0\"><code");
            if !language.is_empty() {
              rendered.push_str(" class=\"language-");
              push_escaped(&mut rendered, &language, true);
              rendered.push('"');
            }
            rendered.push('>');
            rendered.push_str(&output);
            rendered.push_str("</code></pre>");
            rendered
          }
        };
        self.push_html(&rendered);
        return;
      }
      if in_pre {
        return;
      }
    }
    if matches!(node.tag_id, Some(TAG_BR | TAG_HR | TAG_IMG | TAG_PRE)) {
      return;
    }
    let rendered = self.html_element_output(node, false, false);
    if let Some(rendered) = rendered {
      self.push_html(&rendered);
    }
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
