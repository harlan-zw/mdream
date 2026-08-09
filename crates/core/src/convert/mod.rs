use crate::consts::*;
use crate::entities::{decode_html_entities, decode_html_entities_for_markdown};
use crate::scan::{
  PendingTagScan, is_whitespace, process_comment_or_doctype, process_tag_attributes,
  tag_is_complete,
};
use crate::selector::{ParsedSelectorList, matches_selector_list, parse_css_selector_list};
use crate::tags::get_tag_handler;
use crate::tailwind::process_tailwind_classes;
use crate::types::{
  ElementNode, ExtractedElement, HTMLToMarkdownOptions, OutputFormat, TagHandler, TailwindData,
};
use crate::url::{
  is_autolink_uri, is_empty_link_href, is_safe_html_url, resolve_url, slugify_heading,
};
use std::borrow::Cow;

mod html_output;
mod output;
mod parse;
mod plugins;

use html_output::HtmlFrame;

/// Tracked element during extraction — maps stack depth to accumulator
pub(crate) struct TrackedExtraction {
  pub(crate) selector: String,
  pub(crate) stack_depth: usize,
  pub(crate) text_content: String,
  pub(crate) tag_name: String,
  pub(crate) attributes: Vec<(String, String)>,
}

/// ASCII split point of the hazard bitmap: one `u64` covers bytes 0..63, the
/// other 64..127.
const HAZARD_MASK_SPLIT: u8 = 64;

/// Bytes readable as GFM inline markup if emitted unescaped. [`BATCHABLE_TEXT`]
/// derives from these, so a hazard added here cannot be left batchable.
const GFM_HAZARD_LOW: u64 = (1 << b'*') | (1 << b'<');
const GFM_HAZARD_HIGH: u64 = (1 << (b'[' - HAZARD_MASK_SPLIT))
  | (1 << (b'\\' - HAZARD_MASK_SPLIT))
  | (1 << (b'_' - HAZARD_MASK_SPLIT))
  | (1 << (b'`' - HAZARD_MASK_SPLIT))
  | (1 << (b'~' - HAZARD_MASK_SPLIT));

const BATCHABLE_TEXT: [bool; 256] = {
  let mut t = [false; 256];
  let mut c = 33usize;
  while c < 0x80 {
    let mask = if c < HAZARD_MASK_SPLIT as usize {
      GFM_HAZARD_LOW
    } else {
      GFM_HAZARD_HIGH
    };
    t[c] = (mask >> (c & (HAZARD_MASK_SPLIT as usize - 1))) & 1 == 0;
    c += 1;
  }
  t[AMPERSAND_CHAR as usize] = false;
  t
};

const GFM_HAZARD_BIT: u8 = 1;
const GFM_NEWLINE_BIT: u8 = 2;
const GFM_TEXT_ACTIVE_BIT: u8 = 4;

/// Per-byte GFM flags shared by the parser and escaping pass.
const GFM_BYTE_FLAGS: [u8; 256] = {
  let mut t = [0u8; 256];
  let mut c = 33usize;
  while c < 0x80 {
    let mask = if c < HAZARD_MASK_SPLIT as usize {
      GFM_HAZARD_LOW
    } else {
      GFM_HAZARD_HIGH
    };
    if (mask >> (c & (HAZARD_MASK_SPLIT as usize - 1))) & 1 != 0 {
      t[c] |= GFM_HAZARD_BIT;
    }
    c += 1;
  }
  t[b'\n' as usize] |= GFM_NEWLINE_BIT;
  t[b'\r' as usize] |= GFM_NEWLINE_BIT;
  let active = b"\\*_~`[]|><\n\r#-+.) 0123456789";
  let mut i = 0usize;
  while i < active.len() {
    t[active[i] as usize] |= GFM_TEXT_ACTIVE_BIT;
    i += 1;
  }
  t
};

struct CodeSpanState {
  output_start: usize,
  content_start: usize,
}

struct CodeFenceState {
  output_start: usize,
  marker_offset: usize,
  content_start: usize,
  indent: String,
  language: String,
}

#[derive(Clone)]
struct BlockquoteFrame {
  content_start: usize,
  list_indent: String,
}

static HEADING_PREFIXES: [&str; 6] = ["# ", "## ", "### ", "#### ", "##### ", "###### "];

/// Inline tags whose delimiters are suppressed inside `<pre>` (content only).
/// The tag ids form three dense ranges plus four exceptions.
#[inline]
fn suppresses_formatting_in_pre(tag_id: u8) -> bool {
  matches!(tag_id, TAG_A | TAG_KBD | TAG_S | TAG_STRIKE)
    || (TAG_STRONG..=TAG_INS).contains(&tag_id)
    || (TAG_ABBR..=TAG_SMALL).contains(&tag_id)
    || (TAG_U..=TAG_BDO).contains(&tag_id)
}

#[inline]
fn trailing_spaces(bytes: &[u8]) -> usize {
  bytes.len()
    - bytes
      .iter()
      .rposition(|byte| *byte != b' ')
      .map_or(0, |i| i + 1)
}

#[inline]
fn trim_ascii_whitespace_end(value: &str) -> usize {
  let bytes = value.as_bytes();
  let mut len = bytes.len();
  while len > 0 && bytes[len - 1].is_ascii_whitespace() {
    len -= 1;
  }
  len
}

/// What the current output line holds where a table row is about to be written.
enum LineBeforeRow {
  /// Nothing but block prefix, or a pending list marker.
  Open,
  /// A row left open mid-line.
  Row,
  /// Other content, so the row needs a block break to become a table.
  Content,
}

#[derive(Clone, Copy, PartialEq)]
#[repr(u8)]
enum CutLineLead {
  Uncut,
  Blank,
  RawHtml,
  Row,
  Content,
}

/// Widest `colspan` honored.
const MAX_CELL_SPAN: u8 = 64;

/// Largest `<ol start>` CommonMark can express: an ordered marker is at most
/// nine digits, so anything wider stops being a list marker at all.
const MAX_ORDERED_START: u32 = 999_999_999;

// Clean mode bitmask flags
const CLEAN_EMPTY_LINKS: u8 = 1;
const CLEAN_FRAGMENTS: u8 = 2;
const CLEAN_REDUNDANT_LINKS: u8 = 4;
const CLEAN_SELF_LINK_HEADINGS: u8 = 8;
const CLEAN_EMPTY_IMAGES: u8 = 16;
const CLEAN_EMPTY_LINK_TEXT: u8 = 32;

const SCRIPT_DATA: u8 = 0;
const SCRIPT_DATA_ESCAPED: u8 = 1;
const SCRIPT_DATA_ESCAPED_DASH: u8 = 2;
const SCRIPT_DATA_ESCAPED_DASH_DASH: u8 = 3;
const SCRIPT_DATA_DOUBLE_ESCAPED: u8 = 4;
const SCRIPT_DATA_DOUBLE_ESCAPED_DASH: u8 = 5;
const SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: u8 = 6;

#[derive(Clone, Copy)]
enum ScriptSequenceEnd {
  Match(usize),
  NoMatch,
  Incomplete,
}

enum ScriptScanBoundary {
  Close(usize),
  Pending(usize),
  Complete,
}

/// Outcome of feeding one chunk to the script-data scanner.
enum ScriptChunk {
  /// The `</script` close tag was found; resume normal parsing at this index.
  Closed(usize),
  /// The chunk ended inside script data; carry the raw tail from this offset
  /// into the next chunk (`chunk.len()` when everything was consumed, i.e.
  /// nothing to carry).
  Carry(usize),
}

struct ScriptScanResult {
  boundary: ScriptScanBoundary,
  state: u8,
}

#[inline(always)]
fn script_sequence_end(bytes: &[u8], name_start: usize) -> ScriptSequenceEnd {
  const SCRIPT_NAME: &[u8; 6] = b"script";
  for (offset, expected) in SCRIPT_NAME.iter().enumerate() {
    let index = name_start + offset;
    if index >= bytes.len() {
      return ScriptSequenceEnd::Incomplete;
    }
    if bytes[index] | 32 != *expected {
      return ScriptSequenceEnd::NoMatch;
    }
  }
  let delimiter_index = name_start + 6;
  if delimiter_index >= bytes.len() {
    return ScriptSequenceEnd::Incomplete;
  }
  let delimiter = bytes[delimiter_index];
  if delimiter == GT_CHAR || delimiter == SLASH_CHAR || is_whitespace(delimiter) {
    ScriptSequenceEnd::Match(delimiter_index + 1)
  } else {
    ScriptSequenceEnd::NoMatch
  }
}

/// Find the first script end tag that the HTML tokenizer would emit.
///
/// Only an incomplete `<...` boundary candidate is returned to the streaming
/// caller. All completed script data advances the persisted tokenizer state.
fn find_script_end_tag(bytes: &[u8], start: usize, initial_state: u8) -> ScriptScanResult {
  let mut state = initial_state;
  let mut i = start;

  while i < bytes.len() {
    if state == SCRIPT_DATA {
      while i < bytes.len() && bytes[i] != LT_CHAR {
        i += 1;
      }
    } else if state == SCRIPT_DATA_ESCAPED || state == SCRIPT_DATA_DOUBLE_ESCAPED {
      while i < bytes.len() && bytes[i] != LT_CHAR && bytes[i] != b'-' {
        i += 1;
      }
    }
    if i == bytes.len() {
      break;
    }

    let c = bytes[i];

    if c == LT_CHAR {
      if i + 1 == bytes.len() {
        return ScriptScanResult {
          boundary: ScriptScanBoundary::Pending(i),
          state,
        };
      }

      let next = bytes[i + 1];
      if state == SCRIPT_DATA {
        if next == SLASH_CHAR {
          match script_sequence_end(bytes, i + 2) {
            ScriptSequenceEnd::Match(_) => {
              return ScriptScanResult {
                boundary: ScriptScanBoundary::Close(i),
                state,
              };
            }
            ScriptSequenceEnd::Incomplete => {
              return ScriptScanResult {
                boundary: ScriptScanBoundary::Pending(i),
                state,
              };
            }
            ScriptSequenceEnd::NoMatch => {}
          }
        } else if next == EXCLAMATION_CHAR {
          let available = (bytes.len() - i).min(4);
          if b"<!--"[..available] == bytes[i..i + available] {
            if available < 4 {
              return ScriptScanResult {
                boundary: ScriptScanBoundary::Pending(i),
                state,
              };
            }
            state = SCRIPT_DATA_ESCAPED_DASH_DASH;
            i += 4;
            continue;
          }
        }
      } else {
        let escaped = state < SCRIPT_DATA_DOUBLE_ESCAPED;
        state = if escaped {
          SCRIPT_DATA_ESCAPED
        } else {
          SCRIPT_DATA_DOUBLE_ESCAPED
        };
        let is_end_tag = next == SLASH_CHAR;

        if is_end_tag || escaped {
          match script_sequence_end(bytes, i + if is_end_tag { 2 } else { 1 }) {
            ScriptSequenceEnd::Match(sequence_end) => {
              if is_end_tag {
                if escaped {
                  return ScriptScanResult {
                    boundary: ScriptScanBoundary::Close(i),
                    state,
                  };
                }
                state = SCRIPT_DATA_ESCAPED;
              } else {
                state = SCRIPT_DATA_DOUBLE_ESCAPED;
              }
              i = sequence_end;
              continue;
            }
            ScriptSequenceEnd::Incomplete => {
              return ScriptScanResult {
                boundary: ScriptScanBoundary::Pending(i),
                state,
              };
            }
            ScriptSequenceEnd::NoMatch => {}
          }
        }
      }
    } else {
      state = match state {
        SCRIPT_DATA_ESCAPED if c == b'-' => SCRIPT_DATA_ESCAPED_DASH,
        SCRIPT_DATA_ESCAPED_DASH if c == b'-' => SCRIPT_DATA_ESCAPED_DASH_DASH,
        SCRIPT_DATA_ESCAPED_DASH => SCRIPT_DATA_ESCAPED,
        SCRIPT_DATA_ESCAPED_DASH_DASH if c == GT_CHAR => SCRIPT_DATA,
        SCRIPT_DATA_ESCAPED_DASH_DASH if c != b'-' => SCRIPT_DATA_ESCAPED,
        SCRIPT_DATA_DOUBLE_ESCAPED if c == b'-' => SCRIPT_DATA_DOUBLE_ESCAPED_DASH,
        SCRIPT_DATA_DOUBLE_ESCAPED_DASH if c == b'-' => SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH,
        SCRIPT_DATA_DOUBLE_ESCAPED_DASH => SCRIPT_DATA_DOUBLE_ESCAPED,
        SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH if c == GT_CHAR => SCRIPT_DATA,
        SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH if c != b'-' => SCRIPT_DATA_DOUBLE_ESCAPED,
        _ => state,
      };
    }

    i += 1;
  }

  ScriptScanResult {
    boundary: ScriptScanBoundary::Complete,
    state,
  }
}

/// Unified single-pass HTML-to-Markdown converter.
/// Merges parser state and markdown output state to eliminate callback overhead,
/// duplicate state tracking, and enable full inlining of tag handler logic.
pub struct ConvertState {
  // === Parser state ===
  pub depth_map: [u16; MAX_TAG_ID],
  pub depth: usize,
  has_encoded_html_entity: bool,
  last_char_was_whitespace: bool,
  text_buffer_contains_whitespace: bool,
  text_buffer_contains_non_whitespace: bool,
  text_buffer_has_inline_gfm_hazard: bool,
  just_closed_tag: bool,
  is_first_text_in_element: bool,
  in_non_nesting: bool,
  script_data_state: u8,
  in_pre: bool,
  overflow_tag_id: Option<u8>,
  overflow_custom_name: Option<String>,
  overflow_same_name_depth: usize,
  overflow_included: bool,
  overflow_opaque_name: Option<String>,
  overflow_opaque_depth: usize,
  overflow_raw_name: Option<String>,
  overflow_raw_excludes_text: bool,
  /// Shallowest open element that is hidden or matches an exclude selector.
  /// Both drop their whole subtree, so one marker skips it in O(1).
  hidden_since_depth: Option<usize>,
  /// Shallowest open element matching an include selector. Only consulted
  /// when `filter_process_children` is set.
  filter_included_since_depth: Option<usize>,
  /// Unified collapse depth counter (replaces separate counters in ParseState + MarkdownState)
  collapse_non_span_depth: u8,
  collapse_span_depth: u8,
  first_block_parent_index: Option<usize>,
  block_parent_indices: Vec<usize>,
  parse_text_buffer: String,
  /// Set while a start tag is known to span chunks, holding how far its `>`
  /// search reached so the next chunk resumes instead of restarting it.
  pending_tag: Option<PendingTagScan>,
  script_text_buffer: String,
  pub stack: Vec<ElementNode>,
  node_pool: Vec<ElementNode>,

  // Plugin flags
  has_plugins: bool,
  has_tailwind: bool,
  has_isolate_main: bool,
  pub has_frontmatter: bool,
  has_filter: bool,
  pub has_extraction: bool,
  has_tag_overrides: bool,

  // Plugin tracking
  isolate_main_found: bool,
  isolate_main_closed: bool,
  isolate_first_header_depth: Option<usize>,
  isolate_after_footer: bool,

  frontmatter_in_head: bool,
  pub frontmatter_title: Option<String>,
  pub frontmatter_meta: Vec<(String, String)>,

  extraction_parsed_selectors: Vec<(String, ParsedSelectorList)>,
  extraction_tracked: Vec<TrackedExtraction>,
  pub extraction_results: Vec<ExtractedElement>,

  filter_include_parsed: Vec<(String, ParsedSelectorList)>,
  filter_exclude_parsed: Vec<(String, ParsedSelectorList)>,
  filter_process_children: bool,

  // === Markdown output state ===
  pub options: HTMLToMarkdownOptions,
  pub buffer: String,
  last_content_cache_len: usize,
  table_rendered_table: bool,
  table_current_row_cells: usize,
  /// A raw-HTML region (`<details>`, `<dl>`, …) stops being raw at the first
  /// blank line: CommonMark ends an HTML block there and reads what follows as
  /// Markdown, so text past one needs escaping. The scan resumes from
  /// `raw_html_scanned_to`, so a region costs one pass however many nodes it holds.
  raw_html_markdown: bool,
  raw_html_scanned_to: usize,
  /// Index just past the buffer's last `\n`, and how far it was scanned to find
  /// it. Recomputing walks the whole line, which is quadratic over a long one.
  line_start: usize,
  line_start_scanned_to: usize,
  /// Columns the delimiter row promised; cells past it would be dropped by GFM.
  table_header_cells: usize,
  // 0=none, 1=left, 2=center, 3=right
  table_column_alignments: Vec<u8>,
  last_text_node_contains_whitespace: bool,
  last_text_node_depth: usize,
  last_text_node_index: usize,
  has_last_text_node: bool,
  last_node_is_inline: bool,
  /// A collapsed trailing space trimmed from the end of an inline element.
  /// It stays deferred until later visible inline content appears so Markdown
  /// delimiters close before the separator and streaming output has no
  /// speculative trailing whitespace.
  pending_inline_whitespace: bool,

  // Streaming
  last_yielded_length: usize,
  /// Whether any non-leading output has already been returned to the caller.
  /// Once streaming starts, whitespace at the front of a drained buffer is
  /// content, not document-leading whitespace.
  has_streamed_output: bool,
  /// Two bytes immediately before the retained buffer, initialized as virtual
  /// newlines at the document start. When a later rewrite trims the buffer
  /// empty, spacing and newline counts still see the one-shot context.
  flushed_tail: [u8; 2],
  /// Output column immediately before `buffer[0]`. Draining may remove the
  /// beginning of the current line, but wrapping still needs its full column.
  buffer_start_column: usize,
  /// Test-only: disables draining to prove it never alters streamed bytes.
  #[cfg(test)]
  pub(crate) disable_drain: bool,

  /// Hard-wrap width in characters; 0 disables wrapping (zero-cost in the text
  /// hot path — a single integer compare). Code/tables/headings are exempt.
  wrap_width: usize,
  format: OutputFormat,
  plain_text: bool,
  preserve_leading_whitespace: bool,

  // Clean mode — bitmask for zero-cost when disabled
  clean_flags: u8,
  /// Set when current TAG_A has a meaningless href and should be rendered as plain text
  skip_current_link: bool,
  /// Buffer position of the `[` character written for TAG_A enter
  link_bracket_pos: usize,
  /// Open inline markers as (kind, output start, content start); lets the exit drop empty pairs.
  open_markers: Vec<(u8, usize, usize)>,
  /// Open code spans and fenced blocks stay buffered until their closing
  /// delimiter can be chosen from the complete literal content.
  code_spans: Vec<CodeSpanState>,
  code_fence: Option<CodeFenceState>,
  /// Open blockquotes stay buffered until all child line boundaries are known.
  blockquotes: Vec<BlockquoteFrame>,
  /// Heading slugs collected during conversion for fragment validation
  heading_slugs: Vec<String>,
  /// Fragment link locations: (bracket_start, link_end)
  /// Fragment slug is derived from buffer at fixup time
  fragment_links: Vec<(usize, usize)>,
  /// Whether we're inside a heading (for slug collection)
  in_heading: bool,
  /// Buffer position at heading start (for extracting heading text)
  heading_buffer_start: usize,
  html_frames: Vec<HtmlFrame>,

  /// Cumulative indent string for list-item continuation content. Grows by
  /// each ancestor `<li>`'s marker width (`"- "` = 2, `"N. "` = digits(N)+2),
  /// so code blocks, paragraphs, and nested blocks inside a list item land
  /// in the content column that CommonMark requires. Pushed on `<li>` enter,
  /// popped on `<li>` close.
  list_indent: String,
  /// Per-`<li>` contribution width stack, parallel to `list_indent`. Used to
  /// truncate the correct number of bytes on close without re-walking ancestors.
  list_indent_widths: Vec<u8>,

  /// `<pre>` fenced-code deferral (issue #97). A bare `<pre>` (no `<code>`
  /// child) becomes a fenced code block, but the opening fence is deferred
  /// until the first non-whitespace child so empty/whitespace-only blocks emit
  /// nothing. `pre_fence_pending`: inside a `<pre>` whose fence is undecided.
  /// `pre_fence_lang`: language resolved from the `<pre>`'s own class.
  pre_fence_pending: bool,
  pre_fence_lang: String,
  /// A fence is open for the current `<pre>`, however it was opened. The `<pre>`
  /// exit owns the closer, so a `<code>` child's trailing siblings stay in the
  /// block instead of landing on the fence line.
  pre_fence_open: bool,
  /// The open `<li>` wrote its marker onto a line that continues the paragraph
  /// above, so an empty item would read as a setext underline. `empty_item_len`
  /// is the buffer length that still means "nothing written since the marker",
  /// and `empty_item_line_start` where the separating newline goes.
  empty_item_hazard: bool,
  empty_item_line_start: usize,
  empty_item_len: usize,
  /// A list item rule waiting to see whether visible content follows it.
  list_rule_pending: bool,
  /// What leads the current line when draining has removed that line's start.
  /// `Uncut` also says `flushed_tail` still holds its document-start sentinel;
  /// yielding alone does not make that context valid.
  /// Rescanning `buffer` for a line start is wrong once a drain has happened;
  /// this is the same trick as `flushed_tail`, one step further back.
  cut_line_lead: CutLineLead,
  #[cfg(test)]
  gfm_escape_slow_path_calls: usize,
}

impl ConvertState {
  /// Check if we're inside a table cell (either `<td>` or `<th>`).
  #[inline]
  pub(crate) fn in_table_cell(&self) -> bool {
    self.depth_map[TAG_TD as usize] > 0 || self.depth_map[TAG_TH as usize] > 0
  }

  pub fn new(options: HTMLToMarkdownOptions, capacity: usize, format: OutputFormat) -> Self {
    // Read wrap width before `options` is moved into the struct below.
    let options_wrap_width = options.wrap_width;
    let plain_text = format == OutputFormat::Text;
    let mut s = Self {
      depth_map: [0; MAX_TAG_ID],
      depth: 0,
      has_encoded_html_entity: false,
      last_char_was_whitespace: true,
      text_buffer_contains_whitespace: false,
      text_buffer_contains_non_whitespace: false,
      text_buffer_has_inline_gfm_hazard: false,
      just_closed_tag: false,
      is_first_text_in_element: false,
      in_non_nesting: false,
      script_data_state: SCRIPT_DATA,
      in_pre: false,
      overflow_tag_id: None,
      overflow_custom_name: None,
      overflow_same_name_depth: 0,
      overflow_included: false,
      overflow_opaque_name: None,
      overflow_opaque_depth: 0,
      overflow_raw_name: None,
      overflow_raw_excludes_text: false,
      hidden_since_depth: None,
      filter_included_since_depth: None,
      collapse_non_span_depth: 0,
      collapse_span_depth: 0,
      first_block_parent_index: None,
      block_parent_indices: Vec::with_capacity(16),
      parse_text_buffer: String::new(),
      pending_tag: None,
      script_text_buffer: String::new(),
      stack: Vec::with_capacity(32),
      node_pool: Vec::with_capacity(32),

      has_plugins: false,
      has_tailwind: false,
      has_isolate_main: false,
      has_frontmatter: false,
      has_filter: false,
      has_extraction: false,
      has_tag_overrides: false,

      isolate_main_found: false,
      isolate_main_closed: false,
      isolate_first_header_depth: None,
      isolate_after_footer: false,

      frontmatter_in_head: false,
      frontmatter_title: None,
      frontmatter_meta: Vec::new(),

      extraction_parsed_selectors: Vec::new(),
      extraction_tracked: Vec::new(),
      extraction_results: Vec::new(),

      filter_include_parsed: Vec::new(),
      filter_exclude_parsed: Vec::new(),
      filter_process_children: true,

      options,
      buffer: String::with_capacity(capacity.max(1024)),
      last_content_cache_len: 0,
      table_rendered_table: false,
      table_current_row_cells: 0,
      raw_html_markdown: false,
      raw_html_scanned_to: 0,
      line_start: 0,
      line_start_scanned_to: 0,
      table_header_cells: 0,
      table_column_alignments: Vec::new(),
      last_text_node_contains_whitespace: false,
      last_text_node_depth: 0,
      last_text_node_index: 0,
      has_last_text_node: false,
      last_node_is_inline: false,
      pending_inline_whitespace: false,
      last_yielded_length: 0,
      has_streamed_output: false,
      flushed_tail: [b'\n'; 2],
      cut_line_lead: CutLineLead::Uncut,
      buffer_start_column: 0,
      #[cfg(test)]
      disable_drain: false,

      wrap_width: options_wrap_width,
      format,
      plain_text,
      preserve_leading_whitespace: false,
      clean_flags: 0,
      skip_current_link: false,
      link_bracket_pos: 0,
      open_markers: Vec::new(),
      code_spans: Vec::new(),
      code_fence: None,
      blockquotes: Vec::with_capacity(4),
      heading_slugs: Vec::new(),
      fragment_links: Vec::new(),
      in_heading: false,
      heading_buffer_start: 0,
      html_frames: Vec::new(),

      list_indent: String::new(),
      list_indent_widths: Vec::with_capacity(8),

      pre_fence_pending: false,
      pre_fence_lang: String::new(),
      pre_fence_open: false,
      empty_item_hazard: false,
      empty_item_line_start: 0,
      empty_item_len: 0,
      list_rule_pending: false,
      #[cfg(test)]
      gfm_escape_slow_path_calls: 0,
    };
    // Resolve clean config into bitmask
    let effective_clean_urls;
    if let Some(ref clean) = s.options.clean {
      effective_clean_urls = clean.urls || s.options.clean_urls;
      let mut flags = 0u8;
      if clean.empty_links {
        flags |= CLEAN_EMPTY_LINKS;
      }
      if clean.fragments {
        flags |= CLEAN_FRAGMENTS;
      }
      if clean.redundant_links {
        flags |= CLEAN_REDUNDANT_LINKS;
      }
      if clean.self_link_headings {
        flags |= CLEAN_SELF_LINK_HEADINGS;
      }
      if clean.empty_images {
        flags |= CLEAN_EMPTY_IMAGES;
      }
      if clean.empty_link_text {
        flags |= CLEAN_EMPTY_LINK_TEXT;
      }
      s.clean_flags = flags;
    } else {
      effective_clean_urls = s.options.clean_urls;
    }
    s.options.clean_urls = effective_clean_urls;

    if let Some(plugins) = &s.options.plugins {
      s.has_plugins = true;
      s.has_tailwind = plugins.tailwind.is_some();
      s.has_isolate_main = plugins.isolate_main.is_some();
      s.has_frontmatter = plugins.frontmatter.is_some();
      s.has_tag_overrides = plugins.tag_overrides.is_some();
      if let Some(extraction) = &plugins.extraction {
        s.has_extraction = true;
        s.extraction_parsed_selectors = extraction
          .selectors
          .iter()
          .map(|sel| (sel.clone(), parse_css_selector_list(sel)))
          .collect();
      }
      if let Some(filter) = &plugins.filter {
        s.has_filter = true;
        if let Some(incl) = &filter.include {
          s.filter_include_parsed = incl
            .iter()
            .map(|sel| (sel.clone(), parse_css_selector_list(sel)))
            .collect();
        }
        if let Some(excl) = &filter.exclude {
          s.filter_exclude_parsed = excl
            .iter()
            .map(|sel| (sel.clone(), parse_css_selector_list(sel)))
            .collect();
        }
        s.filter_process_children = filter.process_children.unwrap_or(true);
      }
    }
    s
  }

  #[inline]
  fn push_script_text(&mut self, text: &str) {
    if text.is_empty() {
      return;
    }
    // Script data is excluded from the output; only an extraction tracking the
    // script or an ancestor reads it, so buffering it otherwise retains the
    // whole element to emit nothing.
    if !self.extraction_tracked.is_empty() {
      self.script_text_buffer.push_str(text);
    }
    self.text_buffer_contains_non_whitespace = true;
    self.last_char_was_whitespace = false;
    self.just_closed_tag = false;
  }

  fn flush_script_text(&mut self) {
    if self.script_text_buffer.is_empty() {
      return;
    }
    let mut script_text = std::mem::take(&mut self.script_text_buffer);
    self.process_text_buffer(&mut script_text);
    self.script_text_buffer = script_text;
  }

  fn process_script_chunk(&mut self, chunk: &str, start: usize) -> ScriptChunk {
    let scan = find_script_end_tag(chunk.as_bytes(), start, self.script_data_state);
    self.script_data_state = scan.state;
    match scan.boundary {
      ScriptScanBoundary::Close(close_index) => {
        self.push_script_text(&chunk[start..close_index]);
        self.flush_script_text();
        self.script_data_state = SCRIPT_DATA;
        ScriptChunk::Closed(close_index)
      }
      ScriptScanBoundary::Pending(pending_start) => {
        // Consume the script text before the partial `</scr…` and carry only
        // that raw tail. Carrying from the script start instead would re-feed
        // the text just pushed here, which the resume path would push again.
        self.push_script_text(&chunk[start..pending_start]);
        ScriptChunk::Carry(pending_start)
      }
      ScriptScanBoundary::Complete => {
        self.push_script_text(&chunk[start..]);
        ScriptChunk::Carry(chunk.len())
      }
    }
  }

  /// Consumes what it can of `chunk` and returns how many bytes that was. The
  /// caller keeps the rest; returning an owned tail instead would copy a token
  /// that spans many chunks once per chunk, which is quadratic.
  pub fn process_html(&mut self, chunk: &str) -> usize {
    // Non-empty only when the previous chunk ended mid-text: that run continues
    // here instead of being re-fed as raw input. Every flush leaves it empty.
    let mut text_buffer = std::mem::take(&mut self.parse_text_buffer);
    if text_buffer.capacity() == 0 {
      text_buffer.reserve(256);
    }
    let bytes = chunk.as_bytes();
    let chunk_length = bytes.len();
    let mut i = 0;
    // Raw start of the text/tag run currently held in `text_buffer`. Any tail
    // carried to the next chunk is returned raw from here, never the decoded
    // and escaped `text_buffer` (which would be re-escaped, multiplying `\`).
    let mut run_start = 0usize;
    let mut carry = false;

    if self
      .stack
      .last()
      .is_some_and(|node| node.tag_id == Some(TAG_SCRIPT) && node.custom_name.is_none())
    {
      match self.process_script_chunk(chunk, i) {
        ScriptChunk::Closed(close_index) => i = close_index,
        ScriptChunk::Carry(from) => {
          run_start = from;
          carry = true;
          i = chunk_length;
        }
      }
    }

    while i < chunk_length {
      if text_buffer.is_empty() {
        run_start = i;
      }
      let cc = bytes[i];

      if cc != LT_CHAR {
        // Batch contiguous plain ASCII text, absorbing single inter-word
        // spaces so prose is copied once per text node, not per word.
        if BATCHABLE_TEXT[cc as usize] && !self.in_non_nesting && !self.in_pre {
          let start = i;
          i += 1;
          let mut had_space = false;
          loop {
            while i < chunk_length && BATCHABLE_TEXT[bytes[i] as usize] {
              i += 1;
            }
            // Doubled, trailing, and pre-tag spaces leave the run to the
            // general path, which keeps its collapsing semantics.
            if i + 1 < chunk_length
              && bytes[i] == SPACE_CHAR
              && BATCHABLE_TEXT[bytes[i + 1] as usize]
            {
              had_space = true;
              i += 2;
              continue;
            }
            break;
          }
          text_buffer.push_str(&chunk[start..i]);
          self.text_buffer_contains_non_whitespace = true;
          if had_space {
            self.text_buffer_contains_whitespace = true;
          }
          self.last_char_was_whitespace = false;
          self.just_closed_tag = false;
          continue;
        }

        // Script/style rawtext is excluded from output. Scan directly to the
        // next potential tag instead of routing every byte through the general
        // text path. Quotes are ordinary rawtext bytes; HTML closes these
        // elements at the first matching end tag (issue #132).
        if self.in_non_nesting
          && (self.depth_map[TAG_SCRIPT as usize] > 0 || self.depth_map[TAG_STYLE as usize] > 0)
        {
          let start = i;
          while i < chunk_length && bytes[i] != LT_CHAR {
            i += 1;
          }
          text_buffer.push_str(&chunk[start..i]);
          self.text_buffer_contains_non_whitespace = true;
          self.last_char_was_whitespace = false;
          self.just_closed_tag = false;
          continue;
        }

        if cc == AMPERSAND_CHAR {
          self.has_encoded_html_entity = true;
        }
        if GFM_BYTE_FLAGS[cc as usize] & GFM_HAZARD_BIT != 0 {
          self.text_buffer_has_inline_gfm_hazard = true;
        }

        if is_whitespace(cc) {
          if self.just_closed_tag {
            self.just_closed_tag = false;
            self.last_char_was_whitespace = false;
          }
          if !self.in_pre && self.last_char_was_whitespace {
            i += 1;
            continue;
          }
          if self.in_pre {
            text_buffer.push(cc as char);
          } else if cc == SPACE_CHAR || !self.last_char_was_whitespace {
            text_buffer.push(' ');
          }
          self.last_char_was_whitespace = true;
          self.text_buffer_contains_whitespace = true;
        } else {
          self.text_buffer_contains_non_whitespace = true;
          self.last_char_was_whitespace = false;
          self.just_closed_tag = false;

          // Structural GFM escaping (|, [, ], > in table/link/blockquote
          // context) is applied at output time in escape_gfm_text, which also
          // covers characters produced by decoded entities that never pass
          // through this parse loop.
          if cc < 0x80 {
            text_buffer.push(cc as char);
          } else if let Some(ch) = chunk[i..].chars().next() {
            text_buffer.push(ch);
            i += ch.len_utf8();

            continue;
          }
        }
        i += 1;
        continue;
      }

      // Processing '<'
      if i + 1 >= chunk_length {
        run_start = i;
        carry = true;
        break;
      }

      // Non-nesting guard: inside script/style/title/textarea, only the
      // matching closing tag exits. All other '<' patterns (comments,
      // non-matching closing tags, opening tags) are treated as literal text.
      if let Some(raw_name) = self.overflow_raw_name.as_deref() {
        let next = bytes[i + 1];
        if next == SLASH_CHAR {
          let peek_start = i + 2;
          let mut peek_end = peek_start;
          while peek_end < chunk_length {
            let c = bytes[peek_end];
            if c == GT_CHAR || c == SLASH_CHAR || is_whitespace(c) {
              break;
            }
            peek_end += 1;
          }
          if peek_end == chunk_length {
            carry = true;
            break;
          }
          let peek_name = &chunk[peek_start..peek_end];
          if raw_name.eq_ignore_ascii_case(peek_name) {
            if !text_buffer.is_empty() {
              self.process_text_buffer(&mut text_buffer);
              text_buffer.clear();
              run_start = i;
            }
            let result = self.process_closing_tag(chunk, i);
            if result.complete {
              i = result.new_position;
            } else {
              carry = true;
              break;
            }
            continue;
          }
        }
        text_buffer.push('<');
        self.text_buffer_contains_non_whitespace = true;
        self.last_char_was_whitespace = false;
        self.just_closed_tag = false;
        i += 1;
        continue;
      }

      if self.in_non_nesting {
        let next = bytes[i + 1];
        if next == SLASH_CHAR {
          let peek_start = i + 2;
          let mut peek_end = peek_start;
          while peek_end < chunk_length {
            let c = bytes[peek_end];
            if c == GT_CHAR || c == SLASH_CHAR || is_whitespace(c) {
              break;
            }
            peek_end += 1;
          }
          if peek_end == chunk_length {
            // The name is cut off by the chunk end, so it cannot be compared
            // yet. Carry the tag; treating '<' as text here would consume a
            // close tag that a later chunk completes.
            run_start = i;
            carry = true;
            break;
          }
          let peek_name = &chunk[peek_start..peek_end];
          let peek_tag_id = crate::consts::get_tag_id_ci_bytes(peek_name.as_bytes());
          if self
            .stack
            .last()
            .is_some_and(|curr| curr.tag_id == peek_tag_id)
          {
            // Matching closing tag: fall through to normal closing tag processing
            if !text_buffer.is_empty() {
              self.process_text_buffer(&mut text_buffer);
              text_buffer.clear();
              run_start = i;
            }
            let result = self.process_closing_tag(chunk, i);
            if result.complete {
              i = result.new_position;
            } else {
              carry = true;
              break;
            }
            continue;
          }
        }
        // Not a matching closing tag: treat '<' as literal text
        text_buffer.push('<');
        self.text_buffer_contains_non_whitespace = true;
        self.last_char_was_whitespace = false;
        self.just_closed_tag = false;
        i += 1;
        continue;
      }

      let next = bytes[i + 1];

      if next == EXCLAMATION_CHAR {
        let remaining = &chunk[i..];
        // CDATA is dropped by default but can be surfaced via
        // tagOverrides["#cdata-section"]. Handle it before the generic
        // comment/doctype scan, which would otherwise stop at the first
        // `>` inside `]]>` and discard the content. We already matched
        // `<!`, so only the `[CDATA[` tail is checked; `strip_prefix`
        // short-circuits on the third byte for the common comment and
        // doctype cases.
        if let Some(after_open) = chunk[i + 2..].strip_prefix("[CDATA[") {
          if let Some(rel) = after_open.find("]]>") {
            if !text_buffer.is_empty() {
              self.process_text_buffer(&mut text_buffer);
              text_buffer.clear();
              run_start = i;
            }
            self.process_cdata_section(&after_open[..rel]);
            i += "<![CDATA[".len() + rel + 3;
            continue;
          }
          // Unterminated CDATA: re-parse from '<' in the next chunk.
          run_start = i;
          carry = true;
          break;
        }
        if remaining.len() < "<![CDATA[".len() && "<![CDATA[".starts_with(remaining) {
          // Chunk boundary fell inside the `<![CDATA[` opener.
          run_start = i;
          carry = true;
          break;
        }
        if !text_buffer.is_empty() {
          self.process_text_buffer(&mut text_buffer);
          text_buffer.clear();
          run_start = i;
        }
        let result = process_comment_or_doctype(chunk, i);
        if result.complete {
          i = result.new_position;
        } else {
          carry = true;
          break;
        }
      } else if next == SLASH_CHAR {
        if !text_buffer.is_empty() {
          self.process_text_buffer(&mut text_buffer);
          text_buffer.clear();
          run_start = i;
        }
        let result = self.process_closing_tag(chunk, i);
        if result.complete {
          i = result.new_position;
        } else {
          carry = true;
          break;
        }
      } else if !next.is_ascii_alphabetic() && next != QUESTION_CHAR {
        // Tag open state starts a tag only on an ASCII letter; `?` opens a bogus
        // comment. Anything else is text, so `I <3 Rust` is not a tag named `3`.
        text_buffer.push(LT_CHAR as char);
        self.text_buffer_contains_non_whitespace = true;
        self.text_buffer_has_inline_gfm_hazard = true;
        self.last_char_was_whitespace = false;
        self.just_closed_tag = false;
        i += 1;
      } else {
        let mut i2 = i + 1;
        let tag_name_start = i2;
        let mut tag_name_end = None;
        while i2 < chunk_length {
          let c = bytes[i2];
          if is_whitespace(c) || c == SLASH_CHAR || c == GT_CHAR {
            tag_name_end = Some(i2);
            break;
          }
          i2 += 1;
        }
        let Some(tag_name_end) = tag_name_end else {
          run_start = i;
          carry = true;
          break;
        };
        let tag_name_raw = &chunk[tag_name_start..tag_name_end];

        // CI lookup first: built-in tags (the common case) skip the
        // lowercase allocation entirely. Only fall back to a Cow when
        // the override path actually needs the lowercased name.
        let builtin_tag_id = crate::consts::get_tag_id_ci_bytes(tag_name_raw.as_bytes());
        let tag_name: Cow<str> = if builtin_tag_id.is_some() {
          Cow::Borrowed(tag_name_raw)
        } else if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
          Cow::Owned(tag_name_raw.to_ascii_lowercase())
        } else {
          Cow::Borrowed(tag_name_raw)
        };
        let tag_id = if builtin_tag_id.is_some() {
          builtin_tag_id
        } else {
          self
            .options
            .plugins
            .as_ref()
            .and_then(|p| p.tag_overrides.as_ref())
            .and_then(|ovs| {
              ovs
                .iter()
                .find(|(k, _)| k == tag_name.as_ref())
                .map(|(_, v)| v)
            })
            .and_then(|ov| ov.alias_tag_id)
        };
        i2 = tag_name_end;

        if !text_buffer.is_empty() {
          self.process_text_buffer(&mut text_buffer);
          text_buffer.clear();
          run_start = i;
        }

        // `process_opening_tag` throws away everything it parsed when the tag
        // is incomplete, so resume the `>` search instead of re-parsing it.
        if let Some(mut pending) = self.pending_tag {
          if !tag_is_complete(chunk, i2, &mut pending) {
            self.pending_tag = Some(pending);
            carry = true;
            break;
          }
          self.pending_tag = None;
        }

        let result =
          self.process_opening_tag(&tag_name, tag_id, builtin_tag_id.is_some(), chunk, i2);
        if result.skip {
          i = result.new_position;
        } else if result.complete {
          i = result.new_position;
          if result.self_closing {
            self.close_node();
            self.just_closed_tag = true;
          } else {
            self.is_first_text_in_element = true;
            if builtin_tag_id == Some(TAG_SCRIPT) {
              match self.process_script_chunk(chunk, i) {
                ScriptChunk::Closed(close_index) => i = close_index,
                ScriptChunk::Carry(from) => {
                  // Carry the raw script tail (from the partial close tag, or
                  // nothing when fully consumed) into the next chunk.
                  run_start = from;
                  carry = true;
                  break;
                }
              }
            }
          }
        } else {
          // Incomplete opening tag. The next chunk resumes the `>` search from
          // here rather than re-parsing the tag from '<'.
          self.pending_tag = Some(PendingTagScan::new());
          carry = true;
          break;
        }
      }
    }

    // An unfinished token stays with the caller RAW from `run_start`, never the
    // parsed `text_buffer` (re-processing would re-derive it). A trailing text
    // run is kept in `text_buffer` instead, so it is parsed once however many
    // chunks it spans.
    let consumed = if carry { run_start } else { chunk_length };
    self.parse_text_buffer = text_buffer;
    consumed
  }

  pub fn get_markdown(&mut self) -> String {
    if self.format == OutputFormat::Html {
      return std::mem::take(&mut self.buffer);
    }
    // ASCII whitespace only, as everywhere else: U+00A0 is content, and the
    // streaming path cannot un-send a nbsp it has already yielded.
    let trimmed_end_len = trim_ascii_whitespace_end(&self.buffer);
    self.buffer.truncate(trimmed_end_len);
    let start = if self.preserve_leading_whitespace {
      0
    } else {
      self.buffer.len() - self.buffer.trim_start().len()
    };
    if start > 0 {
      self.buffer.drain(..start);
    }

    // Apply clean.fragments using recorded positions
    // Build new string copying segments, replacing broken links with text only
    if self.clean_flags & CLEAN_FRAGMENTS != 0 && !self.fragment_links.is_empty() {
      let trim_offset = start;
      let mut result = String::with_capacity(self.buffer.len());
      let mut cursor = 0usize;

      for &(bracket_start, link_end) in &self.fragment_links {
        let adj_start = bracket_start.saturating_sub(trim_offset);
        let adj_end = link_end.saturating_sub(trim_offset);
        if adj_end > self.buffer.len() || adj_start >= adj_end {
          continue;
        }

        // Extract fragment from buffer: [text](#fragment) → find ](#
        let range = &self.buffer[adj_start..adj_end];
        let is_valid = if let Some(hash_pos) = range.find("](#") {
          let frag_start = hash_pos + 3; // skip ](#
          let frag_end = range.len().saturating_sub(1); // skip trailing )
          if frag_start < frag_end {
            let fragment = &range[frag_start..frag_end];
            !self.heading_slugs.is_empty() && self.heading_slugs.iter().any(|s| s == fragment)
          } else {
            false
          }
        } else {
          true // not a fragment link pattern, keep as-is
        };

        if is_valid {
          continue; // keep original, will be copied by cursor
        }

        // Copy everything before this link
        if cursor < adj_start {
          result.push_str(&self.buffer[cursor..adj_start]);
        }
        // Extract and copy just the text (between [ and ])
        if let Some(close_bracket) = range.find("](#") {
          result.push_str(&self.buffer[adj_start + 1..adj_start + close_bracket]);
        }
        cursor = adj_end;
      }

      // Only rebuild if we actually replaced something
      if cursor > 0 {
        if cursor < self.buffer.len() {
          result.push_str(&self.buffer[cursor..]);
        }
        self.buffer = result;
      }
    }
    std::mem::take(&mut self.buffer)
  }

  /// Commit end-of-input state: flush trailing buffered text and close any
  /// elements left open. The streaming parser keeps trailing text and unclosed
  /// elements pending because a later chunk might continue them; at true EOF
  /// they must be committed so trailing content is not dropped (e.g. a document
  /// that ends mid-paragraph like `<p>a<p>b`, or any unclosed fragment).
  ///
  /// `leftover` is the residual returned by the final `process_html`. Pure
  /// trailing text (no leading `<`) is emitted; a residual that is an
  /// incomplete start tag (leading `<`) is dropped, matching the browser
  /// tokenizer's EOF-in-tag behaviour. The text-buffer flags set while the
  /// trailing text was scanned persist on `self`, so `process_text_buffer`
  /// commits it exactly as if the next tag had triggered the flush.
  pub fn finalize(&mut self, leftover: &str) {
    let in_script = self
      .stack
      .last()
      .is_some_and(|node| node.tag_id == Some(TAG_SCRIPT) && node.custom_name.is_none());
    if in_script {
      self.push_script_text(leftover);
      self.flush_script_text();
      self.script_data_state = SCRIPT_DATA;
    } else {
      if !self.parse_text_buffer.is_empty() {
        let mut buf = std::mem::take(&mut self.parse_text_buffer);
        self.process_text_buffer(&mut buf);
        self.parse_text_buffer = buf;
      }
      if !leftover.is_empty() && leftover.as_bytes()[0] != LT_CHAR {
        let mut buf = leftover.to_string();
        self.process_text_buffer(&mut buf);
      }
    }
    while !self.stack.is_empty() {
      self.close_node();
    }
  }

  pub fn get_markdown_chunk(&mut self) -> String {
    if self.format == OutputFormat::Html {
      return std::mem::take(&mut self.buffer);
    }
    self.flush_streaming_blockquote_lines();
    let buf_len = self.buffer.len();
    // Trailing spaces at the buffer end are never final outside <pre>: a later
    // block close (or a dropped empty element followed by a block) trims them,
    // and an inline close arriving next chunk can trim a text node's trailing
    // space. Yielding them would let that later trim silently remove an
    // already-sent byte and shift every byte after it. Always hold them back;
    // they are re-yielded once real content follows, or dropped at finalize.
    let in_pre = self.depth_map[TAG_PRE as usize] != 0;
    let mut stable_end = self.buffer.trim_end_matches(' ').len();
    if in_pre {
      if self.last_text_node_contains_whitespace {
        // A trailing whitespace run in the current text node stays mutable
        // until its inline/code element closes. That close trims ASCII
        // whitespace, so hold the whole run rather than yielding bytes it may
        // retract later.
        stable_end = trim_ascii_whitespace_end(&self.buffer);
      } else if stable_end < buf_len {
        // Other trailing spaces inside <pre> are significant code. A
        // line-leading run is the exception: list continuation indentation is
        // emitted before the next sibling is known and can still be replaced
        // by its list marker.
        let line_leading = stable_end == 0 || self.buffer.as_bytes()[stable_end - 1] == b'\n';
        if !line_leading {
          stable_end = buf_len;
        }
      }
    } else {
      // A block close or document finalization may still trim trailing block
      // spacing. Keep newlines buffered until following content makes them
      // stable, since yielded bytes cannot be retracted. The trims that reach
      // back here take the whole ASCII set, so holding only `\n` and ` ` leaks
      // a trailing tab that a later trim then removes from the buffer alone.
      stable_end = stable_end.min(trim_ascii_whitespace_end(&self.buffer));
    }
    let leading = if self.preserve_leading_whitespace || self.has_streamed_output {
      0
    } else {
      buf_len - self.buffer.trim_start().len()
    };
    // An open inline marker may still be dropped if its element closes empty in a later chunk;
    // hold the buffer at the earliest such marker so already-yielded output is never rewritten.
    // The spaces immediately before it belong to the preceding text node: if the marker is
    // dropped (empty element) and a block boundary then trims that trailing space, a yielded
    // space would be silently removed and shift every later byte. Hold those spaces back too.
    if let Some(&(_, p, _)) = self.open_markers.first() {
      stable_end = stable_end.min(hold_before(&self.buffer, p));
    }
    if let Some(span) = self.code_spans.first() {
      stable_end = stable_end.min(hold_before(&self.buffer, span.output_start));
    }
    if let Some(fence) = &self.code_fence {
      stable_end = stable_end.min(hold_before(&self.buffer, fence.output_start));
    }
    if let Some(frame) = self.blockquotes.first() {
      stable_end = stable_end.min(hold_before(&self.buffer, frame.content_start));
    }
    // An open `<a>`'s close can rewrite the buffer back to `link_bracket_pos`
    // (emptyLinkText drop, selfLinkHeadings, redundantLinks, GFM autolink). Hold the
    // yield boundary there so a link that turns out empty never leaks a stray `[`.
    // As with inline markers, the spaces just before the `[` belong to the
    // preceding text: an empty-link drop followed by a block close trims them,
    // so hold them back too or a yielded space would be silently removed.
    // Mirrors the same guard in `drain_streamed_prefix`.
    if self.depth_map[TAG_A as usize] > 0 {
      stable_end = stable_end.min(hold_before(&self.buffer, self.link_bracket_pos));
    }
    // A marker still alone on its line has its separating newline inserted at
    // the line start when the item resolves, so the line stays mutable.
    if self.empty_item_hazard {
      stable_end = stable_end.min(keep_two_before(&self.buffer, self.empty_item_line_start));
    }
    // A heading's exit escapes the trailing `#` run GFM would read as an ATX
    // closing sequence, so hold the run (and the spacing that decides whether it
    // closes) until the heading is complete.
    if self.in_heading() {
      stable_end = stable_end.min(self.buffer.trim_end_matches(['#', ' ', '\t']).len());
    }
    // `last_yielded_length` is an absolute buffer offset (see drain below).
    let mut start = self.last_yielded_length.max(leading);
    if start >= stable_end {
      self.drain_streamed_prefix();
      return String::new();
    }
    // Offsets here derive from marker positions and drain rebasing that need not
    // fall on a UTF-8 boundary; slicing mid-codepoint panics. Clamp both bounds
    // down to a boundary, holding any partial codepoint for the next chunk.
    while stable_end > start && !self.buffer.is_char_boundary(stable_end) {
      stable_end -= 1;
    }
    while start > 0 && !self.buffer.is_char_boundary(start) {
      start -= 1;
    }
    if start >= stable_end {
      self.drain_streamed_prefix();
      return String::new();
    }
    let new_content = self.buffer[start..stable_end].to_string();
    self.has_streamed_output = true;
    self.last_yielded_length = stable_end;
    self.drain_streamed_prefix();
    new_content
  }

  /// Free already-yielded output so streaming memory stays O(window), not
  /// O(document). Skipped when a whole-document feature (fragment cleaning,
  /// frontmatter, extraction) still needs the full buffer.
  ///
  /// Must never change the emitted bytes. In-buffer rewrites reach back at most
  /// to `link_bracket_pos` (open `<a>`) or `buffer.len() - last_content_cache_len`;
  /// the window below never frees past either, and offsets are rebased on
  /// removal. Rewrites of already-yielded bytes can't be un-sent by any
  /// streaming API and diverge from one-shot regardless of drain. The
  /// `disable_drain` equivalence test guards this without enumerating rewrites.
  fn drain_streamed_prefix(&mut self) {
    #[cfg(test)]
    if self.disable_drain {
      return;
    }
    if self.clean_flags & CLEAN_FRAGMENTS != 0 || self.has_frontmatter || self.has_extraction {
      return;
    }
    // Keep the tail a late rewrite may still touch, and never drop the `[` of an
    // open link (its close can rewrite from that offset).
    // Formatting also inspects the last two bytes to count existing newlines.
    // Keep enough for the widest GFM list marker too: up to three spaces, nine
    // digits, a delimiter, and a trailing space. Row separation can then still
    // recognize a marker after earlier output has drained.
    let mut retained_tail_start = self
      .buffer
      .len()
      .saturating_sub(self.last_content_cache_len.max(14));
    while !self.buffer.is_char_boundary(retained_tail_start) {
      retained_tail_start -= 1;
    }
    let mut drain_end = self.last_yielded_length.min(retained_tail_start);
    // An empty link or inline marker closing in a later chunk truncates the
    // buffer back to its reach-back point (`link_bracket_pos` / `output_start`).
    // The next block then counts its leading newlines from the two bytes ending
    // there (see `write_output`, which inspects only the last two), so keep
    // those two bytes; otherwise a dropped element leaks an extra newline in
    // streaming.
    if self.depth_map[TAG_A as usize] > 0 {
      drain_end = drain_end.min(keep_two_before(&self.buffer, self.link_bracket_pos));
    }
    if let Some(&(_, output_start, _)) = self.open_markers.first() {
      drain_end = drain_end.min(keep_two_before(&self.buffer, output_start));
    }
    if let Some(span) = self.code_spans.first() {
      drain_end = drain_end.min(keep_two_before(&self.buffer, span.output_start));
    }
    if let Some(fence) = &self.code_fence {
      drain_end = drain_end.min(keep_two_before(&self.buffer, fence.output_start));
    }
    if let Some(frame) = self.blockquotes.first() {
      drain_end = drain_end.min(keep_two_before(&self.buffer, frame.content_start));
    }
    // Settle a pending marker-line guard when the item's first content already
    // answers it, so the hold below never outlives the marker's own line.
    self.resolve_item_marker(false);
    if self.empty_item_hazard {
      drain_end = drain_end.min(keep_two_before(&self.buffer, self.empty_item_line_start));
    }
    if drain_end == 0 {
      return;
    }
    if self.wrap_width != 0 {
      let drained = &self.buffer[..drain_end];
      self.buffer_start_column = if let Some(last_newline) = drained.rfind('\n') {
        drained[last_newline + 1..].chars().count()
      } else {
        self
          .buffer_start_column
          .saturating_add(drained.chars().count())
      };
    }
    // The blank line that ends a raw-HTML region may sit in the bytes about to
    // leave; dropped unscanned, the region never closes and keeps suspending the
    // escapes one-shot writes.
    if self.raw_html_scanned_to < drain_end && !self.raw_html_markdown && self.in_raw_html_block() {
      self.track_raw_html_markdown_context(drain_end);
    }
    let bytes = self.buffer.as_bytes();
    self.flushed_tail = if drain_end >= 2 {
      [bytes[drain_end - 2], bytes[drain_end - 1]]
    } else {
      [self.flushed_tail[1], bytes[0]]
    };
    // Remember what the line being cut leads with; a line opened before an
    // earlier drain keeps that answer across successive cuts.
    self.cut_line_lead = if bytes[drain_end - 1] == b'\n' {
      CutLineLead::Blank
    } else {
      let (line, inherited) = match bytes[..drain_end].iter().rposition(|b| *b == b'\n') {
        Some(at) => (&bytes[at + 1..drain_end], CutLineLead::Blank),
        None => (&bytes[..drain_end], self.cut_line_lead),
      };
      if matches!(
        inherited,
        CutLineLead::RawHtml | CutLineLead::Row | CutLineLead::Content
      ) {
        inherited
      } else {
        line
          .iter()
          .copied()
          .find(|b| !matches!(b, b' ' | b'\t'))
          .map_or(CutLineLead::Blank, |byte| match byte {
            b'<' => CutLineLead::RawHtml,
            b'|' => CutLineLead::Row,
            _ => CutLineLead::Content,
          })
      }
    };
    self.buffer.drain(..drain_end);
    self.last_yielded_length -= drain_end;
    self.link_bracket_pos = self.link_bracket_pos.saturating_sub(drain_end);
    for (_, output_start, content_start) in &mut self.open_markers {
      *output_start -= drain_end;
      *content_start -= drain_end;
    }
    for span in &mut self.code_spans {
      span.output_start -= drain_end;
      span.content_start -= drain_end;
    }
    if let Some(fence) = &mut self.code_fence {
      fence.output_start -= drain_end;
      fence.content_start -= drain_end;
    }
    for frame in &mut self.blockquotes {
      frame.content_start -= drain_end;
    }
    self.empty_item_line_start = self.empty_item_line_start.saturating_sub(drain_end);
    self.empty_item_len = self.empty_item_len.saturating_sub(drain_end);
    // Buffer-indexed like every other stored offset: left alone, streaming reads
    // a different line start than one-shot.
    self.raw_html_scanned_to = self.raw_html_scanned_to.saturating_sub(drain_end);
    self.line_start = self.line_start.saturating_sub(drain_end);
    self.line_start_scanned_to = self.line_start_scanned_to.saturating_sub(drain_end);
  }
}

/// Highest offset that holds back everything from `at`, plus the blank run just
/// before it that a rewrite reaching back there can trim. Floored like
/// `keep_two_before`, so a drifted `at` never slices mid-codepoint.
fn hold_before(buf: &str, at: usize) -> usize {
  let mut i = at.min(buf.len());
  while !buf.is_char_boundary(i) {
    i -= 1;
  }
  buf[..i].trim_end_matches(['\n', ' ']).len()
}

/// Highest offset that still keeps the two bytes before `at` in the buffer, for
/// a rewrite that can reach back there. Floored to a UTF-8 boundary, so the
/// result is always safe to slice at even if `at` has drifted past the end.
fn keep_two_before(buf: &str, at: usize) -> usize {
  let mut i = at.saturating_sub(2);
  while i > 0 && !buf.is_char_boundary(i) {
    i -= 1;
  }
  i
}

// Internal result structs
// ========================================================================

pub(crate) struct OpeningTagResult {
  complete: bool,
  new_position: usize,
  self_closing: bool,
  skip: bool,
}

pub(crate) struct CloseTagResult {
  complete: bool,
  new_position: usize,
}
