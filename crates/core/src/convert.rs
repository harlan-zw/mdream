use std::borrow::Cow;
use crate::consts::*;
use crate::tags::get_tag_handler;
use crate::types::{ElementNode, ExtractedElement, HTMLToMarkdownOptions, ParsedSelector, TailwindData};
use crate::helpers::{
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

/// Pre-computed blockquote prefixes for depths 1-6 (avoids `"> ".repeat()`)
static BQ_PREFIXES: [&str; 7] = ["", "> ", "> > ", "> > > ", "> > > > ", "> > > > > ", "> > > > > > "];
/// Pre-computed unordered list item prefixes for indent depths 0-5
static UL_PREFIXES: [&str; 6] = ["- ", "  - ", "    - ", "      - ", "        - ", "          - "];

// Clean mode bitmask flags
const CLEAN_EMPTY_LINKS: u8 = 1;
const CLEAN_FRAGMENTS: u8 = 2;
const CLEAN_REDUNDANT_LINKS: u8 = 4;
const CLEAN_SELF_LINK_HEADINGS: u8 = 8;
const CLEAN_EMPTY_IMAGES: u8 = 16;
const CLEAN_EMPTY_LINK_TEXT: u8 = 32;

/// Known tracking query parameter prefixes to strip when clean_urls is enabled.
const TRACKING_PREFIXES: [&str; 6] = ["utm_", "fbclid", "gclid", "mc_eid", "msclkid", "oly_"];

/// Check if a query parameter key is a tracking parameter.
#[inline]
fn is_tracking_param(key: &str) -> bool {
    for prefix in &TRACKING_PREFIXES {
        if key.starts_with(prefix) {
            return true;
        }
    }
    false
}

/// Strip tracking query parameters from a URL string.
/// Returns Cow::Borrowed if no tracking params found, avoiding allocation.
fn strip_tracking_params(url: &str) -> Cow<'_, str> {
    let Some(qmark) = url.find('?') else { return Cow::Borrowed(url) };
    let query_start = qmark + 1;
    let query_end = url[query_start..].find('#').map_or(url.len(), |i| query_start + i);
    let query = &url[query_start..query_end];

    // Fast check: does any param match a tracking prefix?
    let has_tracking = query.split('&').any(|param| {
        let key = param.find('=').map_or(param, |i| &param[..i]);
        is_tracking_param(key)
    });
    if !has_tracking {
        return Cow::Borrowed(url);
    }

    Cow::Owned(strip_tracking_params_owned(url.to_string()))
}

/// Strip tracking query parameters from an already-owned URL string.
fn strip_tracking_params_owned(url: String) -> String {
    let Some(qmark) = url.find('?') else { return url };
    let (base, rest) = url.split_at(qmark);
    let query = &rest[1..]; // skip '?'

    // Split off fragment if present
    let (query, fragment) = match query.find('#') {
        Some(i) => (&query[..i], &query[i..]),
        None => {
            // Also check base for fragment before query (rare but possible in malformed URLs)
            (query, "")
        }
    };

    let mut kept = String::new();
    for param in query.split('&') {
        let key = match param.find('=') {
            Some(i) => &param[..i],
            None => param,
        };
        if !is_tracking_param(key) {
            if !kept.is_empty() {
                kept.push('&');
            }
            kept.push_str(param);
        }
    }

    if kept.is_empty() {
        // All params stripped — return base + fragment
        let mut result = base.to_string();
        result.push_str(fragment);
        result
    } else {
        let mut result = base.to_string();
        result.push('?');
        result.push_str(&kept);
        result.push_str(fragment);
        result
    }
}

/// GFM-style slug from heading text: lowercase, collapse whitespace/- → -, strip non-alnum except -_
fn slugify_heading(text: &str) -> String {
    // Strip inline markdown formatting from heading text
    // Remove [text](url) → text, strip *_`~
    let mut cleaned = String::with_capacity(text.len());
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0;
    while i < len {
        if bytes[i] == b'[' {
            // Look for ](url) pattern
            if let Some(close) = text[i+1..].find(']') {
                let close_abs = i + 1 + close;
                if close_abs + 1 < len && bytes[close_abs + 1] == b'(' {
                    if let Some(paren_close) = text[close_abs+2..].find(')') {
                        // Extract link text only
                        cleaned.push_str(&text[i+1..close_abs]);
                        i = close_abs + 2 + paren_close + 1;
                        continue;
                    }
                }
            }
            i += 1;
        } else if bytes[i] == b'*' || bytes[i] == b'_' || bytes[i] == b'`' || bytes[i] == b'~' {
            i += 1;
        } else {
            cleaned.push(bytes[i] as char);
            i += 1;
        }
    }

    let trimmed = cleaned.trim();
    let mut slug = String::with_capacity(trimmed.len());
    let mut last_was_dash = false;
    for c in trimmed.bytes() {
        if c.is_ascii_lowercase() {
            slug.push(c as char);
            last_was_dash = false;
        } else if c.is_ascii_uppercase() {
            slug.push((c + 32) as char);
            last_was_dash = false;
        } else if c.is_ascii_digit() {
            slug.push(c as char);
            last_was_dash = false;
        } else if c == b'_' {
            slug.push('_');
            last_was_dash = false;
        } else if (c == b' ' || c == b'\t' || c == b'-') && !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }
    }
    if last_was_dash {
        slug.pop();
    }
    slug
}

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

    // ========================================================================
    // Main entry point — single-pass parse + markdown generation
    // ========================================================================

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
                // TURBO SKIP: for non-nesting tags that exclude text (script, style, noscript)
                // Skip all content until next '<' — no text processing, no quote tracking needed
                if self.in_non_nesting {
                    if let Some(parent) = self.stack.last() {
                        if parent.excludes_text_nodes {
                            i += 1;
                            while i < chunk_length && bytes[i] != LT_CHAR { i += 1; }
                            continue;
                        }
                    }
                }

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
                    self.last_char_was_backslash = false;
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
                    } else if let Some(ch) = chunk[i..].chars().next() {
                        text_buffer.push(ch);
                        i += ch.len_utf8();
                        self.last_char_was_backslash = false;
                        continue;
                    }

                    if self.in_non_nesting && !self.last_char_was_backslash {
                        if cc == APOS_CHAR && !self.in_double_quote && !self.in_backtick {
                            self.in_single_quote = !self.in_single_quote;
                        } else if cc == QUOTE_CHAR && !self.in_single_quote && !self.in_backtick {
                            self.in_double_quote = !self.in_double_quote;
                        } else if cc == BACKTICK_CHAR && !self.in_single_quote && !self.in_double_quote {
                            self.in_backtick = !self.in_backtick;
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
                    text_buffer.push_str(&chunk[result.remaining_start..]);
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
                    text_buffer.push_str(&chunk[result.remaining_start..]);
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
                let Some(tag_name_end) = tag_name_end else {
                    text_buffer.push_str(&chunk[i..]);
                    break;
                };
                let tag_name_raw = &chunk[tag_name_start..tag_name_end];
                if tag_name_raw.is_empty() { break; }
                let tag_name: Cow<str> = if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
                    Cow::Owned(tag_name_raw.to_ascii_lowercase())
                } else {
                    Cow::Borrowed(tag_name_raw)
                };

                let builtin_tag_id = crate::consts::get_tag_id(&tag_name);
                let tag_id = if builtin_tag_id.is_some() { builtin_tag_id } else {
                    self.options.plugins.as_ref()
                        .and_then(|p| p.tag_overrides.as_ref())
                        .and_then(|ovs| ovs.iter().find(|(k, _)| k == tag_name.as_ref()).map(|(_, v)| v))
                        .and_then(|ov| ov.alias_tag_id)
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
            node_spacing = node.spacing;

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

        // Clean mode — single guard for all clean checks
        if self.clean_flags != 0 {
            if let Some(id) = tag_id {
                if id == TAG_A {
                    // emptyLinks: skip href="#" or "javascript:"
                    if self.clean_flags & CLEAN_EMPTY_LINKS != 0 {
                        let node = &self.stack[self.stack.len() - 1];
                        if let Some(href) = node.attributes.get("href") {
                            if href == "#" || href.starts_with("javascript:") {
                                self.skip_current_link = true;
                                self.last_node_is_inline = is_inline;
                                return;
                            }
                        }
                        self.skip_current_link = false;
                    }
                    // Record buffer position BEFORE write_output emits `[`
                    // so we can find and remove it later if needed
                    self.link_bracket_pos = self.buffer.len();
                } else if id == TAG_IMG && self.clean_flags & CLEAN_EMPTY_IMAGES != 0 {
                    let node = &self.stack[self.stack.len() - 1];
                    let alt = node.attributes.get("alt").map_or("", String::as_str);
                    if alt.is_empty() {
                        self.last_node_is_inline = is_inline;
                        return;
                    }
                }
            }
        }

        self.write_output(true, is_inline, configured_new_lines, output.as_deref());

        // Clean: track heading start for slug collection
        if self.clean_flags & CLEAN_FRAGMENTS != 0 {
            if let Some(id) = tag_id {
                if (TAG_H1..=TAG_H6).contains(&id) && self.depth_map[TAG_A as usize] == 0 {
                    self.in_heading = true;
                    self.heading_buffer_start = self.buffer.len();
                }
            }
        }
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

        // Clean mode exit — single guard
        if self.clean_flags != 0 && tag_id == Some(TAG_A) {
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
                if in_heading {
                    if let Some(href) = node.attributes.get("href") {
                        if href.starts_with('#') && text_len > 0 {
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
                }
            }

            // redundantLinks: [url](url) → url
            if self.clean_flags & CLEAN_REDUNDANT_LINKS != 0 {
                if let Some(href) = node.attributes.get("href") {
                    let resolved = Self::resolve_url(href, self.options.origin.as_deref(), self.options.clean_urls);
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
        }

        // Collect heading slug before writing exit output
        if self.in_heading {
            if let Some(id) = tag_id {
                if (TAG_H1..=TAG_H6).contains(&id) {
                    let heading_text = &self.buffer[self.heading_buffer_start..];
                    let slug = slugify_heading(heading_text);
                    if !slug.is_empty() {
                        self.heading_slugs.push(slug);
                    }
                    self.in_heading = false;
                }
            }
        }

        // TAG_A exit: write ](url) directly to buffer — zero allocation
        if !has_override && tag_id == Some(TAG_A) && table_separator.is_none() {
            // Handle whitespace trimming (write_output with None)
            self.write_output(false, is_inline, configured_new_lines, None);
            // Write link close directly
            if let Some(href) = node.attributes.get("href") {
                let resolved = Self::resolve_url(href, self.options.origin.as_deref(), self.options.clean_urls);
                let mut title = node.attributes.get("title").map_or("", String::as_str);
                if !title.is_empty() && self.last_content_cache_len > 0 {
                    let buf_len = self.buffer.len();
                    let start = buf_len.saturating_sub(self.last_content_cache_len);
                    if self.buffer.is_char_boundary(start) {
                        let cache = &self.buffer[start..];
                        if cache == title { title = ""; }
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
            if self.clean_flags & CLEAN_FRAGMENTS != 0 {
                if let Some(href) = node.attributes.get("href") {
                    if href.starts_with('#') && href.len() > 1 {
                        let mut bp = self.link_bracket_pos;
                        let buf = self.buffer.as_bytes();
                        while bp < buf.len() && buf[bp] != b'[' { bp += 1; }
                        self.fragment_links.push((bp, self.buffer.len()));
                    }
                }
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

        self.write_output(false, is_inline, configured_new_lines, effective);

        // Record fragment link position for deferred fixup (no String alloc)
        if self.clean_flags & CLEAN_FRAGMENTS != 0 && tag_id == Some(TAG_A) {
            if let Some(href) = node.attributes.get("href") {
                if href.starts_with('#') && href.len() > 1 {
                    // Find actual [ position from recorded hint
                    let mut bp = self.link_bracket_pos;
                    let buf = self.buffer.as_bytes();
                    while bp < buf.len() && buf[bp] != b'[' { bp += 1; }
                    self.fragment_links.push((bp, self.buffer.len()));
                }
            }
        }
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
        let tag_id = node.tag_id?;
        match tag_id {
            TAG_DETAILS => Some(Cow::Borrowed("<details>")),
            TAG_SUMMARY => Some(Cow::Borrowed("<summary>")),
            TAG_BR => {
                if self.depth_map[TAG_TD as usize] > 0 { Some(Cow::Borrowed("<br>")) } else { None }
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
                        let indent = "  ".repeat(self.depth_map[TAG_LI as usize] as usize);
                        prefix = format!("\n{indent}{prefix}");
                    }
                    Some(Cow::Owned(prefix))
                }
            }
            TAG_CODE => {
                if self.depth_map[TAG_PRE as usize] > 0 {
                    let lang = Self::get_language_from_class(node.attributes.get("class"));
                    if lang.is_empty() {
                        Some(Cow::Borrowed("```\n"))
                    } else {
                        {
                            let mut s = String::with_capacity(4 + lang.len());
                            s.push_str("```");
                            s.push_str(lang);
                            s.push('\n');
                            Some(Cow::Owned(s))
                        }
                    }
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
                let ul_depth = self.depth_map[TAG_UL as usize] as usize;
                let ol_depth = self.depth_map[TAG_OL as usize] as usize;
                let depth = if ul_depth + ol_depth > 0 { ul_depth + ol_depth - 1 } else { 0 };
                let is_ordered = ol_depth > 0 && _ancestors.last().is_some_and(|p| p.tag_id == Some(TAG_OL));
                if !is_ordered && depth < UL_PREFIXES.len() {
                    Some(Cow::Borrowed(UL_PREFIXES[depth]))
                } else {
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
            }
            TAG_A => {
                if node.attributes.contains_key("href") { Some(Cow::Borrowed("[")) } else { None }
            }
            TAG_IMG => {
                let alt = node.attributes.get("alt").map_or("", String::as_str);
                let src = node.attributes.get("src").map_or("", String::as_str);
                let resolved_src = Self::resolve_url(src, self.options.origin.as_deref(), self.options.clean_urls);
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
    fn get_exit_output(&self, node: &ElementNode) -> Option<Cow<'static, str>> {
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
                    let resolved = Self::resolve_url(href, self.options.origin.as_deref(), self.options.clean_urls);
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
            if let Some(parent) = self.stack.last() {
                if self.last_text_node_contains_whitespace
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

    // ========================================================================
    // Parser internal methods (duplicated from parse.rs with inline emit)
    // ========================================================================

    fn process_text_buffer(&mut self, text_buffer: &mut String) {
        let contains_non_whitespace = self.text_buffer_contains_non_whitespace;
        let contains_whitespace = self.text_buffer_contains_whitespace;
        self.text_buffer_contains_non_whitespace = false;
        self.text_buffer_contains_whitespace = false;

        let Some(parent) = self.stack.last() else { return };
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

        if self.has_frontmatter
            && self.frontmatter_in_head
            && self.stack.last().is_some_and(|p| p.tag_id == Some(TAG_TITLE))
        {
            let val = text_buffer.trim().to_string();
            if !val.is_empty() { self.frontmatter_title = Some(val); }
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

    fn process_opening_tag(&mut self, tag_name: &str, tag_id: Option<u8>, is_builtin: bool, html_chunk: &str, position: usize) -> OpeningTagResult {
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
        } else {
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
                if let Some(style) = tag.attributes.get("style") {
                    if style.contains("absolute") || style.contains("fixed") { skip_node = true; }
                }
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
                if !self.isolate_main_found && is_main && self.depth <= 5 { self.isolate_main_found = true; }
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
                    if let Some(header_depth) = self.isolate_first_header_depth {
                        if !self.isolate_after_footer
                            && tag_id == Some(TAG_FOOTER)
                            && self.depth.saturating_sub(header_depth) <= 5
                        {
                            self.isolate_after_footer = true;
                            skip_node = true;
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

        tag.excluded_from_markdown = filter_excluded;

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
        if !self.extraction_parsed_selectors.is_empty() {
            if let Some(element) = self.stack.last() {
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
        }

        // Inline emit (no callback!)
        if !skip_node {
            self.emit_enter_element();
        }

        self.has_encoded_html_entity = false;

        if self.stack.last().is_some_and(|n| n.is_non_nesting) && !self_closing {
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
        let node_is_non_nesting = node.is_non_nesting;
        self.recycle_node(node);

        if let Some(id) = node_tag_id {
            debug_assert!((id as usize) < MAX_TAG_ID, "tag_id {id} exceeds MAX_TAG_ID {MAX_TAG_ID}");
            if (id as usize) < MAX_TAG_ID {
                self.depth_map[id as usize] = self.depth_map[id as usize].saturating_sub(1);
            }
            self.update_escape_ctx_on_close(id);
        }

        if node_is_non_nesting {
            self.in_single_quote = false;
            self.in_double_quote = false;
            self.in_backtick = false;
            self.last_char_was_backslash = false;
        }

        self.in_non_nesting = self.stack.last().is_some_and(|n| n.is_non_nesting);
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
                remaining_start: position,
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
                    remaining_start: position,
                };
            }
        }

        if let Some(top) = self.stack.last() {
            // Fast path: top of stack matches (well-formed HTML)
            if top.tag_id == tag_id {
                self.close_node();
            } else {
                let mut pop_count = 0;
                for j in (0..self.stack.len()).rev() {
                    pop_count += 1;
                    if self.stack[j].tag_id == tag_id { break; }
                }
                for _ in 0..pop_count {
                    if !self.stack.is_empty() { self.close_node(); }
                }
            }
        }

        self.just_closed_tag = true;
        CloseTagResult { complete: true, new_position: i + 1, remaining_start: 0 }
    }

    // ========================================================================
    // Utility methods
    // ========================================================================

    /// Recycle a node into the pool, preserving its Attributes Vec allocation.
    #[inline]
    fn recycle_node(&mut self, mut node: ElementNode) {
        node.attributes.clear();
        node.custom_name = None;
        node.tailwind = None;
        self.node_pool.push(node);
    }

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
            let v = val.replace('"', "\\\"");
            if v.contains('\n') || v.contains(':') || v.contains('#') || v.contains(' ') {
                format!("\"{v}\"")
            } else { v }
        };

        let mut yaml_out = Vec::new();
        if let Some(t) = &self.frontmatter_title {
            yaml_out.push(format!("title: {}", format_val(t)));
        }

        if let Some(f) = f_opts {
            if let Some(add) = &f.additional_fields {
                let mut sorted: Vec<_> = add.iter().collect();
                sorted.sort_by(|(a, _), (b, _)| a.cmp(b));
                for (key, val) in sorted {
                    if key != "title" && key != "description" {
                        yaml_out.push(format!("{}: {}", key, format_val(val)));
                    }
                }
            }
        }

        if !self.frontmatter_meta.is_empty() {
            yaml_out.push("meta:".to_string());
            self.frontmatter_meta.sort_by(|(a, _), (b, _)| a.cmp(b));
            for (key, val) in &self.frontmatter_meta {
                let k_fmt = if key.contains(':') { format!("\"{key}\"") } else { key.clone() };
                yaml_out.push(format!("  {}: {}", k_fmt, format_val(val)));
            }
        }

        if !yaml_out.is_empty() {
            let frontmatter_content = format!("---\n{}\n---\n\n", yaml_out.join("\n"));
            self.emit_frontmatter(&frontmatter_content);
        }
    }

    #[inline]
    fn resolve_url<'a>(url: &'a str, origin: Option<&str>, clean: bool) -> Cow<'a, str> {
        if url.is_empty() || url.starts_with('#') { return Cow::Borrowed(url); }
        // Fast path: check if cleaning needed before any allocation
        let needs_clean = clean && url.as_bytes().contains(&b'?');
        if url.starts_with("//") {
            let mut resolved = String::with_capacity(6 + url.len());
            resolved.push_str("https:");
            resolved.push_str(url);
            return Cow::Owned(if needs_clean { strip_tracking_params_owned(resolved) } else { resolved });
        }
        if let Some(orig) = origin {
            if url.starts_with('/') {
                let trimmed = orig.trim_end_matches('/');
                let mut resolved = String::with_capacity(trimmed.len() + url.len());
                resolved.push_str(trimmed);
                resolved.push_str(url);
                return Cow::Owned(if needs_clean { strip_tracking_params_owned(resolved) } else { resolved });
            }
            if let Some(suffix) = url.strip_prefix("./") {
                let mut resolved = String::with_capacity(orig.len() + 1 + suffix.len());
                resolved.push_str(orig);
                resolved.push('/');
                resolved.push_str(suffix);
                return Cow::Owned(if needs_clean { strip_tracking_params_owned(resolved) } else { resolved });
            }
            if !url.starts_with("http") {
                let suffix = url.strip_prefix('/').unwrap_or(url);
                let mut resolved = String::with_capacity(orig.len() + 1 + suffix.len());
                resolved.push_str(orig);
                resolved.push('/');
                resolved.push_str(suffix);
                return Cow::Owned(if needs_clean { strip_tracking_params_owned(resolved) } else { resolved });
            }
        }
        if needs_clean {
            strip_tracking_params(url)
        } else {
            Cow::Borrowed(url)
        }
    }

    #[inline]
    fn get_language_from_class(class_name: Option<&String>) -> &str {
        if let Some(class) = class_name {
            for part in class.split_whitespace() {
                if let Some(lang) = part.strip_prefix("language-") {
                    return lang.trim();
                }
            }
        }
        ""
    }

    // ========================================================================
    // Public output methods
    // ========================================================================

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
    /// Start offset into html_chunk for remaining text (only meaningful when !complete)
    remaining_start: usize,
}
