//! Markdown output: tag enter/exit emission, buffer writing, spacing.

use super::*;

/// Bytes rejected from a fenced-code info string.
///
/// Two classes, for two different reasons:
/// - `` ` ``, `~` and the C0/DEL controls can break the construct itself — a
///   marker run extends or terminates the fence, a line terminator ends the
///   opening line and starts a new block.
/// - `"`, `'`, `<`, `>` and `&` are inert in CommonMark, but renderers
///   interpolate the info string into `<code class="language-…">`, so mdream
///   does not hand them markup characters.
///
/// Everything else is accepted, including `_`, `/` and non-ASCII names.
#[inline]
const fn is_unsafe_fence_info_byte(byte: u8) -> bool {
  byte < 0x20 || matches!(byte, 0x7F | b'`' | b'~' | b'"' | b'\'' | b'<' | b'>' | b'&')
}

/// Buffer size at which a streaming flush starts quoting completed blockquote
/// lines, so a long quote releases instead of growing with the document.
const STREAMING_FLUSH_THRESHOLD: usize = 8 * 1024;

const DESTINATION_ESCAPES: [u8; 16] = [0, 0, 0, 0, 0, 0, 0, 80, 0, 0, 0, 16, 0, 0, 0, 0];
const TITLE_ESCAPES: [u8; 16] = [0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0];
const IMAGE_DESCRIPTION_ESCAPES: [u8; 16] = [0, 0, 0, 0, 64, 4, 0, 16, 0, 0, 0, 184, 1, 0, 0, 64];

#[inline(always)]
fn in_byte_set(byte: u8, set: &[u8; 16]) -> bool {
  byte < 128 && set[(byte >> 3) as usize] & (1 << (byte & 7)) != 0
}

#[inline(never)]
fn write_ascii_escaped(output: &mut String, value: &str, escapes: &[u8; 16]) {
  let bytes = value.as_bytes();
  let mut copied = 0usize;
  let mut index = 0usize;
  while index < bytes.len() {
    if in_byte_set(bytes[index], escapes) {
      output.push_str(&value[copied..index]);
      output.push('\\');
      copied = index;
    }
    index += 1;
  }
  output.push_str(&value[copied..]);
}

/// Bytes forcing a destination into angle brackets: tab, LF, FF, CR, space,
/// `(`, `)`, and every byte of [`DESTINATION_ESCAPES`] (must stay a superset).
const DESTINATION_NEEDS_ANGLE: [u8; 16] = [0, 54, 0, 0, 1, 3, 0, 80, 0, 0, 0, 16, 0, 0, 0, 0];

fn write_markdown_destination(output: &mut String, destination: &str) {
  let bytes = destination.as_bytes();
  let mut index = 0usize;
  while index < bytes.len() && !in_byte_set(bytes[index], &DESTINATION_NEEDS_ANGLE) {
    index += 1;
  }
  if index == bytes.len() {
    output.push_str(destination);
    return;
  }

  output.push('<');
  write_ascii_escaped(output, destination, &DESTINATION_ESCAPES);
  output.push('>');
}

fn write_markdown_resource(output: &mut String, destination: &str, title: Option<&str>) {
  output.push('(');
  write_markdown_destination(output, destination);
  if let Some(title) = title
    && !title.is_empty()
  {
    output.push_str(" \"");
    write_ascii_escaped(output, title, &TITLE_ESCAPES);
    output.push('"');
  }
  output.push(')');
}

fn write_image_description(output: &mut String, alt: &str) {
  write_ascii_escaped(output, alt, &IMAGE_DESCRIPTION_ESCAPES);
}

#[inline(never)]
#[allow(clippy::cast_possible_truncation)] // `parsed` is bounded by the `u32` maximum argument.
pub(super) fn parse_bounded_u32(value: &str, max: u32) -> Option<u32> {
  let value = value.trim_ascii().as_bytes();
  let mut index = usize::from(value.first() == Some(&b'+'));
  if index == value.len() {
    return None;
  }
  let mut parsed = 0u64;
  while index < value.len() {
    let byte = value[index];
    let digit = byte.wrapping_sub(b'0');
    if digit > 9 {
      return None;
    }
    parsed = parsed * 10 + u64::from(digit);
    if parsed > u64::from(max) {
      return None;
    }
    index += 1;
  }
  Some(parsed as u32)
}

impl ConvertState {
  fn begin_link(&mut self, bracket_pos: usize, skipped: bool) {
    self.parent_links.push(self.link);
    self.link = LinkOutputState {
      bracket_pos,
      skipped,
    };
  }

  fn end_link(&mut self) {
    self.link = self.parent_links.pop().unwrap_or_default();
  }

  #[inline]
  fn has_flushed_tail(&self) -> bool {
    self.cut_line_lead != CutLineLead::Uncut
  }

  #[inline]
  fn inline_marker_type(tag_id: u8) -> Option<u8> {
    // The kind is the delimiter identity: one value per distinct delimiter
    // string, so tags sharing a delimiter share a kind.
    match tag_id {
      TAG_STRONG | TAG_B | TAG_DFN => Some(0),
      TAG_EM | TAG_I | TAG_FIGCAPTION => Some(1),
      TAG_DEL | TAG_S | TAG_STRIKE => Some(2),
      TAG_CITE => Some(3),
      TAG_KBD | TAG_CODE | TAG_SAMP | TAG_VAR => Some(4),
      TAG_Q => Some(5),
      _ => None,
    }
  }

  fn max_backtick_run(value: &str) -> usize {
    let mut max = 0usize;
    let mut run = 0usize;
    for byte in value.bytes() {
      if byte == b'`' {
        run += 1;
        max = max.max(run);
      } else {
        run = 0;
      }
    }
    max
  }

  fn max_line_leading_run(value: &str, marker: u8, indent: &str) -> usize {
    value
      .split('\n')
      .map(|line| {
        let line = line.strip_prefix(indent).unwrap_or(line);
        let bytes = line.as_bytes();
        let mut index = 0usize;
        while index < bytes.len() && index < 3 && bytes[index] == b' ' {
          index += 1;
        }
        bytes[index..]
          .iter()
          .take_while(|&&byte| byte == marker)
          .count()
      })
      .max()
      .unwrap_or(0)
  }

  #[cold]
  #[inline(never)]
  fn finalize_code_span(&mut self, span: &CodeSpanState) -> String {
    // A pipe splits the row even inside a code span; `\|` is GFM's escape and is
    // honoured there. Content sits at the buffer tail, so this shifts no offset.
    if self.depth_map[TAG_TABLE as usize] > 0 && self.buffer[span.content_start..].contains('|') {
      let escaped = self.buffer[span.content_start..].replace('|', "\\|");
      self.buffer.truncate(span.content_start);
      self.buffer.push_str(&escaped);
    }
    let max_run = Self::max_backtick_run(&self.buffer[span.content_start..]);
    let delimiter = "`".repeat((max_run + 1).max(1));
    let content = &self.buffer[span.content_start..];
    let padded = content.starts_with('`') || content.ends_with('`');
    let mut opening = String::with_capacity(
      span.content_start - span.output_start + delimiter.len() + usize::from(padded),
    );
    opening.push_str(&self.buffer[span.output_start..span.content_start - 1]);
    opening.push_str(&delimiter);
    if padded {
      opening.push(' ');
    }
    self
      .buffer
      .replace_range(span.output_start..span.content_start, &opening);
    if padded {
      format!(" {delimiter}")
    } else {
      delimiter
    }
  }

  #[cold]
  #[inline(never)]
  fn start_code_fence(
    &mut self,
    output_start: usize,
    content_start: usize,
    language: String,
    indent: String,
  ) {
    let marker_offset = self.buffer[output_start..content_start]
      .rfind(MARKDOWN_CODE_BLOCK)
      .expect("code fence opener missing from output");
    self.code_fence = Some(CodeFenceState {
      output_start,
      marker_offset,
      content_start,
      indent,
      language,
    });
  }

  #[cold]
  #[inline(never)]
  fn finalize_code_fence(&mut self) -> Option<String> {
    let fence = self.code_fence.take()?;
    let marker = if fence.language.contains('`') {
      b'~'
    } else {
      b'`'
    };
    let max_run =
      Self::max_line_leading_run(&self.buffer[fence.content_start..], marker, &fence.indent);
    let delimiter = (marker as char).to_string().repeat((max_run + 1).max(3));
    let marker_start = fence.output_start + fence.marker_offset;
    self.shift_fragment_links_after(
      marker_start + MARKDOWN_CODE_BLOCK.len(),
      delimiter.len() as isize - MARKDOWN_CODE_BLOCK.len() as isize,
    );
    self.buffer.replace_range(
      marker_start..marker_start + MARKDOWN_CODE_BLOCK.len(),
      &delimiter,
    );
    Some(delimiter)
  }

  fn shift_fragment_links_after(&mut self, offset: usize, amount: isize) {
    if amount == 0 {
      return;
    }
    for link in &mut self.fragment_links {
      if link.bracket_start >= offset {
        link.bracket_start = link.bracket_start.saturating_add_signed(amount);
      }
      if link.text_end >= offset {
        link.text_end = link.text_end.saturating_add_signed(amount);
      }
      if link.link_end >= offset {
        link.link_end = link.link_end.saturating_add_signed(amount);
      }
    }
  }

  fn blockquote_offset(content: &str, list_indent: &str, offset: usize) -> usize {
    let mut source_start = 0usize;
    let mut output_start = 0usize;

    for line in content.split_inclusive('\n') {
      let line_content = line.strip_suffix('\n').unwrap_or(line);
      let removed = usize::from(!list_indent.is_empty() && line_content.starts_with(list_indent))
        * list_indent.len();
      let unindented_len = line_content.len().saturating_sub(removed);
      let prefix_len = list_indent.len() + 1 + usize::from(unindented_len > 0);
      let line_end = source_start + line_content.len();

      if offset <= line_end {
        return output_start + prefix_len + offset.saturating_sub(source_start + removed);
      }

      source_start += line.len();
      output_start += prefix_len + unindented_len + usize::from(line.ends_with('\n'));
    }

    output_start
  }

  #[cold]
  #[inline(never)]
  fn finalize_blockquote(&mut self) {
    let Some(frame) = self.blockquotes.pop() else {
      return;
    };
    let content_end = trim_ascii_whitespace_end(&self.buffer);
    // An empty range means "no content" only while none of it has left the
    // buffer. `has_streamed_output` is global, so reading it here drops the `>`
    // of a genuinely empty blockquote that one-shot emits.
    let content_left_buffer = self.last_yielded_length > frame.content_start;
    if content_end < frame.content_start
      || (content_end == frame.content_start && content_left_buffer)
    {
      return;
    }
    let content = &self.buffer[frame.content_start..content_end];
    // Borrowed rather than allocated: the capacity outlives the call, so a
    // document full of quotes pays for this region once.
    let mut quoted = core::mem::take(&mut self.blockquote_scratch);
    quoted.clear();
    quoted
      .reserve(content.len() + (frame.list_indent.len() + 2) * (content.matches('\n').count() + 1));

    for (index, line) in content.split('\n').enumerate() {
      if index > 0 {
        quoted.push('\n');
      }
      quoted.push_str(&frame.list_indent);
      quoted.push('>');
      let unindented = if frame.list_indent.is_empty() {
        line
      } else {
        line.strip_prefix(&frame.list_indent).unwrap_or(line)
      };
      if !unindented.is_empty() {
        quoted.push(' ');
        quoted.push_str(unindented);
      }
    }

    for link in &mut self.fragment_links {
      if link.bracket_start >= frame.content_start && link.link_end <= content_end {
        link.bracket_start = frame.content_start
          + Self::blockquote_offset(
            content,
            &frame.list_indent,
            link.bracket_start - frame.content_start,
          );
        link.text_end = frame.content_start
          + Self::blockquote_offset(
            content,
            &frame.list_indent,
            link.text_end - frame.content_start,
          );
        link.link_end = frame.content_start
          + Self::blockquote_offset(
            content,
            &frame.list_indent,
            link.link_end - frame.content_start,
          );
      }
    }

    // Every line gains a quote prefix, so an offset inside the content moves by
    // however many prefixes precede it -- the same remapping the fragment links
    // above need. A code span or fence measures and rewrites itself through its
    // offsets too, and left unmapped they point into the middle of the quoted
    // text, or of a character, and panic the slice that builds the delimiter.
    let quoted_end = frame.content_start + quoted.len();
    let remap = |offset: usize| -> usize {
      if offset < frame.content_start {
        offset
      } else if offset <= content_end {
        frame.content_start
          + Self::blockquote_offset(content, &frame.list_indent, offset - frame.content_start)
      } else {
        // Past the trimmed content there is nothing left to point at.
        quoted_end
      }
    };
    for span in &mut self.code_spans {
      for offset in [&mut span.output_start, &mut span.content_start] {
        *offset = remap(*offset);
      }
    }
    if let Some(fence) = &mut self.code_fence {
      // Held relative to `output_start`, and a prefix can land between the two,
      // so the marker is remapped on its own and the offset rebuilt from it.
      let mut offsets = [
        fence.output_start,
        fence.content_start,
        fence.output_start + fence.marker_offset,
      ];
      for offset in &mut offsets {
        *offset = remap(*offset);
      }
      [fence.output_start, fence.content_start, fence.marker_offset] = [
        offsets[0],
        offsets[1],
        offsets[2].saturating_sub(offsets[0]),
      ];
    }

    self.scan_before_requote(content_end);
    self.buffer.truncate(frame.content_start);
    self.buffer.push_str(&quoted);
    self.shift_raw_html_scan(content_end, quoted_end);
    self.last_content_cache_len = quoted.len();
    self.blockquote_scratch = quoted;
    // Quoting inserted a `> ` and a newline per line, so a line the scan had
    // already passed is no longer where the cache says the current one begins.
    self.invalidate_line_start();
  }

  /// Whether a flush could quote anything, by the two checks that cost nothing
  /// to make. A caller computing a limit for the flush tests this first, so a
  /// document with no open quote -- the common case -- pays neither the limit
  /// nor the call.
  #[inline]
  pub(crate) fn streaming_flush_possible(&self) -> bool {
    self.buffer.len() >= STREAMING_FLUSH_THRESHOLD && !self.blockquotes.is_empty()
  }

  pub(crate) fn flush_streaming_blockquote_lines(&mut self) {
    self.flush_streaming_blockquote_lines_upto(usize::MAX);
  }

  /// Quote completed blockquote lines, never reaching past `limit`.
  ///
  /// A flush between chunks runs at an arbitrary point in the document, where
  /// the buffer tail is still open to rewrites the caller has not settled yet.
  /// Quoting a line there commits a prefix that a later trim or reach-back
  /// rewrite turns into bytes one-shot never writes, and a streamed byte cannot
  /// be taken back. `limit` is the caller's own "safe to hand out" point, so
  /// only lines it would already release get quoted.
  pub(crate) fn flush_streaming_blockquote_lines_upto(&mut self, limit: usize) {
    if !self.streaming_flush_possible()
      || self.clean_flags & CLEAN_FRAGMENTS != 0
      || self.has_frontmatter
      || self.has_extraction
      // These pending rewrites keep absolute buffer offsets. Quoting content
      // before them shifts those offsets, so wait until each rewrite settles.
      || !self.open_markers.is_empty()
      || self.code_fence.is_some()
      || !self.code_spans.is_empty()
      || self.depth_map[TAG_A as usize] > 0
      || self.empty_item_hazard
    {
      return;
    }

    let mut ceiling = limit.min(self.buffer.len());
    while ceiling > 0 && !self.buffer.is_char_boundary(ceiling) {
      ceiling -= 1;
    }
    let Some(mut flush_end) = self.buffer[..ceiling].rfind('\n').map(|index| index + 1) else {
      return;
    };
    // A blank line at the tail is not final: whether it keeps a `>` depends on
    // content that has not arrived, and `finalize_blockquote` trims it off the
    // buffer end when none does. Quoting it here commits a prefix one-shot never
    // writes, so leave it for a later flush or for the close to decide.
    let bytes = self.buffer.as_bytes();
    while flush_end >= 2 && bytes[flush_end - 1] == b'\n' && bytes[flush_end - 2] == b'\n' {
      flush_end -= 1;
    }
    if self
      .blockquotes
      .iter()
      .any(|frame| frame.content_start >= flush_end)
    {
      return;
    }

    let shared_start = self.blockquotes[0].content_start;
    if self
      .blockquotes
      .iter()
      .all(|frame| frame.content_start == shared_start && frame.list_indent.is_empty())
    {
      let content = &self.buffer[shared_start..flush_end];
      let quoted_prefix = "> ".repeat(self.blockquotes.len());
      let blank_prefix = quoted_prefix.trim_end();
      let mut quoted = core::mem::take(&mut self.blockquote_scratch);
      quoted.clear();
      quoted.reserve(content.len() + quoted_prefix.len() * content.matches('\n').count());
      for line in content.split_inclusive('\n') {
        let line = line.strip_suffix('\n').unwrap_or(line);
        if line.is_empty() {
          quoted.push_str(blank_prefix);
        } else {
          quoted.push_str(&quoted_prefix);
          quoted.push_str(line);
        }
        quoted.push('\n');
      }
      self.scan_before_requote(flush_end);
      self.buffer.replace_range(shared_start..flush_end, &quoted);
      let quoted_end = shared_start + quoted.len();
      self.shift_raw_html_scan(flush_end, quoted_end);
      flush_end = quoted_end;
      self.blockquote_scratch = quoted;
      for frame in &mut self.blockquotes {
        frame.content_start = flush_end;
      }
      self.last_content_cache_len = self.buffer.len() - flush_end;
      self.invalidate_line_start();
      return;
    }

    // Every frame re-quotes the same region, so only the first pass sees the
    // bytes unquoted; the rest just move them further.
    let unquoted_end = flush_end;
    self.scan_before_requote(unquoted_end);
    // Taken once for the whole walk: every frame rewrites the same region again,
    // so without this each nesting level allocates its own copy of it per flush.
    let mut quoted = core::mem::take(&mut self.blockquote_scratch);
    for frame in self.blockquotes.iter().rev() {
      let content = &self.buffer[frame.content_start..flush_end];
      quoted.clear();
      quoted.reserve(content.len() + (frame.list_indent.len() + 2) * content.matches('\n').count());
      for line in content.split_inclusive('\n') {
        let line = line.strip_suffix('\n').unwrap_or(line);
        quoted.push_str(&frame.list_indent);
        quoted.push('>');
        let unindented = if frame.list_indent.is_empty() {
          line
        } else {
          line.strip_prefix(&frame.list_indent).unwrap_or(line)
        };
        if !unindented.is_empty() {
          quoted.push(' ');
          quoted.push_str(unindented);
        }
        quoted.push('\n');
      }
      self
        .buffer
        .replace_range(frame.content_start..flush_end, &quoted);
      flush_end = frame.content_start + quoted.len();
    }
    self.blockquote_scratch = quoted;
    self.shift_raw_html_scan(unquoted_end, flush_end);

    for frame in &mut self.blockquotes {
      frame.content_start = flush_end;
    }
    self.last_content_cache_len = self.buffer.len() - flush_end;
    self.invalidate_line_start();
  }

  /// Emit markdown for entering the element currently on top of self.stack.
  #[inline]
  pub(crate) fn emit_enter_element(&mut self) {
    let stack_len = self.stack.len();
    if stack_len == 0 {
      return;
    }

    // Excluded nodes (including parsed template descendants) must return before
    // deferred <pre> handling so an inert subtree cannot mutate output state.
    if self.stack[stack_len - 1].excluded_from_markdown {
      self.last_node_is_inline = self.stack[stack_len - 1].is_inline;
      return;
    }

    if self.format == OutputFormat::Html {
      self.emit_html_enter();
      return;
    }

    if self.list_rule_pending && !self.stack[stack_len - 1].excludes_text_nodes {
      self.flush_list_rule();
    }

    // Deferred <pre> code fence (issue #97): open a bare <pre>'s fence right
    // before its first non-whitespace child. A direct <code> child keeps
    // fence ownership; a deeper/other first child opens the <pre>'s own fence.
    if !self.plain_text && self.pre_fence_pending {
      let tid = self.stack[stack_len - 1].tag_id;
      if tid == Some(TAG_CODE)
        && stack_len >= 2
        && self.stack[stack_len - 2].tag_id == Some(TAG_PRE)
      {
        self.pre_fence_pending = false;
      } else if tid != Some(TAG_PRE) {
        self.flush_pre_fence();
      }
    }
    // Arm the deferral when entering a <pre>; the fence (with this <pre>'s own
    // language) is emitted lazily above for the no-<code> case. Skipped inside
    // a table cell, where the <pre> is emitted as raw HTML instead (issue #147).
    if !self.plain_text
      && self.stack[stack_len - 1].tag_id == Some(TAG_PRE)
      && !self.in_table_cell()
    {
      let lang = Self::get_language_from_class(self.stack[stack_len - 1].attributes.get("class"))
        .to_string();
      self.pre_fence_pending = true;
      self.pre_fence_lang = lang;
    }

    // Phase 1: read from node + compute output (borrows self.stack immutably)
    let tag_id: Option<u8>;
    let is_inline: bool;
    let node_spacing: Option<[u8; 2]>;
    let mut output: Option<Cow<'static, str>>;
    // True when `output` is a user-supplied override enter string — emit it
    // verbatim without synthesizing a separating space (issue #93).
    let enter_is_literal: bool;
    {
      let (ancestors, last) = self.stack.split_at(stack_len - 1);
      let node = &last[0];

      tag_id = node.tag_id;

      // Check override is_inline
      let override_config = if self.has_tag_overrides {
        self
          .options
          .plugins
          .as_ref()
          .and_then(|p| p.tag_overrides.as_ref())
          .and_then(|ovs| ovs.iter().find(|(k, _)| k == node.name()).map(|(_, v)| v))
      } else {
        None
      };
      is_inline = override_config
        .and_then(|ov| ov.is_inline)
        .unwrap_or(node.is_inline);
      node_spacing = override_config.and_then(|ov| ov.spacing).or(node.spacing);

      // Table state reads (tag_id.is_some() is sufficient — all table tags have handlers)
      if tag_id.is_some() {
        if tag_id == Some(TAG_TABLE) {
          if self.depth_map[TAG_TABLE as usize] <= 1 {
            self.table_rendered_table = false;
            self.table_header_cells = 0;
          }
          self.table_column_alignments.clear();
        } else if tag_id == Some(TAG_TR) {
          self.table_current_row_cells = 0;
        } else if tag_id == Some(TAG_TH) {
          let align_val = node.attributes.get("align").map_or(0u8, |s| {
            match s.as_bytes().first().copied().unwrap_or(0) | 0x20 {
              b'l' => 1, // left
              b'c' => 2, // center
              b'r' => 3, // right
              _ => 0,
            }
          });
          if align_val != 0 || self.table_column_alignments.len() <= self.table_current_row_cells {
            self.table_column_alignments.push(align_val);
          }
        }
      }

      // Check override enter string
      output = if let Some(ov) = override_config {
        if let Some(ref s) = ov.enter {
          enter_is_literal = true;
          Some(Cow::Owned(s.clone()))
        } else {
          enter_is_literal = false;
          self.get_enter_output(node, ancestors)
        }
      } else {
        enter_is_literal = false;
        self.get_enter_output(node, ancestors)
      };
    }
    // Phase 1 ends — self.stack borrow released

    // Phase 2: calculate new lines + write buffer
    let new_line_config = self.calculate_new_line_config(tag_id, node_spacing);
    let quote_at_start = self
      .blockquotes
      .last()
      .is_some_and(|frame| frame.content_start == self.buffer.len());
    let configured_new_lines = if quote_at_start {
      0
    } else {
      new_line_config[0]
    };

    // Clean mode — single guard for all clean checks
    if self.clean_flags != 0
      && let Some(id) = tag_id
    {
      if id == TAG_A {
        // emptyLinks: skip hrefs that cannot represent meaningful navigation.
        if self.clean_flags & CLEAN_EMPTY_LINKS != 0 {
          let node = &self.stack[self.stack.len() - 1];
          if let Some(href) = node.attributes.get("href")
            && is_empty_link_href(href)
          {
            self.begin_link(self.buffer.len(), true);
            self.last_node_is_inline = is_inline;
            return;
          }
        }
      } else if id == TAG_IMG && self.clean_flags & CLEAN_EMPTY_IMAGES != 0 {
        let node = &self.stack[self.stack.len() - 1];
        let alt = node.attributes.get("alt").map_or("", String::as_str);
        if alt.is_empty() {
          self.last_node_is_inline = is_inline;
          return;
        }
      }
    }

    // Whitespace immediately before <br> has no visual effect in HTML. Let the
    // explicit line boundary subsume it so the output has no trailing spaces.
    if tag_id == Some(TAG_BR)
      && !enter_is_literal
      && self.depth_map[TAG_PRE as usize] == 0
      && output.as_deref().is_some_and(|value| value.ends_with('\n'))
    {
      self.trim_trailing_spaces();
      if output.as_deref() == Some("\n") && self.buffer.ends_with("\n\n") {
        output = None;
      }
    }

    // Finalize completed quote lines before recording a new code offset. A
    // later flush must stop at that offset, but the prefix before it is safe to
    // quote and yield now even when both arrive in one large input chunk.
    if !self.plain_text
      && !enter_is_literal
      && tag_id == Some(TAG_CODE)
      && output.is_some()
      && ((self.depth_map[TAG_PRE as usize] == 0 && !self.in_raw_html_block())
        || (self.depth_map[TAG_PRE as usize] > 0 && !self.pre_fence_open && !self.in_table_cell()))
    {
      self.flush_streaming_blockquote_lines();
    }

    let output_start = self.buffer.len();
    self.write_output(
      true,
      is_inline,
      configured_new_lines,
      output.as_deref(),
      enter_is_literal,
    );

    if !self.plain_text && !enter_is_literal && tag_id == Some(TAG_LI) && !self.in_table_cell() {
      self.record_item_marker(self.stack[stack_len - 1].index, output_start);
    }

    // The blank line that re-enables Markdown must be looked for *inside* the
    // region. `raw_html_scanned_to` only moves on text nodes, so it still points
    // before the region began and earlier block spacing is read as if inside,
    // escaping text that is passed through verbatim: `\*` reaches the reader as a
    // literal backslash.
    if !self.plain_text
      && tag_id.is_some_and(Self::is_raw_html_block_tag)
      && self.raw_html_block_depth() == 1
    {
      self.raw_html_markdown = false;
      self.raw_html_scanned_to = self.buffer.len();
    }

    if !self.plain_text && !enter_is_literal && tag_id == Some(TAG_BLOCKQUOTE) {
      if !self.blockquotes.is_empty() && self.buffer.ends_with("\n\n") {
        self.buffer.pop();
        // Frames anchored at the old end move with the popped byte. Siblings can
        // share an offset, so this is not only the innermost. See `trim_floor`.
        for frame in &mut self.blockquotes {
          frame.content_start = frame.content_start.min(self.buffer.len());
        }
      }
      self.blockquotes.push(BlockquoteFrame {
        content_start: self.buffer.len(),
        list_indent: self.list_indent.clone(),
      });
    }

    if !enter_is_literal && tag_id == Some(TAG_CODE) {
      if self.depth_map[TAG_PRE as usize] == 0 {
        if !self.in_raw_html_block()
          && let Some(emitted) = output.as_deref()
        {
          self.code_spans.push(CodeSpanState {
            output_start: self.buffer.len() - emitted.len(),
            content_start: self.buffer.len(),
          });
        }
      } else if !self.pre_fence_open
        && !self.in_table_cell()
        && let Some(emitted) = output.as_deref()
      {
        let output_start = self.buffer.len() - emitted.len();
        let language =
          Self::get_language_from_class(self.stack[stack_len - 1].attributes.get("class"))
            .to_string();
        self.start_code_fence(
          output_start,
          self.buffer.len(),
          language,
          self.list_indent.clone(),
        );
        self.pre_fence_open = true;
      }
    }

    // After write_output, the emitted `[` (if any) is the last byte of the
    // buffer. Stash that exact position so emit_exit_element can find the
    // bracket in O(1) instead of scanning forward.
    if tag_id == Some(TAG_A) {
      let buf_len = self.buffer.len();
      // Only a bracket this element just emitted counts. Testing the buffer's
      // last byte alone also matches the `[` of an escaped literal `\[` in the
      // text before the link, and the empty-link drop then truncates into that
      // text instead of the link it meant to remove.
      let bracket_pos = if output
        .as_deref()
        .is_some_and(|o| o.as_bytes().last() == Some(&b'['))
      {
        buf_len - 1
      } else {
        buf_len
      };
      self.begin_link(bracket_pos, false);
    }

    if !enter_is_literal
      && let Some(id) = tag_id
      && (id != TAG_CODE || (self.depth_map[TAG_PRE as usize] == 0 && !self.in_raw_html_block()))
      && let Some(inline_marker_type) = Self::inline_marker_type(id)
      && let Some(emitted) = output.as_deref()
      && !emitted.is_empty()
    {
      self.open_markers.push((
        inline_marker_type,
        self.buffer.len() - emitted.len(),
        self.buffer.len(),
      ));
    } else if !self.open_markers.is_empty()
      && output
        .as_deref()
        .is_some_and(|o| o.as_bytes().iter().any(|&b| !is_whitespace(b)))
    {
      self.open_markers.clear();
    }

    // A block boundary makes an enclosing inline marker permanent even when
    // the block has not emitted content yet. Release streamed output promptly.
    if tag_id.is_some() && !is_inline && !self.open_markers.is_empty() {
      self.open_markers.clear();
    }

    // Clean: track heading start for slug collection
    if self.clean_flags & CLEAN_FRAGMENTS != 0
      && let Some(id) = tag_id
      && id.wrapping_sub(TAG_H1) < 6
      && self.depth_map[TAG_A as usize] == 0
    {
      self.in_heading = true;
      self.heading_buffer_start = self.buffer.len();
    }
  }

  /// Emit markdown for exiting an element (node already popped from stack).
  #[inline]
  pub(crate) fn emit_exit_element(&mut self, node: &ElementNode) {
    if node.excluded_from_markdown {
      self.last_node_is_inline = node.is_inline;
      return;
    }

    if self.format == OutputFormat::Html {
      self.emit_html_exit(node);
      return;
    }

    let tag_id = node.tag_id;
    if tag_id == Some(TAG_LI) {
      self.list_rule_pending = false;
    }
    let closes_own_pre_fence = tag_id == Some(TAG_PRE) && self.pre_fence_open;

    // Check override
    let override_config = if self.has_tag_overrides {
      self
        .options
        .plugins
        .as_ref()
        .and_then(|p| p.tag_overrides.as_ref())
        .and_then(|ovs| ovs.iter().find(|(k, _)| k == node.name()).map(|(_, v)| v))
    } else {
      None
    };

    let is_inline = override_config
      .and_then(|ov| ov.is_inline)
      .unwrap_or(node.is_inline);

    let cell_span =
      if matches!(tag_id, Some(TAG_TH | TAG_TD)) && self.depth_map[TAG_TABLE as usize] <= 1 {
        let span = Self::cell_span(node);
        self.table_current_row_cells += span as usize;
        span
      } else {
        1
      };

    let mut output: Option<Cow<'static, str>> = None;
    let mut table_separator: Option<String> = None;

    // Check override exit string
    let has_override = if let Some(ov) = override_config {
      if let Some(ref s) = ov.exit {
        output = Some(Cow::Owned(s.clone()));
        true
      } else {
        false
      }
    } else {
      false
    };

    if !has_override {
      // Special case: TR table separator
      if tag_id == Some(TAG_TR) && !self.plain_text {
        if !self.table_rendered_table && self.depth_map[TAG_TABLE as usize] <= 1 {
          self.table_rendered_table = true;
          let col_count = self
            .table_current_row_cells
            .max(self.table_column_alignments.len());
          let indent = if self.depth_map[TAG_LI as usize] > 0 {
            self.list_indent.as_str()
          } else {
            ""
          };
          let mut sep = String::with_capacity(col_count * 7 + 5 + indent.len());
          sep.push_str(" |\n");
          sep.push_str(indent);
          sep.push('|');
          for i in 0..col_count {
            let align = self.table_column_alignments.get(i).copied().unwrap_or(0);
            sep.push(' ');
            sep.push_str(match align {
              1 => ":---",
              2 => ":---:",
              3 => "---:",
              _ => "---",
            });
            sep.push_str(" |");
          }
          self.table_header_cells = col_count;
          table_separator = Some(sep);
        } else {
          output = self.get_exit_output(node, cell_span);
        }
      } else if self.plain_text || tag_id != Some(TAG_A) {
        output = self.get_exit_output(node, cell_span);
      }
    }
    let closing_code_span = if !has_override
      && tag_id == Some(TAG_CODE)
      && self.depth_map[TAG_PRE as usize] == 0
      && !self.in_raw_html_block()
    {
      self.code_spans.pop()
    } else {
      None
    };

    let node_spacing = if let Some(ov) = override_config {
      ov.spacing.or(node.spacing)
    } else {
      node.spacing
    };

    if !has_override
      && !self.plain_text
      && tag_id == Some(TAG_HR)
      && !self.in_table_cell()
      && self.depth_map[TAG_LI as usize] > 0
    {
      self.list_rule_pending = true;
    }

    if !self.plain_text && tag_id == Some(TAG_BLOCKQUOTE) && !self.blockquotes.is_empty() {
      self.finalize_blockquote();
    }

    let new_line_config = self.calculate_new_line_config(tag_id, node_spacing);
    let configured_new_lines = if tag_id == Some(TAG_HR) && !self.blockquotes.is_empty() {
      new_line_config[1].min(1)
    } else {
      new_line_config[1]
    };

    // Clean mode exit — single guard. Skipped for overridden anchors,
    // whose custom exit output isn't the default `[…](…)` shape.
    if !self.plain_text && self.clean_flags != 0 && tag_id == Some(TAG_A) && !has_override {
      // emptyLinks: skip exit for skipped links
      if self.link.skipped {
        self.end_link();
        self.last_node_is_inline = is_inline;
        return;
      }

      // Find actual [ position: scan from recorded pos (write_output may have inserted newlines before it)
      let buf_len = self.buffer.len();
      let bracket_pos = {
        let mut pos = self.link.bracket_pos;
        let buf = self.buffer.as_bytes();
        while pos < buf.len() && buf[pos] != b'[' {
          pos += 1;
        }
        pos
      };
      // Guard: if bracket not found, bracket_pos == buf_len; text_start would overflow
      if bracket_pos >= buf_len {
        self.end_link();
        self.last_node_is_inline = is_inline;
        return;
      }
      let text_start = bracket_pos + 1;
      let link_text = if text_start <= buf_len && self.buffer.is_char_boundary(text_start) {
        &self.buffer[text_start..buf_len]
      } else {
        ""
      };
      let text_len = buf_len.saturating_sub(text_start);

      // emptyLinkText: [](url) → drop entirely
      if self.clean_flags & CLEAN_EMPTY_LINK_TEXT != 0 && link_text.trim().is_empty() {
        self.buffer.truncate(bracket_pos);
        self.end_link();
        self.last_node_is_inline = is_inline;
        return;
      }

      // selfLinkHeadings: ## [Title](#slug) → ## Title
      if self.clean_flags & CLEAN_SELF_LINK_HEADINGS != 0 {
        let in_heading = (TAG_H1..=TAG_H6).any(|h| self.depth_map[h as usize] > 0);
        if in_heading
          && let Some(href) = node.attributes.get("href")
          && href.starts_with('#')
          && text_len > 0
        {
          // Remove [ and keep text only — use truncate+copy without intermediate String
          let new_len = bracket_pos + text_len;
          // SAFETY: bracket_pos < text_start are within buffer bounds (guarded above).
          // We copy link text backwards over "[", then truncate. Preserves valid UTF-8.
          #[allow(unsafe_code)]
          unsafe {
            let buf = self.buffer.as_mut_vec();
            std::ptr::copy(
              buf.as_ptr().add(text_start),
              buf.as_mut_ptr().add(bracket_pos),
              text_len,
            );
            buf.set_len(new_len);
          }
          self.last_content_cache_len = text_len;
          self.end_link();
          self.last_node_is_inline = is_inline;
          return;
        }
      }

      // redundantLinks: [url](url) → url
      if self.clean_flags & CLEAN_REDUNDANT_LINKS != 0
        && let Some(href) = node.attributes.get("href")
        && let resolved = resolve_url(
          href,
          self.options.origin.as_deref(),
          self.options.clean_urls,
        )
        && link_text == resolved.as_ref()
        && text_len > 0
      {
        // Remove [ and keep text only — use truncate+copy without intermediate String
        let new_len = bracket_pos + text_len;
        // SAFETY: same invariants as self-link heading case. Preserves valid UTF-8.
        #[allow(unsafe_code)]
        unsafe {
          let buf = self.buffer.as_mut_vec();
          std::ptr::copy(
            buf.as_ptr().add(text_start),
            buf.as_mut_ptr().add(bracket_pos),
            text_len,
          );
          buf.set_len(new_len);
        }
        self.last_content_cache_len = text_len;
        self.end_link();
        self.last_node_is_inline = is_inline;
        return;
      }
    }

    if let Some(id) = tag_id
      && id.wrapping_sub(TAG_H1) < 6
      && self.depth_map[TAG_A as usize] == 0
    {
      if self.in_heading {
        // `heading_buffer_start` was recorded past the marker's trailing space,
        // which a following element that emits nothing (`<style>`, `<script>`)
        // trims away, leaving the offset past the buffer end. `get` returns
        // `None` there instead of panicking, and a heading with no content left
        // has no slug to record.
        if let Some(text) = self.buffer.get(self.heading_buffer_start..) {
          let slug = slugify_heading(text);
          if !slug.is_empty() {
            self.heading_slugs.push(slug);
          }
        }
        self.in_heading = false;
      }
      // Raw `<hN>` in a table cell and plain text both write no ATX prefix, so
      // there is no closing sequence to protect.
      if !self.plain_text && !self.in_table_cell() {
        self.escape_trailing_heading_hashes();
      }
    }

    // TAG_A exit: write ](url) directly to buffer — zero allocation
    if !self.plain_text
      && !has_override
      && tag_id == Some(TAG_A)
      && table_separator.is_none()
      && self.depth_map[TAG_PRE as usize] == 0
    {
      // Handle whitespace trimming (write_output with None)
      self.write_output(false, is_inline, configured_new_lines, None, false);
      let link_text_end = self.buffer.len();
      // Write link close directly
      if let Some(href) = node.attributes.get("href") {
        let resolved = resolve_url(
          href,
          self.options.origin.as_deref(),
          self.options.clean_urls,
        );
        let resolved = resolved.as_ref();
        let mut title = node.attributes.get("title").map_or("", String::as_str);
        if !title.is_empty() && self.last_content_cache_len > 0 {
          let buf_len = self.buffer.len();
          let start = buf_len.saturating_sub(self.last_content_cache_len);
          if self.buffer.is_char_boundary(start) {
            let cache = &self.buffer[start..];
            if cache == title {
              title = "";
            }
          }
        }
        // GFM autolink shorthand: when href equals text content and is a
        // bare absolute URI (http(s)://, ftp://, mailto:), emit `<href>`
        // instead of the verbose `[href](href)`. link_bracket_pos points
        // directly at the `[` byte (set in emit_enter_element), so this
        // is an O(1) check. `[` is single-byte UTF-8, so `bp + 1` is
        // always a char boundary once `buf_bytes[bp]` is confirmed `[`.
        if title.is_empty() && is_autolink_uri(resolved) {
          let bp = self.link.bracket_pos;
          let buf_bytes = self.buffer.as_bytes();
          if bp < buf_bytes.len() && buf_bytes[bp] == b'[' && &self.buffer[bp + 1..] == resolved {
            self.buffer.truncate(bp);
            self.buffer.push('<');
            self.buffer.push_str(resolved);
            self.buffer.push('>');
            self.last_content_cache_len = self.buffer.len() - bp;
            self.end_link();
            self.last_node_is_inline = is_inline;
            return;
          }
        }
        self.buffer.push(']');
        write_markdown_resource(
          &mut self.buffer,
          resolved,
          (!title.is_empty()).then_some(title),
        );
        // The cache is a length, not an offset: the link starts at its `[`.
        // Saturating because `link_bracket_pos` is `buffer.len()` when no `[`
        // was emitted.
        self.last_content_cache_len = self.buffer.len().saturating_sub(self.link.bracket_pos);
        if self.clean_flags & CLEAN_FRAGMENTS != 0
          && self.depth_map[TAG_CODE as usize] == 0
          && let Some(fragment) = resolved.strip_prefix('#')
          && !fragment.is_empty()
        {
          self.fragment_links.push(FragmentLink {
            bracket_start: self.link.bracket_pos,
            text_end: link_text_end,
            link_end: self.buffer.len(),
            fragment: fragment.to_string(),
          });
        }
      }
      self.end_link();
      self.last_node_is_inline = is_inline;
      return;
    }

    // Empty pair: only the enter marker was written, so drop it instead of emitting a close.
    if !has_override
      && let Some(id) = tag_id
      && (id != TAG_CODE || (self.depth_map[TAG_PRE as usize] == 0 && !self.in_raw_html_block()))
      && let Some(inline_marker_type) = Self::inline_marker_type(id)
      && output.as_deref().is_some_and(|emitted| !emitted.is_empty())
      && let Some((open_type, output_start, content_start)) = self.open_markers.pop()
    {
      if open_type == inline_marker_type
        && content_start <= self.buffer.len()
        && self.buffer.as_bytes()[content_start..]
          .iter()
          .all(|&b| is_whitespace(b))
      {
        // `output_start` includes a separator owned by the opener (inline
        // code in a list can emit " `"), but excludes normal surrounding
        // spacing synthesized by write_output.
        self.buffer.truncate(output_start);
        self.last_content_cache_len = 0;
        self.last_node_is_inline = is_inline;
        return;
      }

      // A mismatched or externally modified opener cannot be dropped. Its
      // output makes every enclosing marker non-empty, so release them all.
      self.open_markers.clear();
    }

    if !self.open_markers.is_empty()
      && (has_override
        || (tag_id.is_some() && !is_inline)
        || output
          .as_deref()
          .is_some_and(|o| o.as_bytes().iter().any(|&b| !is_whitespace(b))))
    {
      self.open_markers.clear();
    }

    if let Some(span) = closing_code_span {
      output = Some(Cow::Owned(self.finalize_code_span(&span)));
    }
    if !has_override
      && closes_own_pre_fence
      && let Some(delimiter) = self.finalize_code_fence()
      && let Some(exit) = output.as_deref()
    {
      output = Some(Cow::Owned(exit.replacen(
        MARKDOWN_CODE_BLOCK,
        &delimiter,
        1,
      )));
    }

    // Get effective output
    let effective: Option<&str> = if let Some(ref sep) = table_separator {
      Some(sep.as_str())
    } else {
      output.as_deref()
    };

    if tag_id == Some(TAG_LI) && !self.plain_text {
      self.resolve_item_marker(true);
    }

    self.write_output(false, is_inline, configured_new_lines, effective, false);

    // Reset <pre> fence deferral once the element closes (issue #97).
    if tag_id == Some(TAG_PRE) {
      // The closing fence consumed the trailing newline; clear the whitespace
      // flags too, or the next node trims the blank line through the fence.
      if self.pre_fence_open {
        self.last_text_node_contains_whitespace = false;
        self.has_last_text_node = false;
      }
      self.pre_fence_pending = false;
      self.pre_fence_open = false;
    }

    if tag_id == Some(TAG_A) {
      self.end_link();
    }
  }

  /// Emit a bare <pre>'s opening code fence (issue #97). Mirrors the
  /// <code>-in-<pre> enter formatting: indented and newline-padded inside a
  /// list item, otherwise a plain ```lang opener. Marks the <pre> as owning
  /// the fence so a nested <code> does not double up and the <pre> exit emits
  /// the matching closing fence.
  fn flush_pre_fence(&mut self) {
    if self.plain_text {
      self.pre_fence_pending = false;
      return;
    }

    // Flush before the fence records buffer offsets. Completed quote lines do
    // not need to stay retained behind a fence that starts later in this chunk.
    self.flush_streaming_blockquote_lines();

    self.pre_fence_pending = false;
    self.pre_fence_open = true;
    let li_depth = self.depth_map[TAG_LI as usize];
    let fence = if li_depth > 0 {
      // A blank line between the marker and the fence ends the item, leaving the
      // block a sibling of the list, so a pending marker takes no separator.
      let indent = self.list_indent.as_str();
      let open = self.block_open_prefix(indent).unwrap_or(Cow::Borrowed(""));
      format!("{open}```{1}\n{0}", indent, self.pre_fence_lang)
    } else {
      format!("```{}\n", self.pre_fence_lang)
    };
    let output_start = self.buffer.len();
    self.last_content_cache_len = fence.len();
    self.buffer.push_str(&fence);
    self.start_code_fence(
      output_start,
      self.buffer.len(),
      self.pre_fence_lang.clone(),
      self.list_indent.clone(),
    );
    self.last_node_is_inline = false;
  }

  /// Emit markdown for a text node (no TextNode allocation).
  #[inline]
  pub(crate) fn emit_text(
    &mut self,
    text: &str,
    contains_whitespace: bool,
    depth: usize,
    index: usize,
  ) {
    if self.format == OutputFormat::Html {
      self.emit_html_text(text);
      return;
    }
    let has_inline_gfm_hazard = text
      .bytes()
      .any(|byte| GFM_BYTE_FLAGS[byte as usize] & (GFM_HAZARD_BIT | GFM_NEWLINE_BIT) != 0);
    self.text_buffer_has_inline_gfm_hazard |= has_inline_gfm_hazard;
    self.emit_text_with_generated_markdown(text, contains_whitespace, depth, index, None, None);
  }

  pub(crate) fn emit_text_with_generated_markdown(
    &mut self,
    text: &str,
    contains_whitespace: bool,
    depth: usize,
    index: usize,
    generated_prefix: Option<&str>,
    generated_suffix: Option<&str>,
  ) {
    if self.format == OutputFormat::Html {
      self.emit_html_text(text);
      return;
    }
    let has_inline_gfm_hazard = std::mem::take(&mut self.text_buffer_has_inline_gfm_hazard);
    if text.is_empty() {
      return;
    }

    if self.list_rule_pending {
      if text.as_bytes().iter().all(|&byte| is_whitespace(byte)) {
        return;
      }
      self.flush_list_rule();
    }

    if self.pending_inline_whitespace {
      if text.as_bytes().iter().all(|&b| is_whitespace(b)) {
        return;
      }
      let last = self.last_output_byte();
      let first = text.as_bytes()[0];
      if !matches!(last, Some(b' ' | b'\n' | b'\t') | None) && !is_whitespace(first) {
        self.buffer.push(' ');
      }
      self.pending_inline_whitespace = false;
    }

    // Open a deferred <pre> fence before its first non-whitespace text.
    if self.pre_fence_pending
      && text
        .as_bytes()
        .iter()
        .any(|&b| b != b' ' && b != b'\t' && b != b'\n' && b != b'\r')
    {
      self.flush_pre_fence();
    }
    // Still pending means this <pre> has only seen whitespace so far; drop it
    // so an empty/whitespace-only <pre> emits nothing and never leaks between
    // surrounding blocks (issue #97).
    if self.pre_fence_pending {
      return;
    }

    if self.plain_text && self.depth_map[TAG_PRE as usize] > 0 && self.buffer.is_empty() {
      self.preserve_leading_whitespace = true;
    }

    let buf_bytes = self.buffer.as_bytes();
    let buf_len = buf_bytes.len();
    let last_char = if buf_len > 0 {
      buf_bytes[buf_len - 1]
    } else if self.has_flushed_tail() {
      // The buffer was drained (and possibly trimmed) empty, but earlier output
      // ended with this byte. Spacing must be decided against it, not `0`, so a
      // word separator that one-shot keeps is not dropped across the boundary.
      self.flushed_tail[1]
    } else {
      0
    };

    if text.len() == 1
      && text.as_bytes()[0] == b' '
      && matches!(last_char, b' ' | b'\n' | b'\t' | b'\r')
    {
      self.last_text_node_contains_whitespace = contains_whitespace;
      self.has_last_text_node = true;
      self.last_text_node_depth = depth;
      self.last_text_node_index = index;
      self.last_node_is_inline = false;
      return;
    }

    // Indent code block content inside a list item so every line starts at
    // the list item's content column. CommonMark closes the list item when
    // a line is indented less than that column, so we prepend list_indent
    // on top of any existing in-source indentation. Blank lines are left
    // alone so they stay blank.
    let li_depth = self.depth_map[TAG_LI as usize] as usize;
    let indented_storage;
    let text = if !self.plain_text
      && self.depth_map[TAG_PRE as usize] > 0
      && li_depth > 0
      && (text.contains('\n') || last_char == b'\n')
    {
      let indent = self.list_indent.as_str();
      let mut out = String::with_capacity(text.len() + indent.len() * 2);
      let bytes = text.as_bytes();
      // Prepend indent for the first line when the buffer ended with a
      // newline (code fence opener). Blank first line stays blank.
      if last_char == b'\n' {
        let first = bytes.first().copied().unwrap_or(0);
        if first != b'\n' && first != 0 {
          out.push_str(indent);
        }
      }
      let mut prev = 0usize;
      for (i, &b) in bytes.iter().enumerate() {
        if b == b'\n' {
          out.push_str(&text[prev..=i]);
          let next = i + 1;
          if next < bytes.len() && bytes[next] != b'\n' {
            out.push_str(indent);
          }
          prev = next;
        }
      }
      out.push_str(&text[prev..]);
      indented_storage = out;
      indented_storage.as_str()
    } else {
      text
    };

    // Inside a table cell the <pre>/<code> is emitted as raw HTML, so every
    // text node must be escaped (so decoded `<`/`&` are not live HTML) and its
    // line breaks folded into <br> (issue #147). Runs on all such text, not
    // only text with newlines, since escaping is always required.
    let cell_storage;
    let text = if !self.plain_text && self.depth_map[TAG_PRE as usize] > 0 && self.in_table_cell() {
      cell_storage = Self::fold_pre_lines_to_br(text);
      cell_storage.as_str()
    } else {
      text
    };

    let inside_raw_html_block = self.in_raw_html_block();
    if inside_raw_html_block {
      self.track_raw_html_markdown_context(self.buffer.len());
    } else {
      self.raw_html_markdown = false;
      self.raw_html_scanned_to = self.buffer.len();
    }
    let raw_html_storage;
    let text = if !self.plain_text && self.depth_map[TAG_PRE as usize] == 0 && inside_raw_html_block
    {
      raw_html_storage = self.escape_raw_html_text(text);
      raw_html_storage.as_ref()
    } else {
      text
    };

    // Loop-invariant container tests, behind a closure so the byte scan runs
    // only when no cheaper test already decided.
    let in_table = self.depth_map[TAG_TABLE as usize] > 0;
    let in_link = self.depth_map[TAG_A as usize] > 0;
    let in_quote = self.depth_map[TAG_BLOCKQUOTE as usize] > 0;
    let context_has_gfm_hazard = |text: &str| {
      !inside_raw_html_block
        && (in_table || in_link || in_quote)
        && text.bytes().any(|byte| match byte {
          b'|' => in_table,
          b']' => in_link,
          b'>' => in_quote,
          _ => false,
        })
    };
    let escaped_storage;
    let text = if !self.plain_text
      && self.depth_map[TAG_PRE as usize] == 0
      && self.depth_map[TAG_CODE as usize] == 0
      && (has_inline_gfm_hazard
        || context_has_gfm_hazard(text)
        || self.starts_with_gfm_block_candidate(text))
      // Past a blank line a raw-HTML region is Markdown again, so its text needs
      // escaping too — unless this line reopens a raw block.
      && (!inside_raw_html_block
        || (self.raw_html_markdown && !self.line_opens_raw_html_block()))
    {
      #[cfg(test)]
      {
        self.gfm_escape_slow_path_calls += 1;
      }
      escaped_storage = self.escape_gfm_text(text);
      escaped_storage.as_ref()
    } else {
      text
    };

    let generated_storage;
    let text = if generated_prefix.is_some() || generated_suffix.is_some() {
      generated_storage = format!(
        "{}{}{}",
        generated_prefix.unwrap_or_default(),
        text,
        generated_suffix.unwrap_or_default()
      );
      generated_storage.as_str()
    } else {
      text
    };

    if self.wrap_width != 0 && self.can_wrap_here() {
      self.push_text_wrapped(text, last_char);
    } else if !(self.plain_text && self.depth_map[TAG_PRE as usize] > 0)
      && self.should_add_spacing_before_text(last_char, text)
    {
      self.buffer.push(' ');
      self.last_content_cache_len = text.len() + 1;
      self.buffer.push_str(text);
    } else {
      self.last_content_cache_len = text.len();
      self.buffer.push_str(text);
    }

    if !self.open_markers.is_empty() && text.as_bytes().iter().any(|&b| !is_whitespace(b)) {
      self.open_markers.clear();
    }

    self.last_text_node_contains_whitespace = contains_whitespace;
    self.has_last_text_node = true;
    self.last_text_node_depth = depth;
    self.last_text_node_index = index;
    self.last_node_is_inline = false;
  }

  /// Escape GFM syntax originating in an HTML text node. Generated tag
  /// markers are written elsewhere and never pass through this path.
  #[inline]
  fn escape_gfm_text<'a>(&self, text: &'a str) -> Cow<'a, str> {
    let in_table = self.depth_map[TAG_TABLE as usize] > 0;
    let in_link = self.depth_map[TAG_A as usize] > 0;
    let in_blockquote = self.depth_map[TAG_BLOCKQUOTE as usize] > 0;
    let mut line_indent = self.markdown_line_indent();
    let mut ordered_digits = 0u8;
    let bytes = text.as_bytes();
    let mut output: Option<String> = None;
    let mut copied_until = 0usize;
    let mut index = 0usize;

    while index < bytes.len() {
      let byte = bytes[index];

      if GFM_BYTE_FLAGS[byte as usize] & GFM_TEXT_ACTIVE_BIT == 0 {
        while index < bytes.len()
          && GFM_BYTE_FLAGS[bytes[index] as usize] & GFM_TEXT_ACTIVE_BIT == 0
        {
          index += 1;
        }
        line_indent = None;
        ordered_digits = 0;
        continue;
      }

      // A `\&` guarding a decoded entity reference is emitted by the entity
      // decoder; preserve the pair verbatim so this pass never doubles the slash.
      if byte == b'\\'
        && bytes.get(index + 1).is_some_and(|&next| {
          next == b'&' && Self::is_entity_reference_after_ampersand(&bytes[index + 1..])
        })
      {
        line_indent = None;
        ordered_digits = 0;
        index += 2;
        continue;
      }

      if in_table && matches!(byte, b'\n' | b'\r') {
        let out = output.get_or_insert_with(|| String::with_capacity(text.len() + 8));
        out.push_str(&text[copied_until..index]);
        out.push_str(if byte == b'\n' { "&#10;" } else { "&#13;" });
        copied_until = index + 1;
        index += 1;
        continue;
      }

      let mut should_escape = matches!(byte, b'\\' | b'*' | b'_' | b'~' | b'`' | b'[')
        || (byte == b']' && in_link)
        || (byte == b'|' && in_table)
        || (byte == b'>' && in_blockquote)
        || (byte == b'<'
          && bytes
            .get(index + 1)
            .is_some_and(|next| next.is_ascii_alphabetic() || matches!(next, b'!' | b'/' | b'?')));

      if !should_escape && line_indent.is_some() {
        if byte == b'#' {
          let mut end = index + 1;
          while end < bytes.len() && bytes[end] == b'#' {
            end += 1;
          }
          should_escape =
            end - index <= 6 && Self::is_markdown_marker_whitespace(bytes.get(end).copied());
        } else if byte == b'-' || byte == b'+' {
          should_escape = Self::is_markdown_marker_whitespace(bytes.get(index + 1).copied())
            || (byte == b'-' && Self::is_thematic_break(&bytes[index..], byte));
        } else if byte == b'>' {
          should_escape = true;
        }
      } else if !should_escape && ordered_digits > 0 && (byte == b'.' || byte == b')') {
        should_escape = Self::is_markdown_marker_whitespace(bytes.get(index + 1).copied());
      }

      if should_escape {
        let out = output.get_or_insert_with(|| String::with_capacity(text.len() + 8));
        out.push_str(&text[copied_until..index]);
        out.push('\\');
        out.push(byte as char);
        copied_until = index + 1;
      }

      if byte == b'\n' {
        line_indent = Some(0);
        ordered_digits = 0;
      } else if let Some(indent) = line_indent {
        if byte == b' ' && indent < 3 {
          line_indent = Some(indent + 1);
        } else {
          ordered_digits = u8::from(byte.is_ascii_digit());
          line_indent = None;
        }
      } else if ordered_digits > 0 {
        ordered_digits = if byte.is_ascii_digit() && ordered_digits < 9 {
          ordered_digits + 1
        } else {
          0
        };
      }
      index += 1;
    }

    if let Some(mut out) = output {
      out.push_str(&text[copied_until..]);
      Cow::Owned(out)
    } else {
      Cow::Borrowed(text)
    }
  }

  #[inline]
  fn starts_with_gfm_block_candidate(&self, text: &str) -> bool {
    // Text-side reject first: prose that cannot open a block skips the buffer
    // scan entirely, which is most text nodes.
    match text.as_bytes().first() {
      Some(b' ' | b'#' | b'-' | b'+' | b'>' | b'0'..=b'9') => {}
      _ => return false,
    }
    let Some(mut indent) = self.markdown_line_indent() else {
      return false;
    };
    for byte in text.bytes() {
      if byte == b' ' && indent < 3 {
        indent += 1;
        continue;
      }
      return matches!(byte, b'#' | b'-' | b'+' | b'>' | b'0'..=b'9');
    }
    false
  }

  /// GFM reads a heading's trailing `#` run as an ATX closing sequence and drops
  /// it along with the text it was meant to be, so the run is escaped. Only a run
  /// preceded by whitespace (or forming the whole heading) closes a heading.
  fn escape_trailing_heading_hashes(&mut self) {
    let bytes = self.buffer.as_bytes();
    // Cheap reject: almost no heading ends in `#`.
    let mut end = bytes.len();
    while end > 0 && matches!(bytes[end - 1], b' ' | b'\t') {
      end -= 1;
    }
    if end == 0 || bytes[end - 1] != b'#' {
      return;
    }
    // Content begins past the opening `#` prefix, which this pass must not touch.
    let line = bytes[..end]
      .iter()
      .rposition(|&byte| byte == b'\n')
      .map_or(0, |i| i + 1);
    let mut start = line;
    while start < bytes.len() && bytes[start] == b'#' {
      start += 1;
    }
    start += usize::from(bytes.get(start) == Some(&b' '));
    if end < start {
      return;
    }
    let mut run = end;
    while run > start && bytes[run - 1] == b'#' {
      run -= 1;
    }
    if run < end && (run == start || matches!(bytes[run - 1], b' ' | b'\t')) {
      self.buffer.insert(run, '\\');
    }
  }

  /// Whether `end` sits just past a list marker that is all its line holds:
  /// optional indent, `-`/`*`/`+` or `N.`/`N)`, and nothing else.
  fn list_marker_line_start(&self, bytes: &[u8], end: usize) -> bool {
    let mut index = end - 1;
    match bytes[index] {
      b'.' | b')' => {
        let digits = index;
        while index > 0 && bytes[index - 1].is_ascii_digit() {
          index -= 1;
        }
        if index == digits || digits - index > 9 {
          return false;
        }
      }
      b'-' | b'*' | b'+' => {}
      _ => return false,
    }
    let mut spaces = 0;
    while index > 0 && bytes[index - 1] == b' ' && spaces < 3 {
      index -= 1;
      spaces += 1;
    }
    if index == 0 {
      return !self.has_flushed_tail() || self.flushed_tail[1] == b'\n';
    }
    bytes[index - 1] == b'\n'
  }

  /// Arm the empty-item guard for the `<li>` whose marker was just written from
  /// `output_start`. A marker line continuing the paragraph above turns a lone
  /// marker into a setext underline: the text becomes a heading and the item
  /// disappears. A blank line, or a sibling marker, opens its own block instead.
  fn record_item_marker(&mut self, index: usize, output_start: usize) {
    // Only a list's first item can follow a paragraph, so every later sibling
    // skips the line scan below.
    if index != 0 {
      self.empty_item_hazard = false;
      return;
    }
    let output_start = output_start.min(self.buffer.len());
    let bytes = self.buffer.as_bytes();
    let line_start = bytes[output_start..]
      .iter()
      .rposition(|&byte| byte == b'\n')
      .map_or(output_start, |i| output_start + i + 1);
    // Draining removes the front of the buffer, so read through it the way
    // `write_output` does: `flushed_tail` holds the two bytes before `buffer[0]`.
    let before = |offset: usize| -> u8 {
      match line_start.checked_sub(offset) {
        Some(at) => bytes[at],
        None if self.has_flushed_tail() => self.flushed_tail[2 - (offset - line_start)],
        None => 0,
      }
    };
    let starts_document = line_start == 0 && !self.has_streamed_output;
    let blank_above = before(1) != b'\n' || before(2) == b'\n';
    self.empty_item_hazard = !starts_document && !blank_above;
    self.empty_item_line_start = line_start;
    self.empty_item_len = self.buffer.len();
  }

  /// Give a marker that ended up alone on its line the blank line it needs: the
  /// item is empty, or opened with a block starting on the next line. While
  /// nothing has been written since the marker the answer is still open, so only
  /// the `<li>` exit forces one.
  pub(crate) fn resolve_item_marker(&mut self, at_exit: bool) {
    if !self.empty_item_hazard {
      return;
    }
    // A rewrite behind the recorded length followed by multi-byte content can
    // leave the offset mid-codepoint, which panics on slicing.
    let mut end = self.empty_item_len.min(self.buffer.len());
    while end > 0 && !self.buffer.is_char_boundary(end) {
      end -= 1;
    }
    let tail = self.buffer[end..].trim_start_matches(' ');
    if tail.is_empty() && !at_exit {
      return;
    }
    // An open inline marker, and an open `<a>`'s `[`, are rewritten away if the
    // element closes empty, so neither is content the item can be decided on —
    // only its exit is. It must open exactly at the item's content start;
    // anything earlier is content that already settles the question.
    let opens_the_item = |position: usize| position == end;
    if !at_exit
      && (self
        .open_markers
        .first()
        .is_some_and(|&(_, position, _)| opens_the_item(position))
        || (self.depth_map[TAG_A as usize] > 0 && opens_the_item(self.link.bracket_pos)))
    {
      return;
    }
    // Content on the marker's own line settles it: no blank line is owed.
    if !tail.is_empty() && !tail.starts_with('\n') {
      self.empty_item_hazard = false;
      return;
    }
    // Otherwise only the item's own exit may act. A following `<li>` records a new
    // marker and drops this pending one, which is how one-shot leaves `<li><li>`
    // tight; the drain calling in early must not insert on its behalf.
    if !at_exit {
      return;
    }
    self.empty_item_hazard = false;
    self.buffer.insert(self.empty_item_line_start, '\n');
    // The insertion moves cached offsets at or past the line: an inline marker
    // still open across it measures emptiness from `content_start`, so left
    // unshifted it stops looking empty and streaming leaks markers one-shot drops.
    //
    // Not the blockquote frames. Their `content_start` marks where quote
    // prefixing begins, which belongs *before* this newline; shifting it turns
    // `- \n  >\n  > -` into `- \n\n  > -`, which GFM reads as the list's sibling
    // rather than its child. `link_bracket_pos` needs no shift either — a pending
    // `[` is the tail this function has already returned on.
    let at = self.empty_item_line_start;
    for (_, output_start, content_start) in &mut self.open_markers {
      if *output_start >= at {
        *output_start += 1;
      }
      if *content_start >= at {
        *content_start += 1;
      }
    }
    // A code span or fence measures and rewrites itself through these offsets,
    // so an insertion before them leaves both pointing a byte early -- far
    // enough to land inside a multi-byte character and panic the slice that
    // builds the closing delimiter.
    for span in &mut self.code_spans {
      if span.output_start >= at {
        span.output_start += 1;
      }
      if span.content_start >= at {
        span.content_start += 1;
      }
    }
    if let Some(fence) = &mut self.code_fence {
      // `marker_offset` is relative to `output_start`, so it rides along.
      if fence.output_start >= at {
        fence.output_start += 1;
      }
      if fence.content_start >= at {
        fence.content_start += 1;
      }
    }
    self.invalidate_line_start();
    self.raw_html_scanned_to = self.raw_html_scanned_to.min(at);
  }

  #[inline]
  fn is_markdown_marker_whitespace(byte: Option<u8>) -> bool {
    matches!(byte, None | Some(b' ' | b'\t' | b'\n' | b'\r'))
  }

  #[inline]
  fn is_thematic_break(value: &[u8], marker: u8) -> bool {
    let mut count = 0u8;
    for &byte in value {
      if byte == marker {
        count = count.saturating_add(1);
      } else if byte == b'\n' || byte == b'\r' {
        break;
      } else if byte != b' ' && byte != b'\t' {
        return false;
      }
    }
    count >= 3
  }

  #[inline]
  fn is_entity_reference_after_ampersand(value: &[u8]) -> bool {
    let mut index = 1usize;
    if value.get(index) == Some(&b'#') {
      index += 1;
      let hex = matches!(value.get(index), Some(b'x' | b'X'));
      if hex {
        index += 1;
      }
      let start = index;
      while let Some(&byte) = value.get(index) {
        if byte.is_ascii_digit() || (hex && byte.is_ascii_hexdigit()) {
          index += 1;
        } else {
          break;
        }
      }
      return index > start && value.get(index) == Some(&b';');
    }
    let start = index;
    while value.get(index).is_some_and(u8::is_ascii_alphanumeric) {
      index += 1;
    }
    index > start && value.get(index) == Some(&b';')
  }

  /// Current leading-space count when a GFM block marker may start here.
  #[inline]
  fn markdown_line_indent(&self) -> Option<u8> {
    let bytes = self.buffer.as_bytes();
    let mut spaces = 0u8;
    for (offset, &byte) in bytes.iter().enumerate().rev() {
      if byte == b'\n' {
        return Some(spaces);
      }
      if byte != b' ' || spaces == 3 {
        // A list marker is block prefix too: its content column opens a fresh
        // block context, so `- # h` escapes exactly like `# h` would.
        return self.list_marker_line_start(bytes, offset + 1).then_some(0);
      }
      spaces += 1;
    }
    if self.buffer.is_empty() && self.has_streamed_output {
      if self.flushed_tail[1] == b'\n' {
        Some(0)
      } else {
        None
      }
    } else {
      Some(spaces)
    }
  }

  /// Whether prose at the current position may be hard-wrapped. Code blocks
  /// (`<pre>`/`<code>`), table cells, and headings are emitted verbatim so
  /// wrapping never corrupts fences, table rows, or heading lines.
  #[inline]
  fn can_wrap_here(&self) -> bool {
    self.depth_map[TAG_PRE as usize] == 0
      && self.depth_map[TAG_CODE as usize] == 0
      && !self.in_table_cell()
      && !self.in_heading()
  }

  #[inline]
  pub(crate) fn in_heading(&self) -> bool {
    self.depth_map[TAG_H1 as usize] > 0
      || self.depth_map[TAG_H2 as usize] > 0
      || self.depth_map[TAG_H3 as usize] > 0
      || self.depth_map[TAG_H4 as usize] > 0
      || self.depth_map[TAG_H5 as usize] > 0
      || self.depth_map[TAG_H6 as usize] > 0
  }

  /// Prepare `<pre>` content for raw-HTML emission inside a GFM table cell
  /// (issue #147): fold literal line breaks into `<br>` so the value stays on
  /// one row, encode `|`, and HTML-escape `&`, `<`, `>` so decoded source (e.g.
  /// `<script>`) is not evaluated as live HTML. Leading and trailing breaks are
  /// dropped; a `\r\n` pair counts as one break.
  fn fold_pre_lines_to_br(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut start = 0usize;
    while start < bytes.len() && (bytes[start] == b'\n' || bytes[start] == b'\r') {
      start += 1;
    }
    let mut end = bytes.len();
    while end > start && (bytes[end - 1] == b'\n' || bytes[end - 1] == b'\r') {
      end -= 1;
    }
    // `start`/`end` land on ASCII newline bytes, so slicing here is UTF-8 safe.
    let trimmed = &value[start..end];
    let mut out = String::with_capacity(trimmed.len());
    let mut chars = trimmed.chars().peekable();
    while let Some(c) = chars.next() {
      if c == '\r' {
        out.push_str("<br>");
        if chars.peek() == Some(&'\n') {
          chars.next();
        }
      } else if c == '\n' {
        out.push_str("<br>");
      } else if c == '&' {
        out.push_str("&amp;");
      } else if c == '<' {
        out.push_str("&lt;");
      } else if c == '>' {
        out.push_str("&gt;");
      } else if c == '|' {
        out.push_str("&#124;");
      } else {
        out.push(c);
      }
    }
    out
  }

  fn escape_raw_html_text<'a>(&self, value: &'a str) -> Cow<'a, str> {
    let in_table = self.depth_map[TAG_TABLE as usize] > 0;
    let in_link = self.depth_map[TAG_A as usize] > 0;
    let mut output: Option<String> = None;
    let mut copied_until = 0usize;

    let bytes = value.as_bytes();
    let mut index = 0usize;
    while index < bytes.len() {
      let byte = bytes[index];
      let replacement = match byte {
        b'&' => Some("&amp;"),
        b'<' => Some("&lt;"),
        b'>' => Some("&gt;"),
        b'\n' => Some("&#10;"),
        b'\r' => Some("&#13;"),
        b'|' if in_table => Some("&#124;"),
        b'[' if in_link => Some("&#91;"),
        b']' if in_link => Some("&#93;"),
        _ => None,
      };
      if let Some(replacement) = replacement {
        let out = output.get_or_insert_with(|| String::with_capacity(value.len() + 8));
        out.push_str(&value[copied_until..index]);
        out.push_str(replacement);
        copied_until = index + 1;
      }
      index += 1;
    }

    if let Some(mut output) = output {
      output.push_str(&value[copied_until..]);
      Cow::Owned(output)
    } else {
      Cow::Borrowed(value)
    }
  }

  /// Lowest offset a trailing-whitespace trim may cut back to. Open fences,
  /// code spans, and blockquotes record offsets whose bytes are delimiter, not
  /// spacing; cutting behind one corrupts the block and leaves `content_start`
  /// past the buffer end, which panics on finalize.
  #[inline]
  fn trim_floor(&self) -> usize {
    let mut floor = 0usize;
    if let Some(fence) = &self.code_fence {
      floor = floor.max(fence.content_start);
    }
    if let Some(span) = self.code_spans.last() {
      floor = floor.max(span.content_start);
    }
    if let Some(frame) = self.blockquotes.last() {
      floor = floor.max(frame.content_start);
    }
    floor
  }

  /// Byte the next output will follow, or `None` only at the true start of
  /// output. Draining, or a rewrite that trims what draining retained, can empty
  /// the buffer mid-document; `flushed_tail` then holds the bytes before it.
  #[inline]
  fn last_output_byte(&self) -> Option<u8> {
    match self.buffer.as_bytes().last().copied() {
      Some(byte) => Some(byte),
      None if self.has_flushed_tail() => Some(self.flushed_tail[1]),
      None => None,
    }
  }

  /// Note that the buffer has been shortened to `len`. A list marker's recorded
  /// end is a length, and the space a trim takes is the marker's own: left past
  /// the content it reads the element that opens the item as content.
  #[inline]
  fn clamp_item_marker_end(&mut self, len: usize) {
    if self.empty_item_len > len {
      self.empty_item_len = len;
    }
  }

  #[inline]
  fn trim_trailing_spaces(&mut self) {
    let floor = self.trim_floor();
    if self.buffer.len() > floor {
      let trimmed_len = floor + self.buffer[floor..].trim_end_matches(' ').len();
      // The cached run just lost its tail. Left stale, the length outruns the
      // buffer wherever a drain has already cut the front, and the reach-back
      // trim's `cache_len <= buf_len` guard then skips a retraction one-shot
      // performs, keeping block spacing an empty element wrote.
      self.last_content_cache_len = self
        .last_content_cache_len
        .saturating_sub(self.buffer.len() - trimmed_len);
      self.clamp_item_marker_end(trimmed_len);
      self.buffer.truncate(trimmed_len);
    }
  }

  // The blank-line scan holds an absolute buffer offset, so quoting has to scan
  // the bytes it is about to move while they still read the way one-shot sees
  // them. Call before the rewrite, `shift_raw_html_scan` after it.
  fn scan_before_requote(&mut self, old_end: usize) {
    if self.raw_html_scanned_to < old_end && self.in_raw_html_block() {
      self.track_raw_html_markdown_context(old_end);
    }
  }

  // Quoting `[_, old_end)` into `[_, new_end)` moves every byte after it.
  fn shift_raw_html_scan(&mut self, old_end: usize, new_end: usize) {
    self.raw_html_scanned_to = if self.raw_html_scanned_to < old_end {
      // A blank line among the quoted bytes is a `>` line now, which the scan
      // would not match, and the cursor is rebased before it is next read.
      new_end
    } else {
      self.raw_html_scanned_to + new_end - old_end
    };
  }

  #[inline]
  /// Note whether the open raw-HTML region has been broken by a blank line.
  pub(super) fn track_raw_html_markdown_context(&mut self, end: usize) {
    if self.raw_html_markdown {
      return;
    }
    let len = end.min(self.buffer.len());
    if self.raw_html_scanned_to == 0
      && self.has_flushed_tail()
      && self.flushed_tail[1] == b'\n'
      && self.buffer.as_bytes().first() == Some(&b'\n')
    {
      self.raw_html_markdown = true;
      return;
    }
    // Byte scanning, so a resume point inside a multi-byte character is fine.
    let from = self.raw_html_scanned_to.min(len).saturating_sub(1);
    if self.buffer.as_bytes()[from..len]
      .windows(2)
      .any(|pair| pair == b"\n\n")
    {
      self.raw_html_markdown = true;
    }
    self.raw_html_scanned_to = len;
  }

  /// Rebuild the cached line start on the next read: a rewrite has moved or
  /// inserted newlines behind the incremental scan point.
  #[inline]
  fn invalidate_line_start(&mut self) {
    self.line_start_scanned_to = usize::MAX;
  }

  /// Whether the current line opens a raw HTML block, which suspends Markdown
  /// again until the next blank line.
  fn line_opens_raw_html_block(&mut self) -> bool {
    let len = self.buffer.len();
    let bytes = self.buffer.as_bytes();
    // Only bytes appended since the last call can move the line start; a buffer
    // that shrank behind the cache (a trim, or a streaming drain) rebuilds it.
    if self.line_start_scanned_to > len || self.line_start > len {
      self.line_start = bytes[..len]
        .iter()
        .rposition(|&byte| byte == b'\n')
        .map_or(0, |i| i + 1);
    } else if let Some(i) = bytes[self.line_start_scanned_to..len]
      .iter()
      .rposition(|&byte| byte == b'\n')
    {
      self.line_start = self.line_start_scanned_to + i + 1;
    }
    self.line_start_scanned_to = len;

    // A `line_start` of zero is the drained buffer's front, not the line's, once
    // a drain has taken this line's beginning: the fragment left behind can open
    // with a tag the real line only continues, which suspends Markdown and drops
    // the escapes a one-shot conversion writes.
    if self.line_start == 0 && self.has_flushed_tail() && self.flushed_tail[1] != b'\n' {
      return match self.cut_line_lead {
        CutLineLead::RawHtml => true,
        // The cut fell inside this line's indent, so the fragment's own spaces
        // continue a run that started before it -- and three is all the run may
        // total, however it is split across cuts.
        CutLineLead::Blank(already) => {
          let line = &bytes[..len];
          let own = line.iter().take_while(|&&byte| byte == b' ').count();
          (already as usize).saturating_add(own) <= RAW_HTML_MAX_INDENT as usize
            && line.get(own) == Some(&b'<')
        }
        CutLineLead::Row | CutLineLead::Content | CutLineLead::Uncut => false,
      };
    }
    let line = &bytes[self.line_start..len];
    let indent = line
      .iter()
      .take(RAW_HTML_MAX_INDENT as usize)
      .take_while(|&&byte| byte == b' ')
      .count();
    line.get(indent) == Some(&b'<')
  }

  /// Tags whose content is emitted as raw HTML, suspending Markdown until a
  /// blank line inside the region re-enables it.
  #[inline]
  pub(crate) fn is_raw_html_block_tag(id: u8) -> bool {
    matches!(
      id,
      TAG_DETAILS | TAG_SUMMARY | TAG_ADDRESS | TAG_DL | TAG_DT | TAG_DD
    )
  }

  /// `1` at an enter means this tag begins the region.
  fn raw_html_block_depth(&self) -> u32 {
    u32::from(self.depth_map[TAG_DETAILS as usize])
      + u32::from(self.depth_map[TAG_SUMMARY as usize])
      + u32::from(self.depth_map[TAG_ADDRESS as usize])
      + u32::from(self.depth_map[TAG_DL as usize])
      + u32::from(self.depth_map[TAG_DT as usize])
      + u32::from(self.depth_map[TAG_DD as usize])
  }

  pub(crate) fn in_raw_html_block(&self) -> bool {
    self.depth_map[TAG_DETAILS as usize] > 0
      || self.depth_map[TAG_SUMMARY as usize] > 0
      || self.depth_map[TAG_ADDRESS as usize] > 0
      || self.depth_map[TAG_DL as usize] > 0
      || self.depth_map[TAG_DT as usize] > 0
      || self.depth_map[TAG_DD as usize] > 0
  }

  /// Character count of the current (unterminated) buffer line, i.e. since the
  /// last `\n`. This is the live output column, including any block prefix
  /// (`> `, list indent) already written for the line.
  #[inline]
  fn current_column(&self) -> usize {
    let bytes = self.buffer.as_bytes();
    let mut i = bytes.len();
    while i > 0 && bytes[i - 1] != b'\n' {
      i -= 1;
    }
    let buffered_column = self.buffer[i..].chars().count();
    if i == 0 {
      self.buffer_start_column.saturating_add(buffered_column)
    } else {
      buffered_column
    }
  }

  /// Separation a block needs to open at the content column `prefix` describes,
  /// or `None` when the buffer already sits there.
  fn block_open_prefix(&self, prefix: &str) -> Option<Cow<'static, str>> {
    let bytes = self.buffer.as_bytes();
    // An emptied buffer is the start of the output only while no drain has taken
    // this line away; afterwards `flushed_tail` holds what the block would be
    // glued to. A space there is the ambiguous case the `Some(b' ')` arm below
    // resolves by scanning, which a drained line no longer offers, so leave it to
    // the arm's conservative answer rather than guess a separator.
    let drained_onto_content =
      self.has_flushed_tail() && !matches!(self.flushed_tail[1], b'\n' | b' ');
    match bytes.last() {
      None if drained_onto_content => Some(Cow::Owned(format!("\n\n{prefix}"))),
      None => None,
      Some(b' ') => {
        // A trailing space can be a pending list marker already at the content
        // column, or ordinary text (`"item "`) that still has to break as a
        // paragraph. Only the former needs no separator.
        let end = bytes.len() - trailing_spaces(bytes);
        if end == 0 {
          // Every retained byte is a space, so the line's content — and the
          // marker scan's starting point — left with the drain.
          return drained_onto_content.then(|| Cow::Owned(format!("\n\n{prefix}")));
        }
        if bytes[end - 1] != b'\n' && !self.list_marker_line_start(bytes, end) {
          Some(Cow::Owned(format!("\n\n{prefix}")))
        } else {
          None
        }
      }
      Some(b'\n') => (!prefix.is_empty()).then(|| Cow::Owned(prefix.to_string())),
      // Directly under text the block reads as a setext underline or a lazy
      // continuation, so it has to break the paragraph first.
      _ => Some(Cow::Owned(format!("\n\n{prefix}"))),
    }
  }

  /// Continuation prefix re-emitted at the start of each continued line so the
  /// content stays inside its block context. Built by walking the open
  /// ancestor stack outermost-first so blockquote markers (`> `) and list-item
  /// indentation interleave in the real nesting order: `<li><blockquote>` →
  /// `  > `, `<blockquote><li>` → `>   `. A flat "all quotes then all indent"
  /// prefix would corrupt the Markdown structure of nested blocks.
  fn continuation_prefix(&self) -> String {
    if self.plain_text {
      return String::new();
    }

    let mut p = String::new();
    let mut li_idx = 0usize;
    for node in &self.stack {
      match node.tag_id {
        Some(TAG_BLOCKQUOTE) if self.blockquotes.is_empty() => p.push_str("> "),
        Some(TAG_LI) => {
          // Each open <li> contributes its marker-width of spaces, in
          // the same order they were pushed onto list_indent_widths.
          let w = self.list_indent_widths.get(li_idx).copied().unwrap_or(2) as usize;
          for _ in 0..w {
            p.push(' ');
          }
          li_idx += 1;
        }
        _ => {}
      }
    }
    p
  }

  fn flush_list_rule(&mut self) {
    let prefix = self.continuation_prefix();
    self.buffer.reserve(2 + prefix.len());
    self.buffer.push_str("\n\n");
    self.buffer.push_str(&prefix);
    self.last_content_cache_len = 2 + prefix.len();
    self.list_rule_pending = false;
  }

  /// Push `text` into the buffer, hard-wrapping on spaces so no output line
  /// exceeds `self.wrap_width` characters. Words are never split, so a single
  /// token longer than the width (e.g. a URL) overflows rather than breaking.
  /// A break only ever replaces an inter-word space, so words joined across
  /// inline boundaries (e.g. `foo**bar**`) stay intact.
  fn push_text_wrapped(&mut self, text: &str, last_char: u8) {
    let width = self.wrap_width;
    // A leading/trailing space in `text` is significant inter-word separation
    // across an inline boundary (e.g. `… </a> now`); the non-wrap path keeps
    // it by pushing `text` verbatim, so preserve it here too. `split(' ')`
    // would otherwise discard it as an empty segment.
    let leading_space = text.starts_with(' ');
    let trailing_space = text.ends_with(' ');
    let first_needs_space = leading_space || self.should_add_spacing_before_text(last_char, text);
    let prefix = self.continuation_prefix();
    let prefix_len = prefix.chars().count();
    let buf_start = self.buffer.len();
    let mut col = self.current_column();
    let mut first = true;

    for word in text.split(' ') {
      if word.is_empty() {
        continue;
      }
      let word_len = word.chars().count();
      let need_space = if first { first_needs_space } else { true };

      if need_space && col > prefix_len && col + 1 + word_len > width {
        self.buffer.push('\n');
        self.buffer.push_str(&prefix);
        col = prefix_len;
      } else if need_space {
        self.buffer.push(' ');
        col += 1;
      }
      self.buffer.push_str(word);
      col += word_len;
      first = false;
    }

    // Preserve a trailing separator space (unless we emitted nothing or the
    // line already ends in whitespace) so the next inline run stays separated.
    if trailing_space && !matches!(self.buffer.as_bytes().last(), Some(b' ' | b'\n') | None) {
      self.buffer.push(' ');
    }
    self.last_content_cache_len = self.buffer.len() - buf_start;
  }

  /// Emit frontmatter content.
  pub(crate) fn emit_frontmatter(&mut self, content: &str) {
    if self.format == OutputFormat::Markdown && !content.is_empty() {
      self.last_content_cache_len = content.len();
      self.buffer.push_str(content);
    }
  }

  #[inline]
  pub(crate) fn get_enter_output(
    &self,
    node: &ElementNode,
    _ancestors: &[ElementNode],
  ) -> Option<Cow<'static, str>> {
    if self.plain_text {
      return self.get_text_enter_output(node);
    }

    let tag_id = node.tag_id?;
    if self.depth_map[TAG_PRE as usize] > 0 && suppresses_formatting_in_pre(tag_id) {
      return None;
    }
    match tag_id {
      TAG_DETAILS => Some(Cow::Borrowed("<details>")),
      TAG_SUMMARY => Some(Cow::Borrowed("<summary>")),
      // Inside a table cell a fenced code block would split the GFM row; emit
      // raw <pre> and let the content newlines become <br> (issue #147).
      TAG_PRE if self.in_table_cell() => Some(Cow::Borrowed("<pre>")),
      TAG_BR => {
        if self.in_table_cell() || self.in_heading() || self.in_raw_html_block() {
          Some(Cow::Borrowed("<br>"))
        // Hard-break markers are literal content inside code.
        } else if self.depth_map[TAG_PRE as usize] > 0 || self.depth_map[TAG_CODE as usize] > 0 {
          Some(Cow::Borrowed("\n"))
        } else {
          let prefix = self.continuation_prefix();
          if prefix.is_empty() {
            Some(Cow::Borrowed("  \n"))
          } else {
            Some(Cow::Owned(format!("  \n{prefix}")))
          }
        }
      }
      TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
        let depth = (tag_id - TAG_H1) as usize;
        // A `#` prefix needs its own line, which a GFM row cannot give it.
        if self.depth_map[TAG_A as usize] > 0 || self.in_table_cell() {
          {
            static H_OPEN: [&str; 6] = ["<h1>", "<h2>", "<h3>", "<h4>", "<h5>", "<h6>"];
            Some(Cow::Borrowed(H_OPEN[depth]))
          }
        } else {
          Some(Cow::Borrowed(HEADING_PREFIXES[depth]))
        }
      }
      TAG_HR => {
        if self.in_table_cell() {
          // A thematic break cannot end a GFM row; raw <hr> can sit in a cell.
          return Some(Cow::Borrowed("<hr>"));
        }
        // `continuation_prefix` walks the open element stack and allocates, so
        // only a rule that can actually carry a prefix asks for one.
        if self.depth_map[TAG_LI as usize] == 0 && self.depth_map[TAG_BLOCKQUOTE as usize] == 0 {
          return Some(Cow::Borrowed(MARKDOWN_HORIZONTAL_RULE));
        }
        let prefix = self.continuation_prefix();
        if prefix.is_empty() {
          return Some(Cow::Borrowed(MARKDOWN_HORIZONTAL_RULE));
        }
        Some(match self.block_open_prefix(&prefix) {
          // Sharing the marker's line, where `---` would make the whole line a
          // thematic break and take the item with it.
          None => Cow::Borrowed(MARKDOWN_HORIZONTAL_RULE_ALT),
          Some(open) => Cow::Owned(format!("{open}{MARKDOWN_HORIZONTAL_RULE}")),
        })
      }
      TAG_STRONG | TAG_B => {
        if self.depth_map[TAG_B as usize] > 1 {
          Some(Cow::Borrowed(""))
        } else {
          Some(Cow::Borrowed(MARKDOWN_STRONG))
        }
      }
      TAG_EM | TAG_I => {
        if self.depth_map[TAG_I as usize] > 1 {
          Some(Cow::Borrowed(""))
        } else {
          Some(Cow::Borrowed(MARKDOWN_EMPHASIS))
        }
      }
      TAG_DEL | TAG_S | TAG_STRIKE => Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH)),
      TAG_SUB => Some(Cow::Borrowed("<sub>")),
      TAG_SUP => Some(Cow::Borrowed("<sup>")),
      TAG_INS => Some(Cow::Borrowed("<ins>")),
      TAG_P => {
        if self.depth_map[TAG_LI as usize] > 0 && !self.in_table_cell() {
          let last_char = self.buffer.as_bytes().last().copied().unwrap_or(0);
          if last_char != 0 && last_char != b' ' && last_char != b'\n' {
            let indent = self.list_indent.as_str();
            let mut s = String::with_capacity(2 + indent.len());
            s.push_str("\n\n");
            s.push_str(indent);
            return Some(Cow::Owned(s));
          }
        }
        None
      }
      // A caption has no handler of its own, so inside a list item nothing writes
      // its content column: glued to preceding text it swallows the table's first
      // row, and at column 0 it takes the table out of the item.
      TAG_CAPTION if self.depth_map[TAG_LI as usize] > 0 && !self.in_table_cell() => {
        self.block_open_prefix(&self.list_indent)
      }
      TAG_BLOCKQUOTE => {
        // The completed subtree receives quote prefixes once every structural
        // newline is known. Preserve the list marker's trailing space here.
        (self.depth_map[TAG_LI as usize] > 0).then_some(Cow::Borrowed("\n"))
      }
      TAG_CODE => {
        if self.depth_map[TAG_PRE as usize] > 0 {
          // Inside a table cell emit raw <code> so no fence newline splits
          // the GFM row (issue #147). The enclosing <pre> emitted raw <pre>.
          if self.in_table_cell() {
            return Some(Cow::Borrowed("<code>"));
          }
          // A fence is already open for this <pre> — the <pre> opened it (mixed
          // text + <code> children) or an earlier <code> sibling did.
          if self.pre_fence_open {
            return None;
          }
          let lang = Self::get_language_from_class(node.attributes.get("class"));
          let li_depth = self.depth_map[TAG_LI as usize] as usize;
          if li_depth > 0 {
            let indent = self.list_indent.as_str();
            // A blank line between the marker and the fence ends the item, leaving
            // the block a sibling of the list.
            let open = self.block_open_prefix(indent).unwrap_or(Cow::Borrowed(""));
            let mut s = String::with_capacity(open.len() + indent.len() + 4 + lang.len() + 1);
            s.push_str(&open);
            s.push_str("```");
            s.push_str(lang);
            s.push('\n');
            s.push_str(indent);
            Some(Cow::Owned(s))
          } else if lang.is_empty() {
            Some(Cow::Borrowed("```\n"))
          } else {
            let mut s = String::with_capacity(4 + lang.len());
            s.push_str("```");
            s.push_str(lang);
            s.push('\n');
            Some(Cow::Owned(s))
          }
        } else if self.in_raw_html_block() {
          Some(Cow::Borrowed("<code>"))
        } else if self.depth_map[TAG_LI as usize] > 0 {
          // Inline code inside a list item: collapse the paragraph
          // boundary with a separator space when following text, but
          // not when the buffer just emitted a wrapper opener where
          // a leading space would break the pairing or leak into the
          // wrapper content. Covers emphasis (`*`, `_`),
          // strikethrough (`~`), link text (`[`), HTML passthrough
          // (`>`), and whitespace. A trailing backtick does NOT
          // suppress: two adjacent `<code>` elements must be
          // separated with a space so CommonMark parses them as two
          // code spans rather than merging into one (` `a``b` ` →
          // single span with literal content ``a``b``).
          let last_char = self.buffer.as_bytes().last().copied().unwrap_or(0);
          if last_char != 0
            && !matches!(
              last_char,
              b' ' | b'\n' | b'\t' | b'*' | b'_' | b'~' | b'[' | b'>'
            )
          {
            Some(Cow::Borrowed(" `"))
          } else {
            Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
          }
        } else {
          Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
        }
      }
      TAG_UL => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("<ul>"))
        } else {
          None
        }
      }
      TAG_OL => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("<ol>"))
        } else {
          None
        }
      }
      TAG_LI => {
        if self.in_table_cell() {
          return Some(Cow::Borrowed("<li>"));
        }
        // Parent determines marker: <ol> → "N. " (digits of N + 2
        // columns), else "- " (2 columns). The indent emitted here is
        // the parent's accumulated list_indent — this LI's own marker
        // contribution is pushed onto list_indent AFTER this output
        // is written to the buffer.
        let ordered = _ancestors.last().filter(|p| p.tag_id == Some(TAG_OL));
        let mut s = String::with_capacity(self.list_indent.len() + 6);
        s.push_str(&self.list_indent);
        if let Some(list) = ordered {
          use std::fmt::Write;
          let _ = write!(s, "{}. ", Self::ordered_item_number(list, node.index));
        } else {
          s.push_str("- ");
        }
        Some(Cow::Owned(s))
      }
      TAG_A => {
        if node.attributes.contains_key("href") {
          Some(Cow::Borrowed("["))
        } else {
          None
        }
      }
      TAG_IMG => {
        let alt = node.attributes.get("alt").map_or("", String::as_str);
        let src = node.attributes.get("src").map_or("", String::as_str);
        let resolved_src =
          resolve_url(src, self.options.origin.as_deref(), self.options.clean_urls);
        {
          let title = node.attributes.get("title").map(String::as_str);
          let mut s = String::with_capacity(
            alt.len() + resolved_src.len() + title.map_or(5, |title| title.len() + 8),
          );
          s.push_str("![");
          write_image_description(&mut s, alt);
          s.push(']');
          write_markdown_resource(&mut s, &resolved_src, title);
          Some(Cow::Owned(s))
        }
      }
      TAG_TABLE => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("<table>"))
        } else {
          None
        }
      }
      TAG_THEAD => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("<thead>"))
        } else {
          None
        }
      }
      TAG_TR => {
        if self.in_table_cell() {
          return Some(Cow::Borrowed("<tr>"));
        }
        let indent = if self.depth_map[TAG_LI as usize] > 0 {
          self.list_indent.as_str()
        } else {
          ""
        };
        // A row must open its own line at the item's content column: sharing one
        // with preceding content (a `<caption>`) leaves the header as prose and
        // the delimiter row never forms a table.
        match self.line_state_before_row() {
          LineBeforeRow::Row if indent.is_empty() => Some(Cow::Borrowed("\n| ")),
          LineBeforeRow::Content if indent.is_empty() => Some(Cow::Borrowed("\n\n| ")),
          LineBeforeRow::Row => Some(Cow::Owned(format!("\n{indent}| "))),
          LineBeforeRow::Content => Some(Cow::Owned(format!("\n\n{indent}| "))),
          // A pending list marker already supplies the column; only a fresh line
          // needs the indent written.
          LineBeforeRow::Open
            if !indent.is_empty() && self.buffer.as_bytes().last() == Some(&b'\n') =>
          {
            Some(Cow::Owned(format!("{indent}| ")))
          }
          LineBeforeRow::Open => Some(Cow::Borrowed("| ")),
        }
      }
      TAG_TH | TAG_TD => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          return Some(Cow::Borrowed(if tag_id == TAG_TH {
            "<th>"
          } else {
            "<td>"
          }));
        }
        if node.index == 0 {
          Some(Cow::Borrowed(""))
        } else if self.table_header_cells > 0
          && self.table_current_row_cells >= self.table_header_cells
        {
          // GFM discards cells past the delimiter row's width, so this one folds
          // into the previous cell rather than vanishing.
          Some(Cow::Borrowed(" "))
        } else {
          Some(Cow::Borrowed(" | "))
        }
      }
      TAG_CENTER => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed("<center>"))
        } else {
          None
        }
      }
      TAG_KBD | TAG_SAMP | TAG_VAR => Some(Cow::Borrowed("`")),
      TAG_ABBR | TAG_SMALL | TAG_TIME | TAG_BDO | TAG_RUBY | TAG_RT | TAG_RP => {
        Some(Cow::Borrowed(""))
      }
      TAG_MARK => Some(Cow::Borrowed("<mark>")),
      TAG_Q => Some(Cow::Borrowed("\"")),
      TAG_U => Some(Cow::Borrowed("<u>")),
      TAG_CITE => Some(Cow::Borrowed("*")),
      TAG_FIGCAPTION => Some(Cow::Borrowed(MARKDOWN_EMPHASIS)),
      TAG_DFN => Some(Cow::Borrowed("**")),
      TAG_ADDRESS => Some(Cow::Borrowed("<address>")),
      TAG_DL => Some(Cow::Borrowed("<dl>")),
      TAG_DT => Some(Cow::Borrowed("<dt>")),
      TAG_DD => Some(Cow::Borrowed("<dd>")),
      _ => None,
    }
  }

  #[inline]
  pub(crate) fn get_exit_output(
    &self,
    node: &ElementNode,
    cell_span: u8,
  ) -> Option<Cow<'static, str>> {
    if self.plain_text {
      return Self::get_text_exit_output(node);
    }

    let tag_id = node.tag_id?;
    if self.depth_map[TAG_PRE as usize] > 0 && suppresses_formatting_in_pre(tag_id) {
      return None;
    }
    match tag_id {
      // Inside a table cell the trailing block break would split the GFM row,
      // so emit the raw close tags with no newlines (issue #147).
      TAG_DETAILS if self.in_table_cell() => Some(Cow::Borrowed("</details>")),
      TAG_SUMMARY if self.in_table_cell() => Some(Cow::Borrowed("</summary>")),
      TAG_DETAILS => Some(Cow::Borrowed("</details>\n\n")),
      TAG_SUMMARY => Some(Cow::Borrowed("</summary>\n\n")),
      TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
        let depth = (tag_id - TAG_H1 + 1) as usize;
        if self.depth_map[TAG_A as usize] > 0 || self.in_table_cell() {
          {
            static H_CLOSE: [&str; 6] = ["</h1>", "</h2>", "</h3>", "</h4>", "</h5>", "</h6>"];
            Some(Cow::Borrowed(H_CLOSE[depth - 1]))
          }
        } else {
          None
        }
      }
      TAG_STRONG | TAG_B => {
        if self.depth_map[TAG_B as usize] > 1 {
          Some(Cow::Borrowed(""))
        } else {
          Some(Cow::Borrowed(MARKDOWN_STRONG))
        }
      }
      TAG_EM | TAG_I => {
        if self.depth_map[TAG_I as usize] > 1 {
          Some(Cow::Borrowed(""))
        } else {
          Some(Cow::Borrowed(MARKDOWN_EMPHASIS))
        }
      }
      TAG_DEL | TAG_S | TAG_STRIKE => Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH)),
      TAG_SUB => Some(Cow::Borrowed("</sub>")),
      TAG_SUP => Some(Cow::Borrowed("</sup>")),
      TAG_INS => Some(Cow::Borrowed("</ins>")),
      TAG_CODE => {
        if self.depth_map[TAG_PRE as usize] > 0 {
          // Raw <code> close inside a table cell (issue #147).
          if self.in_table_cell() {
            return Some(Cow::Borrowed("</code>"));
          }
          // The <pre> exit owns the closing fence, so a text sibling after this
          // </code> still lands inside the block.
          None
        } else if self.in_raw_html_block() {
          Some(Cow::Borrowed("</code>"))
        } else {
          Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
        }
      }
      // Raw <pre> close inside a table cell (issue #147).
      TAG_PRE if self.in_table_cell() => Some(Cow::Borrowed("</pre>")),
      // Bare <pre> (no <code> child) closing fence (issue #97). Only emitted
      // when the <pre> opened its own fence; otherwise a <code> child or an
      // empty/whitespace-only <pre> means there is nothing to close.
      TAG_PRE => {
        if !self.pre_fence_open {
          return None;
        }
        let li_depth = self.depth_map[TAG_LI as usize] as usize;
        if li_depth > 0 {
          let indent = self.list_indent.as_str();
          let mut s = String::with_capacity(1 + indent.len() * 2 + 5);
          s.push('\n');
          s.push_str(indent);
          s.push_str("```\n\n");
          s.push_str(indent);
          Some(Cow::Owned(s))
        } else {
          Some(Cow::Borrowed("\n```"))
        }
      }
      TAG_UL => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("</ul>"))
        } else {
          None
        }
      }
      TAG_OL => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("</ol>"))
        } else {
          None
        }
      }
      TAG_LI => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("</li>"))
        } else {
          None
        }
      }
      TAG_TR => {
        if self.in_table_cell() || self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed("</tr>"))
        } else {
          Some(Cow::Borrowed(" |"))
        }
      }
      TAG_TABLE => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("</table>"))
        } else {
          None
        }
      }
      TAG_THEAD => {
        if self.in_table_cell() {
          Some(Cow::Borrowed("</thead>"))
        } else {
          None
        }
      }
      TAG_TH | TAG_TD => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed(if tag_id == TAG_TH {
            "</th>"
          } else {
            "</td>"
          }))
        } else {
          Self::span_filler(cell_span)
        }
      }
      TAG_CENTER => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed("</center>"))
        } else {
          None
        }
      }
      TAG_KBD | TAG_SAMP | TAG_VAR => Some(Cow::Borrowed("`")),
      TAG_ABBR | TAG_SMALL | TAG_TIME | TAG_BDO | TAG_RUBY | TAG_RT | TAG_RP => {
        Some(Cow::Borrowed(""))
      }
      TAG_MARK => Some(Cow::Borrowed("</mark>")),
      TAG_Q => Some(Cow::Borrowed("\"")),
      TAG_U => Some(Cow::Borrowed("</u>")),
      TAG_CITE => Some(Cow::Borrowed("*")),
      TAG_FIGCAPTION => Some(Cow::Borrowed(MARKDOWN_EMPHASIS)),
      TAG_DFN => Some(Cow::Borrowed("**")),
      TAG_ADDRESS => Some(Cow::Borrowed("</address>")),
      TAG_DL => Some(Cow::Borrowed("</dl>")),
      TAG_DT => Some(Cow::Borrowed("</dt>")),
      TAG_DD => Some(Cow::Borrowed("</dd>")),
      _ => None,
    }
  }

  #[inline]
  fn get_text_enter_output(&self, node: &ElementNode) -> Option<Cow<'static, str>> {
    let tag_id = node.tag_id?;
    match tag_id {
      TAG_BR => Some(Cow::Borrowed("\n")),
      TAG_P => {
        if self.depth_map[TAG_BLOCKQUOTE as usize] > 0
          || (self.depth_map[TAG_LI as usize] > 0 && !self.in_table_cell())
        {
          let last_char = self.last_output_byte().unwrap_or(0);
          if last_char != 0 && last_char != b' ' && last_char != b'\n' {
            return Some(Cow::Borrowed("\n\n"));
          }
        }
        None
      }
      TAG_TD | TAG_TH => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          None
        } else if node.index == 0 {
          Some(Cow::Borrowed(""))
        } else {
          Some(Cow::Borrowed("\t"))
        }
      }
      TAG_IMG => {
        if let Some(alt) = node.attributes.get("alt") {
          return if alt.is_empty() {
            None
          } else {
            Some(Cow::Owned(alt.clone()))
          };
        }

        if let Some(title) = node
          .attributes
          .get("title")
          .filter(|title| !title.is_empty())
        {
          return Some(Cow::Owned(title.clone()));
        }

        let src = node.attributes.get("src").filter(|src| !src.is_empty())?;
        Some(Cow::Owned(
          resolve_url(src, self.options.origin.as_deref(), self.options.clean_urls).into_owned(),
        ))
      }
      TAG_Q => Some(Cow::Borrowed("\"")),
      _ => None,
    }
  }

  #[inline]
  fn get_text_exit_output(node: &ElementNode) -> Option<Cow<'static, str>> {
    let tag_id = node.tag_id?;
    match tag_id {
      TAG_Q => Some(Cow::Borrowed("\"")),
      _ => None,
    }
  }

  #[inline]
  pub(crate) fn write_output(
    &mut self,
    is_enter: bool,
    is_inline: bool,
    configured_new_lines: u8,
    output: Option<&str>,
    literal: bool,
  ) {
    let output_str = output.unwrap_or("");
    let output_is_line_boundary =
      !literal && (output_str.starts_with('\n') || output_str.starts_with("\\\n"));

    // A separator trimmed from inside a previously closed inline element must
    // sit outside its Markdown delimiter. Resolve it only when later visible
    // inline output begins; block boundaries and line breaks subsume it.
    if self.pending_inline_whitespace && is_enter {
      let first_output = output_str.as_bytes().first().copied();
      if !is_inline
        || output_is_line_boundary
        || configured_new_lines > 0
        || matches!(first_output, Some(b'\n' | b'\r'))
      {
        self.pending_inline_whitespace = false;
      } else if let Some(first) = first_output {
        let last = self.last_output_byte();
        if !matches!(last, Some(b' ' | b'\n' | b'\t') | None) && !is_whitespace(first) {
          self.buffer.push(' ');
        }
        self.pending_inline_whitespace = false;
      }
    } else if self.pending_inline_whitespace && (!is_inline || configured_new_lines > 0) {
      self.pending_inline_whitespace = false;
    }

    // Fast path: no newlines, no output, no whitespace state to manage
    if configured_new_lines == 0
      && output_str.is_empty()
      && !self.last_text_node_contains_whitespace
    {
      self.last_node_is_inline = is_inline;
      return;
    }

    let buf_bytes = self.buffer.as_bytes();
    let buf_len = buf_bytes.len();
    // Draining removes the front of the buffer, so a block boundary counting its
    // preceding newlines from the last two bytes must see through the drain:
    // `flushed_tail` contains the two bytes immediately before `buffer[0]`.
    // Without that context a separator that one-shot trims to one newline can
    // be emitted as two in streaming (e.g. a lone `-` at the buffer start).
    // Yielding does not remove bytes, so `has_streamed_output` is no evidence that
    // anything precedes `buffer[0]`: until a drain actually cuts, `flushed_tail`
    // still holds its document-start sentinel and reading it invents a newline
    // that suppresses half of a block separator.
    let tail_known = self.has_flushed_tail();
    let last_char = if buf_len > 0 {
      buf_bytes[buf_len - 1]
    } else if tail_known {
      self.flushed_tail[1]
    } else {
      0
    };
    let second_last_char = if buf_len > 1 {
      buf_bytes[buf_len - 2]
    } else if buf_len == 1 && tail_known {
      self.flushed_tail[1]
    } else if tail_known {
      self.flushed_tail[0]
    } else {
      0
    };

    // A closing code fence's block-spacing newlines are appended AFTER the
    // backtick or tilde delimiter, so
    // any trailing newlines already in the buffer (blank lines inside <pre>)
    // sit BEFORE the fence and no longer separate this block from the next
    // sibling — leaving ```<sibling> on one line, an invalid fence that never
    // closes. Measure the trailing-newline run from the fence's own tail (0) so
    // the block spacing is not suppressed (#148). Scoped to the fence: other
    // block closers (raw-HTML </dd>/</dl>, etc.) intentionally glue.
    let measure_from_output_tail =
      !is_enter && (output_str.ends_with("```") || output_str.ends_with("~~~"));

    let mut last_new_lines: u8 = 0;
    if !measure_from_output_tail {
      if last_char == b'\n' {
        last_new_lines += 1;
      }
      if second_last_char == b'\n' {
        last_new_lines += 1;
      }
    }

    let new_lines = configured_new_lines.saturating_sub(last_new_lines);

    if new_lines > 0 {
      // An empty buffer at true document start has no preceding block to
      // separate from, so the leading block newlines are suppressed. Mid-stream
      // the buffer can be empty only because earlier output was already yielded
      // and drained; the block separator is still required there, so fall
      // through and emit it (otherwise streaming drops a `\n\n` that one-shot,
      // which never drains, keeps).
      if self.buffer.is_empty() && !self.has_streamed_output {
        if !output_str.is_empty() {
          self.last_content_cache_len = output_str.len();
          self.buffer.push_str(output_str);
        }
        self.last_node_is_inline = is_inline;
        return;
      }

      if last_char == b' ' && !self.buffer.is_empty() {
        self.trim_trailing_spaces();
        // This source whitespace was consumed by the block boundary; do not
        // let its state leak into a later inline event and trim that output.
        self.last_text_node_contains_whitespace = false;
        self.has_last_text_node = false;
      }

      if is_enter {
        for _ in 0..new_lines {
          self.buffer.push('\n');
        }
        if !output_str.is_empty() {
          self.last_content_cache_len = output_str.len();
          self.buffer.push_str(output_str);
        }
      } else {
        if !output_str.is_empty() {
          self.last_content_cache_len = output_str.len();
          self.buffer.push_str(output_str);
        }
        for _ in 0..new_lines {
          self.buffer.push('\n');
        }
      }
    } else {
      if self.last_text_node_contains_whitespace
        && (is_inline || !self.stack.is_empty())
        && (self.depth_map[TAG_PRE as usize] == 0
          || self
            .stack
            .last()
            .is_some_and(|parent| parent.tag_id == Some(TAG_PRE)))
      {
        let h_is_inline = is_inline;
        let collapses = self
          .stack
          .last()
          .is_some_and(|parent| parent.collapses_inner_white_space);
        let has_spacing = self
          .stack
          .last()
          .is_some_and(|parent| parent.spacing.is_some());
        // For exit, the node was already popped, so use the is_inline param
        let is_block = !h_is_inline && !collapses && configured_new_lines > 0;
        let should_trim = !(is_block || h_is_inline && is_enter || is_enter && collapses)
          && !(has_spacing && is_enter);

        if should_trim && self.last_content_cache_len > 0 {
          let cache_len = self.last_content_cache_len;
          let buf_len = self.buffer.len();
          // The cached run can include a fence opener (see `trim_floor`).
          let start = buf_len.saturating_sub(cache_len).max(self.trim_floor());
          if cache_len <= buf_len && start <= buf_len && self.buffer.is_char_boundary(start) {
            let frag = &self.buffer[start..];
            // Trim only ASCII whitespace, not `str::trim_end`'s full Unicode
            // set: a trailing U+00A0 (`&nbsp;`) is meaningful content, and once
            // streaming has yielded it the truncation can't un-send its bytes,
            // so the reach-back would drop the next text's leading char.
            let trimmed_len = trim_ascii_whitespace_end(frag);
            if start + trimmed_len < buf_len {
              self.clamp_item_marker_end(start + trimmed_len);
              self.buffer.truncate(start + trimmed_len);
              // The run just shrank; a stale length lets the next trim start
              // behind it and reach into spacing no text node wrote.
              self.last_content_cache_len = trimmed_len;
              if !is_enter && is_inline {
                self.pending_inline_whitespace = true;
              }
            }
          }
        }
        self.last_text_node_contains_whitespace = false;
        self.has_last_text_node = false;
      }

      if is_enter
        && !literal
        && !output_is_line_boundary
        && !output_str.is_empty()
        && last_char != 0
        && self.needs_spacing(last_char, output_str.as_bytes()[0])
      {
        self.buffer.push(' ');
        self.last_content_cache_len = 1;
      }

      if !output_str.is_empty() {
        self.last_content_cache_len = output_str.len();
        self.buffer.push_str(output_str);
      }
    }
    self.last_node_is_inline = is_inline;
  }

  #[inline]
  pub(crate) fn needs_spacing(&self, last_byte: u8, first_byte: u8) -> bool {
    if matches!(last_byte, b' ' | b'\n' | b'\t') {
      return false;
    }
    if matches!(first_byte, b' ' | b'\n' | b'\t') {
      return false;
    }
    if last_byte == b'|' && first_byte == b'<' && !self.buffer.is_empty() {
      return true;
    }
    if matches!(last_byte, b'[' | b'(' | b'>' | b'*' | b'_' | b'`')
      || matches!(
        first_byte,
        b']' | b')' | b'<' | b'.' | b',' | b'!' | b'?' | b':' | b';' | b'*' | b'_' | b'`'
      )
    {
      return false;
    }
    true
  }

  #[inline]
  pub(crate) fn should_add_spacing_before_text(&self, last_byte: u8, text: &str) -> bool {
    if last_byte == 0
      || last_byte == b'\n'
      || last_byte == b' '
      || last_byte == b'\t'
      || last_byte == b'['
      || last_byte == b'>'
    {
      return false;
    }
    if self.last_node_is_inline {
      return false;
    }
    // Malformed attribute quoting can carry a start tag past its `>` and leave
    // an empty text node behind, so there may be no first byte to inspect.
    let Some(&first_byte) = text.as_bytes().first() else {
      return false;
    };
    if first_byte == b' ' {
      return false;
    }
    if matches!(
      first_byte,
      b'.' | b',' | b'!' | b'?' | b':' | b';' | b'_' | b'*' | b'`' | b')' | b']'
    ) {
      return false;
    }
    true
  }

  #[inline]
  pub(crate) fn calculate_new_line_config(
    &self,
    tag_id: Option<u8>,
    node_spacing: Option<[u8; 2]>,
  ) -> [u8; 2] {
    if self.plain_text
      && tag_id == Some(TAG_PRE)
      && (self.depth_map[TAG_LI as usize] > 0 || self.depth_map[TAG_BLOCKQUOTE as usize] > 0)
    {
      return [1, 1];
    }
    if let Some(id) = tag_id {
      if (id != TAG_LI && self.depth_map[TAG_LI as usize] > 0)
        || (self.plain_text && id != TAG_BLOCKQUOTE && self.depth_map[TAG_BLOCKQUOTE as usize] > 0)
      {
        return NO_SPACING;
      }
    } else if self.depth_map[TAG_LI as usize] > 0 || self.depth_map[TAG_BLOCKQUOTE as usize] > 0 {
      return NO_SPACING;
    }
    // A heading normally keeps its block spacing inside a collapsing parent, but
    // in a table cell that newline would end the row.
    let current_heading_owns_collapse = tag_id.is_some_and(|id| (TAG_H1..=TAG_H6).contains(&id))
      && self.collapse_non_span_depth == 1
      && !self.in_table_cell();
    if self.collapse_non_span_depth > 0 && !current_heading_owns_collapse {
      return NO_SPACING;
    }
    if self.collapse_span_depth > 0 {
      let is_block = tag_id.is_some_and(|id| {
        (TAG_H1..=TAG_H6).contains(&id) || matches!(id, TAG_P | TAG_DIV | TAG_LI)
      });
      if !is_block {
        return NO_SPACING;
      }
    }
    if self.has_tag_overrides {
      // For override spacing, we'd need the node name — but we have tag_id.
      // Use tag_id to get name for override lookup.
      if let Some(id) = tag_id {
        let name = TAG_NAMES[id as usize];
        if let Some(sp) = self
          .options
          .plugins
          .as_ref()
          .and_then(|p| p.tag_overrides.as_ref())
          .and_then(|ovs| ovs.iter().find(|(k, _)| k == name).map(|(_, v)| v))
          .and_then(|ov| ov.spacing)
        {
          return sp;
        }
      }
    }
    node_spacing.unwrap_or(DEFAULT_BLOCK_SPACING)
  }

  #[inline]
  pub(crate) fn get_language_from_class(class_name: Option<&String>) -> &str {
    if let Some(class) = class_name {
      for part in class.split([' ', '\t', '\n', '\u{000C}', '\r']) {
        if let Some(lang) = part.strip_prefix("language-")
          && !lang.is_empty()
          && !lang.bytes().any(is_unsafe_fence_info_byte)
        {
          return lang;
        }
      }
    }
    ""
  }

  fn line_state_before_row(&self) -> LineBeforeRow {
    let bytes = self.buffer.as_bytes();
    // An empty buffer is a fresh line only while no drain has taken this line's
    // beginning: afterwards `flushed_tail` is what the row follows, so the
    // emptied buffer has to fall through to the drain-aware scan below.
    let line_lead_drained = self.has_flushed_tail() && self.flushed_tail[1] != b'\n';
    // Rows end their line, so the row after a row decides on one byte and never
    // rescans the line it just wrote.
    if matches!(bytes.last(), Some(b'\n')) || (bytes.is_empty() && !line_lead_drained) {
      return LineBeforeRow::Open;
    }
    let mut index = bytes.len();
    while index > 0 && bytes[index - 1] != b'\n' {
      index -= 1;
    }
    let line = &bytes[index..];
    let start = line
      .iter()
      .position(|byte| !matches!(byte, b' ' | b'\t'))
      .unwrap_or(line.len());
    // `index == 0` means the scan ran out of buffer, not that the line starts
    // here: a drain may have taken the beginning of this line away. Trusting the
    // fragment reads an open row as content and separates it with a blank line,
    // which ends the GFM table and ejects every row after it.
    if index == 0 && line_lead_drained {
      match self.cut_line_lead {
        CutLineLead::Row => return LineBeforeRow::Row,
        CutLineLead::RawHtml | CutLineLead::Content => return LineBeforeRow::Content,
        CutLineLead::Uncut | CutLineLead::Blank(_) => {}
      }
    }
    match line.get(start) {
      Some(b'|') => LineBeforeRow::Row,
      None => LineBeforeRow::Open,
      // A pending list marker is block prefix, not content: a table's first row
      // belongs on it.
      // A drain can empty the buffer entirely; the marker scan needs a byte to
      // start from, and a fully drained line has none to offer.
      Some(_)
        if !bytes.is_empty()
          && self.list_marker_line_start(bytes, bytes.len() - trailing_spaces(bytes)) =>
      {
        LineBeforeRow::Open
      }
      Some(_) => LineBeforeRow::Content,
    }
  }

  /// How many columns a cell occupies. GFM has no `colspan`, so a spanned cell
  /// is written as its content followed by empty cells; without them the
  /// delimiter row is too narrow and GFM drops every cell past it.
  #[inline]
  #[allow(clippy::cast_possible_truncation)] // Parsing is explicitly bounded to `u8::MAX`.
  pub(crate) fn cell_span(node: &ElementNode) -> u8 {
    (node
      .attributes
      .get("colspan")
      .and_then(|value| parse_bounded_u32(value, u8::MAX.into()))
      .unwrap_or(1) as u8)
      .clamp(1, MAX_CELL_SPAN)
  }

  fn span_filler(span: u8) -> Option<Cow<'static, str>> {
    match span {
      1 => None,
      span => Some(Cow::Owned(" |".repeat(span as usize - 1))),
    }
  }

  /// Marker number for an `<ol>`'s nth item. GFM numbers a list from its first
  /// item's marker, so only that one has to carry `start`.
  pub(crate) fn ordered_item_number(list: &ElementNode, index: usize) -> u32 {
    list
      .attributes
      .get("start")
      .and_then(|value| parse_bounded_u32(value, MAX_ORDERED_START))
      .unwrap_or(1)
      .saturating_add(u32::try_from(index).unwrap_or(u32::MAX))
      .min(MAX_ORDERED_START)
  }
}

#[cfg(test)]
mod tests {
  use super::{ConvertState, CutLineLead};
  use crate::types::{HTMLToMarkdownOptions, OutputFormat};

  #[test]
  fn empty_drained_buffer_counts_two_flushed_newlines() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);
    state.has_streamed_output = true;
    // A drain is what puts bytes behind `buffer[0]`; yielding alone does not, and
    // the counting below may only read `flushed_tail` once one has happened.
    state.cut_line_lead = CutLineLead::Blank(0);
    state.flushed_tail = [b'\n', b'\n'];

    state.write_output(true, false, 2, Some("next"), false);

    assert_eq!(state.buffer, "next");
  }

  // Yielded output that never drained leaves `buffer[0]` at the document start,
  // where one-shot counts no preceding newlines. Reading the sentinel there
  // suppresses half of every following block separator.
  #[test]
  fn undrained_buffer_counts_no_flushed_newlines() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);
    state.has_streamed_output = true;
    state.buffer.push('c');

    state.write_output(true, false, 2, Some("next"), false);

    assert_eq!(state.buffer, "c\n\nnext");
  }

  // Draining, and then a rewrite trimming what draining retained, leaves the
  // buffer empty mid-document; only a buffer nothing has streamed past is the
  // start of output.
  #[test]
  fn last_output_byte_sees_through_a_drain() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);
    assert_eq!(state.last_output_byte(), None);

    state.has_streamed_output = true;
    // A drain is what puts bytes behind `buffer[0]`; yielding alone does not.
    state.cut_line_lead = CutLineLead::Content;
    state.flushed_tail = *b"xy";
    assert_eq!(state.last_output_byte(), Some(b'y'));

    state.buffer.push('z');
    assert_eq!(state.last_output_byte(), Some(b'z'));
  }

  #[test]
  fn safe_prose_skips_the_gfm_escape_slow_path() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);

    let html = "<p>ordinary prose with 123 numbers and punctuation.</p>";
    assert_eq!(state.process_html(html), html.len());

    assert_eq!(state.gfm_escape_slow_path_calls, 0);
    assert_eq!(
      state.get_markdown(),
      "ordinary prose with 123 numbers and punctuation."
    );
  }

  #[test]
  fn syntax_and_entities_use_the_gfm_escape_slow_path() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);

    let html = "<p>* literal</p><p>&#42; decoded</p>";
    assert_eq!(state.process_html(html), html.len());

    assert_eq!(state.gfm_escape_slow_path_calls, 2);
    assert_eq!(state.get_markdown(), "\\* literal\n\n\\* decoded");
  }
}
