use std::borrow::Cow;
use std::collections::HashMap;
use crate::consts::*;
use crate::tags::get_tag_handler;
use crate::types::{Attributes, ElementNode, ExtractedElement, NodeEvent, ParsedSelector, TextNode};

// Escape context bitmask flags
const ESC_TABLE: u8 = 1;       // pipe escape inside <table>
const ESC_CODE_PRE: u8 = 2;    // backtick escape inside <code>/<pre>
const ESC_LINK: u8 = 4;        // bracket escape inside <a>
const ESC_BLOCKQUOTE: u8 = 8;  // > escape inside <blockquote>

/// Tracked element during extraction — maps stack depth to accumulator
pub(crate) struct TrackedExtraction {
    pub(crate) selector: String,
    pub(crate) stack_depth: usize,
    pub(crate) text_content: String,
    pub(crate) tag_name: String,
    pub(crate) attributes: Vec<(String, String)>,
}

pub struct ParseState {
    pub depth_map: [u8; MAX_TAG_ID],
    pub depth: usize,
    pub has_encoded_html_entity: bool,
    pub last_char_was_whitespace: bool,
    pub text_buffer_contains_whitespace: bool,
    pub text_buffer_contains_non_whitespace: bool,
    pub just_closed_tag: bool,
    pub is_first_text_in_element: bool,
    pub in_single_quote: bool,
    pub in_double_quote: bool,
    pub in_backtick: bool,
    pub last_char_was_backslash: bool,
    pub current_walk_index: usize,
    /// Cached: whether the current top-of-stack element is non-nesting (code, pre, etc.)
    pub in_non_nesting: bool,
    /// Bitmask: which escape contexts are active (avoids per-char depth_map lookups)
    pub escape_ctx: u8,
    /// Cached: depth_map[TAG_PRE] > 0
    pub in_pre: bool,
    /// Count of ancestors with collapses_inner_white_space && tag_id != TAG_SPAN && !excluded_from_markdown
    pub collapse_non_span_depth: u8,
    /// Count of ancestors with collapses_inner_white_space && tag_id == TAG_SPAN && !excluded_from_markdown
    pub collapse_span_depth: u8,
    /// Cached: index of the deepest non-inline element in the stack
    pub first_block_parent_index: Option<usize>,

    // Stack of active elements
    pub stack: Vec<ElementNode>,

    // Fast-path: true when any plugins are configured
    pub has_plugins: bool,
    pub has_tailwind: bool,
    pub has_isolate_main: bool,
    pub has_frontmatter: bool,
    pub has_filter: bool,
    pub has_extraction: bool,
    pub has_tag_overrides: bool,

    // Plugin tracking
    pub isolate_main_found: bool,
    pub isolate_main_closed: bool,
    pub isolate_first_header_depth: Option<usize>,
    pub isolate_after_footer: bool,

    pub frontmatter_in_head: bool,
    pub frontmatter_title: Option<String>,
    pub frontmatter_meta: HashMap<String, String>,

    // Extraction tracking
    pub extraction_parsed_selectors: Vec<(String, ParsedSelector)>,
    extraction_tracked: Vec<TrackedExtraction>,
    pub extraction_results: Vec<ExtractedElement>,

    // Filter tracking (pre-parsed selectors)
    pub filter_include_parsed: Vec<(String, ParsedSelector)>,
    pub filter_exclude_parsed: Vec<(String, ParsedSelector)>,
    pub filter_process_children: bool,
}

impl Default for ParseState {
    fn default() -> Self {
        Self {
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
            current_walk_index: 0,
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
        }
    }
}

impl ParseState {
    pub fn new(opts: &crate::types::HTMLToMarkdownOptions) -> Self {
        let mut state = Self::default();
        if let Some(plugins) = &opts.plugins {
            state.has_plugins = true;
            state.has_tailwind = plugins.tailwind.is_some();
            state.has_isolate_main = plugins.isolate_main.is_some();
            state.has_frontmatter = plugins.frontmatter.is_some();
            state.has_tag_overrides = plugins.tag_overrides.is_some();
            if let Some(extraction) = &plugins.extraction {
                state.has_extraction = true;
                state.extraction_parsed_selectors = extraction.selectors.iter()
                    .map(|s| (s.clone(), parse_css_selector(s)))
                    .collect();
            }
            if let Some(filter) = &plugins.filter {
                state.has_filter = true;
                if let Some(incl) = &filter.include {
                    state.filter_include_parsed = incl.iter()
                        .map(|s| (s.clone(), parse_css_selector(s)))
                        .collect();
                }
                if let Some(excl) = &filter.exclude {
                    state.filter_exclude_parsed = excl.iter()
                        .map(|s| (s.clone(), parse_css_selector(s)))
                        .collect();
                }
                state.filter_process_children = filter.process_children.unwrap_or(true);
            }
        }
        state
    }
}

pub fn parse_css_selector(selector: &str) -> ParsedSelector {
    let selector = selector.trim();
    let mut parts: Vec<ParsedSelector> = Vec::new();
    let mut current = String::new();
    let mut in_attr = false;

    for ch in selector.chars() {
        if ch == '[' {
            if !current.is_empty() {
                parts.push(parse_simple_selector(&current));
                current.clear();
            }
            in_attr = true;
            current.push(ch);
            continue;
        }
        if ch == ']' {
            current.push(ch);
            in_attr = false;
            parts.push(parse_attr_selector(&current));
            current.clear();
            continue;
        }
        if in_attr {
            current.push(ch);
            continue;
        }
        if (ch == '.' || ch == '#') && !current.is_empty() {
            parts.push(parse_simple_selector(&current));
            current.clear();
        }
        current.push(ch);
    }
    if !current.is_empty() {
        parts.push(parse_simple_selector(&current));
    }

    if parts.len() == 1 {
        parts.into_iter().next().unwrap()
    } else {
        ParsedSelector::Compound(parts)
    }
}

fn parse_simple_selector(s: &str) -> ParsedSelector {
    if s.starts_with('.') {
        ParsedSelector::Class(s[1..].to_string())
    } else if s.starts_with('#') {
        ParsedSelector::Id(s[1..].to_string())
    } else {
        ParsedSelector::Tag(s.to_string())
    }
}

fn parse_attr_selector(s: &str) -> ParsedSelector {
    let inner = &s[1..s.len() - 1];
    let operators = ["^=", "$=", "*=", "~=", "|=", "="];
    for op in &operators {
        if let Some(pos) = inner.find(op) {
            let name = inner[..pos].to_string();
            let val = inner[pos + op.len()..].trim_matches(|c| c == '"' || c == '\'').to_string();
            return ParsedSelector::Attribute { name, operator: Some(op.to_string()), value: Some(val) };
        }
    }
    ParsedSelector::Attribute { name: inner.to_string(), operator: None, value: None }
}

pub fn matches_selector(tag: &ElementNode, selector: &ParsedSelector) -> bool {
    match selector {
        ParsedSelector::Tag(name) => tag.name() == name,
        ParsedSelector::Class(class_name) => {
            tag.attributes.get("class").map_or(false, |c| {
                c.split_whitespace().any(|cls| cls == class_name)
            })
        }
        ParsedSelector::Id(id) => {
            tag.attributes.get("id").map_or(false, |v| v == id)
        }
        ParsedSelector::Attribute { name, operator, value } => {
            match tag.attributes.get(name.as_str()) {
                None => false,
                Some(attr_val) => {
                    match (operator.as_deref(), value.as_deref()) {
                        (None, _) | (_, None) => true,
                        (Some("="), Some(v)) => attr_val == v,
                        (Some("^="), Some(v)) => attr_val.starts_with(v),
                        (Some("$="), Some(v)) => attr_val.ends_with(v),
                        (Some("*="), Some(v)) => attr_val.contains(v),
                        (Some("~="), Some(v)) => attr_val.split_whitespace().any(|w| w == v),
                        (Some("|="), Some(v)) => attr_val == v || attr_val.starts_with(&format!("{}-", v)),
                        _ => false,
                    }
                }
            }
        }
        ParsedSelector::Compound(parts) => {
            parts.iter().all(|p| matches_selector(tag, p))
        }
    }
}

/// Whitespace check optimized for the hot character loop.
/// Uses a 33-bit bitmap: space(32), CR(13), LF(10), TAB(9).
#[inline(always)]
pub(crate) fn is_whitespace(c: u8) -> bool {
    if c > 32 { return false; }
    // Bitmap: bit 9 (tab), bit 10 (LF), bit 13 (CR), bit 32 (space)
    const MASK: u64 = (1u64 << 9) | (1u64 << 10) | (1u64 << 13) | (1u64 << 32);
    (MASK >> c) & 1 == 1
}

#[inline]
pub(crate) fn decode_html_entities(text: &str) -> Cow<'_, str> {
    // Fast path: no ampersand means no entities to decode
    if !text.as_bytes().contains(&b'&') {
        return Cow::Borrowed(text);
    }
    Cow::Owned(decode_html_entities_alloc(text))
}

fn decode_html_entities_alloc(text: &str) -> String {
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut result = String::with_capacity(len);
    let mut i = 0;

    while i < len {
        if bytes[i] == b'&' {
            // Try known entities (all ASCII, so byte comparison is safe)
            if i + 4 <= len && &bytes[i..i + 4] == b"&lt;" {
                result.push('<');
                i += 4;
                continue;
            }
            if i + 4 <= len && &bytes[i..i + 4] == b"&gt;" {
                result.push('>');
                i += 4;
                continue;
            }
            if i + 5 <= len && &bytes[i..i + 5] == b"&amp;" {
                result.push('&');
                i += 5;
                continue;
            }
            if i + 6 <= len && &bytes[i..i + 6] == b"&quot;" {
                result.push('"');
                i += 6;
                continue;
            }
            if i + 5 <= len && &bytes[i..i + 5] == b"&#39;" {
                result.push('\'');
                i += 5;
                continue;
            }
            if i + 6 <= len && &bytes[i..i + 6] == b"&apos;" {
                result.push('\'');
                i += 6;
                continue;
            }
            if i + 6 <= len && &bytes[i..i + 6] == b"&nbsp;" {
                result.push(' ');
                i += 6;
                continue;
            }
            // Numeric character references: &#NNN; or &#xHHH;
            if i + 2 < len && bytes[i + 1] == b'#' {
                let start = i;
                i += 2;
                let is_hex = i < len && (bytes[i] == b'x' || bytes[i] == b'X');
                if is_hex {
                    i += 1;
                }
                let num_start = i;
                while i < len && bytes[i] != b';' {
                    i += 1;
                }
                if i < len && bytes[i] == b';' {
                    let num_str = &text[num_start..i];
                    let base = if is_hex { 16 } else { 10 };
                    if let Ok(code_point) = u32::from_str_radix(num_str, base) {
                        if let Some(c) = std::char::from_u32(code_point) {
                            result.push(c);
                            i += 1;
                            continue;
                        }
                    }
                }
                i = start;
            }
        }
        // Safe: we're iterating bytes but need to handle multi-byte UTF-8
        let b = bytes[i];
        if b < 0x80 {
            result.push(b as char);
            i += 1;
        } else {
            // Multi-byte UTF-8 char - find char boundary
            let ch = text[i..].chars().next().unwrap();
            result.push(ch);
            i += ch.len_utf8();
        }
    }
    result
}

pub fn parse_html_chunk<F>(chunk: &str, state: &mut ParseState, options: Option<&crate::types::HTMLToMarkdownOptions>, mut handle_event: F) -> String
where
    F: FnMut(NodeEvent, &[ElementNode], &[u8; MAX_TAG_ID]),
{
    let mut text_buffer = String::with_capacity(256);
    let bytes = chunk.as_bytes();
    let chunk_length = bytes.len();
    let mut i = 0;

    let tag_overrides = options.and_then(|o| o.plugins.as_ref()).and_then(|p| p.tag_overrides.as_ref());

    let get_tag_id_from_name = |name: &str| -> Option<u8> {
        let id = crate::consts::get_tag_id(name);
        if id.is_some() {
            return id;
        }
        // Check for alias in tag_overrides
        tag_overrides
            .and_then(|ovs| ovs.get(name))
            .and_then(|ov| ov.alias_tag_id)
    };

    while i < chunk_length {
        let current_char_code = bytes[i];

        if current_char_code != LT_CHAR {
            if current_char_code == AMPERSAND_CHAR {
                state.has_encoded_html_entity = true;
            }

            if is_whitespace(current_char_code) {
                if state.just_closed_tag {
                    state.just_closed_tag = false;
                    state.last_char_was_whitespace = false;
                }

                if !state.in_pre && state.last_char_was_whitespace {
                    i += 1;
                    continue;
                }

                if state.in_pre {
                    text_buffer.push(current_char_code as char);
                } else {
                    if current_char_code == SPACE_CHAR || !state.last_char_was_whitespace {
                        text_buffer.push(' ');
                    }
                }
                state.last_char_was_whitespace = true;
                state.text_buffer_contains_whitespace = true;
                state.last_char_was_backslash = false;
            } else {
                state.text_buffer_contains_non_whitespace = true;
                state.last_char_was_whitespace = false;
                state.just_closed_tag = false;

                // Fast path: no escape contexts active — just push the char
                if state.escape_ctx == 0 {
                    if current_char_code < 0x80 {
                        text_buffer.push(current_char_code as char);
                    } else {
                        let ch = chunk[i..].chars().next().unwrap();
                        text_buffer.push(ch);
                        i += ch.len_utf8();
                        state.last_char_was_backslash = false;
                        continue;
                    }
                } else if current_char_code == PIPE_CHAR && (state.escape_ctx & ESC_TABLE) != 0 {
                    text_buffer.push_str("\\|");
                } else if current_char_code == BACKTICK_CHAR && (state.escape_ctx & ESC_CODE_PRE) != 0 {
                    text_buffer.push_str("\\`");
                } else if current_char_code == OPEN_BRACKET_CHAR && (state.escape_ctx & ESC_LINK) != 0 {
                    text_buffer.push_str("\\[");
                } else if current_char_code == CLOSE_BRACKET_CHAR && (state.escape_ctx & ESC_LINK) != 0 {
                    text_buffer.push_str("\\]");
                } else if current_char_code == GT_CHAR && (state.escape_ctx & ESC_BLOCKQUOTE) != 0 {
                    text_buffer.push_str("\\>");
                } else if current_char_code < 0x80 {
                    text_buffer.push(current_char_code as char);
                } else {
                    let ch = chunk[i..].chars().next().unwrap();
                    text_buffer.push(ch);
                    i += ch.len_utf8();
                    state.last_char_was_backslash = false;
                    continue;
                }

                if state.in_non_nesting {
                    if !state.last_char_was_backslash {
                        if current_char_code == APOS_CHAR && !state.in_double_quote && !state.in_backtick {
                            state.in_single_quote = !state.in_single_quote;
                        } else if current_char_code == QUOTE_CHAR && !state.in_single_quote && !state.in_backtick {
                            state.in_double_quote = !state.in_double_quote;
                        } else if current_char_code == BACKTICK_CHAR && !state.in_single_quote && !state.in_double_quote {
                            state.in_backtick = !state.in_backtick;
                        }
                    }
                }

                state.last_char_was_backslash = current_char_code == BACKSLASH_CHAR && !state.last_char_was_backslash;
            }
            i += 1;
            continue;
        }

        // Processing <
        if i + 1 >= chunk_length {
            text_buffer.push(current_char_code as char);
            break;
        }

        let next_char_code = bytes[i + 1];

        // COMMENT or DOCTYPE
        if next_char_code == EXCLAMATION_CHAR {
            if !text_buffer.is_empty() {
                process_text_buffer(&mut text_buffer, state, options, &mut handle_event);
                text_buffer.clear();
            }

            let result = process_comment_or_doctype(chunk, i);
            if result.complete {
                i = result.new_position;
            } else {
                text_buffer.push_str(&result.remaining_text);
                break;
            }
        }
        // CLOSING TAG
        else if next_char_code == SLASH_CHAR {
            let in_quotes = state.in_single_quote || state.in_double_quote || state.in_backtick;

            if state.in_non_nesting && in_quotes {
                text_buffer.push(current_char_code as char);
                i += 1;
                continue;
            }

            if !text_buffer.is_empty() {
                process_text_buffer(&mut text_buffer, state, options, &mut handle_event);
                text_buffer.clear();
            }

            let result = process_closing_tag(chunk, i, state, options, &mut handle_event);
            if result.complete {
                i = result.new_position;
            } else {
                text_buffer.push_str(&result.remaining_text);
                break;
            }
        }
        // OPENING TAG
        else {
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
            if tag_name_raw.is_empty() {
                break;
            }
            // Fast path: check if already lowercase (most HTML is)
            let tag_name: Cow<str> = if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
                Cow::Owned(tag_name_raw.to_ascii_lowercase())
            } else {
                Cow::Borrowed(tag_name_raw)
            };

            let tag_id = get_tag_id_from_name(&tag_name);
            i2 = tag_name_end;

            let in_quotes = state.in_single_quote || state.in_double_quote || state.in_backtick;

            if state.in_non_nesting {
                if in_quotes {
                    text_buffer.push(bytes[i] as char);
                    i += 1;
                    continue;
                }
                if let Some(curr) = state.stack.last() {
                    if curr.tag_id != tag_id {
                        text_buffer.push(bytes[i] as char);
                        i += 1;
                        continue;
                    }
                }
            }

            if !text_buffer.is_empty() {
                process_text_buffer(&mut text_buffer, state, options, &mut handle_event);
                text_buffer.clear();
            }

            let result = process_opening_tag(&tag_name, tag_id, chunk, i2, state, options, &mut handle_event);

            if result.skip {
                i = result.new_position;
            } else if result.complete {
                i = result.new_position;
                if result.self_closing {
                    close_node(state, options, &mut handle_event);
                    state.just_closed_tag = true;
                } else {
                    state.is_first_text_in_element = true;
                }
            } else {
                text_buffer.push_str(&result.remaining_text);
                break;
            }
        }
    }

    text_buffer
}

pub(crate) struct CommentResult {
    pub(crate) complete: bool,
    pub(crate) new_position: usize,
    pub(crate) remaining_text: String,
}

pub(crate) fn process_comment_or_doctype(html_chunk: &str, position: usize) -> CommentResult {
    let mut i = position;
    let bytes = html_chunk.as_bytes();
    let chunk_length = bytes.len();

    if i + 3 < chunk_length && bytes[i + 2] == DASH_CHAR && bytes[i + 3] == DASH_CHAR {
        i += 4;
        while i < chunk_length - 2 {
            if bytes[i] == DASH_CHAR && bytes[i + 1] == DASH_CHAR && bytes[i + 2] == GT_CHAR {
                i += 3;
                return CommentResult {
                    complete: true,
                    new_position: i,
                    remaining_text: String::new(),
                };
            }
            i += 1;
        }
        return CommentResult {
            complete: false,
            new_position: position,
            remaining_text: html_chunk[position..].to_string(),
        };
    } else {
        i += 2;
        while i < chunk_length {
            if bytes[i] == GT_CHAR {
                i += 1;
                return CommentResult {
                    complete: true,
                    new_position: i,
                    remaining_text: String::new(),
                };
            }
            i += 1;
        }
        return CommentResult {
            complete: false,
            new_position: i,
            remaining_text: html_chunk[position..i].to_string(),
        };
    }
}

fn process_text_buffer<F>(text_buffer: &mut String, state: &mut ParseState, _options: Option<&crate::types::HTMLToMarkdownOptions>, mut handle_event: F)
where
    F: FnMut(NodeEvent, &[ElementNode], &[u8; MAX_TAG_ID]),
{
    let contains_non_whitespace = state.text_buffer_contains_non_whitespace;
    let contains_whitespace = state.text_buffer_contains_whitespace;
    state.text_buffer_contains_non_whitespace = false;
    state.text_buffer_contains_whitespace = false;

    if state.stack.is_empty() {
        return;
    }

    let parent = state.stack.last().unwrap();
    let mut excludes_text_nodes = parent.excludes_text_nodes || parent.excluded_from_markdown;
    
    // Apply isolate_main logic for text nodes
    if state.has_isolate_main {
        if state.isolate_main_found {
            if state.isolate_main_closed {
                excludes_text_nodes = true;
            }
        } else if state.isolate_first_header_depth.is_none() {
            if state.depth_map[TAG_HEAD as usize] == 0 {
                excludes_text_nodes = true;
            }
        } else if state.isolate_after_footer {
            excludes_text_nodes = true;
        }
    }

    // Apply frontmatter title extraction
    if state.has_frontmatter {
        if state.frontmatter_in_head && state.stack.last().map_or(false, |p| p.tag_id == Some(TAG_TITLE)) {
            let val = text_buffer.trim().to_string();
            if !val.is_empty() {
                state.frontmatter_title = Some(val);
            }
            return; // skip text inside title tag as per plugin design
        }
    }

    let in_pre_tag = state.in_pre;

    let child_text_node_index = state.stack.last().map(|n| n.child_text_node_index).unwrap_or(0);
    
    if !in_pre_tag && !contains_non_whitespace && child_text_node_index == 0 {
        return;
    }

    if text_buffer.is_empty() {
        return;
    }

    let first_block_parent_index = state.first_block_parent_index;

    let first_block_child_text_count = first_block_parent_index.map(|idx| state.stack[idx].child_text_node_index).unwrap_or(0);

    let mut text = std::mem::take(text_buffer);
    if contains_whitespace && first_block_child_text_count == 0 {
        let mut start = 0;
        let bytes = text.as_bytes();
        while start < bytes.len() && (if in_pre_tag { bytes[start] == NEWLINE_CHAR || bytes[start] == CARRIAGE_RETURN_CHAR } else { is_whitespace(bytes[start]) }) {
            start += 1;
        }
        if start > 0 {
            text.drain(..start);
        }
    }

    if state.has_encoded_html_entity {
        if let Cow::Owned(decoded) = decode_html_entities(&text) {
            text = decoded;
        }
        state.has_encoded_html_entity = false;
    }
    
    // Apply Tailwind prefix/suffix
    if state.has_tailwind {
        if let Some(parent) = state.stack.last() {
            if let Some(tw) = &parent.tailwind {
                if tw.hidden {
                    excludes_text_nodes = true;
                } else if !excludes_text_nodes {
                    let mut modified = false;
                    let mut new_text = String::new();
                    if let Some(p) = &tw.prefix {
                        new_text.push_str(p);
                        modified = true;
                    }
                    new_text.push_str(&text);
                    if let Some(s) = &tw.suffix {
                        new_text.push_str(s);
                        modified = true;
                    }
                    if modified {
                        text = fix_redundant_delimiters(&new_text);
                    }
                }
            }
        }
    }

    // Extraction: append text to tracked elements
    if !state.extraction_tracked.is_empty() {
        let current_depth = state.stack.len();
        for tracked in &mut state.extraction_tracked {
            if tracked.stack_depth <= current_depth {
                tracked.text_content.push_str(&text);
            }
        }
    }

    if let Some(parent) = state.stack.last() {
        let text_node = TextNode {
            value: text,
            depth: state.depth,
            index: parent.current_walk_index,
            contains_whitespace,
            excluded_from_markdown: excludes_text_nodes,
        };

        if !excludes_text_nodes {
            handle_event(NodeEvent::EnterText(&text_node), &state.stack, &state.depth_map);
        }

        // Recover String allocation to reuse capacity in text_buffer
        let mut recovered = text_node.value;
        recovered.clear();
        *text_buffer = recovered;
    }

    // Mutate parents
    if let Some(parent) = state.stack.last_mut() {
        parent.current_walk_index += 1;
    }

    // Traverse up to first block node and increment child_text_node_index
    let up_to = first_block_parent_index.unwrap_or(0);
    for idx in up_to..state.stack.len() {
        state.stack[idx].child_text_node_index += 1;
    }
}

struct OpeningTagResult {
    complete: bool,
    new_position: usize,
    remaining_text: String,
    self_closing: bool,
    skip: bool,
}

#[inline]
fn extract_base_class(class: &str) -> (&str, &str) {
    let breakpoints = ["sm:", "md:", "lg:", "xl:", "2xl:"];
    for bp in breakpoints {
        if class.starts_with(bp) {
            return (&class[bp.len()..], bp);
        }
    }
    (class, "")
}

pub(crate) fn process_tailwind_classes(classes_attr: &str) -> (Option<String>, Option<String>, bool) {
    let mut classes: Vec<&str> = classes_attr.split_whitespace().collect();
    let bp_weight = |bp| match bp {
        "" => 0,
        "sm:" => 1,
        "md:" => 2,
        "lg:" => 3,
        "xl:" => 4,
        "2xl:" => 5,
        _ => 6,
    };
    classes.sort_by_key(|c| bp_weight(extract_base_class(c).1));
    
    let mut prefix = String::new();
    let mut suffix = String::new();
    let mut hidden = false;
    
    let mut weight = None;
    let mut emphasis = None;
    let mut decoration = None;
    let mut display_hidden = false;
    let mut position_hidden = false;
    
    for cls in classes {
        let base = extract_base_class(cls).0;
        if base.contains("italic") {
            emphasis = Some(("*", "*"));
        } else if base == "font-bold" || base == "font-semibold" || base == "font-black" || base == "font-extrabold" || base == "font-medium" || base == "bold" {
            weight = Some(("**", "**"));
        } else if base.contains("font-") {
            weight = None;
        } else if base.contains("line-through") || base.contains("underline") {
            decoration = Some(("~~", "~~"));
        } else if base == "hidden" || base.contains("invisible") {
            display_hidden = true;
        } else if base == "block" || base == "flex" || base == "inline" {
            display_hidden = false; 
        } else if base == "absolute" || base == "fixed" || base == "sticky" {
            position_hidden = true;
        } else if base == "static" || base == "relative" {
            position_hidden = false;
        }
    }
    
    if display_hidden || position_hidden {
        hidden = true;
    }
    
    if let Some((p, s)) = weight {
        prefix.push_str(p);
        suffix.insert_str(0, s);
    }
    if let Some((p, s)) = emphasis {
        prefix.push_str(p);
        suffix.insert_str(0, s);
    }
    if let Some((p, s)) = decoration {
        prefix.push_str(p);
        suffix.insert_str(0, s);
    }
    
    (
        if prefix.is_empty() { None } else { Some(prefix) },
        if suffix.is_empty() { None } else { Some(suffix) },
        hidden
    )
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

fn process_opening_tag<F>(
    tag_name: &str,
    tag_id: Option<u8>,
    html_chunk: &str,
    position: usize,
    state: &mut ParseState,
    options: Option<&crate::types::HTMLToMarkdownOptions>,
    mut handle_event: F
) -> OpeningTagResult
where
    F: FnMut(NodeEvent, &[ElementNode], &[u8; MAX_TAG_ID]),
{
    // check non-nesting
    if let Some(curr) = state.stack.last() {
        if curr.is_non_nesting {
            // Can't close from here easily due to ownership without passing handle_event,
            // but this is mostly handled by caller since `state.stack.push` hasn't happened yet.
        }
    }

    let tag_handler = tag_id.and_then(get_tag_handler);
    let needs_attrs = tag_handler.map_or(false, |h| h.needs_attributes)
        || state.has_tailwind
        || state.has_filter
        || state.has_extraction
        || state.has_tag_overrides
        || state.has_frontmatter;
    let (complete, new_position, attributes, self_closing) = process_tag_attributes(html_chunk, position, tag_handler, !needs_attrs);

    if !complete {
        return OpeningTagResult {
            complete: false,
            new_position: position,
            remaining_text: html_chunk[position..].to_string(),
            self_closing: false,
            skip: false,
        };
    }

    if let Some(id) = tag_id {
        state.depth_map[id as usize] += 1;
        // Update escape context bitmask
        match id {
            TAG_TABLE => state.escape_ctx |= ESC_TABLE,
            TAG_CODE | TAG_PRE => { state.escape_ctx |= ESC_CODE_PRE; if id == TAG_PRE { state.in_pre = true; } }
            TAG_A => state.escape_ctx |= ESC_LINK,
            TAG_BLOCKQUOTE => state.escape_ctx |= ESC_BLOCKQUOTE,
            _ => {}
        }
    }
    state.depth += 1;
    let i = new_position;

    let current_walk_index = state.stack.last().map(|n| n.current_walk_index).unwrap_or(0);

    // Only allocate name for non-builtin tags; built-in tags derive name from tag_id.
    // When has_tag_overrides is false, tag_id == get_tag_id(tag_name), so tag_id.is_some() suffices.
    let custom_name = if tag_id.is_some() {
        None
    } else {
        Some(tag_name.to_string())
    };

    let (h_inline, h_excludes, h_non_nesting, h_collapses, h_spacing) = if let Some(h) = tag_handler {
        (h.is_inline, h.excludes_text_nodes, h.is_non_nesting, h.collapses_inner_white_space, h.spacing)
    } else {
        (false, false, false, false, None)
    };

    let mut tag = ElementNode {
        custom_name,
        attributes,
        tag_id,
        depth: state.depth,
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
    };

    let mut skip_node = false;
    let mut filter_excluded = false;

    if state.has_plugins {
        if state.has_tailwind {
            if let Some(class_attr) = tag.attributes.get("class") {
                let (prefix, suffix, hidden) = process_tailwind_classes(class_attr);
                if prefix.is_some() || suffix.is_some() || hidden {
                    tag.tailwind = Some(Box::new(crate::types::TailwindData { prefix, suffix, hidden }));
                    if hidden {
                        skip_node = true;
                    }
                }
            }
        }

        if state.has_filter {
            // If the element has absolute/fixed positioning, skip it
            if let Some(style) = tag.attributes.get("style") {
                if style.contains("absolute") || style.contains("fixed") {
                    skip_node = true;
                }
            }

            // Check exclusion against current element
            if !skip_node {
                for (_, parsed) in &state.filter_exclude_parsed {
                    if matches_selector(&tag, parsed) {
                        skip_node = true;
                        filter_excluded = true;
                        break;
                    }
                }
            }

            // Check exclusion against ancestors
            if !skip_node {
                for parent in state.stack.iter() {
                    for (_, parsed) in &state.filter_exclude_parsed {
                        if matches_selector(parent, parsed) {
                            skip_node = true;
                            filter_excluded = true;
                            break;
                        }
                    }
                    if skip_node { break; }
                }
            }

            // Check inclusion
            if !skip_node && !state.filter_include_parsed.is_empty() {
                let mut match_found = false;

                for (_, parsed) in &state.filter_include_parsed {
                    if matches_selector(&tag, parsed) {
                        match_found = true;
                        break;
                    }
                }

                if !match_found && state.filter_process_children {
                    for parent in state.stack.iter() {
                        for (_, parsed) in &state.filter_include_parsed {
                            if matches_selector(parent, parsed) {
                                match_found = true;
                                break;
                            }
                        }
                        if match_found { break; }
                    }
                }

                if !match_found {
                    skip_node = true;
                    filter_excluded = true;
                }
            }
        }

        // Apply isolateMain
        if state.has_isolate_main {
            let is_main = tag_id == Some(TAG_MAIN);
            if !state.isolate_main_found && is_main && state.depth <= 5 {
                state.isolate_main_found = true;
            }

            if state.isolate_main_found {
                if state.isolate_main_closed {
                    skip_node = true;
                }
            } else {
                let is_header = tag_id.map_or(false, |id| {
                    id == TAG_H1 || id == TAG_H2 || id == TAG_H3 || id == TAG_H4 || id == TAG_H5 || id == TAG_H6
                });

                if state.isolate_first_header_depth.is_none() && is_header {
                    let in_header_tag = state.depth_map[TAG_HEADER as usize] > 0;
                    if !in_header_tag {
                        state.isolate_first_header_depth = Some(state.depth);
                    }
                }

                if let Some(header_depth) = state.isolate_first_header_depth {
                    if !state.isolate_after_footer && tag_id == Some(TAG_FOOTER) {
                        let depth_diff = state.depth.saturating_sub(header_depth);
                        if depth_diff <= 5 {
                            state.isolate_after_footer = true;
                            skip_node = true;
                        }
                    }
                }

                if state.isolate_first_header_depth.is_none() {
                    if tag_id != Some(TAG_HEAD) && state.depth_map[TAG_HEAD as usize] == 0 {
                        skip_node = true;
                    }
                } else if state.isolate_after_footer {
                    skip_node = true;
                }
            }
        }

        // Apply Frontmatter
        if state.has_frontmatter {
            if tag_id == Some(TAG_HEAD) {
                state.frontmatter_in_head = true;
            } else if state.frontmatter_in_head && tag_id == Some(TAG_META) {
                let name = tag.attributes.get("name").or_else(|| tag.attributes.get("property"));
                let content = tag.attributes.get("content");
                if let (Some(n), Some(c)) = (name, content) {
                    let mut is_allowed = false;
                    let n_str = n.as_str();
                    match n_str {
                        "description" | "keywords" | "author" | "date" | "og:title" | "og:description" | "twitter:title" | "twitter:description" => {
                            is_allowed = true;
                        }
                        _ => {
                            if let Some(opts) = options {
                                if let Some(allowed) = opts.plugins.as_ref().and_then(|p| p.frontmatter.as_ref()).and_then(|f| f.meta_fields.as_ref()) {
                                    if allowed.iter().any(|a| a == n_str) {
                                        is_allowed = true;
                                    }
                                }
                            }
                        }
                    }
                    if is_allowed {
                        state.frontmatter_meta.insert(n.clone(), c.clone());
                    }
                }
            }
        }
    }

    tag.excluded_from_markdown = filter_excluded;

    // Update collapse depth counters before push
    if tag.collapses_inner_white_space && !filter_excluded {
        if tag.tag_id == Some(TAG_SPAN) {
            state.collapse_span_depth += 1;
        } else {
            state.collapse_non_span_depth += 1;
        }
    }

    if let Some(last) = state.stack.last_mut() {
        last.current_walk_index += 1;
    }

    // Update first_block_parent_index before push
    if !tag.is_inline {
        state.first_block_parent_index = Some(state.stack.len());
    }

    state.stack.push(tag);

    // Extraction: check if this element matches any selectors
    if !state.extraction_parsed_selectors.is_empty() {
        let element = state.stack.last().unwrap();
        let stack_depth = state.stack.len();
        for (selector, parsed) in &state.extraction_parsed_selectors {
            if matches_selector(element, parsed) {
                let attrs: Vec<(String, String)> = element.attributes.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
                state.extraction_tracked.push(TrackedExtraction {
                    selector: selector.clone(),
                    stack_depth,
                    text_content: String::new(),
                    tag_name: element.name().to_string(),
                    attributes: attrs,
                });
            }
        }
    }

    if !skip_node {
        handle_event(NodeEvent::EnterElement(state.stack.last().unwrap()), &state.stack, &state.depth_map);
    }

    state.has_encoded_html_entity = false;

    if state.stack.last().map_or(false, |n| n.is_non_nesting) && !self_closing {
        state.in_non_nesting = true;
        state.in_single_quote = false;
        state.in_double_quote = false;
        state.in_backtick = false;
        state.last_char_was_backslash = false;
    }

    if self_closing {
        // Can't invoke close_node here without handle_event unfortunately.
        // self.closing returned to caller to process.
    } else {
        state.just_closed_tag = false;
    }

    OpeningTagResult {
        complete: true,
        new_position: i,
        remaining_text: String::new(),
        self_closing,
        skip: false,
    }
}

pub(crate) fn process_tag_attributes(html_chunk: &str, position: usize, tag_handler: Option<&crate::types::TagHandler>, skip_attrs: bool) -> (bool, usize, Attributes, bool) {
    let mut i = position;
    let bytes = html_chunk.as_bytes();
    let chunk_length = bytes.len();

    let self_closing = tag_handler.map_or(false, |h| h.is_self_closing);
    let mut inside_quote = false;
    let mut quote_char: u8 = 0;
    let attr_start_pos = i;

    while i < chunk_length {
        let c = bytes[i];

        if inside_quote {
            if c == quote_char {
                inside_quote = false;
            }
            i += 1;
            continue;
        } else if c == QUOTE_CHAR || c == APOS_CHAR {
            inside_quote = true;
            quote_char = c;
        } else if c == SLASH_CHAR && i + 1 < chunk_length && bytes[i + 1] == GT_CHAR {
            let attrs = if skip_attrs {
                Attributes::new()
            } else {
                parse_attributes(html_chunk[attr_start_pos..i].trim())
            };
            return (true, i + 2, attrs, true);
        } else if c == GT_CHAR {
            let attrs = if skip_attrs {
                Attributes::new()
            } else {
                parse_attributes(html_chunk[attr_start_pos..i].trim())
            };
            return (true, i + 1, attrs, self_closing);
        }

        i += 1;
    }

    (false, i, Attributes::new(), false)
}

pub fn parse_attributes(attr_str: &str) -> Attributes {
    let mut result = Attributes::with_capacity(4);
    if attr_str.is_empty() {
        return result;
    }

    let bytes = attr_str.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    const WHITESPACE: u8 = 0;
    const NAME: u8 = 1;
    const AFTER_NAME: u8 = 2;
    const BEFORE_VALUE: u8 = 3;
    const QUOTED_VALUE: u8 = 4;
    const UNQUOTED_VALUE: u8 = 5;

    let mut state = WHITESPACE;
    let mut name_start = 0;
    let mut name_end;
    let mut value_start = 0;
    let mut quote_char = 0;
    let mut name_start_saved = 0;
    let mut name_end_saved = 0;

    while i < len {
        let char_code = bytes[i];
        let is_space = is_whitespace(char_code);

        match state {
            WHITESPACE => {
                if !is_space {
                    state = NAME;
                    name_start = i;
                }
            }
            NAME => {
                if char_code == EQUALS_CHAR || is_space {
                    name_end = i;
                    name_start_saved = name_start;
                    name_end_saved = name_end;
                    state = if char_code == EQUALS_CHAR { BEFORE_VALUE } else { AFTER_NAME };
                }
            }
            AFTER_NAME => {
                if char_code == EQUALS_CHAR {
                    state = BEFORE_VALUE;
                } else if !is_space {
                    let raw = &attr_str[name_start_saved..name_end_saved];
                    let name = if raw.bytes().any(|b| b.is_ascii_uppercase()) {
                        raw.to_ascii_lowercase()
                    } else {
                        raw.to_string()
                    };
                    result.insert(name, String::new());
                    state = NAME;
                    name_start = i;
                }
            }
            BEFORE_VALUE => {
                if !is_space {
                    if char_code == QUOTE_CHAR || char_code == APOS_CHAR {
                        state = QUOTED_VALUE;
                        quote_char = char_code;
                        value_start = i + 1;
                    } else {
                        state = UNQUOTED_VALUE;
                        value_start = i;
                    }
                }
            }
            QUOTED_VALUE => {
                if char_code == quote_char {
                    let raw = &attr_str[name_start_saved..name_end_saved];
                    let name = if raw.bytes().any(|b| b.is_ascii_uppercase()) {
                        raw.to_ascii_lowercase()
                    } else {
                        raw.to_string()
                    };
                    result.insert(name, decode_html_entities(&attr_str[value_start..i]).into_owned());
                    state = WHITESPACE;
                }
            }
            UNQUOTED_VALUE => {
                if is_space {
                    let raw = &attr_str[name_start_saved..name_end_saved];
                    let name = if raw.bytes().any(|b| b.is_ascii_uppercase()) {
                        raw.to_ascii_lowercase()
                    } else {
                        raw.to_string()
                    };
                    result.insert(name, decode_html_entities(&attr_str[value_start..i]).into_owned());
                    state = WHITESPACE;
                }
            }
            _ => {}
        }
        i += 1;
    }

    if state == NAME {
        let raw = &attr_str[name_start..];
        let lc = if raw.bytes().any(|b| b.is_ascii_uppercase()) { raw.to_ascii_lowercase() } else { raw.to_string() };
        result.insert(lc, String::new());
    } else if state == UNQUOTED_VALUE {
        let raw = &attr_str[name_start_saved..name_end_saved];
        let name = if raw.bytes().any(|b| b.is_ascii_uppercase()) { raw.to_ascii_lowercase() } else { raw.to_string() };
        result.insert(name, decode_html_entities(&attr_str[value_start..]).into_owned());
    } else if state == AFTER_NAME {
        let raw = &attr_str[name_start_saved..name_end_saved];
        let name = if raw.bytes().any(|b| b.is_ascii_uppercase()) { raw.to_ascii_lowercase() } else { raw.to_string() };
        result.insert(name, String::new());
    }

    result
}

struct CloseTagResult {
    complete: bool,
    new_position: usize,
    remaining_text: String,
}

fn process_closing_tag<F>(html_chunk: &str, position: usize, state: &mut ParseState, options: Option<&crate::types::HTMLToMarkdownOptions>, mut handle_event: F) -> CloseTagResult
where
    F: FnMut(NodeEvent, &[ElementNode], &[u8; MAX_TAG_ID]),
{
    let mut i = position + 2;
    let tag_name_start = i;
    let bytes = html_chunk.as_bytes();
    let chunk_length = bytes.len();

    let mut found_close = false;
    while i < chunk_length {
        if bytes[i] == GT_CHAR {
            found_close = true;
            break;
        }
        i += 1;
    }

    if !found_close {
        return CloseTagResult {
            complete: false,
            new_position: position,
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

    if let Some(curr) = state.stack.last() {
        if curr.is_non_nesting && curr.tag_id != tag_id {
            return CloseTagResult {
                complete: false,
                new_position: position,
                remaining_text: html_chunk[position..].to_string(),
            };
        }
    }

    // Pop nodes until we match tag_id
    if state.stack.last().is_some() {
        let mut pop_count = 0;
        for j in (0..state.stack.len()).rev() {
            pop_count += 1;
            if state.stack[j].tag_id == tag_id {
                break;
            }
        }
        for _ in 0..pop_count {
            if !state.stack.is_empty() {
                close_node(state, options, &mut handle_event);
            }
        }
    }

    state.just_closed_tag = true;

    CloseTagResult {
        complete: true,
        new_position: i + 1,
        remaining_text: String::new(),
    }
}

fn close_node<F>(state: &mut ParseState, options: Option<&crate::types::HTMLToMarkdownOptions>, mut handle_event: F)
where
    F: FnMut(NodeEvent, &[ElementNode], &[u8; MAX_TAG_ID]),
{
    if state.stack.is_empty() {
        return;
    }

    // Extraction: finalize tracked elements at this depth
    if !state.extraction_tracked.is_empty() {
        let current_depth = state.stack.len();
        let mut i = 0;
        while i < state.extraction_tracked.len() {
            if state.extraction_tracked[i].stack_depth == current_depth {
                let tracked = state.extraction_tracked.swap_remove(i);
                state.extraction_results.push(ExtractedElement {
                    selector: tracked.selector,
                    tag_name: tracked.tag_name,
                    text_content: tracked.text_content.trim().to_string(),
                    attributes: tracked.attributes,
                });
            } else {
                i += 1;
            }
        }
    }

    // clone node so we don't have borrow issue with Event handling
    let popping_index = state.stack.len() - 1;
    let node = state.stack.pop().unwrap();

    // Update first_block_parent_index after pop
    if state.first_block_parent_index == Some(popping_index) {
        state.first_block_parent_index = None;
        for (idx, n) in state.stack.iter().enumerate().rev() {
            if !n.is_inline {
                state.first_block_parent_index = Some(idx);
                break;
            }
        }
        if state.first_block_parent_index.is_none() && !state.stack.is_empty() {
            state.first_block_parent_index = Some(0);
        }
    }

    // Update collapse depth counters after pop
    if node.collapses_inner_white_space && !node.excluded_from_markdown {
        if node.tag_id == Some(TAG_SPAN) {
            state.collapse_span_depth -= 1;
        } else {
            state.collapse_non_span_depth -= 1;
        }
    }
    
    // Apply isolateMain close
    if state.has_isolate_main {
        if node.tag_id == Some(TAG_MAIN) && state.isolate_main_found && !state.isolate_main_closed {
            state.isolate_main_closed = true;
        }
    }
    if state.has_frontmatter {
        if let Some(f_opts) = options.and_then(|o| o.plugins.as_ref()).and_then(|p| p.frontmatter.as_ref()) {
            if node.tag_id == Some(TAG_HEAD) && state.frontmatter_in_head {
                    state.frontmatter_in_head = false;
                    
                    let mut yaml_lines = Vec::new();
                    
                    // Format function (simulated formatValue)
                    // we do basic escaping
                    let format_val = |val: &str| -> String {
                        let v = val.replace("\"", "\\\"");
                        if v.contains('\n') || v.contains(':') || v.contains('#') || v.contains(' ') {
                            format!("\"{}\"", v)
                        } else {
                            v
                        }
                    };
                    
                    if let Some(t) = &state.frontmatter_title {
                        yaml_lines.push(format!("title: {}", format_val(t)));
                    }
                    
                    if let Some(desc) = state.frontmatter_meta.get("description") {
                        yaml_lines.push(format!("description: {}", format_val(desc)));
                    }
                    
                    // merge additional fields
                    let mut all_fields = state.frontmatter_meta.clone();
                    if let Some(add) = &f_opts.additional_fields {
                        for (k, v) in add {
                            all_fields.insert(k.clone(), v.clone());
                        }
                    }
                    
                    // other top-level fields (we assume everything else is `meta` unless they were additional fields? Wait, JS version puts additionalFields at top level, and ALL meta tags in `meta:`)
                    let mut top_level: Vec<(String, String)> = Vec::new();
                    if let Some(add) = &f_opts.additional_fields {
                        for (k, v) in add {
                            top_level.push((k.clone(), v.clone()));
                        }
                    }
                    top_level.sort_by(|a, b| a.0.cmp(&b.0));
                    for (k, v) in top_level {
                        yaml_lines.push(format!("{}: {}", k, format_val(&v)));
                    }
                    
                    // remove description since we added it to top level explicitly? Wait! JS version puts description at top level if it's in top_level? No, wait!
                    // Let's check JS version!
                    // JS `frontmatter` data type:
                    // `const frontmatter: FrontmatterData = { ...additionalFields, meta: {} }`
                    // THEN it puts all `TAG_META` into `frontmatter.meta`!
                    // Then when generating YAML, it maps `frontmatter.title` and `frontmatter.description` first (if they exist).
                    // WAIT! `frontmatter.description`? Meta tags go into `frontmatter.meta['description']`.
                    // The JS YAML generator sorts keys of `frontmatter`, which has `title` and `meta` and `additionalFields`!
                    // So `description` would only be top-level if provided in `additionalFields`!
                    // Let's be precise: Top level is `title`, `meta`, and `additionalFields`.
                    
                    let mut yaml_out = Vec::new();
                    if let Some(t) = &state.frontmatter_title {
                        yaml_out.push(format!("title: {}", format_val(t)));
                    }
                    
                    // add additional fields
                    if let Some(add) = &f_opts.additional_fields {
                        let mut keys: Vec<_> = add.keys().collect();
                        keys.sort();
                        for key in keys {
                            if key != "title" && key != "description" {
                                yaml_out.push(format!("{}: {}", key, format_val(add.get(key).unwrap())));
                            }
                        }
                    }
                    
                    if !state.frontmatter_meta.is_empty() {
                        yaml_out.push("meta:".to_string());
                        let mut meta_keys: Vec<_> = state.frontmatter_meta.keys().collect();
                        meta_keys.sort();
                        for key in meta_keys {
                            let k_fmt = if key.contains(':') { format!("\"{}\"", key) } else { key.clone() };
                            yaml_out.push(format!("  {}: {}", k_fmt, format_val(state.frontmatter_meta.get(key).unwrap())));
                        }
                    }
                    
                    if !yaml_out.is_empty() {
                        let frontmatter_content = format!("---\n{}\n---\n\n", yaml_out.join("\n"));
                        handle_event(NodeEvent::Frontmatter(frontmatter_content), &state.stack, &state.depth_map);
                    }
                }
            }
        }

    // special handling empty links
    if node.tag_id == Some(TAG_A) && node.child_text_node_index == 0 {
        let prefix = node.attributes.get("title").or_else(|| node.attributes.get("aria-label")).cloned().unwrap_or_default();
        if !prefix.is_empty() {
            let node_depth = node.depth;
            let node_tag_id = node.tag_id;
            let mut modified_node = node;
            modified_node.child_text_node_index = 1;
            let text_node = TextNode {
                value: prefix,
                depth: node_depth + 1,
                index: 0,
                contains_whitespace: false,
                excluded_from_markdown: false,
            };
            state.stack.push(modified_node);
            handle_event(NodeEvent::EnterText(&text_node), &state.stack, &state.depth_map);

            for prev in state.stack.iter_mut() {
                prev.child_text_node_index += 1;
            }
            let modified_node2 = state.stack.pop().unwrap();
            handle_event(NodeEvent::ExitElement(&modified_node2), &state.stack, &state.depth_map);
            if let Some(id) = node_tag_id {
                state.depth_map[id as usize] = state.depth_map[id as usize].saturating_sub(1);
                match id {
                    TAG_TABLE => { if state.depth_map[id as usize] == 0 { state.escape_ctx &= !ESC_TABLE; } }
                    TAG_CODE => { if state.depth_map[TAG_CODE as usize] == 0 && state.depth_map[TAG_PRE as usize] == 0 { state.escape_ctx &= !ESC_CODE_PRE; } }
                    TAG_PRE => { if state.depth_map[TAG_PRE as usize] == 0 { state.in_pre = false; if state.depth_map[TAG_CODE as usize] == 0 { state.escape_ctx &= !ESC_CODE_PRE; } } }
                    TAG_A => { if state.depth_map[id as usize] == 0 { state.escape_ctx &= !ESC_LINK; } }
                    TAG_BLOCKQUOTE => { if state.depth_map[id as usize] == 0 { state.escape_ctx &= !ESC_BLOCKQUOTE; } }
                    _ => {}
                }
            }
            state.depth -= 1;
            state.has_encoded_html_entity = false;
            state.just_closed_tag = true;
            state.in_non_nesting = state.stack.last().map_or(false, |n| n.is_non_nesting);
            return;
        }
    }

    handle_event(NodeEvent::ExitElement(&node), &state.stack, &state.depth_map);

    if let Some(id) = node.tag_id {
        state.depth_map[id as usize] = state.depth_map[id as usize].saturating_sub(1);
        // Update escape context bitmask — clear bit when depth reaches 0
        match id {
            TAG_TABLE => { if state.depth_map[id as usize] == 0 { state.escape_ctx &= !ESC_TABLE; } }
            TAG_CODE => { if state.depth_map[TAG_CODE as usize] == 0 && state.depth_map[TAG_PRE as usize] == 0 { state.escape_ctx &= !ESC_CODE_PRE; } }
            TAG_PRE => { if state.depth_map[TAG_PRE as usize] == 0 { state.in_pre = false; if state.depth_map[TAG_CODE as usize] == 0 { state.escape_ctx &= !ESC_CODE_PRE; } } }
            TAG_A => { if state.depth_map[id as usize] == 0 { state.escape_ctx &= !ESC_LINK; } }
            TAG_BLOCKQUOTE => { if state.depth_map[id as usize] == 0 { state.escape_ctx &= !ESC_BLOCKQUOTE; } }
            _ => {}
        }
    }

    if node.is_non_nesting {
        state.in_single_quote = false;
        state.in_double_quote = false;
        state.in_backtick = false;
        state.last_char_was_backslash = false;
    }

    // Restore in_non_nesting from new top-of-stack
    state.in_non_nesting = state.stack.last().map_or(false, |n| n.is_non_nesting);

    state.depth -= 1;
    state.has_encoded_html_entity = false;
    state.just_closed_tag = true;
}
