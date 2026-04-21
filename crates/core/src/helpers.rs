use std::borrow::Cow;
use crate::consts::*;
use crate::entities::lookup_named_entity;
use crate::types::{Attributes, ElementNode, ParsedSelector};

/// Tracked element during extraction — maps stack depth to accumulator
pub(crate) struct TrackedExtraction {
    pub(crate) selector: String,
    pub(crate) stack_depth: usize,
    pub(crate) text_content: String,
    pub(crate) tag_name: String,
    pub(crate) attributes: Vec<(String, String)>,
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
            // Numeric character references: &#NNN; or &#xHHH;
            if i + 2 < len && bytes[i + 1] == b'#' {
                let start = i;
                i += 2;
                let is_hex = i < len && (bytes[i] == b'x' || bytes[i] == b'X');
                if is_hex {
                    i += 1;
                }
                let num_start = i;
                // Cap digit scan: 7 hex digits (U+10FFFF) or 8 decimal (max codepoint)
                let max_digits = if is_hex { 7 } else { 8 };
                let scan_limit = len.min(num_start + max_digits + 1);
                while i < scan_limit && bytes[i] != b';' {
                    i += 1;
                }
                if i < len && bytes[i] == b';' && i > num_start {
                    let num_str = &text[num_start..i];
                    let base = if is_hex { 16 } else { 10 };
                    if let Ok(code_point) = u32::from_str_radix(num_str, base) {
                        if let Some(c) = char::from_u32(code_point) {
                            result.push(c);
                            i += 1;
                            continue;
                        }
                    }
                }
                i = start;
            } else {
                // Named entity: scan forward up to 33 bytes for ';'
                let mut semi = i + 1;
                let scan_end = len.min(i + 34);
                while semi < scan_end && bytes[semi] != b';' {
                    semi += 1;
                }
                if semi < len && bytes[semi] == b';' && semi > i + 1 {
                    let name = &bytes[i + 1..semi];
                    if let Some(c) = lookup_named_entity(name) {
                        result.push(c);
                        i = semi + 1;
                        continue;
                    }
                }
            }
            // No entity matched — push literal '&'
            result.push('&');
            i += 1;
            continue;
        }
        // Batch copy plain ASCII bytes until next '&' or non-ASCII
        let start = i;
        while i < len && bytes[i] != b'&' && bytes[i] < 0x80 {
            i += 1;
        }
        if i > start {
            result.push_str(&text[start..i]);
        }
        if i >= len { break; }
        // Handle non-ASCII multi-byte UTF-8 char
        if bytes[i] >= 0x80 {
            let Some(ch) = text[i..].chars().next() else { break; };
            result.push(ch);
            i += ch.len_utf8();
        }
    }
    result
}

pub(crate) struct CommentResult {
    pub(crate) complete: bool,
    pub(crate) new_position: usize,
    /// Start offset into html_chunk for remaining text (only meaningful when !complete)
    pub(crate) remaining_start: usize,
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
                return CommentResult { complete: true, new_position: i, remaining_start: 0 };
            }
            i += 1;
        }
        CommentResult { complete: false, new_position: position, remaining_start: position }
    } else {
        i += 2;
        while i < chunk_length {
            if bytes[i] == GT_CHAR {
                i += 1;
                return CommentResult { complete: true, new_position: i, remaining_start: 0 };
            }
            i += 1;
        }
        CommentResult { complete: false, new_position: i, remaining_start: position }
    }
}

pub(crate) fn process_tag_attributes(html_chunk: &str, position: usize, tag_handler: Option<&crate::types::TagHandler>, skip_attrs: bool) -> (bool, usize, Attributes, bool) {
    let mut i = position;
    let bytes = html_chunk.as_bytes();
    let chunk_length = bytes.len();

    let self_closing = tag_handler.is_some_and(|h| h.is_self_closing);
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

#[allow(clippy::collapsible_match)]
pub(crate) fn parse_attributes(attr_str: &str) -> Attributes {
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

// ── CSS Selector parsing ──

pub(crate) fn parse_css_selector(selector: &str) -> ParsedSelector {
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
            if in_attr {
                current.push(ch);
                in_attr = false;
                parts.push(parse_attr_selector(&current));
                current.clear();
            }
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
        parts.into_iter().next().unwrap_or(ParsedSelector::Tag(String::new()))
    } else {
        ParsedSelector::Compound(parts)
    }
}

fn parse_simple_selector(s: &str) -> ParsedSelector {
    if let Some(class) = s.strip_prefix('.') {
        ParsedSelector::Class(class.to_string())
    } else if let Some(id) = s.strip_prefix('#') {
        ParsedSelector::Id(id.to_string())
    } else {
        ParsedSelector::Tag(s.to_string())
    }
}

fn parse_attr_selector(s: &str) -> ParsedSelector {
    if s.len() < 2 {
        return ParsedSelector::Tag(s.to_string());
    }
    let inner = &s[1..s.len() - 1];
    let operators = ["^=", "$=", "*=", "~=", "|=", "="];
    for op in &operators {
        if let Some(pos) = inner.find(op) {
            let name = inner[..pos].to_string();
            let val = inner[pos + op.len()..].trim_matches(|c| c == '"' || c == '\'').to_string();
            return ParsedSelector::Attribute { name, operator: Some((*op).to_string()), value: Some(val) };
        }
    }
    ParsedSelector::Attribute { name: inner.to_string(), operator: None, value: None }
}

pub(crate) fn matches_selector(tag: &ElementNode, selector: &ParsedSelector) -> bool {
    match selector {
        ParsedSelector::Tag(name) => tag.name() == name,
        ParsedSelector::Class(class_name) => {
            tag.attributes.get("class").is_some_and(|c| {
                c.split_whitespace().any(|cls| cls == class_name)
            })
        }
        ParsedSelector::Id(id) => {
            tag.attributes.get("id").is_some_and(|v| v == id)
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
                        (Some("|="), Some(v)) => attr_val == v || attr_val.starts_with(&format!("{v}-")),
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

// ── Tailwind helpers ──

#[inline]
fn extract_base_class(class: &str) -> (&str, &str) {
    let breakpoints = ["sm:", "md:", "lg:", "xl:", "2xl:"];
    for bp in breakpoints {
        if let Some(rest) = class.strip_prefix(bp) {
            return (rest, bp);
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
