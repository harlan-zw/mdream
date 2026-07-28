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
  let self_closing = tag_handler.is_some_and(|h| h.is_self_closing);
  if attr_mask == ATTR_NONE {
    scan_tag::<false>(html_chunk, position, self_closing, ATTR_NONE)
  } else {
    scan_tag::<true>(html_chunk, position, self_closing, attr_mask)
  }
}

/// Walk a start tag to its `>`, extracting attributes on the way when
/// `EXTRACT`. Finding `>` needs the same quote tracking the extraction does, so
/// both come from one pass; the flag is a const so the `ATTR_NONE`
/// instantiation compiles the extraction out, which is what most tags want.
fn scan_tag<const EXTRACT: bool>(
  html_chunk: &str,
  position: usize,
  self_closing: bool,
  attr_mask: u16,
) -> (bool, usize, Attributes, bool) {
  let bytes = html_chunk.as_bytes();
  let chunk_length = bytes.len();
  let mut scan = AttrScan::new(attr_mask);
  let mut inside_quote = false;
  let mut quote_char: u8 = 0;
  // `ATTR_NONE` compiles `AttrScan` out, but still needs the same tokenizer
  // state to distinguish a quoted value from a quote inside an unquoted one.
  let mut state = State::Gap;
  let mut i = position;

  while i < chunk_length {
    let c = bytes[i];

    // A quoted value hides `>`. `EXTRACT` consumes those whole below.
    if inside_quote {
      if c == quote_char {
        inside_quote = false;
        state = State::Gap;
      }
      i += 1;
      continue;
    }

    if c == SLASH_CHAR && i + 1 < chunk_length && bytes[i + 1] == GT_CHAR {
      return (true, i + 2, scan.finish(html_chunk, i), true);
    }
    if c == GT_CHAR {
      return (true, i + 1, scan.finish(html_chunk, i), self_closing);
    }

    // Run to the closing quote without re-entering the state dispatch.
    if EXTRACT && scan.opens_quoted_value(c) {
      let value_start = i + 1;
      let mut end = value_start;
      while end < chunk_length && bytes[end] != c {
        end += 1;
      }
      if end == chunk_length {
        // Unterminated: the tag cannot close in this chunk.
        return (false, chunk_length, Attributes::new(), false);
      }
      scan.take_value(html_chunk, value_start, end);
      i = end + 1;
      continue;
    }

    if EXTRACT {
      scan.step(html_chunk, c, i);
    } else {
      if state == State::BeforeValue && (c == QUOTE_CHAR || c == APOS_CHAR) {
        inside_quote = true;
        quote_char = c;
      } else {
        state = state.step_without_extraction(c);
      }
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

/// Attribute extraction fed one byte at a time by the tag scan. Offsets index
/// the chunk itself, so nothing is allocated until a wanted attribute is whole.
struct AttrScan {
  mask: u16,
  result: Attributes,
  state: State,
  name_start: usize,
  name_end: usize,
  value_start: usize,
}

/// Where the scan sits within one `name="value"` triple.
#[derive(Clone, Copy, PartialEq, Eq)]
enum State {
  Gap,
  Name,
  AfterName,
  BeforeValue,
  UnquotedValue,
}

impl State {
  #[inline]
  fn step_without_extraction(self, c: u8) -> Self {
    match self {
      Self::Gap => {
        if is_whitespace(c) {
          Self::Gap
        } else {
          Self::Name
        }
      }
      Self::Name => {
        if c == EQUALS_CHAR {
          Self::BeforeValue
        } else if is_whitespace(c) {
          Self::AfterName
        } else {
          Self::Name
        }
      }
      Self::AfterName => {
        if c == EQUALS_CHAR {
          Self::BeforeValue
        } else if is_whitespace(c) {
          Self::AfterName
        } else {
          Self::Name
        }
      }
      Self::BeforeValue => {
        if is_whitespace(c) {
          Self::BeforeValue
        } else {
          Self::UnquotedValue
        }
      }
      Self::UnquotedValue => {
        if is_whitespace(c) {
          Self::Gap
        } else {
          Self::UnquotedValue
        }
      }
    }
  }
}

impl AttrScan {
  #[inline]
  fn new(mask: u16) -> Self {
    Self {
      mask,
      // A filtered mask keeps at most three names, so skip the eager reservation.
      result: if mask == ATTR_ALL {
        Attributes::with_capacity(4)
      } else {
        Attributes::new()
      },
      state: State::Gap,
      name_start: 0,
      name_end: 0,
      value_start: 0,
    }
  }

  #[inline]
  fn opens_quoted_value(&self, c: u8) -> bool {
    self.state == State::BeforeValue && (c == QUOTE_CHAR || c == APOS_CHAR)
  }

  #[inline]
  fn take_value(&mut self, chunk: &str, value_start: usize, value_end: usize) {
    push_attr(
      &mut self.result,
      self.mask,
      &chunk[self.name_start..self.name_end],
      Some(&chunk[value_start..value_end]),
    );
    self.state = State::Gap;
  }

  #[inline]
  fn take_bare_name(&mut self, chunk: &str, name_end: usize) {
    push_attr(
      &mut self.result,
      self.mask,
      &chunk[self.name_start..name_end],
      None,
    );
  }

  /// `is_whitespace` is computed per arm, not per byte: the value arms, where
  /// most attribute bytes live, never need it.
  #[inline]
  fn step(&mut self, chunk: &str, c: u8, index: usize) {
    match self.state {
      State::Gap => {
        if !is_whitespace(c) {
          self.state = State::Name;
          self.name_start = index;
        }
      }
      State::Name => {
        if c == EQUALS_CHAR || is_whitespace(c) {
          self.name_end = index;
          self.state = if c == EQUALS_CHAR {
            State::BeforeValue
          } else {
            State::AfterName
          };
        }
      }
      State::AfterName => {
        if c == EQUALS_CHAR {
          self.state = State::BeforeValue;
        } else if !is_whitespace(c) {
          self.take_bare_name(chunk, self.name_end);
          self.state = State::Name;
          self.name_start = index;
        }
      }
      State::BeforeValue => {
        if !is_whitespace(c) {
          self.state = State::UnquotedValue;
          self.value_start = index;
        }
      }
      State::UnquotedValue => {
        if is_whitespace(c) {
          self.take_value(chunk, self.value_start, index);
        }
      }
    }
  }

  /// Take the attribute still open when the tag ended at `end`.
  #[inline]
  fn finish(mut self, chunk: &str, end: usize) -> Attributes {
    match self.state {
      State::Name => self.take_bare_name(chunk, end),
      State::AfterName | State::BeforeValue => self.take_bare_name(chunk, self.name_end),
      State::UnquotedValue => self.take_value(chunk, self.value_start, end),
      State::Gap => {}
    }
    self.result
  }
}

/// Attributes of a bare region, for tests that write their input as it reads
/// inside `<…>`.
#[cfg(test)]
pub(crate) fn parse_attributes(attr_str: &str, mask: u16) -> Attributes {
  let (_, _, attrs, _) = process_tag_attributes(&format!("{attr_str}>"), 0, None, mask);
  attrs
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

  /// A parse error per the spec, but the quote joins the value rather than
  /// opening a quoted region, so it must not hide the `>` that ends the tag.
  #[test]
  fn quote_inside_an_unquoted_value_is_an_ordinary_character() {
    let a = parse_attributes("alt=Bob's src=/i.png", ATTR_ALL);
    assert_eq!(a.get("alt").map(String::as_str), Some("Bob's"));
    assert_eq!(a.get("src").map(String::as_str), Some("/i.png"));

    let b = parse_attributes("alt=Bob\"s", ATTR_ALL);
    assert_eq!(b.get("alt").map(String::as_str), Some("Bob\"s"));
  }

  /// A repeated name is a duplicate-attribute parse error and the later one is
  /// dropped from the token, so the first wins. Names are lowercased first, so
  /// `HREF` collides with `href`.
  #[test]
  fn duplicate_attribute_keeps_the_first() {
    let a = parse_attributes("href=/first href=/second", ATTR_ALL);
    assert_eq!(a.get("href").map(String::as_str), Some("/first"));

    let b = parse_attributes("href=/first HREF=/second", ATTR_ALL);
    assert_eq!(b.get("href").map(String::as_str), Some("/first"));

    let c = parse_attributes("href=\"/1\" href='/2' href=/3", ATTR_ALL);
    assert_eq!(c.get("href").map(String::as_str), Some("/1"));
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

  #[test]
  fn an_unterminated_quoted_value_leaves_the_tag_incomplete() {
    // The closing quote may still arrive in the next chunk, so nothing is
    // reported until it does.
    let html = "a href=\"x";
    let (complete, _, attrs, _) = process_tag_attributes(html, 1, None, ATTR_ALL);
    assert!(!complete);
    assert!(attrs.is_empty());
  }

  #[test]
  fn a_quoted_value_hides_a_tag_terminator() {
    let html = "a href=\"x>y\">rest";
    let (complete, new_pos, attrs, _) = process_tag_attributes(html, 1, None, ATTR_ALL);
    assert!(complete);
    assert_eq!(attrs.get("href").map(String::as_str), Some("x>y"));
    assert_eq!(&html[new_pos..], "rest");
  }

  #[test]
  fn both_scan_instantiations_agree_on_the_tag_end() {
    // `ATTR_NONE` compiles the extraction out, so the two instantiations have
    // to keep finding the same `>`. The expected position pins which one, since
    // agreeing on the wrong `>` would otherwise satisfy this.
    for (html, end) in [
      ("a href=\"x>y\">rest", 13),
      ("a href = \"x>y\">rest", 15),
      ("a href=x/>rest", 10),
      ("a href=a\"b>rest", 11),
      ("a href=a'b>rest", 11),
      ("a href=a'b c=d'e>rest", 17),
      ("a href=x='y>rest", 12),
      ("a>rest", 2),
    ] {
      let (complete, extracted_pos, _, extracted_self_closing) =
        process_tag_attributes(html, 1, None, ATTR_ALL);
      let (bare_complete, bare_pos, bare_attrs, bare_self_closing) =
        process_tag_attributes(html, 1, None, ATTR_NONE);
      assert!(complete, "html={html:?}");
      assert_eq!(extracted_pos, end, "html={html:?}");
      assert_eq!(complete, bare_complete, "html={html:?}");
      assert_eq!(extracted_pos, bare_pos, "html={html:?}");
      assert_eq!(
        extracted_self_closing, bare_self_closing,
        "html={html:?}"
      );
      assert!(bare_attrs.is_empty(), "html={html:?}");
    }
  }

  #[test]
  fn both_scan_instantiations_agree_for_short_inputs() {
    const ALPHABET: &[u8] = b"a ='\".>/";
    const WIDTH: usize = 6;

    for case in 0..ALPHABET.len().pow(WIDTH as u32) {
      let mut encoded = case;
      let mut input = [b'a'; WIDTH];
      for byte in &mut input {
        *byte = ALPHABET[encoded % ALPHABET.len()];
        encoded /= ALPHABET.len();
      }
      let html = std::str::from_utf8(&input).expect("ASCII alphabet");
      let (complete, position, _, self_closing) = process_tag_attributes(html, 0, None, ATTR_ALL);
      let (bare_complete, bare_position, bare_attrs, bare_self_closing) =
        process_tag_attributes(html, 0, None, ATTR_NONE);

      assert_eq!(complete, bare_complete, "html={html:?}");
      assert_eq!(position, bare_position, "html={html:?}");
      assert_eq!(self_closing, bare_self_closing, "html={html:?}");
      assert!(bare_attrs.is_empty(), "html={html:?}");
    }
  }
}
