use super::output::parse_bounded_u32;
use super::*;

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

fn push_escaped_inner<const ESCAPE_BRACKETS: bool>(
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
    let resolved = resolve_url(url, self.options.origin.as_deref(), self.options.clean_urls);
    is_safe_html_url(resolved.as_ref(), image).then_some(resolved)
  }

  fn html_output_mut(&mut self) -> &mut String {
    match self.html_frames.last_mut() {
      Some(HtmlFrame::Heading { output, .. } | HtmlFrame::Pre { output, .. }) => output,
      None => &mut self.buffer,
    }
  }

  fn push_html(&mut self, value: &str) {
    self.html_output_mut().push_str(value);
  }

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
        let href = node.attributes.get("href")?;
        self.resolve_html_url(href, false)?;
      }
      return Some(format!("</{name}>"));
    }

    let mut output = String::with_capacity(name.len() + 24);
    output.push('<');
    output.push_str(name);
    match tag_id {
      TAG_A => {
        let href = node.attributes.get("href")?;
        let resolved = self.resolve_html_url(href, false)?;
        output.push_str(" href=\"");
        if protect_markdown {
          push_raw_anchor_attribute(&mut output, resolved.as_ref());
        } else {
          push_escaped(&mut output, resolved.as_ref(), true);
        }
        output.push('"');
        if let Some(title) = node.attributes.get("title") {
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
          .get("start")
          .and_then(|value| parse_bounded_u32(value, u32::MAX))
        {
          output.push_str(" start=\"");
          output.push_str(&start.to_string());
          output.push('"');
        }
      }
      TAG_CODE => {
        let language = Self::get_language_from_class(node.attributes.get("class"));
        if !language.is_empty() {
          output.push_str(" class=\"language-");
          push_escaped(&mut output, language, true);
          output.push('"');
        }
      }
      TAG_TH | TAG_TD => {
        if let Some(colspan) = node
          .attributes
          .get("colspan")
          .and_then(|value| parse_bounded_u32(value, u32::MAX))
          && colspan > 0
        {
          output.push_str(" colspan=\"");
          output.push_str(&colspan.to_string());
          output.push('"');
        }
        if tag_id == TAG_TH
          && let Some(align) = node.attributes.get("align")
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
        *language = Self::get_language_from_class(node.attributes.get("class")).to_string();
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
        language: Self::get_language_from_class(node.attributes.get("class")).to_string(),
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
      let rendered = node.attributes.get("src").and_then(|src| {
        let resolved = self.resolve_html_url(src, true)?;
        let mut output = String::with_capacity(resolved.len() + 32);
        output.push_str("<img src=\"");
        push_escaped(&mut output, resolved.as_ref(), true);
        output.push_str("\" alt=\"");
        push_escaped(
          &mut output,
          node.attributes.get("alt").map_or("", String::as_str),
          true,
        );
        output.push('"');
        if let Some(title) = node.attributes.get("title") {
          output.push_str(" title=\"");
          push_escaped(&mut output, title, true);
          output.push('"');
        }
        output.push('>');
        Some(output)
      });
      if let Some(rendered) = rendered {
        self.push_html(&rendered);
      }
      return;
    }
    let rendered = self.html_element_output(node, true, false);
    if let Some(rendered) = rendered {
      self.push_html(&rendered);
    }
  }

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

  pub(super) fn emit_html_text(&mut self, text: &str) {
    if !text.is_empty() {
      self.push_html_text(text);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

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
