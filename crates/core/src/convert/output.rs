//! Markdown output: tag enter/exit emission, buffer writing, spacing.

use super::*;

impl ConvertState {
    /// Emit markdown for entering the element currently on top of self.stack.
    #[inline]
    pub(crate) fn emit_enter_element(&mut self) {
        let stack_len = self.stack.len();
        if stack_len == 0 { return; }

        // Phase 1: read from node + compute output (borrows self.stack immutably)
        let tag_id: Option<u8>;
        let is_inline: bool;
        let node_spacing: Option<[u8; 2]>;
        let output: Option<Cow<'static, str>>;
        // True when `output` is a user-supplied override enter string — emit it
        // verbatim without synthesizing a separating space (issue #93).
        let enter_is_literal: bool;
        {
            let (ancestors, last) = self.stack.split_at(stack_len - 1);
            let node = &last[0];

            if node.excluded_from_markdown {
                self.last_node_is_inline = node.is_inline;
                return;
            }

            tag_id = node.tag_id;

            // Check override is_inline
            let override_config = if self.has_tag_overrides {
                self.options.plugins.as_ref()
                    .and_then(|p| p.tag_overrides.as_ref())
                    .and_then(|ovs| ovs.iter().find(|(k, _)| k == node.name()).map(|(_, v)| v))
            } else { None };

            is_inline = override_config.and_then(|ov| ov.is_inline).unwrap_or(node.is_inline);
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
        let configured_new_lines = new_line_config[0];

        // Clean mode — single guard for all clean checks
        if self.clean_flags != 0
            && let Some(id) = tag_id {
                if id == TAG_A {
                    // emptyLinks: skip href="#" or "javascript:"
                    if self.clean_flags & CLEAN_EMPTY_LINKS != 0 {
                        let node = &self.stack[self.stack.len() - 1];
                        if let Some(href) = node.attributes.get("href")
                            && (href == "#" || href.starts_with("javascript:")) {
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

        self.write_output(true, is_inline, configured_new_lines, output.as_deref(), enter_is_literal);

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

        // Clean: track heading start for slug collection
        if self.clean_flags & CLEAN_FRAGMENTS != 0
            && let Some(id) = tag_id
                && (TAG_H1..=TAG_H6).contains(&id) && self.depth_map[TAG_A as usize] == 0 {
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

        // Check override
        let override_config = if self.has_tag_overrides {
            self.options.plugins.as_ref()
                .and_then(|p| p.tag_overrides.as_ref())
                .and_then(|ovs| ovs.iter().find(|(k, _)| k == node.name()).map(|(_, v)| v))
        } else { None };

        let is_inline = override_config.and_then(|ov| ov.is_inline).unwrap_or(node.is_inline);

        // Table cell count (exit)
        if (tag_id == Some(TAG_TH) || tag_id == Some(TAG_TD)) && self.depth_map[TAG_TABLE as usize] <= 1 {
            self.table_current_row_cells += 1;
        }

        let mut output: Option<Cow<'static, str>> = None;
        let mut table_separator: Option<String> = None;

        // Check override exit string
        let has_override = if let Some(ov) = override_config {
            if let Some(ref s) = ov.exit {
                output = Some(Cow::Owned(s.clone()));
                true
            } else { false }
        } else { false };

        if !has_override {
            // Special case: TR table separator
            if tag_id == Some(TAG_TR) {
                if !self.table_rendered_table && self.depth_map[TAG_TABLE as usize] <= 1 {
                    self.table_rendered_table = true;
                    let col_count = self.table_current_row_cells.max(self.table_column_alignments.len());
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

        let new_line_config = self.calculate_new_line_config(tag_id, node_spacing);
        let configured_new_lines = new_line_config[1];

        // Clean mode exit — single guard. Skipped for overridden anchors,
        // whose custom exit output isn't the default `[…](…)` shape.
        if self.clean_flags != 0 && tag_id == Some(TAG_A) && !has_override {
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
                while pos < buf.len() && buf[pos] != b'[' { pos += 1; }
                pos
            };
            // Guard: if bracket not found, bracket_pos == buf_len; text_start would overflow
            if bracket_pos >= buf_len {
                self.last_node_is_inline = is_inline;
                return;
            }
            let text_start = bracket_pos + 1;
            let link_text = if text_start <= buf_len && self.buffer.is_char_boundary(text_start) { &self.buffer[text_start..buf_len] } else { "" };
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
                        && href.starts_with('#') && text_len > 0 {
                            // Remove [ and keep text only — use truncate+copy without intermediate String
                            let new_len = bracket_pos + text_len;
                            // SAFETY: bracket_pos < text_start are within buffer bounds (guarded above).
                            // We copy link text backwards over "[", then truncate. Preserves valid UTF-8.
                            #[allow(unsafe_code)]
                            unsafe {
                                let buf = self.buffer.as_mut_vec();
                                std::ptr::copy(buf.as_ptr().add(text_start), buf.as_mut_ptr().add(bracket_pos), text_len);
                                buf.set_len(new_len);
                            }
                            self.last_content_cache_len = text_len;
                            self.last_node_is_inline = is_inline;
                            return;
                        }
            }

            // redundantLinks: [url](url) → url
            if self.clean_flags & CLEAN_REDUNDANT_LINKS != 0
                && let Some(href) = node.attributes.get("href") {
                    let resolved = resolve_url(href, self.options.origin.as_deref(), self.options.clean_urls);
                    if link_text == resolved.as_ref() && text_len > 0 {
                        // Remove [ and keep text only — use truncate+copy without intermediate String
                        let new_len = bracket_pos + text_len;
                        // SAFETY: same invariants as self-link heading case. Preserves valid UTF-8.
                        #[allow(unsafe_code)]
                        unsafe {
                            let buf = self.buffer.as_mut_vec();
                            std::ptr::copy(buf.as_ptr().add(text_start), buf.as_mut_ptr().add(bracket_pos), text_len);
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
                && (TAG_H1..=TAG_H6).contains(&id) {
                    let heading_text = &self.buffer[self.heading_buffer_start..];
                    let slug = slugify_heading(heading_text);
                    if !slug.is_empty() {
                        self.heading_slugs.push(slug);
                    }
                    self.in_heading = false;
                }

        // TAG_A exit: write ](url) directly to buffer — zero allocation
        if !has_override && tag_id == Some(TAG_A) && table_separator.is_none() {
            // Handle whitespace trimming (write_output with None)
            self.write_output(false, is_inline, configured_new_lines, None, false);
            // Write link close directly
            if let Some(href) = node.attributes.get("href") {
                let resolved = resolve_url(href, self.options.origin.as_deref(), self.options.clean_urls);
                let mut title = node.attributes.get("title").map_or("", String::as_str);
                if !title.is_empty() && self.last_content_cache_len > 0 {
                    let buf_len = self.buffer.len();
                    let start = buf_len.saturating_sub(self.last_content_cache_len);
                    if self.buffer.is_char_boundary(start) {
                        let cache = &self.buffer[start..];
                        if cache == title { title = ""; }
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
                    if bp < buf_bytes.len() && buf_bytes[bp] == b'['
                        && &self.buffer[bp + 1..] == resolved.as_ref() {
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
                    && href.starts_with('#') && href.len() > 1 {
                        // link_bracket_pos now points exactly at `[` (set in emit_enter_element).
                        self.fragment_links.push((self.link_bracket_pos, self.buffer.len()));
                    }
            self.last_node_is_inline = is_inline;
            return;
        }

        // Get effective output
        let effective: Option<&str> = if let Some(ref sep) = table_separator {
            Some(sep.as_str())
        } else {
            output.as_deref()
        };

        self.write_output(false, is_inline, configured_new_lines, effective, false);

        // Record fragment link position for deferred fixup (no String alloc)
        if self.clean_flags & CLEAN_FRAGMENTS != 0 && tag_id == Some(TAG_A)
            && let Some(href) = node.attributes.get("href")
                && href.starts_with('#') && href.len() > 1 {
                    self.fragment_links.push((self.link_bracket_pos, self.buffer.len()));
                }
    }

    /// Emit markdown for a text node (no TextNode allocation).
    #[inline]
    pub(crate) fn emit_text(&mut self, text: &str, contains_whitespace: bool, depth: usize, index: usize) {
        if text.is_empty() { return; }

        let buf_bytes = self.buffer.as_bytes();
        let buf_len = buf_bytes.len();
        let last_char = if buf_len > 0 { buf_bytes[buf_len - 1] } else { 0 };

        if text.len() == 1 && text.as_bytes()[0] == b' ' && last_char == b'\n' {
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
        let text = if self.depth_map[TAG_PRE as usize] > 0 && li_depth > 0
            && (text.contains('\n') || last_char == b'\n') {
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

        if self.should_add_spacing_before_text(last_char, text) {
            self.buffer.push(' ');
            self.last_content_cache_len = text.len() + 1;
            self.buffer.push_str(text);
        } else {
            self.last_content_cache_len = text.len();
            self.buffer.push_str(text);
        }

        self.last_text_node_contains_whitespace = contains_whitespace;
        self.has_last_text_node = true;
        self.last_text_node_depth = depth;
        self.last_text_node_index = index;
        self.last_node_is_inline = false;
    }

    /// Emit frontmatter content.
    pub(crate) fn emit_frontmatter(&mut self, content: &str) {
        if !content.is_empty() {
            self.last_content_cache_len = content.len();
            self.buffer.push_str(content);
        }
    }

    #[inline]
    pub(crate) fn get_enter_output(&self, node: &ElementNode, _ancestors: &[ElementNode]) -> Option<Cow<'static, str>> {
        let tag_id = node.tag_id?;
        match tag_id {
            TAG_DETAILS => Some(Cow::Borrowed("<details>")),
            TAG_SUMMARY => Some(Cow::Borrowed("<summary>")),
            TAG_BR => {
                if self.in_table_cell() { Some(Cow::Borrowed("<br>")) } else { None }
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
                if self.depth_map[TAG_B as usize] > 1 { Some(Cow::Borrowed("")) }
                else { Some(Cow::Borrowed(MARKDOWN_STRONG)) }
            }
            TAG_EM | TAG_I => {
                if self.depth_map[TAG_I as usize] > 1 { Some(Cow::Borrowed("")) }
                else { Some(Cow::Borrowed(MARKDOWN_EMPHASIS)) }
            }
            TAG_DEL => Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH)),
            TAG_SUB => Some(Cow::Borrowed("<sub>")),
            TAG_SUP => Some(Cow::Borrowed("<sup>")),
            TAG_INS => Some(Cow::Borrowed("<ins>")),
            TAG_P => {
                let bq_depth = self.depth_map[TAG_BLOCKQUOTE as usize] as usize;
                if bq_depth > 0 {
                    let last_char = self.buffer.as_bytes().last().copied().unwrap_or(0);
                    if last_char != 0 && last_char != b'\n' && last_char != b' ' && last_char != b'>' {
                        let prefix = if bq_depth < BQ_PREFIXES.len() { BQ_PREFIXES[bq_depth] } else { &"> ".repeat(bq_depth) };
                        let trimmed = prefix.trim_end();
                        let mut s = String::with_capacity(1 + trimmed.len() + 1 + prefix.len());
                        s.push('\n');
                        s.push_str(trimmed);
                        s.push('\n');
                        s.push_str(prefix);
                        return Some(Cow::Owned(s));
                    }
                }
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
                let depth = std::cmp::max(1, self.depth_map[TAG_BLOCKQUOTE as usize]) as usize;
                if self.depth_map[TAG_LI as usize] == 0 && depth < BQ_PREFIXES.len() {
                    Some(Cow::Borrowed(BQ_PREFIXES[depth]))
                } else {
                    let mut prefix = if depth < BQ_PREFIXES.len() {
                        BQ_PREFIXES[depth].to_string()
                    } else {
                        "> ".repeat(depth)
                    };
                    if self.depth_map[TAG_LI as usize] > 0 {
                        prefix = format!("\n{}{}", self.list_indent, prefix);
                    }
                    Some(Cow::Owned(prefix))
                }
            }
            TAG_CODE => {
                if self.depth_map[TAG_PRE as usize] > 0 {
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
                if self.in_table_cell() { Some(Cow::Borrowed("<ul>")) } else { None }
            }
            TAG_OL => {
                if self.in_table_cell() { Some(Cow::Borrowed("<ol>")) } else { None }
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
                if node.attributes.contains_key("href") { Some(Cow::Borrowed("[")) } else { None }
            }
            TAG_IMG => {
                let alt = node.attributes.get("alt").map_or("", String::as_str);
                let src = node.attributes.get("src").map_or("", String::as_str);
                let resolved_src = resolve_url(src, self.options.origin.as_deref(), self.options.clean_urls);
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
                if self.in_table_cell() { Some(Cow::Borrowed("<table>")) } else { None }
            }
            TAG_THEAD => {
                if self.in_table_cell() { Some(Cow::Borrowed("<thead>")) } else { None }
            }
            TAG_TR => {
                if self.in_table_cell() { Some(Cow::Borrowed("<tr>")) }
                else { Some(Cow::Borrowed("| ")) }
            }
            TAG_TH => {
                if self.depth_map[TAG_TABLE as usize] > 1 { return Some(Cow::Borrowed("<th>")); }
                if node.index == 0 { Some(Cow::Borrowed("")) } else { Some(Cow::Borrowed(" | ")) }
            }
            TAG_TD => {
                if self.depth_map[TAG_TABLE as usize] > 1 { return Some(Cow::Borrowed("<td>")); }
                if node.index == 0 { Some(Cow::Borrowed("")) } else { Some(Cow::Borrowed(" | ")) }
            }
            TAG_CENTER => {
                if self.depth_map[TAG_TABLE as usize] > 1 { Some(Cow::Borrowed("<center>")) } else { None }
            }
            TAG_KBD | TAG_SAMP | TAG_VAR => Some(Cow::Borrowed("`")),
            TAG_ABBR | TAG_SMALL | TAG_TIME | TAG_BDO | TAG_RUBY | TAG_RT | TAG_RP => Some(Cow::Borrowed("")),
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
        let tag_id = node.tag_id?;
        match tag_id {
            TAG_DETAILS => Some(Cow::Borrowed("</details>\n\n")),
            TAG_SUMMARY => Some(Cow::Borrowed("</summary>\n\n")),
            TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
                let depth = (tag_id - TAG_H1 + 1) as usize;
                if self.depth_map[TAG_A as usize] > 0 {
                    {
                        static H_CLOSE: [&str; 6] = ["</h1>", "</h2>", "</h3>", "</h4>", "</h5>", "</h6>"];
                        Some(Cow::Borrowed(H_CLOSE[depth - 1]))
                    }
                } else { None }
            }
            TAG_STRONG | TAG_B => {
                if self.depth_map[TAG_B as usize] > 1 { Some(Cow::Borrowed("")) }
                else { Some(Cow::Borrowed(MARKDOWN_STRONG)) }
            }
            TAG_EM | TAG_I => {
                if self.depth_map[TAG_I as usize] > 1 { Some(Cow::Borrowed("")) }
                else { Some(Cow::Borrowed(MARKDOWN_EMPHASIS)) }
            }
            TAG_DEL => Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH)),
            TAG_SUB => Some(Cow::Borrowed("</sub>")),
            TAG_SUP => Some(Cow::Borrowed("</sup>")),
            TAG_INS => Some(Cow::Borrowed("</ins>")),
            TAG_CODE => {
                if self.depth_map[TAG_PRE as usize] > 0 {
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
                } else {
                    Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
                }
            }
            TAG_UL => {
                if self.in_table_cell() { Some(Cow::Borrowed("</ul>")) } else { None }
            }
            TAG_OL => {
                if self.in_table_cell() { Some(Cow::Borrowed("</ol>")) } else { None }
            }
            TAG_LI => {
                if self.in_table_cell() { Some(Cow::Borrowed("</li>")) } else { None }
            }
            TAG_A => {
                if let Some(href) = node.attributes.get("href") {
                    let resolved = resolve_url(href, self.options.origin.as_deref(), self.options.clean_urls);
                    let mut title = node.attributes.get("title").map_or("", String::as_str);
                    if self.last_content_cache_len > 0 {
                        let buf_len = self.buffer.len();
                        let start = buf_len.saturating_sub(self.last_content_cache_len);
                        if self.buffer.is_char_boundary(start) {
                            let cache = &self.buffer[start..];
                            if cache == title { title = ""; }
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
                if self.in_table_cell() { Some(Cow::Borrowed("</table>")) } else { None }
            }
            TAG_THEAD => {
                if self.in_table_cell() { Some(Cow::Borrowed("</thead>")) } else { None }
            }
            TAG_TR => {
                if self.in_table_cell() || self.depth_map[TAG_TABLE as usize] > 1 {
                    Some(Cow::Borrowed("</tr>"))
                } else {
                    Some(Cow::Borrowed(" |"))
                }
            }
            TAG_TH => {
                if self.depth_map[TAG_TABLE as usize] > 1 { Some(Cow::Borrowed("</th>")) } else { None }
            }
            TAG_TD => {
                if self.depth_map[TAG_TABLE as usize] > 1 { Some(Cow::Borrowed("</td>")) } else { None }
            }
            TAG_CENTER => {
                if self.depth_map[TAG_TABLE as usize] > 1 { Some(Cow::Borrowed("</center>")) } else { None }
            }
            TAG_KBD | TAG_SAMP | TAG_VAR => Some(Cow::Borrowed("`")),
            TAG_ABBR | TAG_SMALL | TAG_TIME | TAG_BDO | TAG_RUBY | TAG_RT | TAG_RP => Some(Cow::Borrowed("")),
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
    pub(crate) fn write_output(&mut self, is_enter: bool, is_inline: bool, configured_new_lines: u8, output: Option<&str>, literal: bool) {
        let output_str = output.unwrap_or("");

        // Fast path: no newlines, no output, no whitespace state to manage
        if configured_new_lines == 0 && output_str.is_empty() && !self.last_text_node_contains_whitespace {
            self.last_node_is_inline = is_inline;
            return;
        }

        let buf_bytes = self.buffer.as_bytes();
        let buf_len = buf_bytes.len();
        let last_char = if buf_len > 0 { buf_bytes[buf_len - 1] } else { 0 };
        let second_last_char = if buf_len > 1 { buf_bytes[buf_len - 2] } else { 0 };

        let mut last_new_lines: u8 = 0;
        if last_char == b'\n' { last_new_lines += 1; }
        if second_last_char == b'\n' { last_new_lines += 1; }

        let new_lines = configured_new_lines.saturating_sub(last_new_lines);

        if new_lines > 0 {
            if self.buffer.is_empty() {
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
            }

            if is_enter {
                for _ in 0..new_lines { self.buffer.push('\n'); }
                if !output_str.is_empty() {
                    self.last_content_cache_len = output_str.len();
                    self.buffer.push_str(output_str);
                }
            } else {
                if !output_str.is_empty() {
                    self.last_content_cache_len = output_str.len();
                    self.buffer.push_str(output_str);
                }
                for _ in 0..new_lines { self.buffer.push('\n'); }
            }
        } else {
            if let Some(parent) = self.stack.last()
                && self.last_text_node_contains_whitespace
                    && (self.depth_map[TAG_PRE as usize] == 0 || parent.tag_id == Some(TAG_PRE)) {
                    let h_is_inline = is_inline;
                    let collapses = parent.collapses_inner_white_space;
                    let has_spacing = parent.spacing.is_some();
                    // For exit, the node was already popped, so use the is_inline param
                    let is_block = !h_is_inline && !collapses && configured_new_lines > 0;
                    let should_trim = !(is_block || h_is_inline && is_enter || is_enter && collapses) && !(has_spacing && is_enter);

                    if should_trim && self.last_content_cache_len > 0 {
                        let cache_len = self.last_content_cache_len;
                        let buf_len = self.buffer.len();
                        let start = buf_len.saturating_sub(cache_len);
                        if cache_len <= buf_len && self.buffer.is_char_boundary(start) {
                            let frag = &self.buffer[start..];
                            let trimmed_len = frag.trim_end().len();
                            if trimmed_len < cache_len {
                                self.buffer.truncate(start + trimmed_len);
                            }
                        }
                    }
                    self.last_text_node_contains_whitespace = false;
                    self.has_last_text_node = false;
                }

            if is_enter && !literal && !output_str.is_empty() && last_char != 0 && self.needs_spacing(last_char, output_str.as_bytes()[0]) {
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
        if matches!(last_byte, b' ' | b'\n' | b'\t') { return false; }
        if matches!(first_byte, b' ' | b'\n' | b'\t') { return false; }
        if last_byte == b'|' && first_byte == b'<' && !self.buffer.is_empty() { return true; }
        if matches!(last_byte, b'[' | b'(' | b'>' | b'*' | b'_' | b'`')
            || matches!(first_byte, b']' | b')' | b'<' | b'.' | b',' | b'!' | b'?' | b':' | b';' | b'*' | b'_' | b'`')
        { return false; }
        true
    }

    #[inline]
    pub(crate) fn should_add_spacing_before_text(&self, last_byte: u8, text: &str) -> bool {
        if last_byte == 0 || last_byte == b'\n' || last_byte == b' ' || last_byte == b'[' || last_byte == b'>' { return false; }
        if self.last_node_is_inline { return false; }
        let first_byte = text.as_bytes()[0];
        if first_byte == b' ' { return false; }
        if matches!(first_byte, b'.' | b',' | b'!' | b'?' | b':' | b';' | b'_' | b'*' | b'`' | b')' | b']') { return false; }
        true
    }

    #[inline]
    pub(crate) fn calculate_new_line_config(&self, tag_id: Option<u8>, node_spacing: Option<[u8; 2]>) -> [u8; 2] {
        if let Some(id) = tag_id {
            if (id != TAG_LI && self.depth_map[TAG_LI as usize] > 0)
                || (id != TAG_BLOCKQUOTE && self.depth_map[TAG_BLOCKQUOTE as usize] > 0) {
                return NO_SPACING;
            }
        } else if self.depth_map[TAG_LI as usize] > 0 || self.depth_map[TAG_BLOCKQUOTE as usize] > 0 {
            return NO_SPACING;
        }
        if self.collapse_non_span_depth > 0 { return NO_SPACING; }
        if self.collapse_span_depth > 0 {
            let is_block = tag_id.is_some_and(|id| (TAG_H1..=TAG_H6).contains(&id) || id == TAG_P || id == TAG_DIV);
            if !is_block { return NO_SPACING; }
        }
        if self.has_tag_overrides {
            // For override spacing, we'd need the node name — but we have tag_id.
            // Use tag_id to get name for override lookup.
            if let Some(id) = tag_id {
                let name = TAG_NAMES[id as usize];
                if let Some(sp) = self.options.plugins.as_ref()
                    .and_then(|p| p.tag_overrides.as_ref())
                    .and_then(|ovs| ovs.iter().find(|(k, _)| k == name).map(|(_, v)| v))
                    .and_then(|ov| ov.spacing) {
                    return sp;
                }
            }
        }
        node_spacing.unwrap_or(DEFAULT_BLOCK_SPACING)
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
