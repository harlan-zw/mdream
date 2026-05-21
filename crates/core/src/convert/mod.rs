use std::borrow::Cow;
use crate::consts::*;
use crate::tags::get_tag_handler;
use crate::types::{ElementNode, ExtractedElement, HTMLToMarkdownOptions, ParsedSelector, TailwindData};
use crate::entities::decode_html_entities;
use crate::scan::{is_whitespace, process_comment_or_doctype, process_tag_attributes};
use crate::selector::{matches_selector, parse_css_selector};
use crate::tailwind::process_tailwind_classes;
use crate::url::{is_autolink_uri, resolve_url, slugify_heading};

mod output;
mod parse;
mod plugins;

/// Tracked element during extraction — maps stack depth to accumulator
pub(crate) struct TrackedExtraction {
    pub(crate) selector: String,
    pub(crate) stack_depth: usize,
    pub(crate) text_content: String,
    pub(crate) tag_name: String,
    pub(crate) attributes: Vec<(String, String)>,
}

pub(crate) fn fix_redundant_delimiters(content: &str) -> String {
    let mut c = content.replace("****", "**");
    c = c.replace("~~~~", "~~");
    if c.contains("***") && c.split("***").count() > 3 {
        let parts: Vec<&str> = c.split("***").collect();
        if parts.len() >= 4 {
            c = format!("{}***{} {}***{}", parts[0], parts[1], parts[2], parts[3..].join("***"));
        }
    }
    c
}

// Escape context bitmask flags
const ESC_TABLE: u8 = 1;
const ESC_CODE_PRE: u8 = 2;
const ESC_LINK: u8 = 4;
const ESC_BLOCKQUOTE: u8 = 8;

static HEADING_PREFIXES: [&str; 6] = ["# ", "## ", "### ", "#### ", "##### ", "###### "];

/// Pre-computed blockquote prefixes for depths 1-6 (avoids `"> ".repeat()`)
static BQ_PREFIXES: [&str; 7] = ["", "> ", "> > ", "> > > ", "> > > > ", "> > > > > ", "> > > > > > "];

// Clean mode bitmask flags
const CLEAN_EMPTY_LINKS: u8 = 1;
const CLEAN_FRAGMENTS: u8 = 2;
const CLEAN_REDUNDANT_LINKS: u8 = 4;
const CLEAN_SELF_LINK_HEADINGS: u8 = 8;
const CLEAN_EMPTY_IMAGES: u8 = 16;
const CLEAN_EMPTY_LINK_TEXT: u8 = 32;

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
    in_non_nesting: bool,
    escape_ctx: u8,
    in_pre: bool,
    /// Unified collapse depth counter (replaces separate counters in ParseState + MarkdownState)
    collapse_non_span_depth: u8,
    collapse_span_depth: u8,
    first_block_parent_index: Option<usize>,
    block_parent_indices: Vec<usize>,
    parse_text_buffer: String,
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
    // 0=none, 1=left, 2=center, 3=right
    table_column_alignments: Vec<u8>,
    last_text_node_contains_whitespace: bool,
    last_text_node_depth: usize,
    last_text_node_index: usize,
    has_last_text_node: bool,
    last_node_is_inline: bool,

    // Streaming
    last_yielded_length: usize,

    // Clean mode — bitmask for zero-cost when disabled
    clean_flags: u8,
    /// Set when current TAG_A has a meaningless href and should be rendered as plain text
    skip_current_link: bool,
    /// Buffer position of the `[` character written for TAG_A enter
    link_bracket_pos: usize,
    /// Heading slugs collected during conversion for fragment validation
    heading_slugs: Vec<String>,
    /// Fragment link locations: (bracket_start, link_end)
    /// Fragment slug is derived from buffer at fixup time
    fragment_links: Vec<(usize, usize)>,
    /// Whether we're inside a heading (for slug collection)
    in_heading: bool,
    /// Buffer position at heading start (for extracting heading text)
    heading_buffer_start: usize,

    /// Cumulative indent string for list-item continuation content. Grows by
    /// each ancestor `<li>`'s marker width (`"- "` = 2, `"N. "` = digits(N)+2),
    /// so code blocks, paragraphs, and nested blocks inside a list item land
    /// in the content column that CommonMark requires. Pushed on `<li>` enter,
    /// popped on `<li>` close.
    list_indent: String,
    /// Per-`<li>` contribution width stack, parallel to `list_indent`. Used to
    /// truncate the correct number of bytes on close without re-walking ancestors.
    list_indent_widths: Vec<u8>,
}

impl ConvertState {
    /// Check if we're inside a table cell (either `<td>` or `<th>`).
    #[inline]
    pub(crate) fn in_table_cell(&self) -> bool {
        self.depth_map[TAG_TD as usize] > 0 || self.depth_map[TAG_TH as usize] > 0
    }

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
            in_non_nesting: false,
            escape_ctx: 0,
            in_pre: false,
            collapse_non_span_depth: 0,
            collapse_span_depth: 0,
            first_block_parent_index: None,
            block_parent_indices: Vec::with_capacity(16),
            parse_text_buffer: String::new(),
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
            table_column_alignments: Vec::new(),
            last_text_node_contains_whitespace: false,
            last_text_node_depth: 0,
            last_text_node_index: 0,
            has_last_text_node: false,
            last_node_is_inline: false,
            last_yielded_length: 0,

            clean_flags: 0,
            skip_current_link: false,
            link_bracket_pos: 0,
            heading_slugs: Vec::new(),
            fragment_links: Vec::new(),
            in_heading: false,
            heading_buffer_start: 0,

            list_indent: String::new(),
            list_indent_widths: Vec::with_capacity(8),
        };
        // Resolve clean config into bitmask
        let effective_clean_urls;
        if let Some(ref clean) = s.options.clean {
            effective_clean_urls = clean.urls || s.options.clean_urls;
            let mut flags = 0u8;
            if clean.empty_links { flags |= CLEAN_EMPTY_LINKS; }
            if clean.fragments { flags |= CLEAN_FRAGMENTS; }
            if clean.redundant_links { flags |= CLEAN_REDUNDANT_LINKS; }
            if clean.self_link_headings { flags |= CLEAN_SELF_LINK_HEADINGS; }
            if clean.empty_images { flags |= CLEAN_EMPTY_IMAGES; }
            if clean.empty_link_text { flags |= CLEAN_EMPTY_LINK_TEXT; }
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

    pub fn process_html(&mut self, chunk: &str) -> String {
        // Reuse text_buffer allocation from previous call if available
        let mut text_buffer = std::mem::take(&mut self.parse_text_buffer);
        text_buffer.clear();
        if text_buffer.capacity() == 0 {
            text_buffer.reserve(256);
        }
        let bytes = chunk.as_bytes();
        let chunk_length = bytes.len();
        let mut i = 0;

        while i < chunk_length {
            let cc = bytes[i];

            if cc != LT_CHAR {
                // FAST PATH: batch contiguous plain ASCII text (>32, <128, not & or <)
                // Skip when: in escape context, non-nesting mode, or pre tag
                if cc > 32 && cc < 0x80 && cc != AMPERSAND_CHAR
                   && self.escape_ctx == 0 && !self.in_non_nesting && !self.in_pre {
                    let start = i;
                    i += 1;
                    while i < chunk_length {
                        let c = bytes[i];
                        if c <= 32 || c >= 0x80 || c == LT_CHAR || c == AMPERSAND_CHAR {
                            break;
                        }
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

                    if self.escape_ctx == 0 {
                        if cc < 0x80 {
                            text_buffer.push(cc as char);
                        } else {
                            if let Some(ch) = chunk[i..].chars().next() {
                            text_buffer.push(ch);
                            i += ch.len_utf8();
                            } else { i += 1; }
        
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
                text_buffer.push(cc as char);
                break;
            }

            // Non-nesting guard: inside script/style/title/textarea, only the
            // matching closing tag exits. All other '<' patterns (comments,
            // non-matching closing tags, opening tags) are treated as literal text.
            if self.in_non_nesting {
                let next = bytes[i + 1];
                if next == SLASH_CHAR {
                    let peek_start = i + 2;
                    let mut peek_end = peek_start;
                    while peek_end < chunk_length {
                        let c = bytes[peek_end];
                        if c == GT_CHAR || is_whitespace(c) { break; }
                        peek_end += 1;
                    }
                    let peek_name = &chunk[peek_start..peek_end];
                    let peek_tag_id = crate::consts::get_tag_id_ci_bytes(peek_name.as_bytes());
                    if self.stack.last().is_some_and(|curr| curr.tag_id == peek_tag_id) {
                        // Matching closing tag: fall through to normal closing tag processing
                        if !text_buffer.is_empty() {
                            self.process_text_buffer(&mut text_buffer);
                            text_buffer.clear();
                        }
                        let result = self.process_closing_tag(chunk, i);
                        if result.complete {
                            i = result.new_position;
                        } else {
                            text_buffer.push_str(&chunk[result.remaining_start..]);
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
                if !text_buffer.is_empty() {
                    self.process_text_buffer(&mut text_buffer);
                    text_buffer.clear();
                }
                let result = process_comment_or_doctype(chunk, i);
                if result.complete {
                    i = result.new_position;
                } else {
                    text_buffer.push_str(&chunk[result.remaining_start..]);
                    break;
                }
            } else if next == SLASH_CHAR {
                if !text_buffer.is_empty() {
                    self.process_text_buffer(&mut text_buffer);
                    text_buffer.clear();
                }
                let result = self.process_closing_tag(chunk, i);
                if result.complete {
                    i = result.new_position;
                } else {
                    text_buffer.push_str(&chunk[result.remaining_start..]);
                    break;
                }
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
                    text_buffer.push_str(&chunk[i..]);
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
                let tag_id = if builtin_tag_id.is_some() { builtin_tag_id } else {
                    self.options.plugins.as_ref()
                        .and_then(|p| p.tag_overrides.as_ref())
                        .and_then(|ovs| ovs.iter().find(|(k, _)| k == tag_name.as_ref()).map(|(_, v)| v))
                        .and_then(|ov| ov.alias_tag_id)
                };
                i2 = tag_name_end;

                if tag_name_raw.is_empty() {
                    text_buffer.push(bytes[i] as char);
                    i += 1;
                    continue;
                }

                if !text_buffer.is_empty() {
                    self.process_text_buffer(&mut text_buffer);
                    text_buffer.clear();
                }

                let result = self.process_opening_tag(&tag_name, tag_id, builtin_tag_id.is_some(), chunk, i2);
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

        // If text_buffer is empty (common for non-streaming), save allocation for reuse
        if text_buffer.is_empty() {
            self.parse_text_buffer = text_buffer;
            String::new()
        } else {
            text_buffer
        }
    }

    pub fn get_markdown(&mut self) -> String {
        let trimmed_end_len = self.buffer.trim_end().len();
        self.buffer.truncate(trimmed_end_len);
        let start = self.buffer.len() - self.buffer.trim_start().len();
        if start > 0 { self.buffer.drain(..start); }

        // Apply clean.fragments using recorded positions
        // Build new string copying segments, replacing broken links with text only
        if self.clean_flags & CLEAN_FRAGMENTS != 0 && !self.fragment_links.is_empty() {
            let trim_offset = start;
            let mut result = String::with_capacity(self.buffer.len());
            let mut cursor = 0usize;

            for &(bracket_start, link_end) in &self.fragment_links {
                let adj_start = bracket_start.saturating_sub(trim_offset);
                let adj_end = link_end.saturating_sub(trim_offset);
                if adj_end > self.buffer.len() || adj_start >= adj_end { continue; }

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

    pub fn get_markdown_chunk(&mut self) -> String {
        let current_content = self.buffer.trim_start();
        let content_len = current_content.len();
        if self.last_yielded_length >= content_len {
            self.last_yielded_length = content_len;
            return String::new();
        }
        let new_content = current_content[self.last_yielded_length..].to_string();
        self.last_yielded_length = content_len;
        new_content
    }
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
    /// Start offset into html_chunk for remaining text (only meaningful when !complete)
    remaining_start: usize,
}
