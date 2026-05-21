//! Low-level HTML scanning primitives: whitespace, comments, tag attributes.

use crate::consts::*;
use crate::types::Attributes;
use crate::entities::decode_html_entities;

/// Whitespace check optimized for the hot character loop.
/// Uses a 33-bit bitmap: space(32), CR(13), LF(10), TAB(9).
#[inline(always)]
pub(crate) fn is_whitespace(c: u8) -> bool {
    if c > 32 { return false; }
    // Bitmap: bit 9 (tab), bit 10 (LF), bit 13 (CR), bit 32 (space)
    const MASK: u64 = (1u64 << 9) | (1u64 << 10) | (1u64 << 13) | (1u64 << 32);
    (MASK >> c) & 1 == 1
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
                    // Single-pass lowercase: the result is owned either way,
                    // so the uppercase pre-scan would only add a redundant pass.
                    let name = raw.to_ascii_lowercase();
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
                    // Single-pass lowercase: the result is owned either way,
                    // so the uppercase pre-scan would only add a redundant pass.
                    let name = raw.to_ascii_lowercase();
                    result.insert(name, decode_html_entities(&attr_str[value_start..i]).into_owned());
                    state = WHITESPACE;
                }
            }
            UNQUOTED_VALUE => {
                if is_space {
                    let raw = &attr_str[name_start_saved..name_end_saved];
                    // Single-pass lowercase: the result is owned either way,
                    // so the uppercase pre-scan would only add a redundant pass.
                    let name = raw.to_ascii_lowercase();
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
        let lc = raw.to_ascii_lowercase();
        result.insert(lc, String::new());
    } else if state == UNQUOTED_VALUE {
        let raw = &attr_str[name_start_saved..name_end_saved];
        let name = raw.to_ascii_lowercase();
        result.insert(name, decode_html_entities(&attr_str[value_start..]).into_owned());
    } else if state == AFTER_NAME {
        let raw = &attr_str[name_start_saved..name_end_saved];
        let name = raw.to_ascii_lowercase();
        result.insert(name, String::new());
    }

    result
}
