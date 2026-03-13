use std::borrow::Cow;
use std::collections::HashMap;
use crate::consts::*;
use crate::tags::get_tag_handler;
use crate::types::{ElementNode, ExtractedElement, HTMLToMarkdownOptions, ParsedSelector, TailwindData};
use crate::parse::{
    is_whitespace, decode_html_entities, process_comment_or_doctype,
    process_tag_attributes, parse_css_selector, matches_selector,
    process_tailwind_classes, fix_redundant_delimiters, TrackedExtraction,
};

// Escape context bitmask flags
const ESC_TABLE: u8 = 1;
const ESC_CODE_PRE: u8 = 2;
const ESC_LINK: u8 = 4;
const ESC_BLOCKQUOTE: u8 = 8;

static HEADING_PREFIXES: [&str; 6] = ["# ", "## ", "### ", "#### ", "##### ", "###### "];

/// Unified single-pass HTML-to-Markdown converter.
/// Merges parser state and markdown output state to eliminate callback overhead,
/// duplicate state tracking, and enable full inlining of tag handler logic.
pub struct ConvertState {
    // === Parser state ===
    pub depth_map: [u8; MAX_TAG_ID],
    pub depth: usize,
    has_encoded_html_entity: bool,
    last_char_was_whitespace: bool,
    text_buffer_contains_whitespace: bool,
    text_buffer_contains_non_whitespace: bool,
    just_closed_tag: bool,
    is_first_text_in_element: bool,
    in_single_quote: bool,
    in_double_quote: bool,
    in_backtick: bool,
    last_char_was_backslash: bool,
    in_non_nesting: bool,
    escape_ctx: u8,
    in_pre: bool,
    /// Unified collapse depth counter (replaces separate counters in ParseState + MarkdownState)
    collapse_non_span_depth: u8,
    collapse_span_depth: u8,
    first_block_parent_index: Option<usize>,
    pub stack: Vec<ElementNode>,

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
    pub frontmatter_meta: HashMap<String, String>,

    extraction_parsed_selectors: Vec<(String, ParsedSelector)>,
    extraction_tracked: Vec<TrackedExtraction>,
    pub extraction_results: Vec<ExtractedElement>,

    filter_include_parsed: Vec<(String, ParsedSelector)>,
    filter_exclude_parsed: Vec<(String, ParsedSelector)>,
    filter_process_children: bool,

    // === Markdown output state ===
    pub options: HTMLToMarkdownOptions,
    pub buffer: String,
    last_content_cache_len: usize,
    table_rendered_table: bool,
    table_current_row_cells: usize,
    table_column_alignments: Vec<String>,
    last_text_node_contains_whitespace: bool,
    last_text_node_depth: usize,
    last_text_node_index: usize,
    has_last_text_node: bool,
    last_node_is_inline: bool,

    // Streaming
    last_yielded_length: usize,
}

impl ConvertState {
    pub fn new(options: HTMLToMarkdownOptions, capacity: usize) -> Self {
        let mut s = Self {
            depth_map: [0; MAX_TAG_ID],
            depth: 0,
            has_encoded_html_entity: false,
            last_char_was_whitespace: true,
            text_buffer_contains_whitespace: false,
            text_buffer_contains_non_whitespace: false,
            just_closed_tag: false,
            is_first_text_in_element: false,
            in_single_quote: false,
            in_double_quote: false,
            in_backtick: false,
            last_char_was_backslash: false,
            in_non_nesting: false,
            escape_ctx: 0,
            in_pre: false,
            collapse_non_span_depth: 0,
            collapse_span_depth: 0,
            first_block_parent_index: None,
            stack: Vec::with_capacity(32),

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
            frontmatter_meta: HashMap::new(),

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
            table_column_alignments: Vec::new(),
            last_text_node_contains_whitespace: false,
            last_text_node_depth: 0,
            last_text_node_index: 0,
            has_last_text_node: false,
            last_node_is_inline: false,
            last_yielded_length: 0,
        };
        if let Some(plugins) = &s.options.plugins {
            s.has_plugins = true;
            s.has_tailwind = plugins.tailwind.is_some();
            s.has_isolate_main = plugins.isolate_main.is_some();
            s.has_frontmatter = plugins.frontmatter.is_some();
            s.has_tag_overrides = plugins.tag_overrides.is_some();
            if let Some(extraction) = &plugins.extraction {
                s.has_extraction = true;
                s.extraction_parsed_selectors = extraction.selectors.iter()
                    .map(|sel| (sel.clone(), parse_css_selector(sel)))
                    .collect();
            }
            if let Some(filter) = &plugins.filter {
                s.has_filter = true;
                if let Some(incl) = &filter.include {
                    s.filter_include_parsed = incl.iter()
                        .map(|sel| (sel.clone(), parse_css_selector(sel)))
                        .collect();
                }
                if let Some(excl) = &filter.exclude {
                    s.filter_exclude_parsed = excl.iter()
                        .map(|sel| (sel.clone(), parse_css_selector(sel)))
                        .collect();
                }
                s.filter_process_children = filter.process_children.unwrap_or(true);
            }
        }
        s
    }

    // ========================================================================
    // Main entry point — single-pass parse + markdown generation
    // ========================================================================

    pub fn process_html(&mut self, chunk: &str) -> String {
        let mut text_buffer = String::with_capacity(256);
        let bytes = chunk.as_bytes();
        let chunk_length = bytes.len();
        let mut i = 0;

        while i < chunk_length {
            let cc = bytes[i];

            if cc != LT_CHAR {
                if cc == AMPERSAND_CHAR {
                    self.has_encoded_html_entity = true;
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
                    self.last_char_was_backslash = false;
                } else {
                    self.text_buffer_contains_non_whitespace = true;
                    self.last_char_was_whitespace = false;
                    self.just_closed_tag = false;

                    if self.escape_ctx == 0 {
                        if cc < 0x80 {
                            text_buffer.push(cc as char);
                        } else {
                            let ch = chunk[i..].chars().next().unwrap();
                            text_buffer.push(ch);
                            i += ch.len_utf8();
                            self.last_char_was_backslash = false;
                            continue;
                        }
                    } else if cc == PIPE_CHAR && (self.escape_ctx & ESC_TABLE) != 0 {
                        text_buffer.push_str("\\|");
                    } else if cc == BACKTICK_CHAR && (self.escape_ctx & ESC_CODE_PRE) != 0 {
                        text_buffer.push_str("\\`");
                    } else if cc == OPEN_BRACKET_CHAR && (self.escape_ctx & ESC_LINK) != 0 {
                        text_buffer.push_str("\\[");
                    } else if cc == CLOSE_BRACKET_CHAR && (self.escape_ctx & ESC_LINK) != 0 {
                        text_buffer.push_str("\\]");
                    } else if cc == GT_CHAR && (self.escape_ctx & ESC_BLOCKQUOTE) != 0 {
                        text_buffer.push_str("\\>");
                    } else if cc < 0x80 {
                        text_buffer.push(cc as char);
                    } else {
                        let ch = chunk[i..].chars().next().unwrap();
                        text_buffer.push(ch);
                        i += ch.len_utf8();
                        self.last_char_was_backslash = false;
                        continue;
                    }

                    if self.in_non_nesting {
                        if !self.last_char_was_backslash {
                            if cc == APOS_CHAR && !self.in_double_quote && !self.in_backtick {
                                self.in_single_quote = !self.in_single_quote;
                            } else if cc == QUOTE_CHAR && !self.in_single_quote && !self.in_backtick {
                                self.in_double_quote = !self.in_double_quote;
                            } else if cc == BACKTICK_CHAR && !self.in_single_quote && !self.in_double_quote {
                                self.in_backtick = !self.in_backtick;
                            }
                        }
                    }
                    self.last_char_was_backslash = cc == BACKSLASH_CHAR && !self.last_char_was_backslash;
                }
                i += 1;
                continue;
            }

            // Processing '<'
            if i + 1 >= chunk_length {
                text_buffer.push(cc as char);
                break;
            }

            let next = bytes[i + 1];

            if next == EXCLAMATION_CHAR {
                if !text_buffer.is_empty() {
                    self.process_text_buffer(&mut text_buffer);
                    text_buffer.clear();
                }
                let result = process_comment_or_doctype(chunk, i);
                if result.complete {
                    i = result.new_position;
                } else {
                    text_buffer.push_str(&result.remaining_text);
                    break;
                }
            } else if next == SLASH_CHAR {
                let in_quotes = self.in_single_quote || self.in_double_quote || self.in_backtick;
                if self.in_non_nesting && in_quotes {
                    text_buffer.push(cc as char);
                    i += 1;
                    continue;
                }
                if !text_buffer.is_empty() {
                    self.process_text_buffer(&mut text_buffer);
                    text_buffer.clear();
                }
                let result = self.process_closing_tag(chunk, i);
                if result.complete {
                    i = result.new_position;
                } else {
                    text_buffer.push_str(&result.remaining_text);
                    break;
                }
            } else {
                // Opening tag
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
                if tag_name_end.is_none() {
                    text_buffer.push_str(&chunk[i..]);
                    break;
                }
                let tag_name_end = tag_name_end.unwrap();
                let tag_name_raw = &chunk[tag_name_start..tag_name_end];
                if tag_name_raw.is_empty() { break; }
                let tag_name: Cow<str> = if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
                    Cow::Owned(tag_name_raw.to_ascii_lowercase())
                } else {
                    Cow::Borrowed(tag_name_raw)
                };

                let tag_id = {
                    let id = crate::consts::get_tag_id(&tag_name);
                    if id.is_some() { id } else {
                        self.options.plugins.as_ref()
                            .and_then(|p| p.tag_overrides.as_ref())
                            .and_then(|ovs| ovs.get(tag_name.as_ref()))
                            .and_then(|ov| ov.alias_tag_id)
                    }
                };
                i2 = tag_name_end;

                let in_quotes = self.in_single_quote || self.in_double_quote || self.in_backtick;
                if self.in_non_nesting {
                    if in_quotes {
                        text_buffer.push(bytes[i] as char);
                        i += 1;
                        continue;
                    }
                    if let Some(curr) = self.stack.last() {
                        if curr.tag_id != tag_id {
                            text_buffer.push(bytes[i] as char);
                            i += 1;
                            continue;
                        }
                    }
                }

                if !text_buffer.is_empty() {
                    self.process_text_buffer(&mut text_buffer);
                    text_buffer.clear();
                }

                let result = self.process_opening_tag(&tag_name, tag_id, chunk, i2);
                if result.skip {
                    i = result.new_position;
                } else if result.complete {
                    i = result.new_position;
                    if result.self_closing {
                        self.close_node();
                        self.just_closed_tag = true;
                    } else {
                        self.is_first_text_in_element = true;
                    }
                } else {
                    // Include full tag from '<' for re-parsing in next chunk
                    text_buffer.push_str(&chunk[i..]);
                    break;
                }
            }
        }

        text_buffer
    }

    // ========================================================================
    // Markdown output: enter/exit via match on tag_id (fully inlinable)
    // ========================================================================

    /// Emit markdown for entering the element currently on top of self.stack.
    #[inline]
    fn emit_enter_element(&mut self) {
        let stack_len = self.stack.len();
        if stack_len == 0 { return; }

        // Phase 1: read from node + compute output (borrows self.stack immutably)
        let tag_id: Option<u8>;
        let is_inline: bool;
        let node_spacing: Option<[u8; 2]>;
        let output: Option<Cow<'static, str>>;
        let has_handler: bool;
        {
            let (ancestors, last) = self.stack.split_at(stack_len - 1);
            let node = &last[0];

            if node.excluded_from_markdown {
                self.last_node_is_inline = node.is_inline;
                return;
            }

            tag_id = node.tag_id;
            has_handler = tag_id.and_then(get_tag_handler).is_some();

            // Check override is_inline
            let override_config = if self.has_tag_overrides {
                self.options.plugins.as_ref()
                    .and_then(|p| p.tag_overrides.as_ref())
                    .and_then(|ovs| ovs.get(node.name()))
            } else { None };

            is_inline = override_config.and_then(|ov| ov.is_inline).unwrap_or(node.is_inline);
            node_spacing = node.spacing;

            // Table state reads
            if has_handler {
                if tag_id == Some(TAG_TABLE) {
                    if self.depth_map[TAG_TABLE as usize] <= 1 {
                        self.table_rendered_table = false;
                    }
                    self.table_column_alignments.clear();
                } else if tag_id == Some(TAG_TR) {
                    self.table_current_row_cells = 0;
                } else if tag_id == Some(TAG_TH) {
                    let align = node.attributes.get("align").map(|s| s.to_lowercase());
                    if let Some(align) = align {
                        self.table_column_alignments.push(align);
                    } else if self.table_column_alignments.len() <= self.table_current_row_cells {
                        self.table_column_alignments.push(String::new());
                    }
                }
            }

            // Check override enter string
            output = if let Some(ov) = override_config {
                if let Some(ref s) = ov.enter {
                    Some(Cow::Owned(s.clone()))
                } else {
                    self.get_enter_output(node, ancestors)
                }
            } else {
                self.get_enter_output(node, ancestors)
            };
        }
        // Phase 1 ends — self.stack borrow released

        // Phase 2: calculate new lines + write buffer
        let new_line_config = self.calculate_new_line_config(tag_id, node_spacing);
        let configured_new_lines = new_line_config[0];

        self.write_output(true, is_inline, configured_new_lines, output.as_deref());
    }

    /// Emit markdown for exiting an element (node already popped from stack).
    #[inline]
    fn emit_exit_element(&mut self, node: &ElementNode) {
        if node.excluded_from_markdown {
            self.last_node_is_inline = node.is_inline;
            return;
        }

        let tag_id = node.tag_id;

        // Check override
        let override_config = if self.has_tag_overrides {
            self.options.plugins.as_ref()
                .and_then(|p| p.tag_overrides.as_ref())
                .and_then(|ovs| ovs.get(node.name()))
        } else { None };

        let is_inline = override_config.and_then(|ov| ov.is_inline).unwrap_or(node.is_inline);

        // Table cell count (exit)
        if tag_id == Some(TAG_TH) || tag_id == Some(TAG_TD) {
            if self.depth_map[TAG_TABLE as usize] <= 1 {
                self.table_current_row_cells += 1;
            }
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
                        let align = self.table_column_alignments.get(i).map(|s| s.as_str()).unwrap_or("");
                        sep.push(' ');
                        sep.push_str(match align {
                            "left" => ":---",
                            "center" => ":---:",
                            "right" => "---:",
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

        // Get effective output
        let effective: Option<&str> = if let Some(ref sep) = table_separator {
            Some(sep.as_str())
        } else {
            output.as_deref()
        };

        self.write_output(false, is_inline, configured_new_lines, effective);
    }

    /// Emit markdown for a text node (no TextNode allocation).
    #[inline]
    fn emit_text(&mut self, text: &str, contains_whitespace: bool, depth: usize, index: usize) {
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
    fn emit_frontmatter(&mut self, content: &str) {
        if !content.is_empty() {
            self.last_content_cache_len = content.len();
            self.buffer.push_str(content);
        }
    }

    // ========================================================================
    // Enter/exit output via match on tag_id (replaces fn pointer table)
    // ========================================================================

    #[inline]
    fn get_enter_output(&self, node: &ElementNode, _ancestors: &[ElementNode]) -> Option<Cow<'static, str>> {
        let tag_id = match node.tag_id {
            Some(id) => id,
            None => return None,
        };
        match tag_id {
            TAG_DETAILS => Some(Cow::Borrowed("<details>")),
            TAG_SUMMARY => Some(Cow::Borrowed("<summary>")),
            TAG_BR => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<br>")) } else { None }
            }
            TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
                let depth = (tag_id - TAG_H1) as usize;
                if self.depth_map[TAG_A as usize] > 0 {
                    Some(Cow::Owned(format!("<h{}>", depth + 1)))
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
            TAG_BLOCKQUOTE => {
                let depth = std::cmp::max(1, self.depth_map[TAG_BLOCKQUOTE as usize]);
                let mut prefix = "> ".repeat(depth as usize);
                if self.depth_map[TAG_LI as usize] > 0 {
                    let indent = "  ".repeat(self.depth_map[TAG_LI as usize] as usize);
                    prefix = format!("\n{}{}", indent, prefix);
                }
                Some(Cow::Owned(prefix))
            }
            TAG_CODE => {
                if self.depth_map[TAG_PRE as usize] > 0 {
                    let lang = Self::get_language_from_class(node.attributes.get("class"));
                    Some(Cow::Owned(format!("{}{}\n", MARKDOWN_CODE_BLOCK, lang)))
                } else {
                    Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
                }
            }
            TAG_UL => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<ul>")) } else { None }
            }
            TAG_OL => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<ol>")) } else { None }
            }
            TAG_LI => {
                if self.depth_map[TAG_TD as usize] > 0 {
                    return Some(Cow::Borrowed("<li>"));
                }
                let ul_depth = self.depth_map[TAG_UL as usize];
                let ol_depth = self.depth_map[TAG_OL as usize];
                let depth = if ul_depth + ol_depth > 0 { (ul_depth + ol_depth - 1) as usize } else { 0 };
                let is_ordered = ol_depth > 0 && _ancestors.last().map(|p| p.tag_id == Some(TAG_OL)).unwrap_or(false);
                let mut s = String::with_capacity(depth * 2 + 6);
                for _ in 0..depth { s.push_str("  "); }
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
                let alt = node.attributes.get("alt").map(|s| s.as_str()).unwrap_or("");
                let src = node.attributes.get("src").map(|s| s.as_str()).unwrap_or("");
                let resolved_src = Self::resolve_url(src, self.options.origin.as_deref());
                Some(Cow::Owned(format!("![{}]({})", alt, resolved_src)))
            }
            TAG_TABLE => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<table>")) } else { None }
            }
            TAG_THEAD => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<thead>")) } else { None }
            }
            TAG_TR => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<tr>")) }
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
            TAG_CITE | TAG_FIGCAPTION => Some(Cow::Borrowed("*")),
            TAG_DFN => Some(Cow::Borrowed("**")),
            TAG_ADDRESS => Some(Cow::Borrowed("<address>")),
            TAG_DL => Some(Cow::Borrowed("<dl>")),
            TAG_DT => Some(Cow::Borrowed("<dt>")),
            TAG_DD => Some(Cow::Borrowed("<dd>")),
            _ => None,
        }
    }

    #[inline]
    fn get_exit_output(&self, node: &ElementNode) -> Option<Cow<'static, str>> {
        let tag_id = match node.tag_id {
            Some(id) => id,
            None => return None,
        };
        match tag_id {
            TAG_DETAILS => Some(Cow::Borrowed("</details>\n\n")),
            TAG_SUMMARY => Some(Cow::Borrowed("</summary>\n\n")),
            TAG_H1 | TAG_H2 | TAG_H3 | TAG_H4 | TAG_H5 | TAG_H6 => {
                let depth = (tag_id - TAG_H1 + 1) as usize;
                if self.depth_map[TAG_A as usize] > 0 {
                    Some(Cow::Owned(format!("</h{}>", depth)))
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
                    Some(Cow::Borrowed("\n```"))
                } else {
                    Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
                }
            }
            TAG_UL => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("</ul>")) } else { None }
            }
            TAG_OL => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("</ol>")) } else { None }
            }
            TAG_LI => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("</li>")) } else { None }
            }
            TAG_A => {
                if let Some(href) = node.attributes.get("href") {
                    let resolved = Self::resolve_url(href, self.options.origin.as_deref());
                    let mut title = node.attributes.get("title").map(|s| s.as_str()).unwrap_or("");
                    if self.last_content_cache_len > 0 {
                        let buf_len = self.buffer.len();
                        let start = buf_len.saturating_sub(self.last_content_cache_len);
                        let cache = &self.buffer[start..];
                        if cache == title { title = ""; }
                    }
                    if !title.is_empty() {
                        Some(Cow::Owned(format!("]({} \"{}\")", resolved, title)))
                    } else {
                        Some(Cow::Owned(format!("]({})", resolved)))
                    }
                } else {
                    Some(Cow::Borrowed(""))
                }
            }
            TAG_TABLE => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("</table>")) } else { None }
            }
            TAG_THEAD => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("</thead>")) } else { None }
            }
            TAG_TR => {
                if self.depth_map[TAG_TD as usize] > 0 || self.depth_map[TAG_TABLE as usize] > 1 {
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
            TAG_CITE | TAG_FIGCAPTION => Some(Cow::Borrowed("*")),
            TAG_DFN => Some(Cow::Borrowed("**")),
            TAG_ADDRESS => Some(Cow::Borrowed("</address>")),
            TAG_DL => Some(Cow::Borrowed("</dl>")),
            TAG_DT => Some(Cow::Borrowed("</dt>")),
            TAG_DD => Some(Cow::Borrowed("</dd>")),
            _ => None,
        }
    }

    // ========================================================================
    // Buffer writing logic (shared between enter/exit)
    // ========================================================================

    #[inline]
    fn write_output(&mut self, is_enter: bool, is_inline: bool, configured_new_lines: u8, output: Option<&str>) {
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
            if self.last_text_node_contains_whitespace && !self.stack.is_empty() {
                let parent = self.stack.last().unwrap();
                if self.depth_map[TAG_PRE as usize] == 0 || parent.tag_id == Some(TAG_PRE) {
                    let h_is_inline = is_inline;
                    let collapses = parent.collapses_inner_white_space;
                    let has_spacing = parent.spacing.is_some();
                    // For exit, the node was already popped, so use the is_inline param
                    let is_block = !h_is_inline && !collapses && configured_new_lines > 0;
                    let should_trim = (!h_is_inline || !is_enter) && !is_block && !(collapses && is_enter) && !(has_spacing && is_enter);

                    if should_trim && self.last_content_cache_len > 0 {
                        let cache_len = self.last_content_cache_len;
                        let buf_len = self.buffer.len();
                        if cache_len <= buf_len {
                            let frag = &self.buffer[buf_len - cache_len..];
                            let trimmed_len = frag.trim_end().len();
                            if trimmed_len < cache_len {
                                self.buffer.truncate(buf_len - cache_len + trimmed_len);
                            }
                        }
                    }
                    self.last_text_node_contains_whitespace = false;
                    self.has_last_text_node = false;
                }
            }

            if is_enter && !output_str.is_empty() && last_char != 0 && self.needs_spacing(last_char, output_str.as_bytes()[0]) {
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

    // ========================================================================
    // Markdown output helpers
    // ========================================================================

    #[inline]
    fn needs_spacing(&self, last_byte: u8, first_byte: u8) -> bool {
        if matches!(last_byte, b' ' | b'\n' | b'\t') { return false; }
        if matches!(first_byte, b' ' | b'\n' | b'\t') { return false; }
        if last_byte == b'|' && first_byte == b'<' && !self.buffer.is_empty() { return true; }
        if matches!(last_byte, b'[' | b'(' | b'>' | b'*' | b'_' | b'`')
            || matches!(first_byte, b']' | b')' | b'<' | b'.' | b',' | b'!' | b'?' | b':' | b';' | b'*' | b'_' | b'`')
        { return false; }
        true
    }

    #[inline]
    fn should_add_spacing_before_text(&self, last_byte: u8, text: &str) -> bool {
        if last_byte == 0 || last_byte == b'\n' || last_byte == b' ' || last_byte == b'[' || last_byte == b'>' { return false; }
        if self.last_node_is_inline { return false; }
        let first_byte = text.as_bytes()[0];
        if first_byte == b' ' { return false; }
        if matches!(first_byte, b'.' | b',' | b'!' | b'?' | b':' | b';' | b'_' | b'*' | b'`' | b')' | b']') { return false; }
        true
    }

    #[inline]
    fn calculate_new_line_config(&self, tag_id: Option<u8>, node_spacing: Option<[u8; 2]>) -> [u8; 2] {
        if let Some(id) = tag_id {
            if (id != TAG_LI && self.depth_map[TAG_LI as usize] > 0)
                || (id != TAG_BLOCKQUOTE && self.depth_map[TAG_BLOCKQUOTE as usize] > 0) {
                return NO_SPACING;
            }
        } else {
            if self.depth_map[TAG_LI as usize] > 0 || self.depth_map[TAG_BLOCKQUOTE as usize] > 0 {
                return NO_SPACING;
            }
        }
        if self.collapse_non_span_depth > 0 { return NO_SPACING; }
        if self.collapse_span_depth > 0 {
            let is_block = tag_id.map_or(false, |id| (id >= TAG_H1 && id <= TAG_H6) || id == TAG_P || id == TAG_DIV);
            if !is_block { return NO_SPACING; }
        }
        if self.has_tag_overrides {
            // For override spacing, we'd need the node name — but we have tag_id.
            // Use tag_id to get name for override lookup.
            if let Some(id) = tag_id {
                let name = TAG_NAMES[id as usize];
                if let Some(sp) = self.options.plugins.as_ref()
                    .and_then(|p| p.tag_overrides.as_ref())
                    .and_then(|ovs| ovs.get(name))
                    .and_then(|ov| ov.spacing) {
                    return sp;
                }
            }
        }
        node_spacing.unwrap_or(DEFAULT_BLOCK_SPACING)
    }

    // ========================================================================
    // Parser internal methods (duplicated from parse.rs with inline emit)
    // ========================================================================

    fn process_text_buffer(&mut self, text_buffer: &mut String) {
        let contains_non_whitespace = self.text_buffer_contains_non_whitespace;
        let contains_whitespace = self.text_buffer_contains_whitespace;
        self.text_buffer_contains_non_whitespace = false;
        self.text_buffer_contains_whitespace = false;

        if self.stack.is_empty() { return; }

        let parent = self.stack.last().unwrap();
        let mut excludes_text_nodes = parent.excludes_text_nodes || parent.excluded_from_markdown;

        if self.has_isolate_main {
            if self.isolate_main_found {
                if self.isolate_main_closed { excludes_text_nodes = true; }
            } else if self.isolate_first_header_depth.is_none() {
                if self.depth_map[TAG_HEAD as usize] == 0 { excludes_text_nodes = true; }
            } else if self.isolate_after_footer {
                excludes_text_nodes = true;
            }
        }

        if self.has_frontmatter {
            if self.frontmatter_in_head && self.stack.last().map_or(false, |p| p.tag_id == Some(TAG_TITLE)) {
                let val = text_buffer.trim().to_string();
                if !val.is_empty() { self.frontmatter_title = Some(val); }
                return;
            }
        }

        let in_pre_tag = self.in_pre;
        let child_text_node_index = self.stack.last().map(|n| n.child_text_node_index).unwrap_or(0);

        if !in_pre_tag && !contains_non_whitespace && child_text_node_index == 0 { return; }
        if text_buffer.is_empty() { return; }

        let first_block_parent_index = self.first_block_parent_index;
        let first_block_child_text_count = first_block_parent_index.map(|idx| self.stack[idx].child_text_node_index).unwrap_or(0);

        let mut text = std::mem::take(text_buffer);
        if contains_whitespace && first_block_child_text_count == 0 {
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

        if self.has_tailwind {
            if let Some(parent) = self.stack.last() {
                if let Some(tw) = &parent.tailwind {
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
            let index = self.stack.last().map(|n| n.current_walk_index).unwrap_or(0);
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

    fn process_opening_tag(&mut self, tag_name: &str, tag_id: Option<u8>, html_chunk: &str, position: usize) -> OpeningTagResult {
        let tag_handler = tag_id.and_then(get_tag_handler);
        let needs_attrs = tag_handler.map_or(false, |h| h.needs_attributes)
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
            self.depth_map[id as usize] += 1;
            match id {
                TAG_TABLE => self.escape_ctx |= ESC_TABLE,
                TAG_CODE | TAG_PRE => { self.escape_ctx |= ESC_CODE_PRE; if id == TAG_PRE { self.in_pre = true; } }
                TAG_A => self.escape_ctx |= ESC_LINK,
                TAG_BLOCKQUOTE => self.escape_ctx |= ESC_BLOCKQUOTE,
                _ => {}
            }
        }
        self.depth += 1;

        let current_walk_index = self.stack.last().map(|n| n.current_walk_index).unwrap_or(0);
        // Set custom_name for non-builtin tags (even if they have an alias_tag_id from overrides)
        let is_builtin = crate::consts::get_tag_id(tag_name).is_some();
        let custom_name = if is_builtin { None } else { Some(tag_name.to_string()) };

        let (h_inline, h_excludes, h_non_nesting, h_collapses, h_spacing) = if let Some(h) = tag_handler {
            (h.is_inline, h.excludes_text_nodes, h.is_non_nesting, h.collapses_inner_white_space, h.spacing)
        } else {
            (false, false, false, false, None)
        };

        let mut tag = ElementNode {
            custom_name, attributes, tag_id,
            depth: self.depth, index: current_walk_index,
            current_walk_index: 0, child_text_node_index: 0,
            contains_whitespace: false, excluded_from_markdown: false,
            tailwind: None,
            is_inline: h_inline, excludes_text_nodes: h_excludes,
            is_non_nesting: h_non_nesting, collapses_inner_white_space: h_collapses,
            spacing: h_spacing,
        };

        let mut skip_node = false;
        let mut filter_excluded = false;

        if self.has_plugins {
            if self.has_tailwind {
                if let Some(class_attr) = tag.attributes.get("class") {
                    let (prefix, suffix, hidden) = process_tailwind_classes(class_attr);
                    if prefix.is_some() || suffix.is_some() || hidden {
                        tag.tailwind = Some(Box::new(TailwindData { prefix, suffix, hidden }));
                        if hidden { skip_node = true; }
                    }
                }
            }

            if self.has_filter {
                if let Some(style) = tag.attributes.get("style") {
                    if style.contains("absolute") || style.contains("fixed") { skip_node = true; }
                }
                if !skip_node {
                    for (_, parsed) in &self.filter_exclude_parsed {
                        if matches_selector(&tag, parsed) { skip_node = true; filter_excluded = true; break; }
                    }
                }
                if !skip_node {
                    for parent in self.stack.iter() {
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
                        for parent in self.stack.iter() {
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
                if !self.isolate_main_found && is_main && self.depth <= 5 { self.isolate_main_found = true; }
                if self.isolate_main_found {
                    if self.isolate_main_closed { skip_node = true; }
                } else {
                    let is_header = tag_id.map_or(false, |id| id >= TAG_H1 && id <= TAG_H6);
                    if self.isolate_first_header_depth.is_none() && is_header {
                        if self.depth_map[TAG_HEADER as usize] == 0 {
                            self.isolate_first_header_depth = Some(self.depth);
                        }
                    }
                    if let Some(header_depth) = self.isolate_first_header_depth {
                        if !self.isolate_after_footer && tag_id == Some(TAG_FOOTER) {
                            if self.depth.saturating_sub(header_depth) <= 5 {
                                self.isolate_after_footer = true;
                                skip_node = true;
                            }
                        }
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
                                .map_or(false, |allowed| allowed.iter().any(|a| a == n_str)),
                        };
                        if is_allowed { self.frontmatter_meta.insert(n.clone(), c.clone()); }
                    }
                }
            }
        }

        tag.excluded_from_markdown = filter_excluded;

        if tag.collapses_inner_white_space && !filter_excluded {
            if tag.tag_id == Some(TAG_SPAN) { self.collapse_span_depth += 1; }
            else { self.collapse_non_span_depth += 1; }
        }

        if let Some(last) = self.stack.last_mut() { last.current_walk_index += 1; }

        if !tag.is_inline { self.first_block_parent_index = Some(self.stack.len()); }

        self.stack.push(tag);

        // Extraction
        if !self.extraction_parsed_selectors.is_empty() {
            let element = self.stack.last().unwrap();
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

        self.has_encoded_html_entity = false;

        if self.stack.last().map_or(false, |n| n.is_non_nesting) && !self_closing {
            self.in_non_nesting = true;
            self.in_single_quote = false;
            self.in_double_quote = false;
            self.in_backtick = false;
            self.last_char_was_backslash = false;
        }

        if !self_closing { self.just_closed_tag = false; }

        OpeningTagResult {
            complete: true, new_position,
            self_closing, skip: false,
        }
    }

    fn close_node(&mut self) {
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
        let node = self.stack.pop().unwrap();

        if self.first_block_parent_index == Some(popping_index) {
            self.first_block_parent_index = None;
            for (idx, n) in self.stack.iter().enumerate().rev() {
                if !n.is_inline { self.first_block_parent_index = Some(idx); break; }
            }
            if self.first_block_parent_index.is_none() && !self.stack.is_empty() {
                self.first_block_parent_index = Some(0);
            }
        }

        if node.collapses_inner_white_space && !node.excluded_from_markdown {
            if node.tag_id == Some(TAG_SPAN) { self.collapse_span_depth -= 1; }
            else { self.collapse_non_span_depth -= 1; }
        }

        if self.has_isolate_main {
            if node.tag_id == Some(TAG_MAIN) && self.isolate_main_found && !self.isolate_main_closed {
                self.isolate_main_closed = true;
            }
        }

        // Frontmatter generation on HEAD close
        if self.has_frontmatter && node.tag_id == Some(TAG_HEAD) && self.frontmatter_in_head {
            self.frontmatter_in_head = false;
            self.generate_frontmatter_yaml();
        }

        // Special: empty links
        if node.tag_id == Some(TAG_A) && node.child_text_node_index == 0 {
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
                for prev in self.stack.iter_mut() { prev.child_text_node_index += 1; }
                let modified_node2 = self.stack.pop().unwrap();
                // Emit exit
                self.emit_exit_element(&modified_node2);
                if let Some(id) = node_tag_id {
                    self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
                    self.update_escape_ctx_on_close(id);
                }
                self.depth -= 1;
                self.has_encoded_html_entity = false;
                self.just_closed_tag = true;
                self.in_non_nesting = self.stack.last().map_or(false, |n| n.is_non_nesting);
                return;
            }
        }

        // Inline emit exit (no callback!)
        self.emit_exit_element(&node);

        if let Some(id) = node.tag_id {
            self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
            self.update_escape_ctx_on_close(id);
        }

        if node.is_non_nesting {
            self.in_single_quote = false;
            self.in_double_quote = false;
            self.in_backtick = false;
            self.last_char_was_backslash = false;
        }

        self.in_non_nesting = self.stack.last().map_or(false, |n| n.is_non_nesting);
        self.depth -= 1;
        self.has_encoded_html_entity = false;
        self.just_closed_tag = true;
    }

    fn process_closing_tag(&mut self, html_chunk: &str, position: usize) -> CloseTagResult {
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
                remaining_text: html_chunk[position..].to_string(),
            };
        }

        let tag_name_raw = &html_chunk[tag_name_start..i];
        let tag_name: Cow<str> = if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
            Cow::Owned(tag_name_raw.to_ascii_lowercase())
        } else {
            Cow::Borrowed(tag_name_raw)
        };
        let tag_id = crate::consts::get_tag_id(&tag_name);

        if let Some(curr) = self.stack.last() {
            if curr.is_non_nesting && curr.tag_id != tag_id {
                return CloseTagResult {
                    complete: false, new_position: position,
                    remaining_text: html_chunk[position..].to_string(),
                };
            }
        }

        if self.stack.last().is_some() {
            let mut pop_count = 0;
            for j in (0..self.stack.len()).rev() {
                pop_count += 1;
                if self.stack[j].tag_id == tag_id { break; }
            }
            for _ in 0..pop_count {
                if !self.stack.is_empty() { self.close_node(); }
            }
        }

        self.just_closed_tag = true;
        CloseTagResult { complete: true, new_position: i + 1, remaining_text: String::new() }
    }

    // ========================================================================
    // Utility methods
    // ========================================================================

    #[inline]
    fn update_escape_ctx_on_close(&mut self, id: u8) {
        match id {
            TAG_TABLE => { if self.depth_map[id as usize] == 0 { self.escape_ctx &= !ESC_TABLE; } }
            TAG_CODE => { if self.depth_map[TAG_CODE as usize] == 0 && self.depth_map[TAG_PRE as usize] == 0 { self.escape_ctx &= !ESC_CODE_PRE; } }
            TAG_PRE => { if self.depth_map[TAG_PRE as usize] == 0 { self.in_pre = false; if self.depth_map[TAG_CODE as usize] == 0 { self.escape_ctx &= !ESC_CODE_PRE; } } }
            TAG_A => { if self.depth_map[id as usize] == 0 { self.escape_ctx &= !ESC_LINK; } }
            TAG_BLOCKQUOTE => { if self.depth_map[id as usize] == 0 { self.escape_ctx &= !ESC_BLOCKQUOTE; } }
            _ => {}
        }
    }

    fn generate_frontmatter_yaml(&mut self) {
        let f_opts = self.options.plugins.as_ref().and_then(|p| p.frontmatter.as_ref());

        let format_val = |val: &str| -> String {
            let v = val.replace("\"", "\\\"");
            if v.contains('\n') || v.contains(':') || v.contains('#') || v.contains(' ') {
                format!("\"{}\"", v)
            } else { v }
        };

        let mut yaml_out = Vec::new();
        if let Some(t) = &self.frontmatter_title {
            yaml_out.push(format!("title: {}", format_val(t)));
        }

        if let Some(f) = f_opts {
            if let Some(add) = &f.additional_fields {
                let mut keys: Vec<_> = add.keys().collect();
                keys.sort();
                for key in keys {
                    if key != "title" && key != "description" {
                        yaml_out.push(format!("{}: {}", key, format_val(add.get(key).unwrap())));
                    }
                }
            }
        }

        if !self.frontmatter_meta.is_empty() {
            yaml_out.push("meta:".to_string());
            let mut meta_keys: Vec<_> = self.frontmatter_meta.keys().collect();
            meta_keys.sort();
            for key in meta_keys {
                let k_fmt = if key.contains(':') { format!("\"{}\"", key) } else { key.clone() };
                yaml_out.push(format!("  {}: {}", k_fmt, format_val(self.frontmatter_meta.get(key).unwrap())));
            }
        }

        if !yaml_out.is_empty() {
            let frontmatter_content = format!("---\n{}\n---\n\n", yaml_out.join("\n"));
            self.emit_frontmatter(&frontmatter_content);
        }
    }

    #[inline]
    fn resolve_url(url: &str, origin: Option<&str>) -> String {
        if url.is_empty() { return url.to_string(); }
        if url.starts_with("//") { return format!("https:{}", url); }
        if url.starts_with('#') { return url.to_string(); }
        if let Some(orig) = origin {
            if url.starts_with('/') {
                return format!("{}{}", orig.trim_end_matches('/'), url);
            }
            if url.starts_with("./") { return format!("{}/{}", orig, &url[2..]); }
            if !url.starts_with("http") {
                return format!("{}/{}", orig, url.strip_prefix('/').unwrap_or(url));
            }
        }
        url.to_string()
    }

    #[inline]
    fn get_language_from_class(class_name: Option<&String>) -> String {
        if let Some(class) = class_name {
            for part in class.split_whitespace() {
                if let Some(lang) = part.strip_prefix("language-") {
                    return lang.trim().to_string();
                }
            }
        }
        String::new()
    }

    // ========================================================================
    // Public output methods
    // ========================================================================

    pub fn get_markdown(&mut self) -> String {
        let trimmed_end_len = self.buffer.trim_end().len();
        self.buffer.truncate(trimmed_end_len);
        let start = self.buffer.len() - self.buffer.trim_start().len();
        if start > 0 { self.buffer.drain(..start); }
        std::mem::take(&mut self.buffer)
    }

    pub fn get_markdown_chunk(&mut self) -> String {
        let current_content = self.buffer.trim_start();
        let new_content = current_content[self.last_yielded_length..].to_string();
        self.last_yielded_length = current_content.len();
        new_content
    }
}

// ========================================================================
// Internal result structs
// ========================================================================

struct OpeningTagResult {
    complete: bool,
    new_position: usize,
    self_closing: bool,
    skip: bool,
}

struct CloseTagResult {
    complete: bool,
    new_position: usize,
    remaining_text: String,
}
