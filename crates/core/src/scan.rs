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
    // `-->` is not the only terminator. `<!-->` and `<!--->` close straight out
    // of the comment start states, and a run of two or more dashes also closes
    // on `!>`. Matching `-->` alone leaves those comments open, so the scan
    // runs to end of chunk and every byte after them is discarded.
    if i < chunk_length && bytes[i] == GT_CHAR {
      return CommentResult {
        complete: true,
        new_position: i + 1,
      };
    }
    if i + 1 < chunk_length && bytes[i] == DASH_CHAR && bytes[i + 1] == GT_CHAR {
      return CommentResult {
        complete: true,
        new_position: i + 2,
      };
    }
    while i + 2 < chunk_length {
      // Scanning for the dash on its own keeps this loop vectorizable; the
      // three-byte window is only formed once a dash is found.
      while i + 2 < chunk_length && bytes[i] != DASH_CHAR {
        i += 1;
      }
      if i + 2 >= chunk_length {
        break;
      }
      if bytes[i + 1] == DASH_CHAR {
        let after_dashes = bytes[i + 2];
        if after_dashes == GT_CHAR {
          return CommentResult {
            complete: true,
            new_position: i + 3,
          };
        }
        if after_dashes == EXCLAMATION_CHAR && i + 3 < chunk_length && bytes[i + 3] == GT_CHAR {
          return CommentResult {
            complete: true,
            new_position: i + 4,
          };
        }
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

/// How far a start tag spanning several chunks has been searched for its `>`,
/// so the next chunk resumes instead of restarting. Without this a tag longer
/// than the chunk is re-scanned from `<` every chunk, which is quadratic.
#[derive(Clone, Copy)]
pub(crate) struct PendingTagScan {
  /// Bytes of the attribute region already examined.
  scanned: usize,
  state: State,
  /// The quote still open at `scanned`, or 0 outside a quoted value.
  quote_char: u8,
}

impl PendingTagScan {
  #[inline]
  pub(crate) fn new() -> Self {
    Self {
      scanned: 0,
      state: State::Gap,
      quote_char: 0,
    }
  }

  /// Resume from the start of a fresh chunk, keeping the tokenizer state. Lets a
  /// discarded tag's bytes be dropped while its `>` is still found correctly.
  #[inline]
  pub(crate) fn restart(&mut self) {
    self.scanned = 0;
  }
}

#[derive(Clone, Copy)]
#[repr(u8)]
pub(crate) enum DiscardedCommentState {
  Start,
  StartDash,
  Comment,
  EndDash,
  End,
  EndBang,
}

impl DiscardedCommentState {
  #[inline]
  pub(crate) fn new() -> Self {
    Self::Start
  }
}

/// Find the end of a comment whose earlier bytes have been dropped, resuming from
/// its tokenizer state. Returns the index after the `>` without retaining bytes.
pub(crate) fn discarded_comment_end(
  chunk: &str,
  state: &mut DiscardedCommentState,
) -> Option<usize> {
  for (index, &c) in chunk.as_bytes().iter().enumerate() {
    if c == GT_CHAR
      && matches!(
        *state,
        DiscardedCommentState::Start
          | DiscardedCommentState::StartDash
          | DiscardedCommentState::End
          | DiscardedCommentState::EndBang
      )
    {
      return Some(index + 1);
    }
    *state = match c {
      DASH_CHAR => match *state {
        DiscardedCommentState::Start => DiscardedCommentState::StartDash,
        DiscardedCommentState::StartDash
        | DiscardedCommentState::EndDash
        | DiscardedCommentState::End => DiscardedCommentState::End,
        DiscardedCommentState::Comment | DiscardedCommentState::EndBang => {
          DiscardedCommentState::EndDash
        }
      },
      EXCLAMATION_CHAR if matches!(*state, DiscardedCommentState::End) => {
        DiscardedCommentState::EndBang
      }
      _ => DiscardedCommentState::Comment,
    }
  }
  None
}

/// Quote state carried while an end tag's bytes are dropped. The end-tag
/// tokenizer only treats a quote as opening a value once the tag name has ended,
/// so both bits have to survive a chunk boundary.
#[derive(Clone, Copy, Default)]
pub(crate) struct DiscardedCloseTag {
  /// The tag name has ended within the bytes scanned so far, so a dropped end
  /// tag's match can be resolved against the open elements.
  pub(crate) name_ended: bool,
  quote: u8,
}

/// Find the `>` ending an end tag whose earlier bytes have been dropped. Mirrors
/// the end-tag tokenizer in `process_closing_tag`, where a `>` inside a quoted
/// parse-error attribute does not complete the token. Returns the index after
/// the `>`.
pub(crate) fn discarded_close_tag_end(chunk: &str, state: &mut DiscardedCloseTag) -> Option<usize> {
  for (index, &c) in chunk.as_bytes().iter().enumerate() {
    if !state.name_ended && (is_whitespace(c) || c == SLASH_CHAR || c == GT_CHAR) {
      state.name_ended = true;
    }
    if state.quote != 0 {
      if c == state.quote {
        state.quote = 0;
      }
    } else if state.name_ended && (c == QUOTE_CHAR || c == APOS_CHAR) {
      state.quote = c;
    } else if c == GT_CHAR {
      return Some(index + 1);
    }
  }
  None
}

/// Find the `>` ending a dropped doctype or bogus comment. Both end at the first
/// `>`, quoted or not, exactly as [`process_comment_or_doctype`] scans them.
pub(crate) fn discarded_gt(chunk: &str) -> Option<usize> {
  chunk
    .as_bytes()
    .iter()
    .position(|&c| c == GT_CHAR)
    .map(|index| index + 1)
}

/// Find the `]]>` ending a dropped CDATA section, resuming from `brackets` (the
/// trailing `]` run). Returns the index after the `>`.
pub(crate) fn discarded_cdata_end(chunk: &str, brackets: &mut u8) -> Option<usize> {
  for (index, &c) in chunk.as_bytes().iter().enumerate() {
    match c {
      b']' => *brackets = (*brackets + 1).min(2),
      GT_CHAR if *brackets >= 2 => return Some(index + 1),
      _ => *brackets = 0,
    }
  }
  None
}

/// Resume the search for a start tag's `>`, returning its index once the tag is
/// complete. Runs the same tokenizer as [`scan_tag`] so the two always agree on
/// where a tag ends; `process_tag_attributes` still does the single real parse.
pub(crate) fn tag_is_complete(
  html_chunk: &str,
  attrs_start: usize,
  pending: &mut PendingTagScan,
) -> Option<usize> {
  let bytes = html_chunk.as_bytes();
  let mut i = attrs_start + pending.scanned;

  while i < bytes.len() {
    let c = bytes[i];

    if pending.quote_char != 0 {
      if c == pending.quote_char {
        pending.quote_char = 0;
        pending.state = State::Gap;
      }
      i += 1;
      continue;
    }

    // `/>` is reached through its own `>`, so one test covers both endings.
    if c == GT_CHAR {
      return Some(i);
    }

    if pending.state == State::BeforeValue && (c == QUOTE_CHAR || c == APOS_CHAR) {
      pending.quote_char = c;
    } else {
      pending.state = pending.state.step_without_extraction(c);
    }
    i += 1;
  }

  pending.scanned = i - attrs_start;
  None
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

    let attribute_state = if EXTRACT { scan.state } else { state };
    if attribute_state != State::UnquotedValue
      && c == SLASH_CHAR
      && i + 1 < chunk_length
      && bytes[i + 1] == GT_CHAR
    {
      let attrs = scan.finish(html_chunk, i);
      return (true, i + 2, attrs, true);
    }
    if c == GT_CHAR {
      let attrs = scan.finish(html_chunk, i);
      return (true, i + 1, attrs, self_closing);
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
    } else if state == State::BeforeValue && (c == QUOTE_CHAR || c == APOS_CHAR) {
      inside_quote = true;
      quote_char = c;
    } else {
      state = state.step_without_extraction(c);
    }
    i += 1;
  }

  (false, i, Attributes::new(), false)
}

/// Mask rejection happens before any lowercasing or entity decoding, so
/// unwanted attributes cost no allocations.
#[inline]
fn push_attr(result: &mut Attributes, mask: u16, raw: &str, value: Option<&str>) {
  let bit = attr_bit(raw.as_bytes());
  if mask != ATTR_ALL && mask & bit == 0 {
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

  #[test]
  fn slash_inside_an_unquoted_value_is_an_ordinary_character() {
    let a = parse_attributes("href=/a/b/", ATTR_ALL);
    assert_eq!(a.get("href").map(String::as_str), Some("/a/b/"));
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
  fn colspan_uses_the_filtered_attribute_path() {
    let attrs = parse_attributes("colspan=2 id=x", ATTR_COLSPAN);
    assert_eq!(attrs.get("colspan").map(String::as_str), Some("2"));
    assert!(!attrs.contains_key("id"));
  }

  #[test]
  fn process_tag_attributes_finds_close() {
    // "<a href=\"x\">" — scan from after the tag name
    let html = "a href=\"x\">rest";
    let (complete, new_pos, attrs, self_closing) = process_tag_attributes(html, 1, None, ATTR_ALL);
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
      assert_eq!(extracted_self_closing, bare_self_closing, "html={html:?}");
      assert!(bare_attrs.is_empty(), "html={html:?}");
    }
  }

  fn comment_end(html: &str) -> Option<usize> {
    let r = process_comment_or_doctype(html, 0);
    r.complete.then_some(r.new_position)
  }

  #[test]
  fn comment_closes_at_every_spec_end_state() {
    // Offsets cross-checked against parse5 (rehype-parse) comment token spans.
    assert_eq!(comment_end("<!-->Z"), Some(5));
    assert_eq!(comment_end("<!--->Z"), Some(6));
    assert_eq!(comment_end("<!---->Z"), Some(7));
    assert_eq!(comment_end("<!--x-->Z"), Some(8));
    assert_eq!(comment_end("<!--x--!>Z"), Some(9));
    assert_eq!(comment_end("<!-----!>Z"), Some(9));
    assert_eq!(comment_end("<!--!--!>Z"), Some(9));
    assert_eq!(comment_end("<!--<--!>Z"), Some(9));
    assert_eq!(comment_end("<!--<!-->Z"), Some(9));

    // An earlier terminator wins; scanning for `-->` alone overshot these.
    assert_eq!(comment_end("<!-->-->Z"), Some(5));
    assert_eq!(comment_end("<!--->-->Z"), Some(6));

    // A `>` inside the body is not a terminator, so downlevel-hidden
    // conditional comments still close only at `-->`.
    assert_eq!(comment_end("<!--[if IE]>x<![endif]-->Z"), Some(25));

    // Unterminated: the caller carries the chunk instead.
    assert_eq!(comment_end("<!--"), None);
    assert_eq!(comment_end("<!--x"), None);
    assert_eq!(comment_end("<!--x--"), None);
    assert_eq!(comment_end("<!--x--!"), None);
  }

  // Literal transcription of the WHATWG comment states, including the
  // less-than-sign states and the reconsume steps the scan above collapses
  // into a sliding window.
  fn spec_comment_end(bytes: &[u8], start: usize) -> Option<usize> {
    enum S {
      Start,
      StartDash,
      Comment,
      Lt,
      LtBang,
      LtBangDash,
      LtBangDashDash,
      EndDash,
      End,
      EndBang,
    }
    let mut state = S::Start;
    let mut i = start;
    while i < bytes.len() {
      let c = bytes[i];
      match state {
        S::Start => match c {
          GT_CHAR => return Some(i + 1),
          DASH_CHAR => {
            state = S::StartDash;
            i += 1;
          }
          _ => state = S::Comment,
        },
        S::StartDash => match c {
          GT_CHAR => return Some(i + 1),
          DASH_CHAR => {
            state = S::End;
            i += 1;
          }
          _ => state = S::Comment,
        },
        S::Comment => match c {
          b'<' => {
            state = S::Lt;
            i += 1;
          }
          DASH_CHAR => {
            state = S::EndDash;
            i += 1;
          }
          _ => i += 1,
        },
        S::Lt => match c {
          EXCLAMATION_CHAR => {
            state = S::LtBang;
            i += 1;
          }
          b'<' => i += 1,
          _ => state = S::Comment,
        },
        S::LtBang => match c {
          DASH_CHAR => {
            state = S::LtBangDash;
            i += 1;
          }
          _ => state = S::Comment,
        },
        S::LtBangDash => match c {
          DASH_CHAR => {
            state = S::LtBangDashDash;
            i += 1;
          }
          _ => state = S::EndDash,
        },
        S::LtBangDashDash => state = S::End,
        S::EndDash => match c {
          DASH_CHAR => {
            state = S::End;
            i += 1;
          }
          _ => state = S::Comment,
        },
        S::End => match c {
          GT_CHAR => return Some(i + 1),
          EXCLAMATION_CHAR => {
            state = S::EndBang;
            i += 1;
          }
          DASH_CHAR => i += 1,
          _ => state = S::Comment,
        },
        S::EndBang => match c {
          GT_CHAR => return Some(i + 1),
          DASH_CHAR => {
            state = S::EndDash;
            i += 1;
          }
          _ => state = S::Comment,
        },
      }
    }
    None
  }

  #[test]
  fn scan_matches_the_spec_state_machine_for_every_short_comment() {
    // `-`, `!` and `>` are the only bytes with transitions, `<` reaches the
    // less-than-sign states, `x` stands for every other byte.
    const ALPHABET: [u8; 5] = *b"-!>x<";
    for len in 0..=6u32 {
      for n in 0..ALPHABET.len().pow(len) {
        let mut html = String::from("<!--");
        let mut rest = n;
        for _ in 0..len {
          html.push(ALPHABET[rest % ALPHABET.len()] as char);
          rest /= ALPHABET.len();
        }
        html.push('Z');
        assert_eq!(
          comment_end(&html),
          spec_comment_end(html.as_bytes(), 4),
          "html={html:?}"
        );
      }
    }
  }

  // A dropped comment ends where the full scan ends it, or the document resumes
  // inside the comment. Check every carried state by splitting each short input.
  #[test]
  fn the_discarded_comment_scan_matches_the_spec_state_machine() {
    const ALPHABET: [u8; 5] = *b"-!>x<";
    for len in 0..=6u32 {
      for n in 0..ALPHABET.len().pow(len) {
        let mut tail = String::new();
        let mut rest = n;
        for _ in 0..len {
          tail.push(ALPHABET[rest % ALPHABET.len()] as char);
          rest /= ALPHABET.len();
        }
        tail.push('Z');
        let reference = spec_comment_end(tail.as_bytes(), 0);
        for split in 0..=tail.len() {
          let mut state = DiscardedCommentState::new();
          let first = discarded_comment_end(&tail[..split], &mut state);
          let actual = first
            .or_else(|| discarded_comment_end(&tail[split..], &mut state).map(|end| split + end));
          assert_eq!(actual, reference, "tail={tail:?} split={split}");
        }
      }
    }
  }

  #[test]
  fn both_scan_instantiations_agree_for_short_inputs() {
    const ALPHABET: &[u8] = b"a ='\".>/";
    const WIDTH: usize = 6;

    for case in 0..ALPHABET
      .len()
      .pow(u32::try_from(WIDTH).expect("test width fits in u32"))
    {
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
