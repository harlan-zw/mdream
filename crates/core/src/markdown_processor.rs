use std::borrow::Cow;
use crate::consts::*;
use crate::tags::get_tag_handler;
use crate::types::{ElementNode, HTMLToMarkdownOptions, HandlerContext, NodeEvent, TextNode};

pub struct MarkdownState {
    pub options: HTMLToMarkdownOptions,
    pub buffer: String,
    pub last_content_cache_len: usize,
    pub table_rendered_table: bool,
    pub table_current_row_cells: usize,
    pub table_column_alignments: Vec<String>,

    pub last_text_node_contains_whitespace: bool,
    pub last_text_node_depth: usize,
    pub last_text_node_index: usize,
    pub has_last_text_node: bool,
    pub last_node_is_inline: bool,
    pub has_tag_overrides: bool,
    /// Cached: count of non-span ancestors with collapses_inner_white_space
    pub collapse_non_span_depth: u8,
    /// Cached: count of span ancestors with collapses_inner_white_space
    pub collapse_span_depth: u8,
}

pub struct MarkdownProcessor {
    pub state: MarkdownState,
    pub last_yielded_length: usize,
}

impl MarkdownProcessor {
    pub fn new(options: HTMLToMarkdownOptions) -> Self {
        Self::with_capacity(options, 1024)
    }

    pub fn with_capacity(options: HTMLToMarkdownOptions, capacity: usize) -> Self {
        let has_tag_overrides = options.plugins.as_ref()
            .and_then(|p| p.tag_overrides.as_ref())
            .is_some();
        Self {
            state: MarkdownState {
                options,
                buffer: String::with_capacity(capacity),
                last_content_cache_len: 0,
                table_rendered_table: false,
                table_current_row_cells: 0,
                table_column_alignments: Vec::new(),
                last_text_node_contains_whitespace: false,
                last_text_node_depth: 0,
                last_text_node_index: 0,
                has_last_text_node: false,
                last_node_is_inline: false,
                has_tag_overrides,
                collapse_non_span_depth: 0,
                collapse_span_depth: 0,
            },
            last_yielded_length: 0,
        }
    }

    pub fn process_event(&mut self, event: NodeEvent, ancestors: &[ElementNode], depth_map: &[u8; MAX_TAG_ID]) {
        let buf_bytes = self.state.buffer.as_bytes();
        let buf_len = buf_bytes.len();
        let last_char = if buf_len > 0 { buf_bytes[buf_len - 1] } else { 0 };
        let second_last_char = if buf_len > 1 { buf_bytes[buf_len - 2] } else { 0 };

        match event {
            NodeEvent::EnterText(text_node) => {
                if !text_node.value.is_empty() && !text_node.excluded_from_markdown {
                    if text_node.value.len() == 1 && text_node.value.as_bytes()[0] == b' ' && last_char == b'\n' {
                        // Update tracking state before returning
                        self.state.last_text_node_contains_whitespace = text_node.contains_whitespace;
                        self.state.has_last_text_node = true;
                        self.state.last_text_node_depth = text_node.depth;
                        self.state.last_text_node_index = text_node.index;
                        self.state.last_node_is_inline = false;
                        return;
                    }

                    if self.should_add_spacing_before_text(last_char, text_node) {
                        self.state.buffer.push(' ');
                        self.state.last_content_cache_len = text_node.value.len() + 1;
                        self.state.buffer.push_str(&text_node.value);
                    } else {
                        self.state.last_content_cache_len = text_node.value.len();
                        self.state.buffer.push_str(&text_node.value);
                    }
                }
                self.state.last_text_node_contains_whitespace = text_node.contains_whitespace;
                self.state.has_last_text_node = true;
                self.state.last_text_node_depth = text_node.depth;
                self.state.last_text_node_index = text_node.index;
                self.state.last_node_is_inline = false;
            }
            NodeEvent::Frontmatter(content) => {
                if !content.is_empty() {
                    self.state.last_content_cache_len = content.len();
                    self.state.buffer.push_str(&content);
                }
            }
            NodeEvent::EnterElement(node) | NodeEvent::ExitElement(node) => {
                let handler = node.tag_id.and_then(get_tag_handler);
                // Check for tag override config (skip HashMap lookup when no overrides)
                let override_config = if self.state.has_tag_overrides {
                    self.state.options.plugins.as_ref()
                        .and_then(|p| p.tag_overrides.as_ref())
                        .and_then(|ovs| ovs.get(node.name()))
                } else {
                    None
                };
                let is_inline = override_config.and_then(|ov| ov.is_inline)
                    .unwrap_or(node.is_inline);
                let is_enter = match event {
                    NodeEvent::EnterElement(elem) => {
                        if elem.excluded_from_markdown {
                            return;
                        }
                        true
                    }
                    NodeEvent::ExitElement(elem) => {
                        if elem.excluded_from_markdown {
                            return;
                        }
                        false
                    }
                    _ => unreachable!(),
                };

                // Update collapse depth counters
                if node.collapses_inner_white_space {
                    if is_enter {
                        if node.tag_id == Some(TAG_SPAN) {
                            self.state.collapse_span_depth += 1;
                        } else {
                            self.state.collapse_non_span_depth += 1;
                        }
                    } else {
                        if node.tag_id == Some(TAG_SPAN) {
                            self.state.collapse_span_depth -= 1;
                        } else {
                            self.state.collapse_non_span_depth -= 1;
                        }
                    }
                }

                // Table state updates (must happen before handler calls)
                if handler.is_some() {
                    if is_enter {
                        if node.tag_id == Some(TAG_TABLE) {
                            if depth_map[TAG_TABLE as usize] <= 1 {
                                self.state.table_rendered_table = false;
                            }
                            self.state.table_column_alignments.clear();
                        } else if node.tag_id == Some(TAG_TR) {
                            self.state.table_current_row_cells = 0;
                        } else if node.tag_id == Some(TAG_TH) {
                            let align = node.attributes.get("align").map(|s| s.to_lowercase());
                            if let Some(align) = align {
                                self.state.table_column_alignments.push(align);
                            } else if self.state.table_column_alignments.len() <= self.state.table_current_row_cells {
                                self.state.table_column_alignments.push(String::new());
                            }
                        }
                    }
                }

                // Call handler - use Option instead of Vec to avoid allocation
                let mut output: Option<Cow<'static, str>> = None;
                let mut table_separator: Option<String> = None;

                // Build handler context - borrow cache directly from buffer (no allocation)
                let cache_start: Option<usize> = if !is_enter && node.tag_id == Some(TAG_A) && self.state.last_content_cache_len > 0 {
                    Some(self.state.buffer.len().saturating_sub(self.state.last_content_cache_len))
                } else {
                    None
                };
                let ctx = HandlerContext {
                    node,
                    ancestors: &ancestors[..ancestors.len().saturating_sub(1)],
                    options: &self.state.options,
                    last_content_cache: cache_start.map(|s| &self.state.buffer[s..]),
                    depth_map,
                };

                // Check for override enter/exit strings (works for both alias and non-alias)
                let has_override_output = if let Some(ov) = override_config {
                    if is_enter {
                        if let Some(ref s) = ov.enter {
                            output = Some(Cow::Owned(s.clone()));
                            true
                        } else if ov.alias_tag_id.is_none() {
                            if let Some(h) = handler {
                                if let Some(f) = h.enter { output = f(&ctx); }
                            }
                            false
                        } else { false }
                    } else {
                        if let Some(ref s) = ov.exit {
                            output = Some(Cow::Owned(s.clone()));
                            true
                        } else if ov.alias_tag_id.is_none() {
                            if let Some(h) = handler {
                                if let Some(f) = h.exit { output = f(&ctx); }
                            }
                            false
                        } else { false }
                    }
                } else {
                    false
                };

                if !has_override_output {
                    if let Some(h) = handler {
                        if is_enter {
                            if let Some(f) = h.enter {
                                output = f(&ctx);
                            }
                        } else {
                            if node.tag_id == Some(TAG_TR) {
                                if !self.state.table_rendered_table && depth_map[TAG_TABLE as usize] <= 1 {
                                    self.state.table_rendered_table = true;
                                    let col_count = self.state.table_current_row_cells.max(self.state.table_column_alignments.len());
                                    let mut separator = String::with_capacity(col_count * 7 + 5);
                                    separator.push_str(" |\n|");
                                    for i in 0..col_count {
                                        let align = self.state.table_column_alignments.get(i).map(|s| s.as_str()).unwrap_or("");
                                        separator.push(' ');
                                        separator.push_str(match align {
                                            "left" => ":---",
                                            "center" => ":---:",
                                            "right" => "---:",
                                            _ => "---",
                                        });
                                        separator.push_str(" |");
                                    }
                                    table_separator = Some(separator);
                                } else {
                                    if let Some(f) = h.exit {
                                        output = f(&ctx);
                                    }
                                }
                            } else {
                                if let Some(f) = h.exit {
                                    output = f(&ctx);
                                }
                            }

                            if node.tag_id == Some(TAG_TH) || node.tag_id == Some(TAG_TD) {
                                if depth_map[TAG_TABLE as usize] <= 1 {
                                    self.state.table_current_row_cells += 1;
                                }
                            }
                        }
                    }
                }

                let mut last_new_lines: u8 = 0;
                if last_char == b'\n' { last_new_lines += 1; }
                if second_last_char == b'\n' { last_new_lines += 1; }

                let new_line_config = self.calculate_new_line_config(node, ancestors, depth_map);
                let configured_new_lines = if is_enter { new_line_config[0] } else { new_line_config[1] };
                let new_lines = configured_new_lines.saturating_sub(last_new_lines);

                // Get effective output str ref
                let output_str: &str = if let Some(ref sep) = table_separator {
                    sep.as_str()
                } else if let Some(ref cow) = output {
                    cow.as_ref()
                } else {
                    ""
                };
                if new_lines > 0 {
                    if self.state.buffer.is_empty() {
                        if !output_str.is_empty() {
                            self.state.last_content_cache_len = output_str.len();
                            self.state.buffer.push_str(output_str);
                        }
                        self.state.last_node_is_inline = is_inline;
                        return;
                    }

                    if last_char == b' ' && !self.state.buffer.is_empty() {
                        let trimmed_len = self.state.buffer.trim_end_matches(' ').len();
                        self.state.buffer.truncate(trimmed_len);
                    }

                    if is_enter {
                        for _ in 0..new_lines { self.state.buffer.push('\n'); }
                        if !output_str.is_empty() {
                            self.state.last_content_cache_len = output_str.len();
                            self.state.buffer.push_str(output_str);
                        }
                    } else {
                        if !output_str.is_empty() {
                            self.state.last_content_cache_len = output_str.len();
                            self.state.buffer.push_str(output_str);
                        }
                        for _ in 0..new_lines {
                            self.state.buffer.push('\n');
                        }
                    }
                } else {
                    if self.state.last_text_node_contains_whitespace && !ancestors.is_empty() {
                        let parent = ancestors.last().unwrap();
                        if depth_map[TAG_PRE as usize] == 0 || parent.tag_id == Some(TAG_PRE) {
                            let h_is_inline = node.is_inline;
                            let collapses = node.collapses_inner_white_space;
                            let has_spacing = node.spacing.is_some();
                            let is_block = !h_is_inline && !collapses && configured_new_lines > 0;
                            let should_trim = (!h_is_inline || !is_enter) && !is_block && !(collapses && is_enter) && !(has_spacing && is_enter);

                            if should_trim && self.state.last_content_cache_len > 0 {
                                let cache_len = self.state.last_content_cache_len;
                                let buf_len = self.state.buffer.len();
                                if cache_len <= buf_len {
                                    let frag = &self.state.buffer[buf_len - cache_len..];
                                    let trimmed_len = frag.trim_end().len();
                                    if trimmed_len < cache_len {
                                        self.state.buffer.truncate(buf_len - cache_len + trimmed_len);
                                    }
                                }
                            }
                            self.state.last_text_node_contains_whitespace = false;
                            self.state.has_last_text_node = false;
                        }
                    }

                    if is_enter && !output_str.is_empty() && last_char != 0 && self.needs_spacing(last_char, output_str.as_bytes()[0]) {
                        self.state.buffer.push(' ');
                        self.state.last_content_cache_len = 1;
                    }

                    if !output_str.is_empty() {
                        self.state.last_content_cache_len = output_str.len();
                        self.state.buffer.push_str(output_str);
                    }
                }
                self.state.last_node_is_inline = is_inline;
            }
        }
    }

    #[inline]
    fn needs_spacing(&self, last_byte: u8, first_byte: u8) -> bool {
        if matches!(last_byte, b' ' | b'\n' | b'\t') {
            return false;
        }
        if matches!(first_byte, b' ' | b'\n' | b'\t') {
            return false;
        }

        if last_byte == b'|' && first_byte == b'<' {
            if !self.state.buffer.is_empty() {
                return true;
            }
        }

        if matches!(last_byte, b'[' | b'(' | b'>' | b'*' | b'_' | b'`')
            || matches!(first_byte, b']' | b')' | b'<' | b'.' | b',' | b'!' | b'?' | b':' | b';' | b'*' | b'_' | b'`')
        {
            return false;
        }

        true
    }

    #[inline]
    fn should_add_spacing_before_text(&self, last_byte: u8, text_node: &TextNode) -> bool {
        if last_byte == 0 || last_byte == b'\n' || last_byte == b' ' || last_byte == b'[' || last_byte == b'>' {
            return false;
        }
        if self.state.last_node_is_inline {
            return false;
        }
        if text_node.value.as_bytes()[0] == b' ' {
            return false;
        }
        let first_byte = text_node.value.as_bytes()[0];
        if matches!(first_byte, b'.' | b',' | b'!' | b'?' | b':' | b';' | b'_' | b'*' | b'`' | b')' | b']') {
            return false;
        }
        true
    }

    #[inline]
    fn calculate_new_line_config(&self, node: &ElementNode, _ancestors: &[ElementNode], depth_map: &[u8; MAX_TAG_ID]) -> [u8; 2] {
        if (node.tag_id != Some(TAG_LI) && depth_map[TAG_LI as usize] > 0)
            || (node.tag_id != Some(TAG_BLOCKQUOTE) && depth_map[TAG_BLOCKQUOTE as usize] > 0) {
            return NO_SPACING;
        }

        // Fast path: use cached collapse counters instead of iterating ancestors
        if self.state.collapse_non_span_depth > 0 {
            return NO_SPACING;
        }
        if self.state.collapse_span_depth > 0 {
            let is_block_element = node.tag_id.map_or(false, |id| (id >= TAG_H1 && id <= TAG_H6) || id == TAG_P || id == TAG_DIV);
            if !is_block_element {
                return NO_SPACING;
            }
        }

        // Check override spacing first (skip when no overrides configured)
        if self.state.has_tag_overrides {
            let override_spacing = self.state.options.plugins.as_ref()
                .and_then(|p| p.tag_overrides.as_ref())
                .and_then(|ovs| ovs.get(node.name()))
                .and_then(|ov| ov.spacing);
            if let Some(sp) = override_spacing {
                return sp;
            }
        }

        node.spacing.unwrap_or(DEFAULT_BLOCK_SPACING)
    }

    pub fn get_markdown(&mut self) -> String {
        // Trim trailing whitespace in-place
        let trimmed_end_len = self.state.buffer.trim_end().len();
        self.state.buffer.truncate(trimmed_end_len);
        // Trim leading whitespace by finding start offset
        let start = self.state.buffer.len() - self.state.buffer.trim_start().len();
        if start > 0 {
            self.state.buffer.drain(..start);
        }
        std::mem::take(&mut self.state.buffer)
    }

    pub fn get_markdown_chunk(&mut self) -> String {
        let current_content = self.state.buffer.trim_start();
        let new_content = current_content[self.last_yielded_length..].to_string();
        self.last_yielded_length = current_content.len();
        new_content
    }
}
