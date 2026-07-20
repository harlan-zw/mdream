//! Markdown output: tag enter/exit emission, buffer writing, spacing.

use super::*;

impl ConvertState {
  #[inline]
  fn inline_marker_type(tag_id: u8) -> Option<u8> {
    // The kind is the delimiter identity: one value per distinct delimiter
    // string, so tags sharing a delimiter share a kind.
    match tag_id {
      TAG_STRONG | TAG_B | TAG_DFN => Some(0),
      TAG_EM | TAG_I | TAG_FIGCAPTION => Some(1),
      TAG_DEL => Some(2),
      TAG_CITE => Some(3),
      TAG_KBD | TAG_CODE | TAG_SAMP | TAG_VAR => Some(4),
      TAG_Q => Some(5),
      _ => None,
    }
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
    let new_line_config = self.calculate_new_line_config(true, tag_id, node_spacing);
    let configured_new_lines = new_line_config[0];

    // Clean mode — single guard for all clean checks
    if self.clean_flags != 0
      && let Some(id) = tag_id
    {
      if id == TAG_A {
        // emptyLinks: skip href="#" or "javascript:"
        if self.clean_flags & CLEAN_EMPTY_LINKS != 0 {
          let node = &self.stack[self.stack.len() - 1];
          if let Some(href) = node.attributes.get("href")
            && (href == "#" || href.starts_with("javascript:"))
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
      && output
        .as_deref()
        .is_some_and(|value| value.starts_with('\n'))
    {
      let trimmed_len = self.buffer.trim_end_matches(' ').len();
      self.buffer.truncate(trimmed_len);
      if output.as_deref() == Some("\n") && self.buffer.ends_with("\n\n") {
        output = None;
      }
    }

    let removable_marker_type = if enter_is_literal {
      None
    } else {
      tag_id
        .filter(|&id| id != TAG_CODE || self.depth_map[TAG_PRE as usize] == 0)
        .and_then(Self::inline_marker_type)
    };
    // Only removable marker enters need a quote-state snapshot. The buffered
    // blank remains part of rollback output (following text may need it), but
    // must be withheld from streaming until the marker proves non-empty.
    let marker_quote_rollback = if removable_marker_type.is_some()
      && self.depth_map[TAG_BLOCKQUOTE as usize] > 0
    {
      let rollback_start = self.buffer.len();
      Some((
        rollback_start,
        self
          .trailing_quoted_blank_start()
          .unwrap_or(rollback_start),
        self.quoted_blank_prefix.is_some(),
      ))
    } else {
      None
    };

    self.write_output(
      true,
      tag_id,
      is_inline,
      configured_new_lines,
      output.as_deref(),
      enter_is_literal,
    );

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

    if let Some(inline_marker_type) = removable_marker_type
      && let Some(emitted) = output.as_deref()
      && !emitted.is_empty()
    {
      let output_start = self.buffer.len() - emitted.len();
      let (rollback_start, hold_start, had_quoted_blank) =
        marker_quote_rollback.unwrap_or((output_start, output_start, false));
      self.open_markers.push(OpenMarker {
        marker_type: inline_marker_type,
        content_start: self.buffer.len(),
        rollback_start,
        hold_start,
        had_quoted_blank,
      });
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

    // A descendant block exit may leave a quoted blank continuation line at
    // the end of the quote. It separates siblings, but must not survive after
    // the blockquote itself closes.
    if !self.plain_text
      && tag_id == Some(TAG_BLOCKQUOTE)
      && let Some(blank_start) = self.trailing_quoted_blank_start()
    {
      self.buffer.truncate(blank_start);
      self.last_content_cache_len = 0;
      self.quoted_blank_prefix = None;
    }

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
      } else {
        output = self.get_exit_output(node);
      }
    }

    let node_spacing = if let Some(ov) = override_config {
      ov.spacing.or(node.spacing)
    } else {
      node.spacing
    };

    let new_line_config = self.calculate_new_line_config(false, tag_id, node_spacing);
    let configured_new_lines = new_line_config[1];

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
      self.write_output(false, tag_id, is_inline, configured_new_lines, None, false);
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
        self.buffer.push_str("](");
        self.buffer.push_str(&resolved);
        if !title.is_empty() {
          self.buffer.push_str(" \"");
          self.buffer.push_str(title);
          self.buffer.push('"');
        }
        self.buffer.push(')');
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
      && (id != TAG_CODE || self.depth_map[TAG_PRE as usize] == 0)
      && let Some(inline_marker_type) = Self::inline_marker_type(id)
      && output.as_deref().is_some_and(|emitted| !emitted.is_empty())
      && let Some(open_marker) = self.open_markers.pop()
    {
      if open_marker.marker_type == inline_marker_type
        && open_marker.content_start <= self.buffer.len()
        && self.buffer.as_bytes()[open_marker.content_start..]
          .iter()
          .all(|&b| is_whitespace(b))
      {
        self.buffer.truncate(open_marker.rollback_start);
        self.quoted_blank_prefix = if open_marker.had_quoted_blank {
          Some(self.continuation_prefix().trim_end().to_string())
        } else {
          None
        };
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

    // Get effective output
    let effective: Option<&str> = if let Some(ref sep) = table_separator {
      Some(sep.as_str())
    } else {
      output.as_deref()
    };

    self.write_output(
      false,
      tag_id,
      is_inline,
      configured_new_lines,
      effective,
      has_override,
    );

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
    let (quote_prefix, in_blockquote) = self.continuation_prefix_for(&self.stack);
    let fence = if li_depth > 0 && !in_blockquote {
      format!("\n\n{0}```{1}\n{0}", self.list_indent, self.pre_fence_lang)
    } else {
      format!("```{}\n", self.pre_fence_lang)
    };
    self.last_content_cache_len = fence.len();
    if in_blockquote {
      self.push_blockquote_fragment(&fence, &quote_prefix);
    } else {
      self.buffer.push_str(&fence);
    }
    self.last_node_is_inline = false;
  }

  pub(crate) fn emit_text(
    &mut self,
    text: &str,
    contains_whitespace: bool,
    depth: usize,
    index: usize,
  ) {
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
    let in_blockquote = self.depth_map[TAG_BLOCKQUOTE as usize] > 0;
    let text = if !self.plain_text
      && self.depth_map[TAG_PRE as usize] > 0
      && li_depth > 0
      && !in_blockquote
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
    let text = if !self.plain_text
      && self.depth_map[TAG_PRE as usize] > 0
      && self.in_table_cell()
    {
      cell_storage = Self::fold_pre_lines_to_br(text);
      cell_storage.as_str()
    } else {
      text
    };

    let actual_last_char = if !self.plain_text
      && self.depth_map[TAG_PRE as usize] == 0
      && li_depth > 0
      && !in_blockquote
      && last_char == b'\n'
      && text.as_bytes().first().is_some_and(|&b| b != b'\n')
    {
      // A blockquote closes with a line break. Restore the list content
      // column only when following content arrives so streaming never emits
      // speculative trailing indentation at the end of a list item.
      // Write it separately so the wrapping path cannot collapse the
      // indentation's repeated spaces while tokenizing the text.
      self.buffer.push_str(&self.list_indent);
      self.list_indent.as_bytes().last().copied().unwrap_or(b'\n')
    } else {
      last_char
    };

    if self.wrap_width != 0 && self.can_wrap_here() {
      self.push_text_wrapped(text, actual_last_char);
    } else if !(self.plain_text && self.depth_map[TAG_PRE as usize] > 0)
      && self.should_add_spacing_before_text(actual_last_char, text)
    {
      self.buffer.push(' ');
      self.last_content_cache_len = text.len() + 1;
      if in_blockquote {
        let prefix = self.continuation_prefix();
        self.push_blockquote_fragment(text, &prefix);
      } else {
        self.buffer.push_str(text);
      }
    } else {
      self.last_content_cache_len = text.len();
      if in_blockquote {
        let prefix = self.continuation_prefix();
        self.push_blockquote_fragment(text, &prefix);
      } else {
        self.buffer.push_str(text);
      }
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
  /// one row, and HTML-escape `&`, `<`, `>` so decoded source (e.g. `<script>`)
  /// is not evaluated as live HTML. Leading and trailing breaks are dropped; a
  /// `\r\n` pair counts as one break.
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
      } else {
        out.push(c);
      }
    }
    out
  }

  #[inline]
  fn in_raw_html_block(&self) -> bool {
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
  fn continuation_prefix_for(&self, nodes: &[ElementNode]) -> (String, bool) {
    if self.plain_text {
      return (String::new(), false);
    }

    let mut p = String::new();
    let mut li_idx = 0usize;
    let mut has_blockquote = false;
    for node in nodes {
      match node.tag_id {
        Some(TAG_BLOCKQUOTE) => {
          p.push_str("> ");
          has_blockquote = true;
        }
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
    (p, has_blockquote)
  }

  fn continuation_prefix(&self) -> String {
    self.continuation_prefix_for(&self.stack).0
  }

  /// Append a fragment while keeping each complete line inside its blockquote.
  fn push_blockquote_fragment(&mut self, value: &str, prefix: &str) {
    let mut start = 0usize;
    loop {
      let newline = value[start..].find('\n').map(|offset| start + offset);
      let end = newline.unwrap_or(value.len());
      let line = &value[start..end];
      let at_line_start = self.buffer.is_empty() || self.buffer.ends_with('\n');

      if at_line_start {
        if !line.is_empty() {
          self.buffer.push_str(prefix);
          self.quoted_blank_prefix = None;
        } else if newline.is_some() {
          let blank_prefix = prefix.trim_end();
          self.buffer.push_str(blank_prefix);
          self.quoted_blank_prefix = Some(blank_prefix.to_string());
        }
      } else if !line.is_empty() || newline.is_some() {
        self.quoted_blank_prefix = None;
      }
      self.buffer.push_str(line);
      let Some(newline) = newline else { break };
      self.buffer.push('\n');
      start = newline + 1;
    }
  }

  fn trailing_new_line_count(&self, prefix: Option<&str>) -> u8 {
    if !self.buffer.ends_with('\n') {
      return 0;
    }
    let before_last = &self.buffer[..self.buffer.len() - 1];
    let previous_newline = before_last.rfind('\n');
    let previous_line = previous_newline.map_or(before_last, |i| &before_last[i + 1..]);
    if previous_line.is_empty() {
      return 2;
    }
    if let Some(prefix) = prefix {
      let blank = prefix.trim_end();
      if previous_line == blank || (previous_newline.is_none() && blank.ends_with(previous_line)) {
        return 2;
      }
    }
    1
  }

  fn current_line_is_prefix(&self, prefix: &str) -> bool {
    let previous_newline = self.buffer.rfind('\n');
    let line = previous_newline.map_or(self.buffer.as_str(), |i| &self.buffer[i + 1..]);
    line == prefix || (previous_newline.is_none() && !line.is_empty() && prefix.ends_with(line))
  }

  /// Locate a trailing blank quote marker (`>`, optionally nested/indented).
  pub(super) fn trailing_quoted_blank_start(&self) -> Option<usize> {
    let prefix = self.quoted_blank_prefix.as_deref()?;
    if !self.buffer.ends_with('\n') {
      return None;
    }
    let before_last = &self.buffer[..self.buffer.len() - 1];
    let previous_newline = before_last.rfind('\n');
    let start = previous_newline.map_or(0, |i| i + 1);
    let line = &before_last[start..];
    if line != prefix && !(previous_newline.is_none() && !line.is_empty() && prefix.ends_with(line))
    {
      return None;
    }
    Some(start)
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
    let (prefix, in_blockquote) = self.continuation_prefix_for(&self.stack);
    let prefix_len = prefix.chars().count();
    let mut col = self.current_column();
    if col == 0 && in_blockquote {
      self.buffer.push_str(&prefix);
      col = prefix_len;
    }
    if in_blockquote {
      self.quoted_blank_prefix = None;
    }
    let buf_start = self.buffer.len();
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
        } else if self.depth_map[TAG_BLOCKQUOTE as usize] > 0 {
          // Quote continuations are applied centrally to every emitted line.
          Some(Cow::Borrowed("\n"))
        } else {
          let prefix = self.continuation_prefix();
          if prefix.is_empty() {
            Some(Cow::Borrowed("\n"))
          } else {
            Some(Cow::Owned(format!("\n{prefix}")))
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
      TAG_DEL => Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH)),
      TAG_SUB => Some(Cow::Borrowed("<sub>")),
      TAG_SUP => Some(Cow::Borrowed("<sup>")),
      TAG_INS => Some(Cow::Borrowed("<ins>")),
      TAG_P => {
        if self.depth_map[TAG_LI as usize] > 0 && !self.in_table_cell() {
          let last_char = self.buffer.as_bytes().last().copied().unwrap_or(0);
          if last_char != 0 && last_char != b' ' && last_char != b'\n' {
            if self.depth_map[TAG_BLOCKQUOTE as usize] > 0 {
              return Some(Cow::Borrowed("\n\n"));
            }
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
        let mut prefix = self.continuation_prefix_for(_ancestors).0;
        prefix.push_str("> ");
        Some(Cow::Owned(prefix))
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
          if li_depth > 0 && self.depth_map[TAG_BLOCKQUOTE as usize] == 0 {
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
        let in_blockquote = self.depth_map[TAG_BLOCKQUOTE as usize] > 0;
        let mut s = String::with_capacity(if in_blockquote {
          6
        } else {
          self.list_indent.len() + 6
        });
        if !in_blockquote {
          s.push_str(&self.list_indent);
        }
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
          let mut s = String::with_capacity(alt.len() + resolved_src.len() + 5);
          s.push_str("![");
          s.push_str(alt);
          s.push_str("](");
          s.push_str(&resolved_src);
          s.push(')');
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
      TAG_DEL => Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH)),
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
          if li_depth > 0 && self.depth_map[TAG_BLOCKQUOTE as usize] == 0 {
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
        if li_depth > 0 && self.depth_map[TAG_BLOCKQUOTE as usize] == 0 {
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
      TAG_A => {
        if let Some(href) = node.attributes.get("href") {
          let resolved = resolve_url(
            href,
            self.options.origin.as_deref(),
            self.options.clean_urls,
          );
          let mut title = node.attributes.get("title").map_or("", String::as_str);
          if self.last_content_cache_len > 0 {
            let buf_len = self.buffer.len();
            let start = buf_len.saturating_sub(self.last_content_cache_len);
            if self.buffer.is_char_boundary(start) {
              let cache = &self.buffer[start..];
              if cache == title {
                title = "";
              }
            }
          }
          if title.is_empty() {
            let mut s = String::with_capacity(resolved.len() + 3);
            s.push_str("](");
            s.push_str(&resolved);
            s.push(')');
            Some(Cow::Owned(s))
          } else {
            let mut s = String::with_capacity(resolved.len() + title.len() + 6);
            s.push_str("](");
            s.push_str(&resolved);
            s.push_str(" \"");
            s.push_str(title);
            s.push_str("\")");
            Some(Cow::Owned(s))
          }
        } else {
          Some(Cow::Borrowed(""))
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
        let alt = node.attributes.get("alt").map_or("", String::as_str);
        if alt.is_empty() {
          None
        } else {
          Some(Cow::Owned(alt.to_string()))
        }
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
    tag_id: Option<u8>,
    is_inline: bool,
    configured_new_lines: u8,
    output: Option<&str>,
    literal: bool,
  ) {
    let output_str = output.unwrap_or("");
    let context_nodes = if is_enter && !self.stack.is_empty() {
      &self.stack[..self.stack.len() - 1]
    } else {
      &self.stack[..]
    };
    let (context_prefix, in_blockquote) = if self.depth_map[TAG_BLOCKQUOTE as usize] == 0 {
      (String::new(), false)
    } else {
      self.continuation_prefix_for(context_nodes)
    };
    let prefix_output = in_blockquote && !literal && !(is_enter && tag_id == Some(TAG_BLOCKQUOTE));

    // A separator trimmed from inside a previously closed inline element must
    // sit outside its Markdown delimiter. Resolve it only when later visible
    // inline output begins; block boundaries and line breaks subsume it.
    if self.pending_inline_whitespace && is_enter {
      let first_output = output_str.as_bytes().first().copied();
      if !is_inline || configured_new_lines > 0 || matches!(first_output, Some(b'\n' | b'\r')) {
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
    let last_char = if buf_len > 0 {
      buf_bytes[buf_len - 1]
    } else {
      0
    };
    // A closing code fence ("\n```") appends its block spacing after the
    // fence. Newlines before the fence therefore cannot separate it from the
    // following sibling (#148), so measure from the output tail in this case.
    let last_new_lines = if !is_enter && output_str.as_bytes().last() == Some(&b'`') {
      0
    } else if !is_enter && in_blockquote && output_str.ends_with('\n') {
      if output_str.ends_with("\n\n") { 2 } else { 1 }
    } else {
      self.trailing_new_line_count(in_blockquote.then_some(context_prefix.as_str()))
    };
    let prefix_only_line = is_enter
      && tag_id != Some(TAG_BLOCKQUOTE)
      && in_blockquote
      && self.current_line_is_prefix(&context_prefix);
    let new_lines = if prefix_only_line {
      0
    } else {
      configured_new_lines.saturating_sub(last_new_lines)
    };

    if new_lines > 0 {
      if self.buffer.is_empty() {
        if !output_str.is_empty() {
          self.last_content_cache_len = output_str.len();
          if prefix_output {
            self.push_blockquote_fragment(output_str, &context_prefix);
          } else {
            self.buffer.push_str(output_str);
            if in_blockquote {
              self.quoted_blank_prefix = None;
            }
          }
        }
        self.last_node_is_inline = is_inline;
        return;
      }

      let preserve_empty_list_marker = is_enter
        && tag_id == Some(TAG_BLOCKQUOTE)
        && self.stack.len() >= 2
        && self.stack[self.stack.len() - 2].tag_id == Some(TAG_LI);
      if last_char == b' ' && !self.buffer.is_empty() && !preserve_empty_list_marker {
        let trimmed_len = self.buffer.trim_end_matches(' ').len();
        self.buffer.truncate(trimmed_len);
        // This source whitespace was consumed by the block boundary; do not
        // let its state leak into a later inline event and trim that output.
        self.last_text_node_contains_whitespace = false;
        self.has_last_text_node = false;
      }

      if is_enter {
        for _ in 0..new_lines {
          if in_blockquote {
            self.push_blockquote_fragment("\n", &context_prefix);
          } else {
            self.buffer.push('\n');
          }
        }
        if !output_str.is_empty() {
          self.last_content_cache_len = output_str.len();
          if prefix_output {
            self.push_blockquote_fragment(output_str, &context_prefix);
          } else {
            self.buffer.push_str(output_str);
            if in_blockquote {
              self.quoted_blank_prefix = None;
            }
          }
        }
      } else {
        if !output_str.is_empty() {
          self.last_content_cache_len = output_str.len();
          if prefix_output {
            self.push_blockquote_fragment(output_str, &context_prefix);
          } else {
            self.buffer.push_str(output_str);
            if in_blockquote {
              self.quoted_blank_prefix = None;
            }
          }
        }
        for _ in 0..new_lines {
          if in_blockquote {
            self.push_blockquote_fragment("\n", &context_prefix);
          } else {
            self.buffer.push('\n');
          }
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

        // Quoted <pre> tails may already have streamed, so preserve them
        // rather than making chunked output differ from one-shot output.
        if should_trim
          && !(in_blockquote && self.depth_map[TAG_PRE as usize] > 0)
          && self.last_content_cache_len > 0
        {
          let cache_len = self.last_content_cache_len;
          let buf_len = self.buffer.len();
          let start = buf_len.saturating_sub(cache_len);
          if cache_len <= buf_len && self.buffer.is_char_boundary(start) {
            let frag = &self.buffer[start..];
            let trimmed_len = frag.trim_end().len();
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
        && !output_str.is_empty()
        && last_char != 0
        && self.needs_spacing(last_char, output_str.as_bytes()[0])
      {
        self.buffer.push(' ');
        self.last_content_cache_len = 1;
      }

      if !output_str.is_empty() {
        self.last_content_cache_len = output_str.len();
        if prefix_output {
          self.push_blockquote_fragment(output_str, &context_prefix);
        } else {
          self.buffer.push_str(output_str);
          if in_blockquote {
            self.quoted_blank_prefix = None;
          }
        }
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
    is_enter: bool,
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
      if id != TAG_LI && id != TAG_BLOCKQUOTE && self.depth_map[TAG_LI as usize] > 0 {
        return NO_SPACING;
      }
    } else if self.depth_map[TAG_LI as usize] > 0 {
      return NO_SPACING;
    }
    // Enter-time collapse counters already include the current element. Match
    // the JS ancestor walk by excluding that element from the ancestor count.
    let mut collapse_non_span_depth = self.collapse_non_span_depth;
    let mut collapse_span_depth = self.collapse_span_depth;
    if is_enter
      && let Some(current) = self.stack.last()
      && current.collapses_inner_white_space
    {
      if current.tag_id == Some(TAG_SPAN) {
        collapse_span_depth = collapse_span_depth.saturating_sub(1);
      } else {
        collapse_non_span_depth = collapse_non_span_depth.saturating_sub(1);
      }
    }
    if collapse_non_span_depth > 0 {
      return NO_SPACING;
    }
    if collapse_span_depth > 0 {
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
    if let Some(spacing) = node_spacing {
      return spacing;
    }
    // A quoted block needs a blank line before another block, but only one
    // continuation before following prose. Tables retain their trailing blank
    // line so prose cannot be parsed as another table row.
    if !self.plain_text && self.depth_map[TAG_BLOCKQUOTE as usize] > 0 && tag_id != Some(TAG_TABLE)
    {
      return [DEFAULT_BLOCK_SPACING[0], 1];
    }
    DEFAULT_BLOCK_SPACING
  }

  #[inline]
  pub(crate) fn get_language_from_class(class_name: Option<&String>) -> &str {
    if let Some(class) = class_name {
      for part in class.split_whitespace() {
        if let Some(lang) = part.strip_prefix("language-") {
          return lang.trim();
        }
      }
    }
    ""
  }
}
