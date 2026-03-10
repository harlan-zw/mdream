use crate::consts::*;
use crate::tags::get_tag_handler;
use crate::types::{Attributes, ElementNode, NodeEvent, TextNode};
use std::collections::HashMap;

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
    
    // Stack of active elements
    pub stack: Vec<ElementNode>,
    
    // Plugin tracking
    pub isolate_main_found: bool,
    pub isolate_main_closed: bool,
    pub isolate_first_header_depth: Option<usize>,
    pub isolate_after_footer: bool,
    
    pub frontmatter_in_head: bool,
    pub frontmatter_title: Option<String>,
    pub frontmatter_meta: HashMap<String, String>,
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
            stack: Vec::with_capacity(32),
            
            isolate_main_found: false,
            isolate_main_closed: false,
            isolate_first_header_depth: None,
            isolate_after_footer: false,
            
            frontmatter_in_head: false,
            frontmatter_title: None,
            frontmatter_meta: HashMap::new(),
        }
    }
}

#[inline]
fn is_whitespace(c: u8) -> bool {
    c == SPACE_CHAR || c == TAB_CHAR || c == NEWLINE_CHAR || c == CARRIAGE_RETURN_CHAR
}

use std::borrow::Cow;

#[inline]
fn decode_html_entities(text: &str) -> Cow<str> {
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
    F: FnMut(NodeEvent, &[ElementNode]),
{
    let mut text_buffer = String::with_capacity(256);
    let bytes = chunk.as_bytes();
    let chunk_length = bytes.len();
    let mut i = 0;

    let get_tag_id_from_name = |name: &str| -> Option<u8> {
        crate::consts::get_tag_id(name)
    };

    while i < chunk_length {
        let current_char_code = bytes[i];

        if current_char_code != LT_CHAR {
            if current_char_code == AMPERSAND_CHAR {
                state.has_encoded_html_entity = true;
            }

            if is_whitespace(current_char_code) {
                let in_pre_tag = state.depth_map[TAG_PRE as usize] > 0;

                if state.just_closed_tag {
                    state.just_closed_tag = false;
                    state.last_char_was_whitespace = false;
                }

                if !in_pre_tag && state.last_char_was_whitespace {
                    i += 1;
                    continue;
                }

                if in_pre_tag {
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

                if current_char_code == PIPE_CHAR && state.depth_map[TAG_TABLE as usize] > 0 {
                    text_buffer.push_str("\\|");
                } else if current_char_code == BACKTICK_CHAR && (state.depth_map[TAG_CODE as usize] > 0 || state.depth_map[TAG_PRE as usize] > 0) {
                    text_buffer.push_str("\\`");
                } else if current_char_code == OPEN_BRACKET_CHAR && state.depth_map[TAG_A as usize] > 0 {
                    text_buffer.push_str("\\[");
                } else if current_char_code == CLOSE_BRACKET_CHAR && state.depth_map[TAG_A as usize] > 0 {
                    text_buffer.push_str("\\]");
                } else if current_char_code == GT_CHAR && state.depth_map[TAG_BLOCKQUOTE as usize] > 0 {
                    text_buffer.push_str("\\>");
                } else {
                    text_buffer.push(current_char_code as char);
                }

                if let Some(current_node) = state.stack.last() {
                    let tag_handler = current_node.tag_id.and_then(get_tag_handler);
                    if tag_handler.map_or(false, |h| h.is_non_nesting) {
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
            
            let is_non_nesting = state.stack.last()
                .and_then(|n| n.tag_id.and_then(get_tag_handler))
                .map_or(false, |h| h.is_non_nesting);

            if is_non_nesting && in_quotes {
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
                i = tag_name_end;
                break;
            }
            // Fast path: check if already lowercase (most HTML is)
            let tag_name = if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
                tag_name_raw.to_ascii_lowercase()
            } else {
                tag_name_raw.to_string()
            };

            let tag_id = get_tag_id_from_name(&tag_name);
            i2 = tag_name_end;

            let is_non_nesting = state.stack.last()
                .and_then(|n| n.tag_id.and_then(get_tag_handler))
                .map_or(false, |h| h.is_non_nesting);

            let in_quotes = state.in_single_quote || state.in_double_quote || state.in_backtick;

            if is_non_nesting {
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

struct CommentResult {
    complete: bool,
    new_position: usize,
    remaining_text: String,
}

fn process_comment_or_doctype(html_chunk: &str, position: usize) -> CommentResult {
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

fn process_text_buffer<F>(text_buffer: &mut String, state: &mut ParseState, options: Option<&crate::types::HTMLToMarkdownOptions>, mut handle_event: F)
where
    F: FnMut(NodeEvent, &[ElementNode]),
{
    let contains_non_whitespace = state.text_buffer_contains_non_whitespace;
    let contains_whitespace = state.text_buffer_contains_whitespace;
    state.text_buffer_contains_non_whitespace = false;
    state.text_buffer_contains_whitespace = false;

    if state.stack.is_empty() {
        return;
    }

    let handler_excludes_text = state.stack.last().and_then(|n| n.tag_id.and_then(get_tag_handler)).map_or(false, |h| h.excludes_text_nodes);
    let parent_excluded = state.stack.last().map_or(false, |n| n.excluded_from_markdown);
    let mut excludes_text_nodes = handler_excludes_text || parent_excluded;
    
    // Apply isolate_main logic for text nodes
    if let Some(opts) = options {
        if let Some(plugins) = &opts.plugins {
            if plugins.isolate_main.is_some() {
                if state.isolate_main_found {
                    if state.isolate_main_closed {
                        excludes_text_nodes = true;
                    }
                } else {
                    if state.isolate_first_header_depth.is_none() {
                        if state.depth_map[TAG_HEAD as usize] == 0 {
                            excludes_text_nodes = true;
                        }
                    } else if state.isolate_after_footer {
                        excludes_text_nodes = true;
                    }
                }
            }
        }
    }
    
    // Apply frontmatter title extraction
    if let Some(opts) = options {
        if opts.plugins.as_ref().and_then(|p| p.frontmatter.as_ref()).is_some() {
            if state.frontmatter_in_head && state.stack.last().map_or(false, |p| p.tag_id == Some(TAG_TITLE)) {
                let val = text_buffer.trim().to_string();
                if !val.is_empty() {
                    state.frontmatter_title = Some(val);
                }
                return; // skip text inside title tag as per plugin design
            }
        }
    }

    let in_pre_tag = state.depth_map[TAG_PRE as usize] > 0;

    let child_text_node_index = state.stack.last().map(|n| n.child_text_node_index).unwrap_or(0);
    
    if !in_pre_tag && !contains_non_whitespace && child_text_node_index == 0 {
        return;
    }

    if text_buffer.is_empty() {
        return;
    }

    let mut first_block_parent_index = None;
    if !state.stack.is_empty() {
        for (idx, node) in state.stack.iter().enumerate().rev() {
            let is_inline = node.tag_id.and_then(get_tag_handler).map_or(false, |h| h.is_inline);
            if !is_inline {
                first_block_parent_index = Some(idx);
                break;
            }
        }
        if first_block_parent_index.is_none() {
            first_block_parent_index = Some(0);
        }
    }

    let first_block_child_text_count = first_block_parent_index.map(|idx| state.stack[idx].child_text_node_index).unwrap_or(0);

    let mut text = std::mem::take(text_buffer);
    if contains_whitespace && first_block_child_text_count == 0 {
        let mut start = 0;
        let bytes = text.as_bytes();
        while start < bytes.len() && (if in_pre_tag { bytes[start] == NEWLINE_CHAR || bytes[start] == CARRIAGE_RETURN_CHAR } else { is_whitespace(bytes[start]) }) {
            start += 1;
        }
        if start > 0 {
            text = text[start..].to_string();
        }
    }

    if state.has_encoded_html_entity {
        text = decode_html_entities(&text).into_owned();
        state.has_encoded_html_entity = false;
    }
    
    // Apply Tailwind prefix/suffix
    if let Some(opts) = options {
        if opts.plugins.as_ref().and_then(|p| p.tailwind.as_ref()).is_some() {
            if let Some(parent) = state.stack.last() {
                if parent.tailwind_hidden {
                    excludes_text_nodes = true;
                } else if !excludes_text_nodes {
                    let mut modified = false;
                    let mut new_text = String::new();
                    if let Some(p) = &parent.tailwind_prefix {
                        new_text.push_str(p);
                        modified = true;
                    }
                    new_text.push_str(&text);
                    if let Some(s) = &parent.tailwind_suffix {
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

    if let Some(parent) = state.stack.last() {
        let text_node = TextNode {
            value: text,
            depth: state.depth,
            index: parent.current_walk_index,
            contains_whitespace,
            excluded_from_markdown: excludes_text_nodes,
        };

        if !excludes_text_nodes {
            handle_event(NodeEvent::EnterText(&text_node), &state.stack);
        }
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

fn process_tailwind_classes(classes_attr: &str) -> (Option<String>, Option<String>, bool) {
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

fn fix_redundant_delimiters(content: &str) -> String {
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
    F: FnMut(NodeEvent, &[ElementNode]),
{
    // check non-nesting
    if let Some(curr) = state.stack.last() {
        if curr.tag_id.and_then(get_tag_handler).map_or(false, |h| h.is_non_nesting) {
            // Can't close from here easily due to ownership without passing handle_event,
            // but this is mostly handled by caller since `state.stack.push` hasn't happened yet.
        }
    }

    let tag_handler = tag_id.and_then(get_tag_handler);
    let (complete, new_position, attributes, self_closing, attr_buffer) = process_tag_attributes(html_chunk, position, tag_handler);

    if !complete {
        return OpeningTagResult {
            complete: false,
            new_position: position,
            remaining_text: format!("<{}{}", tag_name, attr_buffer),
            self_closing: false,
            skip: false,
        };
    }

    if let Some(id) = tag_id {
        state.depth_map[id as usize] += 1;
    }
    state.depth += 1;
    let i = new_position;

    let current_walk_index = state.stack.last().map(|n| n.current_walk_index).unwrap_or(0);

    let mut tag = ElementNode {
        name: tag_name.to_string(),
        attributes,
        tag_id,
        depth_map: state.depth_map,
        depth: state.depth,
        index: current_walk_index,
        current_walk_index: 0,
        child_text_node_index: 0,
        contains_whitespace: false,
        excluded_from_markdown: false,
        tailwind_prefix: None,
        tailwind_suffix: None,
        tailwind_hidden: false,
    };

    let mut skip_node = false;
    let mut filter_excluded = false;

    if let Some(opts) = options {
        if opts.plugins.as_ref().and_then(|p| p.tailwind.as_ref()).is_some() {
            if let Some(class_attr) = tag.attributes.get("class") {
                let (prefix, suffix, hidden) = process_tailwind_classes(class_attr);
                tag.tailwind_prefix = prefix;
                tag.tailwind_suffix = suffix;
                tag.tailwind_hidden = hidden;
                if hidden {
                    skip_node = true;
                }
            }
        }
        
        if let Some(plugins) = &opts.plugins {
            if let Some(filter) = &plugins.filter {
                // If the element has absolute/fixed positioning, skip it
                if let Some(style) = tag.attributes.get("style") {
                    if style.contains("absolute") || style.contains("fixed") {
                        skip_node = true;
                    }
                }

                if !skip_node {
                    // Check exclusion
                    if let Some(excl) = &filter.exclude {
                        for selector in excl {
                            // Simple tag exact match support (ignoring full CSS query parsing for now)
                            if selector == &tag.name {
                                skip_node = true;
                                filter_excluded = true;
                                break;
                            }
                            // Class matching
                            if selector.starts_with('.') {
                                let class_name = &selector[1..];
                                if let Some(class_attr) = tag.attributes.get("class") {
                                    if class_attr.split_whitespace().any(|c| c == class_name) {
                                        skip_node = true;
                                        filter_excluded = true;
                                        break;
                                    }
                                }
                            }
                            // ID matching
                            if selector.starts_with('#') {
                                let id_name = &selector[1..];
                                if let Some(id_attr) = tag.attributes.get("id") {
                                    if id_attr == id_name {
                                        skip_node = true;
                                        filter_excluded = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                // Check ancestor exclusion
                if !skip_node {
                    if let Some(excl) = &filter.exclude {
                        for parent in state.stack.iter() {
                            for selector in excl {
                                if selector == &parent.name {
                                    skip_node = true;
                                    filter_excluded = true;
                                    break;
                                }
                                if selector.starts_with('.') {
                                    let class_name = &selector[1..];
                                    if let Some(class_attr) = parent.attributes.get("class") {
                                        if class_attr.split_whitespace().any(|c| c == class_name) {
                                            skip_node = true;
                                            filter_excluded = true;
                                            break;
                                        }
                                    }
                                }
                                if selector.starts_with('#') {
                                    if let Some(id_attr) = parent.attributes.get("id") {
                                        if id_attr == &selector[1..] {
                                            skip_node = true;
                                            filter_excluded = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if skip_node { break; }
                        }
                    }
                }

                // Check inclusion
                if !skip_node {
                    if let Some(incl) = &filter.include {
                        if !incl.is_empty() {
                            let mut match_found = false;
                        
                        // Check current tag
                        for selector in incl {
                            if selector == &tag.name {
                                match_found = true;
                                break;
                            }
                            if selector.starts_with('.') {
                                let class_name = &selector[1..];
                                if let Some(class_attr) = tag.attributes.get("class") {
                                    if class_attr.split_whitespace().any(|c| c == class_name) {
                                        match_found = true;
                                        break;
                                    }
                                }
                            }
                            if selector.starts_with('#') {
                                if let Some(id_attr) = tag.attributes.get("id") {
                                    if id_attr == &selector[1..] {
                                        match_found = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if !match_found && filter.process_children.unwrap_or(true) {
                            for parent in state.stack.iter() {
                                for selector in incl {
                                    if selector == &parent.name {
                                        match_found = true;
                                        break;
                                    }
                                    if selector.starts_with('.') {
                                        let class_name = &selector[1..];
                                        if let Some(class_attr) = parent.attributes.get("class") {
                                            if class_attr.split_whitespace().any(|c| c == class_name) {
                                                match_found = true;
                                                break;
                                            }
                                        }
                                    }
                                    if selector.starts_with('#') {
                                        if let Some(id_attr) = parent.attributes.get("id") {
                                            if id_attr == &selector[1..] {
                                                match_found = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if match_found { break; }
                            }
                        }
                        
                        // If include list is not empty and no match was found, we must skip this node
                        if !match_found {
                           skip_node = true; 
                        }
                    }
                    }
                }
            }
            
            // Apply isolateMain
            if let Some(_isolate_opts) = &plugins.isolate_main {
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
            if let Some(opts) = &plugins.frontmatter {
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
                                if let Some(allowed) = &opts.meta_fields {
                                    if allowed.iter().any(|a| a == n_str) {
                                        is_allowed = true;
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
    }

    tag.excluded_from_markdown = filter_excluded;

    if let Some(mut last) = state.stack.last_mut() {
        last.current_walk_index += 1;
    }

    state.stack.push(tag);

    if !skip_node {
        handle_event(NodeEvent::EnterElement(state.stack.last().unwrap()), &state.stack);
    }

    state.has_encoded_html_entity = false;

    if tag_handler.map_or(false, |h| h.is_non_nesting) && !self_closing {
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

fn process_tag_attributes(html_chunk: &str, position: usize, tag_handler: Option<&crate::types::TagHandler>) -> (bool, usize, Attributes, bool, String) {
    let mut i = position;
    let bytes = html_chunk.as_bytes();
    let chunk_length = bytes.len();

    let self_closing = tag_handler.map_or(false, |h| h.is_self_closing);
    let attr_start_pos = i;
    let mut inside_quote = false;
    let mut quote_char = 0;
    let mut prev_char = 0;

    while i < chunk_length {
        let c = bytes[i];

        if inside_quote {
            if c == quote_char && prev_char != BACKSLASH_CHAR {
                inside_quote = false;
            }
            i += 1;
            continue;
        } else if c == QUOTE_CHAR || c == APOS_CHAR {
            inside_quote = true;
            quote_char = c;
        } else if c == SLASH_CHAR && i + 1 < chunk_length && bytes[i + 1] == GT_CHAR {
            let attr_str = html_chunk[attr_start_pos..i].trim().to_string();
            return (
                true,
                i + 2,
                parse_attributes(&attr_str),
                true,
                attr_str,
            );
        } else if c == GT_CHAR {
            let attr_str = html_chunk[attr_start_pos..i].trim().to_string();
            return (
                true,
                i + 1,
                parse_attributes(&attr_str),
                self_closing,
                attr_str,
            );
        }

        i += 1;
        prev_char = c;
    }

    (
        false,
        i,
        Attributes::new(),
        false,
        html_chunk[attr_start_pos..i].to_string(),
    )
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
    let mut name_end = 0;
    let mut value_start = 0;
    let mut quote_char = 0;
    let mut name = String::new();

    while i < len {
        let char_code = bytes[i];
        let is_space = is_whitespace(char_code);

        match state {
            WHITESPACE => {
                if !is_space {
                    state = NAME;
                    name_start = i;
                    name_end = 0;
                }
            }
            NAME => {
                if char_code == EQUALS_CHAR || is_space {
                    name_end = i;
                    let raw = &attr_str[name_start..name_end];
                    name = if raw.bytes().any(|b| b.is_ascii_uppercase()) {
                        raw.to_ascii_lowercase()
                    } else {
                        raw.to_string()
                    };
                    state = if char_code == EQUALS_CHAR { BEFORE_VALUE } else { AFTER_NAME };
                }
            }
            AFTER_NAME => {
                if char_code == EQUALS_CHAR {
                    state = BEFORE_VALUE;
                } else if !is_space {
                    result.insert(name.clone(), String::new());
                    state = NAME;
                    name_start = i;
                    name_end = 0;
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
                    result.insert(name.clone(), decode_html_entities(&attr_str[value_start..i]).into_owned());
                    state = WHITESPACE;
                }
            }
            UNQUOTED_VALUE => {
                if is_space {
                    result.insert(name.clone(), decode_html_entities(&attr_str[value_start..i]).into_owned());
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
        result.insert(name, decode_html_entities(&attr_str[value_start..]).into_owned());
    } else if state == AFTER_NAME {
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
    F: FnMut(NodeEvent, &[ElementNode]),
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
    let tag_name = if tag_name_raw.bytes().any(|b| b.is_ascii_uppercase()) {
        tag_name_raw.to_ascii_lowercase()
    } else {
        tag_name_raw.to_string()
    };
    let tag_id = crate::consts::get_tag_id(&tag_name);

    if let Some(curr) = state.stack.last() {
        if curr.tag_id.and_then(get_tag_handler).map_or(false, |h| h.is_non_nesting) && curr.tag_id != tag_id {
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
    F: FnMut(NodeEvent, &[ElementNode]),
{
    if state.stack.is_empty() {
        return;
    }

    // clone node so we don't have borrow issue with Event handling
    let node = state.stack.pop().unwrap();
    
    // Apply isolateMain close
    if let Some(opts) = options {
        if let Some(plugins) = &opts.plugins {
            if plugins.isolate_main.is_some() {
                if node.tag_id == Some(TAG_MAIN) && state.isolate_main_found && !state.isolate_main_closed {
                    // check if the closing main is actually the one we opened
                    state.isolate_main_closed = true;
                }
            }
            if let Some(f_opts) = &plugins.frontmatter {
                if node.tag_id == Some(TAG_HEAD) && state.frontmatter_in_head {
                    state.frontmatter_in_head = false;
                    
                    let mut yaml_lines = Vec::new();
                    
                    // Format function (simulated formatValue)
                    // we do basic escaping
                    let format_val = |val: &str| -> String {
                        let mut v = val.replace("\"", "\\\"");
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
                        handle_event(NodeEvent::Frontmatter(frontmatter_content), &state.stack);
                    }
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
            handle_event(NodeEvent::EnterText(&text_node), &state.stack);

            for prev in state.stack.iter_mut() {
                prev.child_text_node_index += 1;
            }
            let modified_node2 = state.stack.pop().unwrap();
            handle_event(NodeEvent::ExitElement(&modified_node2), &state.stack);
            if let Some(id) = node_tag_id {
                state.depth_map[id as usize] = state.depth_map[id as usize].saturating_sub(1);
            }
            state.depth -= 1;
            state.has_encoded_html_entity = false;
            state.just_closed_tag = true;
            return;
        }
    }

    handle_event(NodeEvent::ExitElement(&node), &state.stack);

    if let Some(id) = node.tag_id {
        state.depth_map[id as usize] = state.depth_map[id as usize].saturating_sub(1);
    }

    if node.tag_id.and_then(get_tag_handler).map_or(false, |h| h.is_non_nesting) {
        state.in_single_quote = false;
        state.in_double_quote = false;
        state.in_backtick = false;
        state.last_char_was_backslash = false;
    }

    state.depth -= 1;
    state.has_encoded_html_entity = false;
    state.just_closed_tag = true;
}
