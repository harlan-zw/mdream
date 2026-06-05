//! HTML parsing: tag scanning, node lifecycle, text-buffer processing.

use super::*;

impl ConvertState {
    pub(crate) fn process_text_buffer(&mut self, text_buffer: &mut String) {
        let contains_non_whitespace = self.text_buffer_contains_non_whitespace;
        let contains_whitespace = self.text_buffer_contains_whitespace;
        self.text_buffer_contains_non_whitespace = false;
        self.text_buffer_contains_whitespace = false;

        // No parent element means this is a top-level (root) text node, e.g. the
        // leading `foo ` in the fragment `foo <sup>bar</sup>`. Such text must
        // still be emitted rather than dropped (issue #93).
        let mut excludes_text_nodes = self.stack.last()
            .is_some_and(|parent| parent.excludes_text_nodes || parent.excluded_from_markdown);

        if self.has_isolate_main {
            if self.isolate_main_found {
                if self.isolate_main_closed { excludes_text_nodes = true; }
            } else if self.isolate_first_header_depth.is_none() {
                if self.depth_map[TAG_HEAD as usize] == 0 { excludes_text_nodes = true; }
            } else if self.isolate_after_footer {
                excludes_text_nodes = true;
            }
        }

        if self.has_frontmatter
            && self.frontmatter_in_head
            && self.stack.last().is_some_and(|p| p.tag_id == Some(TAG_TITLE))
        {
            let val = text_buffer.trim().to_string();
            if !val.is_empty() { self.frontmatter_title = Some(val); }
            text_buffer.clear();
            return;
        }

        let in_pre_tag = self.in_pre;
        let child_text_node_index = self.stack.last().map_or(0, |n| n.child_text_node_index);

        if !in_pre_tag && !contains_non_whitespace && child_text_node_index == 0 { return; }
        if text_buffer.is_empty() { return; }

        let first_block_parent_index = self.first_block_parent_index;
        let first_block_child_text_count = first_block_parent_index.map_or(0, |idx| self.stack[idx].child_text_node_index);

        let mut text = std::mem::take(text_buffer);
        let is_first_text_in_block = first_block_child_text_count == 0
            && (first_block_parent_index.is_some() || self.buffer.is_empty() || self.buffer.as_bytes().last() == Some(&b'\n'));
        if contains_whitespace && is_first_text_in_block {
            let mut start = 0;
            let bytes = text.as_bytes();
            while start < bytes.len() && (if in_pre_tag { bytes[start] == NEWLINE_CHAR || bytes[start] == CARRIAGE_RETURN_CHAR } else { is_whitespace(bytes[start]) }) {
                start += 1;
            }
            if start > 0 { text.drain(..start); }
        }

        if self.has_encoded_html_entity {
            if let Cow::Owned(decoded) = decode_html_entities(&text) {
                text = decoded;
            }
            self.has_encoded_html_entity = false;
        }

        if self.has_tailwind
            && let Some(parent) = self.stack.last()
                && let Some(tw) = &parent.tailwind {
                    if tw.hidden {
                        excludes_text_nodes = true;
                    } else if !excludes_text_nodes {
                        let mut modified = false;
                        let mut new_text = String::new();
                        if let Some(p) = &tw.prefix { new_text.push_str(p); modified = true; }
                        new_text.push_str(&text);
                        if let Some(s) = &tw.suffix { new_text.push_str(s); modified = true; }
                        if modified { text = fix_redundant_delimiters(&new_text); }
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
            self.emit_text(&text, contains_whitespace, depth, index);
        }

        // Recover String allocation
        text.clear();
        *text_buffer = text;

        if let Some(parent) = self.stack.last_mut() {
            parent.current_walk_index += 1;
        }

        let up_to = first_block_parent_index.unwrap_or(0);
        for idx in up_to..self.stack.len() {
            self.stack[idx].child_text_node_index += 1;
        }
    }

    pub(crate) fn process_opening_tag(&mut self, tag_name: &str, tag_id: Option<u8>, is_builtin: bool, html_chunk: &str, position: usize) -> OpeningTagResult {
        let tag_handler = tag_id.and_then(get_tag_handler);
        let needs_attrs = tag_handler.is_some_and(|h| h.needs_attributes)
            || self.has_tailwind || self.has_filter || self.has_extraction
            || self.has_tag_overrides || self.has_frontmatter;
        let (complete, new_position, attributes, self_closing) = process_tag_attributes(html_chunk, position, tag_handler, !needs_attrs);

        if !complete {
            return OpeningTagResult {
                complete: false, new_position: position,
                self_closing: false, skip: false,
            };
        }

        if let Some(id) = tag_id {
            debug_assert!((id as usize) < MAX_TAG_ID, "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}");
            if (id as usize) < MAX_TAG_ID {
                self.depth_map[id as usize] = self.depth_map[id as usize].saturating_add(1);
            }
            match id {
                TAG_TABLE => self.escape_ctx |= ESC_TABLE,
                TAG_CODE | TAG_PRE => { self.escape_ctx |= ESC_CODE_PRE; if id == TAG_PRE { self.in_pre = true; } }
                TAG_A => self.escape_ctx |= ESC_LINK,
                TAG_BLOCKQUOTE => self.escape_ctx |= ESC_BLOCKQUOTE,
                _ => {}
            }
        }
        self.depth += 1;

        let current_walk_index = self.stack.last().map_or(0, |n| n.current_walk_index);
        let custom_name = if is_builtin { None } else { Some(tag_name.to_string()) };

        let (h_inline, h_excludes, h_non_nesting, h_collapses, h_spacing) = if let Some(h) = tag_handler {
            (h.is_inline, h.excludes_text_nodes, h.is_non_nesting, h.collapses_inner_white_space, h.spacing)
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
                custom_name, attributes, tag_id,
                depth: self.depth, index: current_walk_index,
                current_walk_index: 0, child_text_node_index: 0,
                contains_whitespace: false, excluded_from_markdown: false,
                tailwind: None,
                is_inline: h_inline, excludes_text_nodes: h_excludes,
                is_non_nesting: h_non_nesting, collapses_inner_white_space: h_collapses,
                spacing: h_spacing,
            }
        };

        let mut skip_node = false;
        let mut filter_excluded = false;

        if self.has_plugins {
            if self.has_tailwind {
                let parent_hidden = self.stack.last()
                    .and_then(|p| p.tailwind.as_ref())
                    .is_some_and(|tw| tw.hidden);

                if let Some(class_attr) = tag.attributes.get("class") {
                    let (prefix, suffix, hidden) = process_tailwind_classes(class_attr);
                    let hidden = hidden || parent_hidden;
                    if prefix.is_some() || suffix.is_some() || hidden {
                        tag.tailwind = Some(Box::new(TailwindData { prefix, suffix, hidden }));
                        if hidden { skip_node = true; }
                    }
                } else if parent_hidden {
                    tag.tailwind = Some(Box::new(TailwindData { prefix: None, suffix: None, hidden: true }));
                    skip_node = true;
                }
            }

            if self.has_filter {
                if let Some(style) = tag.attributes.get("style")
                    && (style.contains("absolute") || style.contains("fixed")) { skip_node = true; }
                if !skip_node {
                    for (_, parsed) in &self.filter_exclude_parsed {
                        if matches_selector(&tag, parsed) { skip_node = true; filter_excluded = true; break; }
                    }
                }
                if !skip_node {
                    for parent in &self.stack {
                        for (_, parsed) in &self.filter_exclude_parsed {
                            if matches_selector(parent, parsed) { skip_node = true; filter_excluded = true; break; }
                        }
                        if skip_node { break; }
                    }
                }
                if !skip_node && !self.filter_include_parsed.is_empty() {
                    let mut match_found = false;
                    for (_, parsed) in &self.filter_include_parsed {
                        if matches_selector(&tag, parsed) { match_found = true; break; }
                    }
                    if !match_found && self.filter_process_children {
                        for parent in &self.stack {
                            for (_, parsed) in &self.filter_include_parsed {
                                if matches_selector(parent, parsed) { match_found = true; break; }
                            }
                            if match_found { break; }
                        }
                    }
                    if !match_found { skip_node = true; filter_excluded = true; }
                }
            }

            if self.has_isolate_main {
                let is_main = tag_id == Some(TAG_MAIN);
                if !self.isolate_main_found && is_main && self.depth <= 50 { self.isolate_main_found = true; }
                if self.isolate_main_found {
                    if self.isolate_main_closed { skip_node = true; }
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
                        if tag_id != Some(TAG_HEAD) && self.depth_map[TAG_HEAD as usize] == 0 { skip_node = true; }
                    } else if self.isolate_after_footer {
                        skip_node = true;
                    }
                }
            }

            if self.has_frontmatter {
                if tag_id == Some(TAG_HEAD) {
                    self.frontmatter_in_head = true;
                } else if self.frontmatter_in_head && tag_id == Some(TAG_META) {
                    let name = tag.attributes.get("name").or_else(|| tag.attributes.get("property"));
                    let content = tag.attributes.get("content");
                    if let (Some(n), Some(c)) = (name, content) {
                        let n_str = n.as_str();
                        let is_allowed = match n_str {
                            "description" | "keywords" | "author" | "date" | "og:title" | "og:description" | "twitter:title" | "twitter:description" => true,
                            _ => self.options.plugins.as_ref()
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

        tag.excluded_from_markdown = filter_excluded
            || (skip_node && (!self.has_isolate_main || self.isolate_main_found));

        if tag.collapses_inner_white_space && !filter_excluded {
            if tag.tag_id == Some(TAG_SPAN) { self.collapse_span_depth = self.collapse_span_depth.saturating_add(1); }
            else { self.collapse_non_span_depth = self.collapse_non_span_depth.saturating_add(1); }
        }

        if let Some(last) = self.stack.last_mut() { last.current_walk_index += 1; }

        if !tag.is_inline {
            let idx = self.stack.len();
            self.first_block_parent_index = Some(idx);
            self.block_parent_indices.push(idx);
        }

        self.stack.push(tag);

        // Extraction
        if !self.extraction_parsed_selectors.is_empty()
            && let Some(element) = self.stack.last() {
                let stack_depth = self.stack.len();
                for (selector, parsed) in &self.extraction_parsed_selectors {
                    if matches_selector(element, parsed) {
                        let attrs: Vec<(String, String)> = element.attributes.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
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
            let width: usize = if !skip_node && !self.in_table_cell() {
                let stack_len = self.stack.len();
                let parent_is_ordered = stack_len >= 2
                    && self.stack[stack_len - 2].tag_id == Some(TAG_OL);
                if parent_is_ordered {
                    let n = li.index + 1;
                    // n >= 1 so ilog10 never panics; +1 converts floor(log10) to digit count.
                    let digits = (n.ilog10() + 1) as usize;
                    digits + 2
                } else {
                    2
                }
            } else {
                0
            };
            self.list_indent_widths.push(u8::try_from(width).unwrap_or(u8::MAX));
            for _ in 0..width { self.list_indent.push(' '); }
        }

        self.has_encoded_html_entity = false;

        if self.stack.last().is_some_and(|n| n.is_non_nesting) && !self_closing {
            self.in_non_nesting = true;
            // <script>/<style> are quote-aware: a `</script>` inside a JS/CSS
            // string literal must not close the element (issue #93 regression).
            self.in_rawtext_quote_aware = matches!(tag_id, Some(TAG_SCRIPT | TAG_STYLE));
            self.rawtext_quote = 0;
            self.rawtext_escaped = false;
        }

        if !self_closing { self.just_closed_tag = false; }

        OpeningTagResult {
            complete: true, new_position,
            self_closing, skip: false,
        }
    }

    pub(crate) fn close_node(&mut self) {
        if self.stack.is_empty() { return; }

        // Extraction finalize
        if !self.extraction_tracked.is_empty() {
            let current_depth = self.stack.len();
            let mut i = 0;
            while i < self.extraction_tracked.len() {
                if self.extraction_tracked[i].stack_depth == current_depth {
                    let tracked = self.extraction_tracked.swap_remove(i);
                    self.extraction_results.push(ExtractedElement {
                        selector: tracked.selector,
                        tag_name: tracked.tag_name,
                        text_content: tracked.text_content.trim().to_string(),
                        attributes: tracked.attributes,
                    });
                } else { i += 1; }
            }
        }

        let popping_index = self.stack.len() - 1;
        // Guard already checked above, but avoid panic on edge cases
        let Some(node) = self.stack.pop() else { return };

        if self.first_block_parent_index == Some(popping_index) {
            self.block_parent_indices.pop();
            self.first_block_parent_index = self.block_parent_indices.last().copied()
                .or(if self.stack.is_empty() { None } else { Some(0) });
        }

        if node.collapses_inner_white_space && !node.excluded_from_markdown {
            if node.tag_id == Some(TAG_SPAN) { self.collapse_span_depth = self.collapse_span_depth.saturating_sub(1); }
            else { self.collapse_non_span_depth = self.collapse_non_span_depth.saturating_sub(1); }
        }

        if self.has_isolate_main
            && node.tag_id == Some(TAG_MAIN)
            && self.isolate_main_found
            && !self.isolate_main_closed
        {
            self.isolate_main_closed = true;
        }

        // Frontmatter generation on HEAD close
        if self.has_frontmatter && node.tag_id == Some(TAG_HEAD) && self.frontmatter_in_head {
            self.frontmatter_in_head = false;
            self.generate_frontmatter_yaml();
        }

        // Special: empty links — synthesize text from title/aria-label
        if node.tag_id == Some(TAG_A) && node.child_text_node_index == 0 && !node.excluded_from_markdown {
            let prefix = node.attributes.get("title").or_else(|| node.attributes.get("aria-label")).cloned().unwrap_or_default();
            if !prefix.is_empty() {
                let node_depth = node.depth;
                let node_tag_id = node.tag_id;
                let mut modified_node = node;
                modified_node.child_text_node_index = 1;
                let text_depth = node_depth + 1;
                self.stack.push(modified_node);
                // Emit synthetic text
                self.emit_text(&prefix, false, text_depth, 0);
                for prev in &mut self.stack { prev.child_text_node_index += 1; }
                let Some(modified_node2) = self.stack.pop() else { return; };
                // Emit exit
                self.emit_exit_element(&modified_node2);
                self.recycle_node(modified_node2);
                if let Some(id) = node_tag_id {
                    debug_assert!((id as usize) < MAX_TAG_ID, "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}");
                    if (id as usize) < MAX_TAG_ID {
                        self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
                    }
                    self.update_escape_ctx_on_close(id);
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
                self.reset_rawtext_quote_state();
                return;
            }
        }

        // Inline emit exit (no callback!)
        self.emit_exit_element(&node);

        let node_tag_id = node.tag_id;
        self.recycle_node(node);

        if let Some(id) = node_tag_id {
            debug_assert!((id as usize) < MAX_TAG_ID, "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}");
            if (id as usize) < MAX_TAG_ID {
                self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
            }
            self.update_escape_ctx_on_close(id);
            if id == TAG_LI
                && let Some(w) = self.list_indent_widths.pop()
            {
                let new_len = self.list_indent.len().saturating_sub(w as usize);
                self.list_indent.truncate(new_len);
            }
        }

        self.in_non_nesting = self.stack.last().is_some_and(|n| n.is_non_nesting);
        self.reset_rawtext_quote_state();
        self.depth -= 1;
        self.has_encoded_html_entity = false;
        self.just_closed_tag = true;
    }

    /// Clear quote-aware rawtext tracking once no longer inside `<script>`/`<style>`.
    #[inline]
    fn reset_rawtext_quote_state(&mut self) {
        if !self.in_non_nesting {
            self.in_rawtext_quote_aware = false;
            self.rawtext_quote = 0;
            self.rawtext_escaped = false;
        }
    }

    pub(crate) fn process_closing_tag(&mut self, html_chunk: &str, position: usize) -> CloseTagResult {
        let mut i = position + 2;
        let tag_name_start = i;
        let bytes = html_chunk.as_bytes();
        let chunk_length = bytes.len();

        let mut found_close = false;
        while i < chunk_length {
            if bytes[i] == GT_CHAR { found_close = true; break; }
            i += 1;
        }

        if !found_close {
            return CloseTagResult {
                complete: false, new_position: position,
                remaining_start: position,
            };
        }

        let tag_name_raw = html_chunk[tag_name_start..i].trim();
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
        let tag_id = if builtin_tag_id.is_some() { builtin_tag_id } else {
            self.options.plugins.as_ref()
                .and_then(|p| p.tag_overrides.as_ref())
                .and_then(|ovs| ovs.iter().find(|(k, _)| k == tag_name.as_ref()).map(|(_, v)| v))
                .and_then(|ov| ov.alias_tag_id)
        };

        if let Some(curr) = self.stack.last()
            && curr.is_non_nesting && curr.tag_id != tag_id {
                return CloseTagResult {
                    complete: false, new_position: position,
                    remaining_start: position,
                };
            }

        // For aliased close (`</ex>` with ex→em), match the open node by both
        // tag_id and custom_name so we close the specific aliased element rather
        // than an unrelated built-in <em> on the stack.
        let close_name: &str = tag_name.as_ref();
        let needs_name_match = builtin_tag_id.is_none() && tag_id.is_some();
        let matches = |node: &ElementNode| -> bool {
            if node.tag_id != tag_id { return false; }
            if !needs_name_match { return true; }
            node.custom_name.as_deref() == Some(close_name)
        };

        if let Some(top) = self.stack.last() {
            if matches(top) {
                self.close_node();
            } else {
                let mut pop_count = 0;
                for j in (0..self.stack.len()).rev() {
                    pop_count += 1;
                    if matches(&self.stack[j]) { break; }
                }
                for _ in 0..pop_count {
                    if !self.stack.is_empty() { self.close_node(); }
                }
            }
        }

        self.just_closed_tag = true;
        CloseTagResult { complete: true, new_position: i + 1, remaining_start: 0 }
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
        if !self.has_tag_overrides { return; }
        let Some(tag_id) = self.options.plugins.as_ref()
            .and_then(|p| p.tag_overrides.as_ref())
            .and_then(|ovs| ovs.iter().find(|(k, _)| k == "#cdata-section"))
            .map(|(_, ov)| ov.alias_tag_id)
        else { return };

        let result = self.process_opening_tag("#cdata-section", tag_id, false, ">", 0);
        if !result.complete { return; }

        if !result.self_closing && !content.is_empty() {
            let excluded = self.stack.last()
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
    pub(crate) fn update_escape_ctx_on_close(&mut self, id: u8) {
        match id {
            TAG_TABLE if self.depth_map[id as usize] == 0 => self.escape_ctx &= !ESC_TABLE,
            TAG_CODE if self.depth_map[TAG_CODE as usize] == 0 && self.depth_map[TAG_PRE as usize] == 0 => self.escape_ctx &= !ESC_CODE_PRE,
            TAG_PRE if self.depth_map[TAG_PRE as usize] == 0 => {
                self.in_pre = false;
                if self.depth_map[TAG_CODE as usize] == 0 { self.escape_ctx &= !ESC_CODE_PRE; }
            }
            TAG_A if self.depth_map[id as usize] == 0 => self.escape_ctx &= !ESC_LINK,
            TAG_BLOCKQUOTE if self.depth_map[id as usize] == 0 => self.escape_ctx &= !ESC_BLOCKQUOTE,
            _ => {}
        }
    }
}
