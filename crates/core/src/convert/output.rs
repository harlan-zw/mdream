//! Markdown output: tag enter/exit emission, buffer writing, spacing.

use super::*;

const DESTINATION_ESCAPES: [u8; 16] = [0, 0, 0, 0, 0, 0, 0, 80, 0, 0, 0, 16, 0, 0, 0, 0];
const TITLE_ESCAPES: [u8; 16] = [0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0];
const IMAGE_DESCRIPTION_ESCAPES: [u8; 16] = [0, 0, 0, 0, 64, 4, 0, 16, 0, 0, 0, 184, 1, 0, 0, 64];

#[inline(never)]
fn write_ascii_escaped(output: &mut String, value: &str, escapes: &[u8; 16]) {
  let bytes = value.as_bytes();
  let mut copied = 0usize;
  let mut index = 0usize;
  while index < bytes.len() {
    let byte = bytes[index];
    if byte < 128 && escapes[(byte >> 3) as usize] & (1 << (byte & 7)) != 0 {
      output.push_str(&value[copied..index]);
      output.push('\\');
      copied = index;
    }
    index += 1;
  }
  output.push_str(&value[copied..]);
}

fn write_markdown_destination(output: &mut String, destination: &str) {
  let bytes = destination.as_bytes();
  let mut index = 0usize;
  while index < bytes.len()
    && !matches!(
      bytes[index],
      b'\t' | b'\n' | 0x0C | b'\r' | b' ' | b'(' | b')' | b'\\' | b'<' | b'>'
    )
  {
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

#[inline]
fn starts_with_ignore_ascii_case(value: &str, prefix: &[u8]) -> bool {
  value
    .as_bytes()
    .get(..prefix.len())
    .is_some_and(|candidate| candidate.eq_ignore_ascii_case(prefix))
}

impl ConvertState {
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
  fn finalize_code_span(&mut self, span: CodeSpanState) -> String {
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
    self.buffer.replace_range(
      marker_start..marker_start + MARKDOWN_CODE_BLOCK.len(),
      &delimiter,
    );
    Some(delimiter)
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
    let content_end = self
      .buffer
      .trim_end_matches(|c: char| c.is_ascii_whitespace())
      .len();
    if content_end < frame.content_start
      || (content_end == frame.content_start && self.has_streamed_output)
    {
      return;
    }
    let content = &self.buffer[frame.content_start..content_end];
    let mut quoted = String::with_capacity(
      content.len() + (frame.list_indent.len() + 2) * (content.matches('\n').count() + 1),
    );

    for (index, line) in content.split('\n').enumerate() {
      if index > 0 {
        quoted.push('\n');
      }
      quoted.push_str(&frame.list_indent);
      quoted.push('>');
      let unindented = if !frame.list_indent.is_empty() {
        line.strip_prefix(&frame.list_indent).unwrap_or(line)
      } else {
        line
      };
      if !unindented.is_empty() {
        quoted.push(' ');
        quoted.push_str(unindented);
      }
    }

    for (bracket_start, link_end) in &mut self.fragment_links {
      if *bracket_start >= frame.content_start && *link_end <= content_end {
        *bracket_start = frame.content_start
          + Self::blockquote_offset(
            content,
            &frame.list_indent,
            *bracket_start - frame.content_start,
          );
        *link_end = frame.content_start
          + Self::blockquote_offset(content, &frame.list_indent, *link_end - frame.content_start);
      }
    }

    self.buffer.truncate(frame.content_start);
    self.buffer.push_str(&quoted);
    self.last_content_cache_len = quoted.len();
  }

  pub(crate) fn flush_streaming_blockquote_lines(&mut self) {
    const FLUSH_THRESHOLD: usize = 8 * 1024;
    if self.buffer.len() < FLUSH_THRESHOLD
      || self.blockquotes.is_empty()
      || self.clean_flags & CLEAN_FRAGMENTS != 0
      || self.has_frontmatter
      || self.has_extraction
    {
      return;
    }

    let Some(mut flush_end) = self.buffer.rfind('\n').map(|index| index + 1) else {
      return;
    };
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
      let mut quoted =
        String::with_capacity(content.len() + quoted_prefix.len() * content.matches('\n').count());
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
      self.buffer.replace_range(shared_start..flush_end, &quoted);
      flush_end = shared_start + quoted.len();
      for frame in &mut self.blockquotes {
        frame.content_start = flush_end;
      }
      self.last_content_cache_len = self.buffer.len() - flush_end;
      return;
    }

    let frames = self.blockquotes.clone();
    for frame in frames.iter().rev() {
      let content = &self.buffer[frame.content_start..flush_end];
      let mut quoted = String::with_capacity(
        content.len() + (frame.list_indent.len() + 2) * content.matches('\n').count(),
      );
      for line in content.split_inclusive('\n') {
        let line = line.strip_suffix('\n').unwrap_or(line);
        quoted.push_str(&frame.list_indent);
        quoted.push('>');
        let unindented = if !frame.list_indent.is_empty() {
          line.strip_prefix(&frame.list_indent).unwrap_or(line)
        } else {
          line
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

    for frame in &mut self.blockquotes {
      frame.content_start = flush_end;
    }
    self.last_content_cache_len = self.buffer.len() - flush_end;
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
      self.pre_own_fence = false;
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
            && (href == "#"
              || starts_with_ignore_ascii_case(href, b"javascript:")
              || starts_with_ignore_ascii_case(href, b"data:")
              || starts_with_ignore_ascii_case(href, b"vbscript:"))
          {
            self.skip_current_link = true;
            self.last_node_is_inline = is_inline;
            return;
          }
          self.skip_current_link = false;
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
      let trimmed_len = self.buffer.trim_end_matches(' ').len();
      self.buffer.truncate(trimmed_len);
      if output.as_deref() == Some("\n") && self.buffer.ends_with("\n\n") {
        output = None;
      }
    }

    self.write_output(
      true,
      is_inline,
      configured_new_lines,
      output.as_deref(),
      enter_is_literal,
    );

    if !self.plain_text && !enter_is_literal && tag_id == Some(TAG_BLOCKQUOTE) {
      if !self.blockquotes.is_empty() && self.buffer.ends_with("\n\n") {
        self.buffer.pop();
      }
      self.blockquotes.push(BlockquoteFrame {
        content_start: self.buffer.len(),
        list_indent: self.list_indent.clone(),
      });
    }

    if !enter_is_literal && tag_id == Some(TAG_CODE) && !self.in_raw_html_block() {
      if self.depth_map[TAG_PRE as usize] == 0 {
        if let Some(emitted) = output.as_deref() {
          self.code_spans.push(CodeSpanState {
            output_start: self.buffer.len() - emitted.len(),
            content_start: self.buffer.len(),
          });
        }
      } else if !self.pre_own_fence
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
      }
    }

    // After write_output, the emitted `[` (if any) is the last byte of the
    // buffer. Stash that exact position so emit_exit_element can find the
    // bracket in O(1) instead of scanning forward.
    if tag_id == Some(TAG_A) {
      let buf_len = self.buffer.len();
      self.link_bracket_pos = if buf_len > 0 && self.buffer.as_bytes()[buf_len - 1] == b'[' {
        buf_len - 1
      } else {
        buf_len
      };
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
      && (TAG_H1..=TAG_H6).contains(&id)
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

    let tag_id = node.tag_id;
    let closes_own_pre_fence = tag_id == Some(TAG_PRE) && self.pre_own_fence;

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

    // Table cell count (exit)
    if (tag_id == Some(TAG_TH) || tag_id == Some(TAG_TD)) && self.depth_map[TAG_TABLE as usize] <= 1
    {
      self.table_current_row_cells += 1;
    }

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
          let mut sep = String::with_capacity(col_count * 7 + 5);
          sep.push_str(" |\n|");
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
          table_separator = Some(sep);
        } else {
          output = self.get_exit_output(node);
        }
      } else if self.plain_text || tag_id != Some(TAG_A) {
        output = self.get_exit_output(node);
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
      if self.skip_current_link {
        self.skip_current_link = false;
        self.last_node_is_inline = is_inline;
        return;
      }

      // Find actual [ position: scan from recorded pos (write_output may have inserted newlines before it)
      let buf_len = self.buffer.len();
      let bracket_pos = {
        let mut pos = self.link_bracket_pos;
        let buf = self.buffer.as_bytes();
        while pos < buf.len() && buf[pos] != b'[' {
          pos += 1;
        }
        pos
      };
      // Guard: if bracket not found, bracket_pos == buf_len; text_start would overflow
      if bracket_pos >= buf_len {
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
          self.last_node_is_inline = is_inline;
          return;
        }
      }

      // redundantLinks: [url](url) → url
      if self.clean_flags & CLEAN_REDUNDANT_LINKS != 0
        && let Some(href) = node.attributes.get("href")
      {
        let resolved = resolve_url(
          href,
          self.options.origin.as_deref(),
          self.options.clean_urls,
        );
        if link_text == resolved.as_ref() && text_len > 0 {
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
          self.last_node_is_inline = is_inline;
          return;
        }
      }
    }

    // Collect heading slug before writing exit output
    if self.in_heading
      && let Some(id) = tag_id
      && (TAG_H1..=TAG_H6).contains(&id)
    {
      let heading_text = &self.buffer[self.heading_buffer_start..];
      let slug = slugify_heading(heading_text);
      if !slug.is_empty() {
        self.heading_slugs.push(slug);
      }
      self.in_heading = false;
    }

    // TAG_A exit: write ](url) directly to buffer — zero allocation
    if !self.plain_text && !has_override && tag_id == Some(TAG_A) && table_separator.is_none() {
      // Handle whitespace trimming (write_output with None)
      self.write_output(false, is_inline, configured_new_lines, None, false);
      // Write link close directly
      if let Some(href) = node.attributes.get("href") {
        let resolved = resolve_url(
          href,
          self.options.origin.as_deref(),
          self.options.clean_urls,
        );
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
        if title.is_empty() && is_autolink_uri(&resolved) {
          let bp = self.link_bracket_pos;
          let buf_bytes = self.buffer.as_bytes();
          if bp < buf_bytes.len()
            && buf_bytes[bp] == b'['
            && &self.buffer[bp + 1..] == resolved.as_ref()
          {
            self.buffer.truncate(bp);
            self.buffer.push('<');
            self.buffer.push_str(&resolved);
            self.buffer.push('>');
            self.last_content_cache_len = self.buffer.len();
            self.last_node_is_inline = is_inline;
            return;
          }
        }
        self.buffer.push(']');
        write_markdown_resource(
          &mut self.buffer,
          &resolved,
          (!title.is_empty()).then_some(title),
        );
        self.last_content_cache_len = self.buffer.len(); // will be recalculated
      }
      // Record fragment link position for deferred fixup
      if self.clean_flags & CLEAN_FRAGMENTS != 0
        && let Some(href) = node.attributes.get("href")
        && href.starts_with('#')
        && href.len() > 1
      {
        // link_bracket_pos now points exactly at `[` (set in emit_enter_element).
        self
          .fragment_links
          .push((self.link_bracket_pos, self.buffer.len()));
      }
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
      output = Some(Cow::Owned(self.finalize_code_span(span)));
    }
    if !has_override
      && ((tag_id == Some(TAG_CODE) && self.depth_map[TAG_PRE as usize] > 0 && !self.pre_own_fence)
        || closes_own_pre_fence)
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

    self.write_output(false, is_inline, configured_new_lines, effective, false);

    // Reset <pre> fence deferral once the element closes (issue #97).
    if tag_id == Some(TAG_PRE) {
      self.pre_fence_pending = false;
      self.pre_own_fence = false;
    }

    // Record fragment link position for deferred fixup (no String alloc)
    if !self.plain_text
      && self.clean_flags & CLEAN_FRAGMENTS != 0
      && tag_id == Some(TAG_A)
      && let Some(href) = node.attributes.get("href")
      && href.starts_with('#')
      && href.len() > 1
    {
      self
        .fragment_links
        .push((self.link_bracket_pos, self.buffer.len()));
    }
  }

  /// Emit markdown for a text node (no TextNode allocation).
  #[inline]
  /// Emit a bare <pre>'s opening code fence (issue #97). Mirrors the
  /// <code>-in-<pre> enter formatting: indented and newline-padded inside a
  /// list item, otherwise a plain ```lang opener. Marks the <pre> as owning
  /// the fence so a nested <code> does not double up and the <pre> exit emits
  /// the matching closing fence.
  fn flush_pre_fence(&mut self) {
    if self.plain_text {
      self.pre_fence_pending = false;
      self.pre_own_fence = false;
      return;
    }

    self.pre_fence_pending = false;
    self.pre_own_fence = true;
    let li_depth = self.depth_map[TAG_LI as usize];
    let fence = if li_depth > 0 {
      format!("\n\n{0}```{1}\n{0}", self.list_indent, self.pre_fence_lang)
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

  pub(crate) fn emit_text(
    &mut self,
    text: &str,
    contains_whitespace: bool,
    depth: usize,
    index: usize,
  ) {
    let has_inline_gfm_hazard = text.bytes().any(|byte| {
      (byte > 32 && byte < 0x80 && is_inline_gfm_hazard(byte)) || matches!(byte, b'\n' | b'\r')
    });
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
    let has_inline_gfm_hazard = std::mem::take(&mut self.text_buffer_has_inline_gfm_hazard);
    if text.is_empty() {
      return;
    }

    if self.pending_inline_whitespace {
      if text.as_bytes().iter().all(|&b| is_whitespace(b)) {
        return;
      }
      let last = self.buffer.as_bytes().last().copied();
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
    } else if self.has_streamed_output {
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
    let raw_html_storage;
    let text = if !self.plain_text && self.depth_map[TAG_PRE as usize] == 0 && inside_raw_html_block
    {
      raw_html_storage = self.escape_raw_html_text(text);
      raw_html_storage.as_ref()
    } else {
      text
    };

    let has_contextual_escape = self.depth_map[TAG_TABLE as usize] > 0
      || self.depth_map[TAG_A as usize] > 0
      || self.depth_map[TAG_BLOCKQUOTE as usize] > 0;
    let context_has_gfm_hazard = !inside_raw_html_block
      && has_contextual_escape
      && text.bytes().any(|byte| {
        (byte == b'|' && self.depth_map[TAG_TABLE as usize] > 0)
          || (byte == b']' && self.depth_map[TAG_A as usize] > 0)
          || (byte == b'>' && self.depth_map[TAG_BLOCKQUOTE as usize] > 0)
      });
    let escaped_storage;
    let text = if !self.plain_text
      && self.depth_map[TAG_PRE as usize] == 0
      && self.depth_map[TAG_CODE as usize] == 0
      && !inside_raw_html_block
      && (has_inline_gfm_hazard
        || context_has_gfm_hazard
        || self.starts_with_gfm_block_candidate(text))
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

      // A `\&` guarding a decoded entity reference is emitted by the entity
      // decoder; preserve the pair verbatim so this pass never doubles the slash.
      if byte == b'\\'
        && bytes
          .get(index + 1)
          .is_some_and(|&next| next == b'&' && Self::is_entity_reference_after_ampersand(&bytes[index + 1..]))
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
    let mut spaces = 0u8;
    for &byte in self.buffer.as_bytes().iter().rev() {
      if byte == b'\n' {
        return Some(spaces);
      }
      if byte != b' ' || spaces == 3 {
        return None;
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
  fn in_heading(&self) -> bool {
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

  #[inline]
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
    if !content.is_empty() {
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
            Some(Cow::Borrowed("\\\n"))
          } else {
            Some(Cow::Owned(format!("\\\n{prefix}")))
          }
        }
      }
      TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
        let depth = (tag_id - TAG_H1) as usize;
        if self.depth_map[TAG_A as usize] > 0 {
          {
            static H_OPEN: [&str; 6] = ["<h1>", "<h2>", "<h3>", "<h4>", "<h5>", "<h6>"];
            Some(Cow::Borrowed(H_OPEN[depth]))
          }
        } else {
          Some(Cow::Borrowed(HEADING_PREFIXES[depth]))
        }
      }
      TAG_HR => Some(Cow::Borrowed(MARKDOWN_HORIZONTAL_RULE)),
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
          // The enclosing <pre> already opened its own fence (mixed
          // text + <code> children); don't emit a nested fence.
          if self.pre_own_fence {
            return None;
          }
          let lang = Self::get_language_from_class(node.attributes.get("class"));
          let li_depth = self.depth_map[TAG_LI as usize] as usize;
          if li_depth > 0 {
            let indent = self.list_indent.as_str();
            let mut s = String::with_capacity(2 + indent.len() * 2 + 4 + lang.len() + 1);
            s.push_str("\n\n");
            s.push_str(indent);
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
        let is_ordered = _ancestors.last().is_some_and(|p| p.tag_id == Some(TAG_OL));
        let mut s = String::with_capacity(self.list_indent.len() + 6);
        s.push_str(&self.list_indent);
        if is_ordered {
          use std::fmt::Write;
          let _ = write!(s, "{}. ", node.index + 1);
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
          Some(Cow::Borrowed("<tr>"))
        } else {
          Some(Cow::Borrowed("| "))
        }
      }
      TAG_TH => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          return Some(Cow::Borrowed("<th>"));
        }
        if node.index == 0 {
          Some(Cow::Borrowed(""))
        } else {
          Some(Cow::Borrowed(" | "))
        }
      }
      TAG_TD => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          return Some(Cow::Borrowed("<td>"));
        }
        if node.index == 0 {
          Some(Cow::Borrowed(""))
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
  pub(crate) fn get_exit_output(&self, node: &ElementNode) -> Option<Cow<'static, str>> {
    if self.plain_text {
      return Self::get_text_exit_output(node);
    }

    let tag_id = node.tag_id?;
    match tag_id {
      // Inside a table cell the trailing block break would split the GFM row,
      // so emit the raw close tags with no newlines (issue #147).
      TAG_DETAILS if self.in_table_cell() => Some(Cow::Borrowed("</details>")),
      TAG_SUMMARY if self.in_table_cell() => Some(Cow::Borrowed("</summary>")),
      TAG_DETAILS => Some(Cow::Borrowed("</details>\n\n")),
      TAG_SUMMARY => Some(Cow::Borrowed("</summary>\n\n")),
      TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
        let depth = (tag_id - TAG_H1 + 1) as usize;
        if self.depth_map[TAG_A as usize] > 0 {
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
          // The enclosing <pre> owns the fence; this <code> opened none.
          if self.pre_own_fence {
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
        if !self.pre_own_fence {
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
      TAG_TR => {
        if self.in_table_cell() || self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed("</tr>"))
        } else {
          Some(Cow::Borrowed(" |"))
        }
      }
      TAG_TH => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed("</th>"))
        } else {
          None
        }
      }
      TAG_TD => {
        if self.depth_map[TAG_TABLE as usize] > 1 {
          Some(Cow::Borrowed("</td>"))
        } else {
          None
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
          let last_char = self.buffer.as_bytes().last().copied().unwrap_or(0);
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
        let last = self.buffer.as_bytes().last().copied();
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
    let last_char = if buf_len > 0 {
      buf_bytes[buf_len - 1]
    } else if self.has_streamed_output {
      self.flushed_tail[1]
    } else {
      0
    };
    let second_last_char = if buf_len > 1 {
      buf_bytes[buf_len - 2]
    } else if buf_len == 1 && self.has_streamed_output {
      self.flushed_tail[1]
    } else if self.has_streamed_output {
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
        let trimmed_len = self.buffer.trim_end_matches(' ').len();
        self.buffer.truncate(trimmed_len);
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
          let start = buf_len.saturating_sub(cache_len);
          if cache_len <= buf_len && self.buffer.is_char_boundary(start) {
            let frag = &self.buffer[start..];
            // Trim only ASCII whitespace, not `str::trim_end`'s full Unicode
            // set: a trailing U+00A0 (`&nbsp;`) is meaningful content, and once
            // streaming has yielded it the truncation can't un-send its bytes,
            // so the reach-back would drop the next text's leading char.
            let trimmed_len = frag
              .trim_end_matches(|c: char| c.is_ascii_whitespace())
              .len();
            if trimmed_len < cache_len {
              self.buffer.truncate(start + trimmed_len);
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
    let first_byte = text.as_bytes()[0];
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
    let current_heading_owns_collapse =
      tag_id.is_some_and(|id| (TAG_H1..=TAG_H6).contains(&id)) && self.collapse_non_span_depth == 1;
    if self.collapse_non_span_depth > 0 && !current_heading_owns_collapse {
      return NO_SPACING;
    }
    if self.collapse_span_depth > 0 {
      let is_block =
        tag_id.is_some_and(|id| (TAG_H1..=TAG_H6).contains(&id) || id == TAG_P || id == TAG_DIV);
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
          && lang
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'#' | b'+' | b'-' | b'.'))
        {
          return lang;
        }
      }
    }
    ""
  }
}

#[cfg(test)]
mod tests {
  use super::ConvertState;
  use crate::types::{HTMLToMarkdownOptions, OutputFormat};

  #[test]
  fn empty_drained_buffer_counts_two_flushed_newlines() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);
    state.has_streamed_output = true;
    state.flushed_tail = [b'\n', b'\n'];

    state.write_output(true, false, 2, Some("next"), false);

    assert_eq!(state.buffer, "next");
  }

  #[test]
  fn safe_prose_skips_the_gfm_escape_slow_path() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);

    assert!(
      state
        .process_html("<p>ordinary prose with 123 numbers and punctuation.</p>")
        .is_empty()
    );

    assert_eq!(state.gfm_escape_slow_path_calls, 0);
    assert_eq!(
      state.get_markdown(),
      "ordinary prose with 123 numbers and punctuation."
    );
  }

  #[test]
  fn syntax_and_entities_use_the_gfm_escape_slow_path() {
    let mut state = ConvertState::new(HTMLToMarkdownOptions::default(), 64, OutputFormat::Markdown);

    assert!(
      state
        .process_html("<p>* literal</p><p>&#42; decoded</p>")
        .is_empty()
    );

    assert_eq!(state.gfm_escape_slow_path_calls, 2);
    assert_eq!(state.get_markdown(), "\\* literal\n\n\\* decoded");
  }
}
