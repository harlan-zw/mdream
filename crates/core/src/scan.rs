//! Low-level HTML scanning primitives: whitespace, comments, tag attributes.

use crate::consts::*;
use crate::entities::decode_html_attribute_entities;
use crate::types::Attributes;

/// Whitespace check optimized for the hot character loop.
/// Uses a 33-bit bitmap: space(32), CR(13), LF(10), TAB(9).
#[inline(always)]
pub(crate) fn is_whitespace(c: u8) -> bool {
  if c > 32 {
    return false;
  }
  // Bitmap: bit 9 (tab), bit 10 (LF), bit 12 (FF), bit 13 (CR), bit 32 (space)
  const MASK: u64 = (1u64 << 9) | (1u64 << 10) | (1u64 << 12) | (1u64 << 13) | (1u64 << 32);
  (MASK >> c) & 1 == 1
}

pub(crate) struct CommentResult {
  pub(crate) complete: bool,
  pub(crate) new_position: usize,
}

pub(crate) fn process_comment_or_doctype(html_chunk: &str, position: usize) -> CommentResult {
  let mut i = position;
  let bytes = html_chunk.as_bytes();
  let chunk_length = bytes.len();

  if i + 3 < chunk_length && bytes[i + 2] == DASH_CHAR && bytes[i + 3] == DASH_CHAR {
    i += 4;
    while i < chunk_length - 2 {
      if bytes[i] == DASH_CHAR && bytes[i + 1] == DASH_CHAR && bytes[i + 2] == GT_CHAR {
        i += 3;
        return CommentResult {
          complete: true,
          new_position: i,
        };
      }
      i += 1;
    }
    CommentResult {
      complete: false,
      new_position: position,
    }
  } else {
    i += 2;
    while i < chunk_length {
      if bytes[i] == GT_CHAR {
        i += 1;
        return CommentResult {
          complete: true,
          new_position: i,
        };
      }
      i += 1;
    }
    CommentResult {
      complete: false,
      new_position: i,
    }
  }
}

/// Scan a start tag's attribute region to its `>`, storing only the attributes
/// `attr_mask` selects.
pub(crate) fn process_tag_attributes(
  html_chunk: &str,
  position: usize,
  tag_handler: Option<&crate::types::TagHandler>,
  attr_mask: u16,
) -> (bool, usize, Attributes, bool) {
  let mut i = position;
  let bytes = html_chunk.as_bytes();
  let chunk_length = bytes.len();

  let self_closing = tag_handler.is_some_and(|h| h.is_self_closing);
  let mut inside_quote = false;
  let mut quote_char: u8 = 0;
  let attr_start_pos = i;

  while i < chunk_length {
    let c = bytes[i];

    if inside_quote {
      if c == quote_char {
        inside_quote = false;
      }
      i += 1;
      continue;
    } else if c == QUOTE_CHAR || c == APOS_CHAR {
      inside_quote = true;
      quote_char = c;
    } else if c == SLASH_CHAR && i + 1 < chunk_length && bytes[i + 1] == GT_CHAR {
      let attrs = parse_attributes(html_chunk[attr_start_pos..i].trim(), attr_mask);
      return (true, i + 2, attrs, true);
    } else if c == GT_CHAR {
      let attrs = parse_attributes(html_chunk[attr_start_pos..i].trim(), attr_mask);
      return (true, i + 1, attrs, self_closing);
    }

    i += 1;
  }

  (false, i, Attributes::new(), false)
}

/// Mask rejection happens before any lowercasing or entity decoding, so
/// unwanted attributes cost no allocations.
#[inline]
fn push_attr(result: &mut Attributes, mask: u16, raw: &str, value: Option<&str>) {
  if !attr_wanted(mask, raw.as_bytes()) {
    return;
  }
  let name = raw.to_ascii_lowercase();
  match value {
    Some(value) => result.insert(name, decode_html_attribute_entities(value).into_owned()),
    None => result.insert(name, String::new()),
  }
}

#[allow(clippy::collapsible_match)]
pub(crate) fn parse_attributes(attr_str: &str, mask: u16) -> Attributes {
  if attr_str.is_empty() || mask == ATTR_NONE {
    return Attributes::new();
  }
  // A filtered mask keeps at most three names, so skip the eager reservation.
  let mut result = if mask == ATTR_ALL {
    Attributes::with_capacity(4)
  } else {
    Attributes::new()
  };

  let bytes = attr_str.as_bytes();
  let len = bytes.len();
  let mut i = 0;

  const WHITESPACE: u8 = 0;
  const NAME: u8 = 1;
  const AFTER_NAME: u8 = 2;
  const BEFORE_VALUE: u8 = 3;
  const QUOTED_VALUE: u8 = 4;
  const UNQUOTED_VALUE: u8 = 5;

  let mut state = WHITESPACE;
  let mut name_start = 0;
  let mut name_end;
  let mut value_start = 0;
  let mut quote_char = 0;
  let mut name_start_saved = 0;
  let mut name_end_saved = 0;

  while i < len {
    let char_code = bytes[i];

    // `is_whitespace` is computed per arm, not per byte: the quoted-value arm,
    // where most attribute bytes live, never needs it.
    match state {
      WHITESPACE => {
        if !is_whitespace(char_code) {
          state = NAME;
          name_start = i;
        }
      }
      NAME => {
        if char_code == EQUALS_CHAR || is_whitespace(char_code) {
          name_end = i;
          name_start_saved = name_start;
          name_end_saved = name_end;
          state = if char_code == EQUALS_CHAR {
            BEFORE_VALUE
          } else {
            AFTER_NAME
          };
        }
      }
      AFTER_NAME => {
        if char_code == EQUALS_CHAR {
          state = BEFORE_VALUE;
        } else if !is_whitespace(char_code) {
          push_attr(
            &mut result,
            mask,
            &attr_str[name_start_saved..name_end_saved],
            None,
          );
          state = NAME;
          name_start = i;
        }
      }
      BEFORE_VALUE => {
        if !is_whitespace(char_code) {
          if char_code == QUOTE_CHAR || char_code == APOS_CHAR {
            state = QUOTED_VALUE;
            quote_char = char_code;
            value_start = i + 1;
          } else {
            state = UNQUOTED_VALUE;
            value_start = i;
          }
        }
      }
      QUOTED_VALUE => {
        // Run to the closing quote without re-entering the state dispatch.
        while i < len && bytes[i] != quote_char {
          i += 1;
        }
        if i == len {
          // Unterminated quote: the attribute is dropped.
          break;
        }
        push_attr(
          &mut result,
          mask,
          &attr_str[name_start_saved..name_end_saved],
          Some(&attr_str[value_start..i]),
        );
        state = WHITESPACE;
      }
      UNQUOTED_VALUE => {
        if is_whitespace(char_code) {
          push_attr(
            &mut result,
            mask,
            &attr_str[name_start_saved..name_end_saved],
            Some(&attr_str[value_start..i]),
          );
          state = WHITESPACE;
        }
      }
      _ => {}
    }
    i += 1;
  }

  if state == NAME {
    push_attr(&mut result, mask, &attr_str[name_start..], None);
  } else if state == UNQUOTED_VALUE {
    push_attr(
      &mut result,
      mask,
      &attr_str[name_start_saved..name_end_saved],
      Some(&attr_str[value_start..]),
    );
  } else if state == AFTER_NAME || state == BEFORE_VALUE {
    push_attr(
      &mut result,
      mask,
      &attr_str[name_start_saved..name_end_saved],
      None,
    );
  }

  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn whitespace_detection() {
    for c in [b' ', b'\t', b'\n', b'\r'] {
      assert!(is_whitespace(c));
    }
    for c in [b'a', b'0', b'-', 0u8] {
      assert!(!is_whitespace(c));
    }
  }

  #[test]
  fn parses_quoted_and_unquoted_attributes() {
    let a = parse_attributes("href=\"/x\" id=main", ATTR_ALL);
    assert_eq!(a.get("href").map(String::as_str), Some("/x"));
    assert_eq!(a.get("id").map(String::as_str), Some("main"));
  }

  #[test]
  fn parses_valueless_and_empty_attributes() {
    let a = parse_attributes("disabled checked", ATTR_ALL);
    assert!(a.contains_key("disabled"));
    assert!(a.contains_key("checked"));
    let empty = parse_attributes("", ATTR_ALL);
    assert!(empty.is_empty());
  }

  #[test]
  fn attribute_names_lowercased_values_decoded() {
    let a = parse_attributes("DATA-X='a &amp; b'", ATTR_ALL);
    assert_eq!(a.get("data-x").map(String::as_str), Some("a & b"));
  }

  #[test]
  fn attribute_entities_follow_ambiguous_ampersand_rules() {
    let a = parse_attributes("title='&copycat &copy=1 &copy! &copy;cat'", ATTR_ALL);
    assert_eq!(
      a.get("title").map(String::as_str),
      Some("&copycat &copy=1 ©! ©cat")
    );
  }

  #[test]
  fn form_feed_is_whitespace() {
    assert!(is_whitespace(0x0C));
  }

  #[test]
  fn valueless_equals_attribute_kept_as_empty() {
    // `<a href=>` — attribute ends in `name=`, must survive as empty value
    let a = parse_attributes("href=", ATTR_ALL);
    assert!(a.contains_key("href"));
    assert_eq!(a.get("href").map(String::as_str), Some(""));
  }

  #[test]
  fn a_filtered_mask_stores_only_the_wanted_names() {
    // <a>'s mask: href/title/aria-label. Everything else is scanned past.
    let mask = ATTR_HREF | ATTR_TITLE | ATTR_ARIA_LABEL;
    let a = parse_attributes(
      "class=btn href=\"/x\" rel=nofollow data-id='7' TITLE=\"t\" target=_blank",
      mask,
    );
    assert_eq!(a.get("href").map(String::as_str), Some("/x"));
    assert_eq!(a.get("title").map(String::as_str), Some("t"));
    assert!(!a.contains_key("class"));
    assert!(!a.contains_key("rel"));
    assert!(!a.contains_key("data-id"));
    assert!(!a.contains_key("target"));
  }

  #[test]
  fn a_filtered_mask_keeps_trailing_and_valueless_forms() {
    // Tail states (bare name, `name=`, unquoted final value) honour the mask.
    assert!(parse_attributes("hidden href", ATTR_HREF).contains_key("href"));
    assert!(parse_attributes("hidden href=", ATTR_HREF).contains_key("href"));
    assert_eq!(
      parse_attributes("class=c src=/i.png", ATTR_SRC)
        .get("src")
        .map(String::as_str),
      Some("/i.png")
    );
    assert!(!parse_attributes("class=c src=/i.png", ATTR_SRC).contains_key("class"));
  }

  #[test]
  fn attr_mask_none_stores_nothing_and_all_stores_everything() {
    assert!(parse_attributes("href=/x class=c", ATTR_NONE).is_empty());
    let all = parse_attributes("href=/x class=c", ATTR_ALL);
    assert!(all.contains_key("href") && all.contains_key("class"));
  }

  #[test]
  fn process_tag_attributes_finds_close() {
    // "<a href=\"x\">" — scan from after the tag name
    let html = "a href=\"x\">rest";
    let (complete, new_pos, attrs, self_closing) =
      process_tag_attributes(html, 1, None, ATTR_ALL);
    assert!(complete);
    assert!(!self_closing);
    assert_eq!(&html[new_pos..], "rest");
    assert_eq!(attrs.get("href").map(String::as_str), Some("x"));
  }
}
