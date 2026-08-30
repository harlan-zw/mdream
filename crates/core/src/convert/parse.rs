//! HTML parsing: tag scanning, node lifecycle, text-buffer processing.

use super::*;

// Keep rich element nodes to the same practical depth as browsers. One exact
// flattened root preserves balanced recovery beyond it without allowing
// untrusted nesting to grow memory forever.
const MAX_ELEMENT_DEPTH: usize = 512;

/// Tags valid inside `<head>` per the HTML parser's "in head" insertion mode.
/// Any other start tag implies the end of `<head>` and the start of the body, so
/// an unclosed head is auto-closed when one appears. Unknown tags (`None`) are
/// treated as body content, matching the spec's "anything else" rule. `<head>` is
/// deliberately excluded: a second/nested head must close the first rather than
/// stack, so malformed `<head><head>...<p>` does not trap body flow under an
/// outer head.
fn is_head_content_tag(tag_id: Option<u8>) -> bool {
  matches!(
    tag_id,
    Some(
      TAG_TITLE
        | TAG_META
        | TAG_LINK
        | TAG_BASE
        | TAG_STYLE
        | TAG_SCRIPT
        | TAG_NOSCRIPT
        | TAG_TEMPLATE
    )
  )
}

/// Start tags that cannot appear inside a `<p>` and therefore imply its end
/// (HTML §13.1.2.4 optional tags + the "in body" insertion mode, where these
/// tags first close an open `<p>` in button scope). Block containers, headings,
/// lists, tables, and the list-item/definition tags all close an open `<p>`.
///
/// A compile-time `[bool; MAX_TAG_ID]` table, not a `match`: this is evaluated
/// for every start tag opened while a `<p>` is on the stack (most inline tags in
/// prose), so the hot path is a single indexed load, matching the table-driven
/// style of `TAG_HANDLERS` and `depth_map`.
const CLOSES_P: [bool; MAX_TAG_ID] = {
  let mut t = [false; MAX_TAG_ID];
  t[TAG_DIV as usize] = true;
  t[TAG_P as usize] = true;
  t[TAG_UL as usize] = true;
  t[TAG_OL as usize] = true;
  t[TAG_DL as usize] = true;
  t[TAG_LI as usize] = true;
  t[TAG_DD as usize] = true;
  t[TAG_DT as usize] = true;
  t[TAG_TABLE as usize] = true;
  t[TAG_H1 as usize] = true;
  t[TAG_H2 as usize] = true;
  t[TAG_H3 as usize] = true;
  t[TAG_H4 as usize] = true;
  t[TAG_H5 as usize] = true;
  t[TAG_H6 as usize] = true;
  t[TAG_BLOCKQUOTE as usize] = true;
  t[TAG_SECTION as usize] = true;
  t[TAG_ARTICLE as usize] = true;
  t[TAG_HEADER as usize] = true;
  t[TAG_FOOTER as usize] = true;
  t[TAG_NAV as usize] = true;
  t[TAG_ASIDE as usize] = true;
  t[TAG_PRE as usize] = true;
  t[TAG_HR as usize] = true;
  t[TAG_FORM as usize] = true;
  t[TAG_FIELDSET as usize] = true;
  t[TAG_FIGURE as usize] = true;
  t[TAG_FIGCAPTION as usize] = true;
  t[TAG_ADDRESS as usize] = true;
  t[TAG_MAIN as usize] = true;
  t[TAG_CENTER as usize] = true;
  t[TAG_DETAILS as usize] = true;
  t[TAG_SUMMARY as usize] = true;
  t[TAG_DIALOG as usize] = true;
  t
};

/// Start tags that can trigger any implied-end-tag recovery branch below. The
/// common inline tags (`code`, `em`, `span`, ...) otherwise skip the whole
/// recovery dispatch instead of loading unrelated depth counters and matching
/// through recovery-only cases on every start tag.
const NEEDS_IMPLIED_END_RECOVERY: [bool; MAX_TAG_ID] = {
  let mut t = CLOSES_P;
  t[TAG_A as usize] = true;
  t[TAG_TD as usize] = true;
  t[TAG_TH as usize] = true;
  t[TAG_TR as usize] = true;
  t[TAG_THEAD as usize] = true;
  t[TAG_TBODY as usize] = true;
  t[TAG_TFOOT as usize] = true;
  t[TAG_OPTION as usize] = true;
  t[TAG_OPTGROUP as usize] = true;
  t[TAG_SELECT as usize] = true;
  t
};

#[inline]
fn closes_p(tag_id: u8) -> bool {
  CLOSES_P[tag_id as usize]
}

#[inline]
fn needs_implied_end_recovery(tag_id: u8) -> bool {
  (tag_id as usize) < MAX_TAG_ID && NEEDS_IMPLIED_END_RECOVERY[tag_id as usize]
}

/// Build a tag lookup table. Sized 256 rather than `MAX_TAG_ID` so indexing by
/// any `u8` is in bounds by construction: no bounds check, no panic path.
const fn tag_set(ids: &[u8]) -> [bool; 256] {
  let mut t = [false; 256];
  let mut i = 0;
  while i < ids.len() {
    t[ids[i] as usize] = true;
    i += 1;
  }
  t
}

/// "Button scope" terminators for closing a `<p>`: scanning up the open stack
/// stops here so a `<p>` outside a table cell is never closed from inside one.
/// `UL`/`OL`/`DL`/`LI` are added (a deviation from the bare spec list) to keep
/// scans short; a `<p>` is always closed before any of these can become its
/// ancestor, so they never hide a closable `<p>`.
const P_SCOPE_BOUNDARY: [bool; 256] = tag_set(&[
  TAG_BUTTON,
  TAG_TD,
  TAG_TH,
  TAG_CAPTION,
  TAG_TABLE,
  TAG_TEMPLATE,
  TAG_HTML,
  TAG_UL,
  TAG_OL,
  TAG_DL,
  TAG_LI,
]);

/// "List item scope" terminators for closing a `<li>`: a new `<li>` closes the
/// previous one only within the same list, never across a nested list or table.
const LI_SCOPE_BOUNDARY: [bool; 256] = tag_set(&[
  TAG_UL,
  TAG_OL,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_CAPTION,
  TAG_TEMPLATE,
  TAG_HTML,
]);

/// Scope terminators for closing a `<dt>`/`<dd>`: each closes the other within
/// the same `<dl>`, never crossing into a nested list or table.
const DL_SCOPE_BOUNDARY: [bool; 256] = tag_set(&[
  TAG_DL,
  TAG_UL,
  TAG_OL,
  TAG_LI,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_CAPTION,
  TAG_TEMPLATE,
  TAG_HTML,
]);

/// "Table cell scope" terminators: a new `<td>`/`<th>` closes the current cell
/// (and any inline content left open inside it), stopping at the row/section.
const CELL_SCOPE_BOUNDARY: [bool; 256] = tag_set(&[
  TAG_TR,
  TAG_THEAD,
  TAG_TBODY,
  TAG_TFOOT,
  TAG_TABLE,
  TAG_CAPTION,
  TAG_TEMPLATE,
  TAG_HTML,
]);

/// Block-level terminators for closing an `<a>`: a nested `<a>` closes the open
/// one (HTML forbids nested anchors — the adoption agency closes the outer),
/// but only within the same block so a stray open `<a>` in another block is left
/// alone. Closing intervening inline formatting matches the spec's reconstruction.
const A_SCOPE_BOUNDARY: [bool; 256] = tag_set(&[
  TAG_P,
  TAG_DIV,
  TAG_LI,
  TAG_UL,
  TAG_OL,
  TAG_DL,
  TAG_DD,
  TAG_DT,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_TR,
  TAG_CAPTION,
  TAG_BLOCKQUOTE,
  TAG_SECTION,
  TAG_ARTICLE,
  TAG_HEADER,
  TAG_FOOTER,
  TAG_NAV,
  TAG_ASIDE,
  TAG_MAIN,
  TAG_FORM,
  TAG_FIELDSET,
  TAG_FIGURE,
  TAG_BUTTON,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_TEMPLATE,
  TAG_HTML,
]);

/// Close targets use the same table form so the scan loop makes no indirect call.
const TARGET_A: [bool; 256] = tag_set(&[TAG_A]);
const TARGET_P: [bool; 256] = tag_set(&[TAG_P]);
const TARGET_LI: [bool; 256] = tag_set(&[TAG_LI]);
const TARGET_CELL: [bool; 256] = tag_set(&[TAG_TD, TAG_TH]);
const TARGET_DT_DD: [bool; 256] = tag_set(&[TAG_DT, TAG_DD]);

const ROW_CLOSEABLE: [bool; 256] = tag_set(&[TAG_TD, TAG_TH, TAG_TR]);

const SECTION_CLOSEABLE: [bool; 256] = tag_set(&[
  TAG_TD,
  TAG_TH,
  TAG_TR,
  TAG_THEAD,
  TAG_TBODY,
  TAG_TFOOT,
  TAG_CAPTION,
]);

/// Allows one optional space, so `display:none` and `display: none` both match.
#[inline]
fn style_value_at(bytes: &[u8], index: usize, prop: &[u8]) -> Option<usize> {
  let end = index + prop.len();
  if end > bytes.len() || &bytes[index..end] != prop {
    return None;
  }
  Some(end + usize::from(bytes.get(end) == Some(&SPACE_CHAR)))
}

/// Single pass over the declarations, dispatching on the property's first byte.
fn style_hides(style: &str) -> bool {
  let bytes = style.as_bytes();
  let mut index = 0usize;
  while index < bytes.len() {
    match bytes[index] {
      b'd' => {
        if let Some(value) = style_value_at(bytes, index, b"display:")
          && bytes[value..].starts_with(b"none")
        {
          return true;
        }
      }
      b'v' => {
        if let Some(value) = style_value_at(bytes, index, b"visibility:")
          && bytes[value..].starts_with(b"hidden")
        {
          return true;
        }
      }
      b'p' => {
        if let Some(value) = style_value_at(bytes, index, b"position:")
          && (bytes[value..].starts_with(b"absolute") || bytes[value..].starts_with(b"fixed"))
        {
          return true;
        }
      }
      _ => {}
    }
    index += 1;
  }
  false
}

/// Whether an element is visually hidden, so the filter should drop it and its
/// subtree: inline `display:none` / `visibility:hidden` / `position:absolute|fixed`,
/// or the `hidden` attribute (except `hidden="until-found"`).
///
/// Matches the actual `display:`/`visibility:`/`position:` declaration (not bare
/// keywords like `fixed`, which would false-match e.g. `background-attachment:fixed`)
/// and both unspaced and `: `-spaced forms. Allocation-free; uppercased
/// properties (rare in inline styles) are not handled.
fn is_hidden(node: &ElementNode) -> bool {
  if let Some(style) = node.attributes.get("style")
    && style_hides(style)
  {
    return true;
  }
  // The `hidden` attribute hides the element unless it's the revealable
  // `until-found` state (an enumerated keyword, so ASCII case-insensitive).
  matches!(node.attributes.get("hidden"), Some(v) if !v.eq_ignore_ascii_case("until-found"))
}

impl ConvertState {
  fn matches_overflow_tag(&self, tag_name: &str, tag_id: Option<u8>, is_builtin: bool) -> bool {
    if is_builtin {
      self.overflow_tag_id == tag_id
    } else {
      self.overflow_custom_name.as_deref() == Some(tag_name)
    }
  }

  fn enter_overflow(
    &mut self,
    tag_name: &str,
    tag_id: Option<u8>,
    is_builtin: bool,
    tag_handler: Option<&TagHandler>,
    included: bool,
  ) {
    self.overflow_tag_id = is_builtin.then_some(tag_id).flatten();
    self.overflow_custom_name = (!is_builtin).then(|| tag_name.to_string());
    self.overflow_same_name_depth = 1;
    self.overflow_included = included;
    if tag_handler.is_some_and(|handler| handler.is_non_nesting) {
      self.overflow_raw_name = Some(tag_name.to_string());
      self.overflow_raw_excludes_text =
        tag_handler.is_some_and(|handler| handler.excludes_text_nodes);
    }
  }

  fn clear_overflow(&mut self) {
    self.overflow_tag_id = None;
    self.overflow_custom_name = None;
    self.overflow_same_name_depth = 0;
    self.overflow_included = false;
    self.overflow_raw_name = None;
    self.overflow_raw_excludes_text = false;
  }

  fn matches_opaque_tag(&self, tag_name: &str) -> bool {
    self
      .overflow_opaque_name
      .as_deref()
      .is_some_and(|name| name.eq_ignore_ascii_case(tag_name))
  }

  fn enter_opaque_overflow(&mut self, tag_name: &str, tag_handler: Option<&TagHandler>) {
    self.overflow_opaque_name = Some(tag_name.to_string());
    self.overflow_opaque_depth = 1;
    if tag_handler.is_some_and(|handler| handler.is_non_nesting) {
      self.overflow_raw_name = Some(tag_name.to_string());
      self.overflow_raw_excludes_text =
        tag_handler.is_some_and(|handler| handler.excludes_text_nodes);
    }
  }

  fn clear_opaque_overflow(&mut self) {
    self.overflow_opaque_name = None;
    self.overflow_opaque_depth = 0;
  }

  fn overflow_plugin_mode(
    &self,
    tag_name: &str,
    tag_id: Option<u8>,
    is_builtin: bool,
    attributes: &crate::types::Attributes,
    tag_handler: Option<&TagHandler>,
  ) -> u8 {
    if !self.has_filter && !self.has_tailwind {
      return 0;
    }
    if self.hidden_since_depth.is_some()
      || self.depth_map[TAG_TEMPLATE as usize] > 0
      || self
        .stack
        .last()
        .and_then(|node| node.tailwind.as_ref())
        .is_some_and(|tailwind| tailwind.hidden)
    {
      return 1;
    }
    let handler = tag_handler.copied().unwrap_or(TagHandler {
      is_self_closing: false,
      is_non_nesting: false,
      collapses_inner_white_space: false,
      is_inline: true,
      spacing: Some(NO_SPACING),
      excludes_text_nodes: false,
      wanted_attrs: ATTR_NONE,
    });
    let node = ElementNode {
      attributes: attributes.clone(),
      tailwind: None,
      custom_name: (!is_builtin).then(|| tag_name.to_string()),
      depth: self.depth + 1,
      index: 0,
      current_walk_index: 0,
      child_text_node_index: 0,
      tag_id,
      contains_whitespace: false,
      excluded_from_markdown: false,
      is_inline: handler.is_inline,
      excludes_text_nodes: handler.excludes_text_nodes,
      is_non_nesting: handler.is_non_nesting,
      collapses_inner_white_space: handler.collapses_inner_white_space,
      spacing: handler.spacing,
    };
    if self.has_tailwind
      && node
        .attributes
        .get("class")
        .is_some_and(|class| process_tailwind_classes(class).2)
    {
      return 1;
    }
    if !self.has_filter {
      return 0;
    }
    if is_hidden(&node)
      || self
        .filter_exclude_parsed
        .iter()
        .any(|(_, parsed)| matches_selector_list(&node, parsed))
    {
      return 1;
    }
    u8::from(
      self
        .filter_include_parsed
        .iter()
        .any(|(_, parsed)| matches_selector_list(&node, parsed)),
    ) * 2
  }

  pub(crate) fn process_text_buffer(&mut self, text_buffer: &mut String) {
    self.process_text_buffer_piece(text_buffer, true);
  }

  /// Emit buffered text. Internal size flushes split one source text node into
  /// pieces, so they defer advancing the parent's child index until the run ends.
  pub(crate) fn process_text_buffer_piece(
    &mut self,
    text_buffer: &mut String,
    completes_text_node: bool,
  ) {
    let contains_non_whitespace = self.text_buffer_contains_non_whitespace;
    let contains_whitespace = self.text_buffer_contains_whitespace;
    let has_inline_gfm_hazard =
      self.text_buffer_has_inline_gfm_hazard || self.has_encoded_html_entity;
    self.text_buffer_contains_non_whitespace = false;
    self.text_buffer_contains_whitespace = false;
    self.text_buffer_batchable_len = 0;
    self.text_buffer_has_inline_gfm_hazard = false;

    // No parent element means this is a top-level (root) text node, e.g. the
    // leading `foo ` in the fragment `foo <sup>bar</sup>`. Such text must
    // still be emitted rather than dropped (issue #93).
    let overflow_excludes_text = self
      .overflow_tag_id
      .and_then(get_tag_handler)
      .is_some_and(|handler| handler.excludes_text_nodes);
    let mut excludes_text_nodes = self.overflow_opaque_depth > 0
      || self.overflow_raw_excludes_text
      || overflow_excludes_text
      || self.stack.last().is_some_and(|parent| {
        parent.excludes_text_nodes || (!self.overflow_included && parent.excluded_from_markdown)
      });

    if self.has_isolate_main {
      if self.isolate_main_found {
        if self.isolate_main_closed {
          excludes_text_nodes = true;
        }
      } else if self.isolate_first_header_depth.is_none() {
        if self.depth_map[TAG_HEAD as usize] == 0 {
          excludes_text_nodes = true;
        }
      } else if self.isolate_after_footer {
        excludes_text_nodes = true;
      }
    }

    if self.has_frontmatter
      && self.frontmatter_in_head
      && !excludes_text_nodes
      && self
        .stack
        .last()
        .is_some_and(|p| p.tag_id == Some(TAG_TITLE))
    {
      let val = text_buffer.trim().to_string();
      if !val.is_empty() {
        self.frontmatter_title = Some(val);
      }
      text_buffer.clear();
      return;
    }

    let in_pre_tag = self.in_pre;
    let child_text_node_index = self.stack.last().map_or(0, |n| n.child_text_node_index);

    // Whitespace-only text before an element's first child is indentation and
    // can be dropped. At the fragment root it can instead separate adjacent
    // inline siblings, so emit it and let the output layer trim or absorb it at
    // leading/trailing and block boundaries.
    if !in_pre_tag
      && !contains_non_whitespace
      && child_text_node_index == 0
      && !self.stack.is_empty()
    {
      return;
    }
    if text_buffer.is_empty() {
      return;
    }

    let first_block_parent_index = self.first_block_parent_index;
    let first_block_child_text_count =
      first_block_parent_index.map_or(0, |idx| self.stack[idx].child_text_node_index);

    let mut text = std::mem::take(text_buffer);
    let mut tailwind_prefix = None;
    let mut tailwind_suffix = None;
    let is_first_text_in_block = first_block_child_text_count == 0
      && (first_block_parent_index.is_some()
        || self.buffer.is_empty()
        || self.buffer.as_bytes().last() == Some(&b'\n'));
    if contains_whitespace && is_first_text_in_block {
      let mut start = 0;
      let bytes = text.as_bytes();
      while start < bytes.len()
        && (if in_pre_tag {
          bytes[start] == NEWLINE_CHAR || bytes[start] == CARRIAGE_RETURN_CHAR
        } else {
          is_whitespace(bytes[start])
        })
      {
        start += 1;
      }
      if start > 0 {
        text.drain(..start);
      }
    }

    if self.has_encoded_html_entity {
      let protect_decoded_entity_references = self.format == OutputFormat::Markdown
        && self.depth_map[TAG_PRE as usize] == 0
        && self.depth_map[TAG_CODE as usize] == 0
        && !self.in_raw_html_block();
      let decoded = if protect_decoded_entity_references {
        decode_html_entities_for_markdown(&text)
      } else {
        decode_html_entities(&text)
      };
      if let Cow::Owned(decoded) = decoded {
        text = decoded;
      }
      self.has_encoded_html_entity = false;
    }

    if self.has_tailwind
      && let Some(parent) = self.stack.last()
      && let Some(tw) = &parent.tailwind
    {
      if tw.hidden {
        excludes_text_nodes = true;
      } else if !excludes_text_nodes {
        tailwind_prefix.clone_from(&tw.prefix);
        tailwind_suffix.clone_from(&tw.suffix);
      }
    }

    if !self.extraction_tracked.is_empty() {
      let current_depth = self.stack.len();
      for tracked in &mut self.extraction_tracked {
        if tracked.stack_depth <= current_depth {
          tracked.text_content.push_str(&text);
        }
      }
    }

    if !excludes_text_nodes {
      let depth = self.depth;
      let index = self.stack.last().map_or(0, |n| n.current_walk_index);
      self.text_buffer_has_inline_gfm_hazard = has_inline_gfm_hazard;
      if self.link_empty_text_pending && !text.trim().is_empty() {
        self.link_empty_text_pending = false;
      }
      self.emit_text_with_generated_markdown(
        &text,
        contains_whitespace,
        depth,
        index,
        tailwind_prefix.as_deref(),
        tailwind_suffix.as_deref(),
      );
    }

    // Recover String allocation
    text.clear();
    *text_buffer = text;

    if completes_text_node {
      if let Some(parent) = self.stack.last_mut() {
        parent.current_walk_index += 1;
      }

      let up_to = first_block_parent_index.unwrap_or(0);
      for idx in up_to..self.stack.len() {
        self.stack[idx].child_text_node_index += 1;
      }
    }
  }

  /// Close open nodes from the top of the stack up to and including the nearest
  /// node matching `target`, but only if it is found before `boundary` (in which
  /// case nothing is closed). Implements implied end tags for `<p>`, `<li>`, and
  /// `<dt>`/`<dd>`: the intervening unmatched nodes (inline formatting, unknown
  /// elements) are closed along the way, mirroring the spec's "generate implied
  /// end tags" step.
  fn close_implied_to(&mut self, target: &[bool; 256], boundary: &[bool; 256]) {
    if self.overflow_same_name_depth > 0 {
      if let Some(id) = self.overflow_tag_id {
        if target[id as usize] {
          self.clear_overflow();
          return;
        }
        if boundary[id as usize] {
          return;
        }
      }
      self.clear_overflow();
    }
    let mut close_count = 0usize;
    let mut found = false;
    for node in self.stack.iter().rev() {
      match node.tag_id {
        Some(id) if target[id as usize] => {
          close_count += 1;
          found = true;
          break;
        }
        Some(id) if boundary[id as usize] => break,
        _ => close_count += 1,
      }
    }
    if found {
      for _ in 0..close_count {
        self.close_node();
      }
    }
  }

  /// Close open table-internal nodes (cells, rows, sections) from the top while
  /// they match `closeable`, stopping at the first node that does not (e.g. the
  /// enclosing `<table>`). Implements implied end tags for `<tr>` (closes an open
  /// cell + row) and `<thead>`/`<tbody>`/`<tfoot>` (closes cell + row + section).
  fn close_table_context(&mut self, closeable: &[bool; 256]) {
    if self.overflow_same_name_depth > 0 {
      let close_root = self
        .overflow_tag_id
        .is_some_and(|id| closeable[id as usize]);
      if !close_root {
        return;
      }
      self.clear_overflow();
    }

    // One reverse pass, as in `close_implied_to`: re-deciding after each close
    // walks the stack once per closed node.
    let mut close_count = 0usize;
    let mut walked = 0usize;
    for node in self.stack.iter().rev() {
      match node.tag_id {
        Some(id) if closeable[id as usize] => {
          walked += 1;
          close_count = walked;
        }
        // Content left open inside a cell (`<td><p>text` with no `</p>`, or an
        // unknown custom element) sits above the closeable element and closes
        // with it; stopping here would leave the new row nested in the old cell.
        Some(TAG_TABLE | TAG_TEMPLATE | TAG_CAPTION) => break,
        _ => walked += 1,
      }
    }
    for _ in 0..close_count {
      self.close_node();
    }
  }

  /// Close the nearest select-related `target_id`. Option/optgroup scans stop
  /// at their owning `<select>`; a select scan includes the select itself. This
  /// only runs for recovery tags, leaving the common path as one table lookup.
  fn close_select_to(&mut self, target_id: u8) -> bool {
    if self.overflow_same_name_depth > 0 {
      if let Some(id) = self.overflow_tag_id {
        if id == target_id {
          self.clear_overflow();
          return true;
        }
        if (id == TAG_SELECT && target_id != TAG_SELECT) || id == TAG_TEMPLATE {
          return false;
        }
      }
      self.clear_overflow();
    }
    let mut target_index = None;
    for i in (0..self.stack.len()).rev() {
      match self.stack[i].tag_id {
        Some(id) if id == target_id => {
          target_index = Some(i);
          break;
        }
        Some(TAG_SELECT) if target_id != TAG_SELECT => break,
        Some(TAG_TEMPLATE) => break,
        _ => {}
      }
    }
    if let Some(index) = target_index {
      while self.stack.len() > index {
        self.close_node();
      }
      true
    } else {
      false
    }
  }

  fn parser_tag_depth(&self, tag_id: u8) -> usize {
    self.depth_map[tag_id as usize] as usize + usize::from(self.overflow_tag_id == Some(tag_id))
  }

  fn parser_last_tag_id(&self) -> Option<u8> {
    self
      .overflow_tag_id
      .or_else(|| self.stack.last().and_then(|node| node.tag_id))
  }

  fn pop_parser_top(&mut self) {
    if self.overflow_same_name_depth > 0 {
      self.clear_overflow();
    } else {
      self.close_node();
    }
  }

  pub(crate) fn process_opening_tag(
    &mut self,
    tag_name: &str,
    tag_id: Option<u8>,
    is_builtin: bool,
    html_chunk: &str,
    position: usize,
  ) -> OpeningTagResult {
    let tag_handler = tag_id.and_then(get_tag_handler);
    // Plugins can read any attribute, so they force full capture. `frontmatter`
    // is absent deliberately: TAG_META's own mask already covers what it reads.
    let attr_mask =
      if self.has_tailwind || self.has_filter || self.has_extraction || self.has_tag_overrides {
        ATTR_ALL
      } else {
        tag_handler.map_or(ATTR_NONE, |h| h.wanted_attrs)
      };
    let (complete, new_position, attributes, self_closing) =
      process_tag_attributes(html_chunk, position, tag_handler, attr_mask);

    if !complete {
      return OpeningTagResult {
        complete: false,
        new_position: position,
        self_closing: false,
        skip: false,
      };
    }

    if self.overflow_opaque_depth > 0 {
      if !self_closing && self.matches_opaque_tag(tag_name) {
        self.overflow_opaque_depth = self.overflow_opaque_depth.saturating_add(1);
      } else if !self_closing && tag_handler.is_some_and(|handler| handler.is_non_nesting) {
        self.overflow_raw_name = Some(tag_name.to_string());
        self.overflow_raw_excludes_text =
          tag_handler.is_some_and(|handler| handler.excludes_text_nodes);
      }
      return OpeningTagResult {
        complete: true,
        new_position,
        self_closing,
        skip: true,
      };
    }

    // Browser recovery: a non-head start tag while <head> is still open means the
    // page never closed its head (no </head>/<body>). Auto-close head (and anything
    // wrongly opened inside it) so body content parses as flow content with normal
    // block spacing instead of inheriting head's whitespace collapsing.
    if self.overflow_same_name_depth == 0
      && self.depth_map[TAG_HEAD as usize] > 0
      && self.depth_map[TAG_TEMPLATE as usize] == 0
      && !is_head_content_tag(tag_id)
    {
      while self
        .stack
        .last()
        .is_some_and(|n| n.tag_id != Some(TAG_HEAD))
      {
        self.close_node();
      }
      if self
        .stack
        .last()
        .is_some_and(|n| n.tag_id == Some(TAG_HEAD))
      {
        self.close_node();
      }
    }

    // Browser recovery: implied end tags (HTML §13.1.2.4 optional tags +
    // tree-construction). Common malformed-but-valid markup omits end tags
    // (`<p>a<p>b`, `<li>a<li>b`, `<td>a<td>b`, `<dt>t<dd>d`); auto-close the
    // open element so the new sibling is not wrongly nested. Runs after the
    // tag is confirmed complete (above) so a chunk-split start tag never
    // mutates parser state or emits a premature close.
    if let Some(id) = tag_id
      && needs_implied_end_recovery(id)
    {
      match id {
        // In the "in select" insertion mode a nested <select> acts as the end
        // of the open select; the incoming start tag itself is ignored.
        TAG_SELECT if self.parser_tag_depth(TAG_SELECT) > 0 => {
          if self.close_select_to(TAG_SELECT) {
            return OpeningTagResult {
              complete: true,
              new_position,
              self_closing: false,
              skip: true,
            };
          }
        }
        TAG_OPTION => {
          if self.parser_tag_depth(TAG_SELECT) > 0 {
            self.close_select_to(TAG_OPTION);
          } else if self.parser_last_tag_id() == Some(TAG_OPTION) {
            self.pop_parser_top();
          }
        }
        TAG_OPTGROUP if self.parser_tag_depth(TAG_SELECT) > 0 => {
          self.close_select_to(TAG_OPTION);
          self.close_select_to(TAG_OPTGROUP);
        }
        // A nested <a> closes the open one (anchors cannot nest), so the
        // markdown is two adjacent links rather than invalid nested `[..]`.
        TAG_A if self.parser_tag_depth(TAG_A) > 0 => {
          self.close_implied_to(&TARGET_A, &A_SCOPE_BOUNDARY);
        }
        TAG_TD | TAG_TH | TAG_TR | TAG_THEAD | TAG_TBODY | TAG_TFOOT
          if self.parser_tag_depth(TAG_TABLE) > 0 =>
        {
          match id {
            TAG_TD | TAG_TH
              if self.parser_tag_depth(TAG_TD) > 0 || self.parser_tag_depth(TAG_TH) > 0 =>
            {
              self.close_implied_to(&TARGET_CELL, &CELL_SCOPE_BOUNDARY);
            }
            TAG_TR if self.parser_tag_depth(TAG_TR) > 0 => {
              self.close_table_context(&ROW_CLOSEABLE);
            }
            TAG_THEAD | TAG_TBODY | TAG_TFOOT => {
              self.close_table_context(&SECTION_CLOSEABLE);
            }
            _ => {}
          }
        }
        TAG_A | TAG_TD | TAG_TH | TAG_TR | TAG_THEAD | TAG_TBODY | TAG_TFOOT | TAG_OPTGROUP
        | TAG_SELECT => {}
        _ => {
          if self.parser_tag_depth(TAG_P) > 0 {
            debug_assert!(closes_p(id));
            self.close_implied_to(&TARGET_P, &P_SCOPE_BOUNDARY);
          }
          match id {
            // A heading start closes an open heading (they cannot nest); only
            // when one is the current node, matching the spec's "if the current
            // node is an h1–h6 element, pop it" step.
            TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6
              if self.parser_last_tag_id().is_some_and(|id| {
                matches!(id, TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6)
              }) =>
            {
              self.pop_parser_top();
            }
            TAG_LI if self.parser_tag_depth(TAG_LI) > 0 => {
              self.close_implied_to(&TARGET_LI, &LI_SCOPE_BOUNDARY);
            }
            TAG_DT | TAG_DD
              if self.parser_tag_depth(TAG_DT) > 0 || self.parser_tag_depth(TAG_DD) > 0 =>
            {
              self.close_implied_to(&TARGET_DT_DD, &DL_SCOPE_BOUNDARY);
            }
            _ => {}
          }
        }
      }
    }

    let overflow_plugin_mode = if !self_closing
      && (self.overflow_same_name_depth > 0 || self.stack.len() >= MAX_ELEMENT_DEPTH)
    {
      self.overflow_plugin_mode(tag_name, tag_id, is_builtin, &attributes, tag_handler)
    } else {
      0
    };
    if !self_closing
      && (self.overflow_same_name_depth > 0 || self.stack.len() >= MAX_ELEMENT_DEPTH)
      && (tag_id == Some(TAG_TEMPLATE) || overflow_plugin_mode == 1)
    {
      self.enter_opaque_overflow(tag_name, tag_handler);
      return OpeningTagResult {
        complete: true,
        new_position,
        self_closing: false,
        skip: true,
      };
    }

    if self.overflow_same_name_depth > 0 && !self_closing {
      if self.matches_overflow_tag(tag_name, tag_id, is_builtin) {
        self.overflow_same_name_depth = self.overflow_same_name_depth.saturating_add(1);
      } else if tag_handler.is_some_and(|handler| handler.is_non_nesting) {
        self.overflow_raw_name = Some(tag_name.to_string());
        self.overflow_raw_excludes_text =
          tag_handler.is_some_and(|handler| handler.excludes_text_nodes);
      }
      return OpeningTagResult {
        complete: true,
        new_position,
        self_closing: false,
        skip: true,
      };
    }

    if !self_closing && self.stack.len() >= MAX_ELEMENT_DEPTH {
      self.enter_overflow(
        tag_name,
        tag_id,
        is_builtin,
        tag_handler,
        overflow_plugin_mode == 2,
      );
      return OpeningTagResult {
        complete: true,
        new_position,
        self_closing: false,
        skip: true,
      };
    }

    if let Some(id) = tag_id {
      debug_assert!(
        (id as usize) < MAX_TAG_ID,
        "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}"
      );
      if (id as usize) < MAX_TAG_ID {
        self.depth_map[id as usize] = self.depth_map[id as usize].saturating_add(1);
      }
      if id == TAG_PRE {
        self.in_pre = true;
      }
    }
    self.depth += 1;

    let current_walk_index = self.stack.last().map_or(0, |n| n.current_walk_index);
    let custom_name = if is_builtin {
      None
    } else {
      Some(tag_name.to_string())
    };

    let (h_inline, h_excludes, h_non_nesting, h_collapses, h_spacing) = if let Some(h) = tag_handler
    {
      (
        h.is_inline,
        h.excludes_text_nodes,
        h.is_non_nesting,
        h.collapses_inner_white_space,
        h.spacing,
      )
    } else if tag_id.is_none() {
      // Truly unknown tag (not in dictionary, no override): treat as inline
      // with zero spacing so it doesn't fragment the surrounding paragraph.
      // `<p>before <ex>foo</ex> after</p>` becomes `before foo after`. Users
      // opt custom elements into block semantics via `tagOverrides`.
      (true, false, false, false, Some(NO_SPACING))
    } else {
      // Built-in tag without a dedicated handler (e.g. caption, span fallback):
      // keep previous block-default behaviour.
      (false, false, false, false, None)
    };

    let mut tag = if let Some(mut pooled) = self.node_pool.pop() {
      pooled.custom_name = custom_name;
      pooled.attributes = attributes;
      pooled.tag_id = tag_id;
      pooled.depth = self.depth;
      pooled.index = current_walk_index;
      pooled.current_walk_index = 0;
      pooled.child_text_node_index = 0;
      pooled.contains_whitespace = false;
      pooled.excluded_from_markdown = false;
      pooled.tailwind = None;
      pooled.is_inline = h_inline;
      pooled.excludes_text_nodes = h_excludes;
      pooled.is_non_nesting = h_non_nesting;
      pooled.collapses_inner_white_space = h_collapses;
      pooled.spacing = h_spacing;
      pooled
    } else {
      ElementNode {
        custom_name,
        attributes,
        tag_id,
        depth: self.depth,
        index: current_walk_index,
        current_walk_index: 0,
        child_text_node_index: 0,
        contains_whitespace: false,
        excluded_from_markdown: false,
        tailwind: None,
        is_inline: h_inline,
        excludes_text_nodes: h_excludes,
        is_non_nesting: h_non_nesting,
        collapses_inner_white_space: h_collapses,
        spacing: h_spacing,
      }
    };

    let mut skip_node = false;
    let mut filter_excluded = false;
    let in_template = self.depth_map[TAG_TEMPLATE as usize] > 0;

    if self.has_plugins {
      if self.has_tailwind {
        let parent_hidden = self
          .stack
          .last()
          .and_then(|p| p.tailwind.as_ref())
          .is_some_and(|tw| tw.hidden);

        if let Some(class_attr) = tag.attributes.get("class") {
          let (mut prefix, mut suffix, hidden) = process_tailwind_classes(class_attr);
          if self.plain_text {
            prefix = None;
            suffix = None;
          }
          let hidden = hidden || parent_hidden;
          if prefix.is_some() || suffix.is_some() || hidden {
            tag.tailwind = Some(Box::new(TailwindData {
              prefix,
              suffix,
              hidden,
            }));
            if hidden {
              skip_node = true;
            }
          }
        } else if parent_hidden {
          tag.tailwind = Some(Box::new(TailwindData {
            prefix: None,
            suffix: None,
            hidden: true,
          }));
          skip_node = true;
        }
      }

      if self.has_filter {
        // Hidden and exclude-matched elements both drop their whole subtree, so
        // one marker covers both: a descendant costs an Option check instead of
        // rescanning every ancestor against every selector.
        if self.hidden_since_depth.is_some() {
          skip_node = true;
          filter_excluded = true;
        } else if is_hidden(&tag)
          || self
            .filter_exclude_parsed
            .iter()
            .any(|(_, parsed)| matches_selector_list(&tag, parsed))
        {
          skip_node = true;
          filter_excluded = true;
          self.hidden_since_depth = Some(self.depth);
        }
        if !skip_node && !self.filter_include_parsed.is_empty() {
          // Inclusion is inherited the same way, but only when
          // `process_children` keeps the matched element's subtree.
          let mut match_found =
            self.filter_process_children && self.filter_included_since_depth.is_some();
          if !match_found
            && self
              .filter_include_parsed
              .iter()
              .any(|(_, parsed)| matches_selector_list(&tag, parsed))
          {
            match_found = true;
            if self.filter_included_since_depth.is_none() {
              self.filter_included_since_depth = Some(self.depth);
            }
          }
          if !match_found {
            skip_node = true;
            filter_excluded = true;
          }
        }
      }

      if self.has_isolate_main && !in_template {
        let is_main = tag_id == Some(TAG_MAIN);
        if !self.isolate_main_found && is_main && self.depth <= 50 {
          self.isolate_main_found = true;
        }
        if self.isolate_main_found {
          if self.isolate_main_closed {
            skip_node = true;
          }
        } else {
          let is_header = tag_id.is_some_and(|id| (TAG_H1..=TAG_H6).contains(&id));
          if self.isolate_first_header_depth.is_none()
            && is_header
            && self.depth_map[TAG_HEADER as usize] == 0
          {
            self.isolate_first_header_depth = Some(self.depth);
          }
          if let Some(header_depth) = self.isolate_first_header_depth
            && !self.isolate_after_footer
            && tag_id == Some(TAG_FOOTER)
            && self.depth.saturating_sub(header_depth) <= 5
          {
            self.isolate_after_footer = true;
            skip_node = true;
          }
          if self.isolate_first_header_depth.is_none() {
            if tag_id != Some(TAG_HEAD) && self.depth_map[TAG_HEAD as usize] == 0 {
              skip_node = true;
            }
          } else if self.isolate_after_footer {
            skip_node = true;
          }
        }
      }

      if self.has_frontmatter && !in_template {
        if tag_id == Some(TAG_HEAD) {
          self.frontmatter_in_head = true;
        } else if self.frontmatter_in_head && tag_id == Some(TAG_META) {
          let name = tag
            .attributes
            .get("name")
            .or_else(|| tag.attributes.get("property"));
          let content = tag.attributes.get("content");
          if let (Some(n), Some(c)) = (name, content) {
            let n_str = n.as_str();
            let is_allowed = match n_str {
              "description"
              | "keywords"
              | "author"
              | "date"
              | "og:title"
              | "og:description"
              | "twitter:title"
              | "twitter:description" => true,
              _ => self
                .options
                .plugins
                .as_ref()
                .and_then(|p| p.frontmatter.as_ref())
                .and_then(|f| f.meta_fields.as_ref())
                .is_some_and(|allowed| allowed.iter().any(|a| a == n_str)),
            };
            if is_allowed {
              if let Some(entry) = self.frontmatter_meta.iter_mut().find(|(k, _)| k == n) {
                entry.1.clone_from(c);
              } else {
                self.frontmatter_meta.push((n.clone(), c.clone()));
              }
            }
          }
        }
      }
    }

    tag.excluded_from_markdown = in_template
      || filter_excluded
      || (skip_node && (!self.has_isolate_main || self.isolate_main_found));

    if tag.collapses_inner_white_space && !tag.excluded_from_markdown {
      if tag.tag_id == Some(TAG_SPAN) {
        self.collapse_span_depth = self.collapse_span_depth.saturating_add(1);
      } else {
        self.collapse_non_span_depth = self.collapse_non_span_depth.saturating_add(1);
      }
    }

    if let Some(last) = self.stack.last_mut() {
      last.current_walk_index += 1;
    }

    if !tag.is_inline {
      let idx = self.stack.len();
      self.first_block_parent_index = Some(idx);
      self.block_parent_indices.push(idx);
    }

    self.stack.push(tag);

    // Extraction
    if !self.extraction_parsed_selectors.is_empty()
      && let Some(element) = self.stack.last()
    {
      let stack_depth = self.stack.len();
      for (selector, parsed) in &self.extraction_parsed_selectors {
        if matches_selector_list(element, parsed) {
          let attrs: Vec<(String, String)> = element
            .attributes
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
          self.extraction_tracked.push(TrackedExtraction {
            selector: selector.clone(),
            stack_depth,
            text_content: String::new(),
            tag_name: element.name().to_string(),
            attributes: attrs,
          });
        }
      }
    }

    // Inline emit (no callback!)
    if !skip_node {
      self.emit_enter_element();
    }

    // After the LI prefix is emitted, push this LI's marker-width worth of
    // spaces to list_indent so subsequent continuation content (code blocks,
    // paragraphs, nested blocks) lands in the correct content column. The
    // width depends on the marker: "- " = 2, "N. " = digits(N) + 2.
    // Push for every LI open so close_node can pop unconditionally; width 0
    // when skipped or in a table cell keeps the stack balanced without
    // affecting the indent string.
    if tag_id == Some(TAG_LI)
      && let Some(li) = self.stack.last()
    {
      let width: usize = if !skip_node && !self.in_table_cell() && !self.plain_text {
        let stack_len = self.stack.len();
        let parent_is_ordered = stack_len >= 2 && self.stack[stack_len - 2].tag_id == Some(TAG_OL);
        if parent_is_ordered {
          // Must match the marker actually written, `start` included, or the
          // item's continuation content drifts out of it.
          let n = Self::ordered_item_number(&self.stack[stack_len - 2], li.index).max(1);
          // n >= 1 so ilog10 never panics; +1 converts floor(log10) to digit count.
          let digits = (n.ilog10() + 1) as usize;
          digits + 2
        } else {
          2
        }
      } else {
        0
      };
      self
        .list_indent_widths
        .push(u8::try_from(width).unwrap_or(u8::MAX));
      for _ in 0..width {
        self.list_indent.push(' ');
      }
    }

    self.has_encoded_html_entity = false;

    if self.stack.last().is_some_and(|n| n.is_non_nesting) && !self_closing {
      self.in_non_nesting = true;
    }

    if !self_closing {
      self.just_closed_tag = false;
    }

    OpeningTagResult {
      complete: true,
      new_position,
      self_closing,
      skip: false,
    }
  }

  pub(crate) fn close_node(&mut self) {
    if self.stack.is_empty() {
      return;
    }

    // Extraction finalize
    if !self.extraction_tracked.is_empty() {
      let current_depth = self.stack.len();
      if let Some(first) = self
        .extraction_tracked
        .iter()
        .position(|tracked| tracked.stack_depth == current_depth)
      {
        let extraction_results = &mut self.extraction_results;
        for tracked in self.extraction_tracked.drain(first..) {
          extraction_results.push(ExtractedElement {
            selector: tracked.selector,
            tag_name: tracked.tag_name,
            text_content: tracked.text_content.trim().to_string(),
            attributes: tracked.attributes,
          });
        }
      }
    }

    let popping_index = self.stack.len() - 1;
    // Guard already checked above, but avoid panic on edge cases
    let Some(node) = self.stack.pop() else { return };

    // Each marker holds the shallowest open match, so only its own close clears it.
    if self.hidden_since_depth == Some(node.depth) {
      self.hidden_since_depth = None;
    }
    if self.filter_included_since_depth == Some(node.depth) {
      self.filter_included_since_depth = None;
    }

    if self.first_block_parent_index == Some(popping_index) {
      self.block_parent_indices.pop();
      self.first_block_parent_index = self
        .block_parent_indices
        .last()
        .copied()
        .or(if self.stack.is_empty() { None } else { Some(0) });
    }

    if node.collapses_inner_white_space && !node.excluded_from_markdown {
      if node.tag_id == Some(TAG_SPAN) {
        self.collapse_span_depth = self.collapse_span_depth.saturating_sub(1);
      } else {
        self.collapse_non_span_depth = self.collapse_non_span_depth.saturating_sub(1);
      }
    }

    if self.has_isolate_main
      && node.tag_id == Some(TAG_MAIN)
      && !node.excluded_from_markdown
      && self.isolate_main_found
      && !self.isolate_main_closed
    {
      self.isolate_main_closed = true;
    }

    // Frontmatter generation on HEAD close
    if self.has_frontmatter
      && node.tag_id == Some(TAG_HEAD)
      && !node.excluded_from_markdown
      && self.frontmatter_in_head
    {
      self.frontmatter_in_head = false;
      self.generate_frontmatter_yaml();
    }

    // Special: empty links — synthesize text from title/aria-label
    if node.tag_id == Some(TAG_A) && node.child_text_node_index == 0 && !node.excluded_from_markdown
    {
      let prefix = node
        .attributes
        .get("title")
        .or_else(|| node.attributes.get("aria-label"))
        .cloned()
        .unwrap_or_default();
      if !prefix.is_empty() {
        let node_depth = node.depth;
        let node_tag_id = node.tag_id;
        let mut modified_node = node;
        modified_node.child_text_node_index = 1;
        let text_depth = node_depth + 1;
        self.stack.push(modified_node);
        // Emit synthetic text
        self.emit_text(&prefix, false, text_depth, 0);
        for prev in &mut self.stack {
          prev.child_text_node_index += 1;
        }
        let Some(modified_node2) = self.stack.pop() else {
          return;
        };
        // Emit exit
        self.emit_exit_element(&modified_node2);
        self.recycle_node(modified_node2);
        if let Some(id) = node_tag_id {
          debug_assert!(
            (id as usize) < MAX_TAG_ID,
            "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}"
          );
          if (id as usize) < MAX_TAG_ID {
            self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
          }
          self.update_in_pre_on_close(id);
          if id == TAG_LI
            && let Some(w) = self.list_indent_widths.pop()
          {
            let new_len = self.list_indent.len().saturating_sub(w as usize);
            self.list_indent.truncate(new_len);
          }
        }
        self.depth -= 1;
        self.has_encoded_html_entity = false;
        self.just_closed_tag = true;
        self.in_non_nesting = self.stack.last().is_some_and(|n| n.is_non_nesting);
        return;
      }
    }

    // Inline emit exit (no callback!)
    self.emit_exit_element(&node);

    let node_tag_id = node.tag_id;
    self.recycle_node(node);

    if let Some(id) = node_tag_id {
      debug_assert!(
        (id as usize) < MAX_TAG_ID,
        "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}"
      );
      if (id as usize) < MAX_TAG_ID {
        self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
      }
      self.update_in_pre_on_close(id);
      if id == TAG_LI
        && let Some(w) = self.list_indent_widths.pop()
      {
        let new_len = self.list_indent.len().saturating_sub(w as usize);
        self.list_indent.truncate(new_len);
      }
    }

    self.in_non_nesting = self.stack.last().is_some_and(|n| n.is_non_nesting);
    self.depth -= 1;
    self.has_encoded_html_entity = false;
    self.just_closed_tag = true;
  }

  pub(crate) fn process_closing_tag(
    &mut self,
    html_chunk: &str,
    position: usize,
  ) -> CloseTagResult {
    let mut i = position + 2;
    let tag_name_start = i;
    let bytes = html_chunk.as_bytes();
    let chunk_length = bytes.len();

    let mut tag_name_end = chunk_length;
    let mut quote = 0;
    let mut found_close = false;
    while i < chunk_length {
      let c = bytes[i];
      if tag_name_end == chunk_length && (is_whitespace(c) || c == SLASH_CHAR || c == GT_CHAR) {
        tag_name_end = i;
      }

      // End-tag attributes are a parse error, but the tokenizer still consumes
      // them. In particular, a `>` inside a quoted value does not complete the
      // token, which matters when the malformed tag spans stream chunks.
      if quote != 0 {
        if c == quote {
          quote = 0;
        }
      } else if tag_name_end != chunk_length && (c == QUOTE_CHAR || c == APOS_CHAR) {
        quote = c;
      } else if c == GT_CHAR {
        found_close = true;
        break;
      }
      i += 1;
    }

    if !found_close {
      return CloseTagResult {
        complete: false,
        new_position: position,
      };
    }

    // Only the initial name participates in matching. Whitespace, a trailing
    // solidus, and parse-error attributes belong to the rest of the end tag.
    let tag_name_raw = &html_chunk[tag_name_start..tag_name_end];
    let builtin_tag_id = crate::consts::get_tag_id_ci_bytes(tag_name_raw.as_bytes());
    let tag_name: Cow<str> = if builtin_tag_id.is_some() {
      Cow::Borrowed(tag_name_raw)
    } else if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
      Cow::Owned(tag_name_raw.to_ascii_lowercase())
    } else {
      Cow::Borrowed(tag_name_raw)
    };
    // Closing tag may target an aliased custom element (e.g. </ex> where
    // tagOverrides: { ex: 'em' } opened a TAG_EM node). Resolve the alias
    // here so the close matches the open.
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

    if self.overflow_opaque_depth > 0 {
      if self.overflow_raw_name.is_some() {
        let closes_opaque_root = self.matches_opaque_tag(tag_name.as_ref());
        self.overflow_raw_name = None;
        self.overflow_raw_excludes_text = false;
        if closes_opaque_root {
          self.clear_opaque_overflow();
        }
      } else if self.matches_opaque_tag(tag_name.as_ref()) {
        self.overflow_opaque_depth -= 1;
        if self.overflow_opaque_depth == 0 {
          self.clear_opaque_overflow();
        }
      }
      self.just_closed_tag = true;
      return CloseTagResult {
        complete: true,
        new_position: i + 1,
      };
    }

    if self.overflow_same_name_depth > 0 {
      let is_self_closing = tag_id
        .and_then(get_tag_handler)
        .is_some_and(|handler| handler.is_self_closing);
      if is_self_closing {
        self.just_closed_tag = true;
        return CloseTagResult {
          complete: true,
          new_position: i + 1,
        };
      }
      if self.overflow_raw_name.is_some() {
        let closes_root =
          self.matches_overflow_tag(tag_name.as_ref(), tag_id, builtin_tag_id.is_some());
        self.overflow_raw_name = None;
        self.overflow_raw_excludes_text = false;
        if closes_root {
          self.clear_overflow();
        }
        self.just_closed_tag = true;
        return CloseTagResult {
          complete: true,
          new_position: i + 1,
        };
      }
      if self.matches_overflow_tag(tag_name.as_ref(), tag_id, builtin_tag_id.is_some()) {
        self.overflow_same_name_depth -= 1;
        if self.overflow_same_name_depth == 0 {
          self.clear_overflow();
        }
        self.just_closed_tag = true;
        return CloseTagResult {
          complete: true,
          new_position: i + 1,
        };
      }
      if tag_id.is_some_and(|id| self.depth_map[id as usize] > 0) {
        self.clear_overflow();
      } else {
        self.just_closed_tag = true;
        return CloseTagResult {
          complete: true,
          new_position: i + 1,
        };
      }
    }

    if let Some(curr) = self.stack.last()
      && curr.is_non_nesting
      && curr.tag_id != tag_id
    {
      return CloseTagResult {
        complete: false,
        new_position: position,
      };
    }

    // Non-built-in names must match the open node's custom name as well as its
    // resolved tag id. This keeps `</other>` from closing an unknown custom
    // element and keeps aliased `</ex>` from closing an unrelated built-in.
    let close_name: &str = tag_name.as_ref();
    let needs_name_match = builtin_tag_id.is_none();
    let matches = |node: &ElementNode| -> bool {
      if node.tag_id != tag_id {
        return false;
      }
      if !needs_name_match {
        return true;
      }
      node.custom_name.as_deref() == Some(close_name)
    };

    let mut matched = false;
    if let Some(top) = self.stack.last() {
      if matches(top) {
        matched = true;
        self.close_node();
      } else {
        let mut pop_count = 0;
        let mut found_match = false;
        for j in (0..self.stack.len()).rev() {
          // Template contents have their own tree-construction scope. An end
          // tag inside them cannot close an element in the outer document.
          if tag_id != Some(TAG_TEMPLATE) && self.stack[j].tag_id == Some(TAG_TEMPLATE) {
            break;
          }
          pop_count += 1;
          if matches(&self.stack[j]) {
            found_match = true;
            break;
          }
        }
        if found_match {
          matched = true;
          for _ in 0..pop_count {
            self.close_node();
          }
        }
      }
    }

    if !matched {
      // The ignored token does not create a semantic boundary between the
      // text nodes on either side. Avoid the output layer's conservative
      // separator for adjacent, independently flushed text nodes.
      self.last_node_is_inline = true;
    }
    // Keep the scanner's whitespace state aligned after consuming a tag token.
    self.just_closed_tag = true;
    CloseTagResult {
      complete: true,
      new_position: i + 1,
    }
  }

  /// Handle a CDATA section's inner content.
  ///
  /// CDATA is discarded by default (matching the HTML spec, where `<![CDATA[`
  /// outside foreign content is a bogus comment). Callers opt in by registering
  /// a `#cdata-section` entry in `tagOverrides`; the leading `#` makes the
  /// pseudo-tag impossible to collide with a real HTML element name. When an
  /// override exists the content is emitted as a synthetic `#cdata-section`
  /// element whose rendering follows the override (alias tag and/or
  /// enter/exit strings).
  pub(crate) fn process_cdata_section(&mut self, content: &str) {
    if !self.has_tag_overrides {
      return;
    }
    let Some(tag_id) = self
      .options
      .plugins
      .as_ref()
      .and_then(|p| p.tag_overrides.as_ref())
      .and_then(|ovs| ovs.iter().find(|(k, _)| k == "#cdata-section"))
      .map(|(_, ov)| ov.alias_tag_id)
    else {
      return;
    };

    let result = self.process_opening_tag("#cdata-section", tag_id, false, ">", 0);
    if !result.complete {
      return;
    }
    if result.skip {
      if self.matches_overflow_tag("#cdata-section", tag_id, false) {
        self.clear_overflow();
      }
      return;
    }

    if !result.self_closing && !content.is_empty() {
      let excluded = self
        .stack
        .last()
        .is_some_and(|n| n.excluded_from_markdown || n.excludes_text_nodes);
      if !excluded {
        let depth = self.depth;
        let index = self.stack.last().map_or(0, |n| n.current_walk_index);
        self.emit_text(content, false, depth, index);
      }
      if let Some(parent) = self.stack.last_mut() {
        parent.current_walk_index += 1;
        parent.child_text_node_index += 1;
      }
    }
    if !result.self_closing {
      self.close_node();
    }
  }

  /// Recycle a node into the pool, preserving its Attributes Vec allocation.
  #[inline]
  pub(crate) fn recycle_node(&mut self, mut node: ElementNode) {
    node.attributes.clear();
    node.custom_name = None;
    node.tailwind = None;
    self.node_pool.push(node);
  }

  #[inline]
  pub(crate) fn update_in_pre_on_close(&mut self, id: u8) {
    if id == TAG_PRE && self.depth_map[TAG_PRE as usize] == 0 {
      self.in_pre = false;
    }
  }
}
