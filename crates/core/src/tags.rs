use crate::consts::*;
use crate::types::TagHandler;

const NONE: TagHandler = TagHandler {
    is_self_closing: false,
    is_non_nesting: false,
    collapses_inner_white_space: false,
    is_inline: false,
    spacing: None,
    excludes_text_nodes: false,
    needs_attributes: false,
};

const BLOCK: TagHandler = NONE;

const BLOCK_NO_SPACING: TagHandler = TagHandler { spacing: Some(NO_SPACING), ..NONE };

const INLINE_COLLAPSE: TagHandler = TagHandler {
    collapses_inner_white_space: true,
    spacing: Some(NO_SPACING),
    is_inline: true,
    ..NONE
};

const SELF_CLOSING_INLINE: TagHandler = TagHandler {
    is_self_closing: true,
    spacing: Some(NO_SPACING),
    is_inline: true,
    collapses_inner_white_space: true,
    ..NONE
};

const SELF_CLOSING_BLOCK: TagHandler = TagHandler {
    is_self_closing: true,
    spacing: Some(NO_SPACING),
    ..NONE
};

const NON_NESTING_NO_SPACING: TagHandler = TagHandler {
    is_non_nesting: true,
    spacing: Some(NO_SPACING),
    ..NONE
};

// Compile-time tag handler table. No runtime init, no LazyLock, no indirection.
static TAG_HANDLERS: [Option<TagHandler>; MAX_TAG_ID] = {
    let mut t: [Option<TagHandler>; MAX_TAG_ID] = [None; MAX_TAG_ID];

    // HEAD
    t[TAG_HEAD as usize] = Some(TagHandler { collapses_inner_white_space: true, spacing: Some(NO_SPACING), ..NONE });
    t[TAG_DETAILS as usize] = Some(BLOCK);
    t[TAG_SUMMARY as usize] = Some(BLOCK);
    t[TAG_TITLE as usize] = Some(TagHandler { collapses_inner_white_space: true, is_non_nesting: true, spacing: Some(NO_SPACING), ..NONE });
    t[TAG_SCRIPT as usize] = Some(TagHandler { excludes_text_nodes: true, is_non_nesting: true, ..NONE });
    t[TAG_STYLE as usize] = Some(TagHandler { is_non_nesting: true, excludes_text_nodes: true, ..NONE });
    t[TAG_META as usize] = Some(TagHandler { collapses_inner_white_space: true, is_self_closing: true, spacing: Some(NO_SPACING), needs_attributes: true, ..NONE });
    t[TAG_BR as usize] = Some(TagHandler { is_self_closing: true, spacing: Some(NO_SPACING), collapses_inner_white_space: true, is_inline: true, ..NONE });

    // Headings
    t[TAG_H1 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..NONE });
    t[TAG_H2 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..NONE });
    t[TAG_H3 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..NONE });
    t[TAG_H4 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..NONE });
    t[TAG_H5 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..NONE });
    t[TAG_H6 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..NONE });

    t[TAG_HR as usize] = Some(TagHandler { is_self_closing: true, ..NONE });

    // Inline formatting
    t[TAG_STRONG as usize] = Some(INLINE_COLLAPSE);
    t[TAG_B as usize] = Some(INLINE_COLLAPSE);
    t[TAG_EM as usize] = Some(INLINE_COLLAPSE);
    t[TAG_I as usize] = Some(INLINE_COLLAPSE);
    t[TAG_DEL as usize] = Some(INLINE_COLLAPSE);
    t[TAG_SUB as usize] = Some(INLINE_COLLAPSE);
    t[TAG_SUP as usize] = Some(INLINE_COLLAPSE);
    t[TAG_INS as usize] = Some(INLINE_COLLAPSE);

    t[TAG_BLOCKQUOTE as usize] = Some(TagHandler { spacing: Some(BLOCKQUOTE_SPACING), ..NONE });
    t[TAG_CODE as usize] = Some(TagHandler { collapses_inner_white_space: true, spacing: Some(NO_SPACING), is_inline: true, needs_attributes: true, ..NONE });

    // Lists
    t[TAG_UL as usize] = Some(BLOCK);
    t[TAG_OL as usize] = Some(BLOCK);
    t[TAG_LI as usize] = Some(TagHandler { spacing: Some(LIST_ITEM_SPACING), ..NONE });

    // Links & images
    t[TAG_A as usize] = Some(TagHandler { collapses_inner_white_space: true, spacing: Some(NO_SPACING), is_inline: true, needs_attributes: true, ..NONE });
    t[TAG_IMG as usize] = Some(TagHandler { collapses_inner_white_space: true, is_self_closing: true, spacing: Some(NO_SPACING), is_inline: true, needs_attributes: true, ..NONE });

    // Tables
    t[TAG_TABLE as usize] = Some(BLOCK);
    t[TAG_THEAD as usize] = Some(TagHandler { spacing: Some(TABLE_ROW_SPACING), excludes_text_nodes: true, ..NONE });
    t[TAG_TR as usize] = Some(TagHandler { excludes_text_nodes: true, spacing: Some(TABLE_ROW_SPACING), ..NONE });
    t[TAG_TH as usize] = Some(TagHandler { collapses_inner_white_space: true, needs_attributes: true, spacing: Some(NO_SPACING), ..NONE });
    t[TAG_TD as usize] = Some(TagHandler { collapses_inner_white_space: true, spacing: Some(NO_SPACING), ..NONE });
    t[TAG_TBODY as usize] = Some(TagHandler { spacing: Some(NO_SPACING), excludes_text_nodes: true, ..NONE });
    t[TAG_TFOOT as usize] = Some(TagHandler { spacing: Some(TABLE_ROW_SPACING), excludes_text_nodes: true, ..NONE });

    // Block elements
    t[TAG_P as usize] = Some(BLOCK);
    t[TAG_DIV as usize] = Some(BLOCK);
    t[TAG_NAV as usize] = Some(BLOCK);
    t[TAG_ARTICLE as usize] = Some(BLOCK);
    t[TAG_SECTION as usize] = Some(BLOCK);
    t[TAG_HEADER as usize] = Some(BLOCK);
    t[TAG_MAIN as usize] = Some(BLOCK);
    t[TAG_FIGURE as usize] = Some(BLOCK);
    t[TAG_PRE as usize] = Some(BLOCK);

    // Inline elements
    t[TAG_SPAN as usize] = Some(INLINE_COLLAPSE);
    t[TAG_LABEL as usize] = Some(INLINE_COLLAPSE);
    t[TAG_KBD as usize] = Some(INLINE_COLLAPSE);
    t[TAG_MARK as usize] = Some(INLINE_COLLAPSE);
    t[TAG_Q as usize] = Some(INLINE_COLLAPSE);
    t[TAG_SAMP as usize] = Some(INLINE_COLLAPSE);
    t[TAG_VAR as usize] = Some(INLINE_COLLAPSE);
    t[TAG_ABBR as usize] = Some(INLINE_COLLAPSE);
    t[TAG_SMALL as usize] = Some(INLINE_COLLAPSE);
    t[TAG_TIME as usize] = Some(INLINE_COLLAPSE);
    t[TAG_BDO as usize] = Some(INLINE_COLLAPSE);
    t[TAG_RUBY as usize] = Some(INLINE_COLLAPSE);
    t[TAG_RT as usize] = Some(INLINE_COLLAPSE);
    t[TAG_RP as usize] = Some(INLINE_COLLAPSE);
    t[TAG_U as usize] = Some(INLINE_COLLAPSE);
    t[TAG_CITE as usize] = Some(INLINE_COLLAPSE);
    t[TAG_DFN as usize] = Some(INLINE_COLLAPSE);
    t[TAG_FIGCAPTION as usize] = Some(INLINE_COLLAPSE);

    t[TAG_BUTTON as usize] = Some(TagHandler { collapses_inner_white_space: true, is_inline: true, ..NONE });

    // Block no-spacing
    t[TAG_BODY as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_CENTER as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_FOOTER as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_FORM as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_ASIDE as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_DL as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_ADDRESS as usize] = Some(TagHandler { collapses_inner_white_space: true, spacing: Some(NO_SPACING), ..NONE });

    // Definition list items
    t[TAG_DT as usize] = Some(TagHandler { collapses_inner_white_space: true, spacing: Some([0, 1]), ..NONE });
    t[TAG_DD as usize] = Some(TagHandler { spacing: Some([0, 1]), ..NONE });

    // Self-closing block elements
    t[TAG_COL as usize] = Some(SELF_CLOSING_BLOCK);
    t[TAG_EMBED as usize] = Some(SELF_CLOSING_BLOCK);
    t[TAG_PARAM as usize] = Some(SELF_CLOSING_BLOCK);
    t[TAG_SOURCE as usize] = Some(SELF_CLOSING_BLOCK);
    t[TAG_TRACK as usize] = Some(SELF_CLOSING_BLOCK);

    // Self-closing inline elements
    t[TAG_LINK as usize] = Some(SELF_CLOSING_INLINE);
    t[TAG_AREA as usize] = Some(SELF_CLOSING_INLINE);
    t[TAG_BASE as usize] = Some(SELF_CLOSING_INLINE);
    t[TAG_WBR as usize] = Some(SELF_CLOSING_INLINE);
    t[TAG_INPUT as usize] = Some(SELF_CLOSING_INLINE);
    t[TAG_KEYGEN as usize] = Some(SELF_CLOSING_INLINE);

    // Media/interactive (block no-spacing)
    t[TAG_SVG as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_SELECT as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_FIELDSET as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_LEGEND as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_AUDIO as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_VIDEO as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_CANVAS as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_MAP as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_DIALOG as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_METER as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_PROGRESS as usize] = Some(BLOCK_NO_SPACING);
    t[TAG_TEMPLATE as usize] = Some(BLOCK_NO_SPACING);

    // Non-nesting elements
    t[TAG_TEXTAREA as usize] = Some(NON_NESTING_NO_SPACING);
    t[TAG_OPTION as usize] = Some(NON_NESTING_NO_SPACING);
    t[TAG_IFRAME as usize] = Some(NON_NESTING_NO_SPACING);
    t[TAG_NOFRAMES as usize] = Some(NON_NESTING_NO_SPACING);
    t[TAG_XMP as usize] = Some(NON_NESTING_NO_SPACING);
    t[TAG_PLAINTEXT as usize] = Some(NON_NESTING_NO_SPACING);

    t[TAG_NOSCRIPT as usize] = Some(TagHandler { excludes_text_nodes: true, spacing: Some(NO_SPACING), ..NONE });

    t
};

/// Get tag handler by ID from static lookup table. O(1), no allocation.
#[inline]
pub fn get_tag_handler(tag_id: u8) -> Option<&'static TagHandler> {
    if (tag_id as usize) < MAX_TAG_ID {
        TAG_HANDLERS[tag_id as usize].as_ref()
    } else {
        None
    }
}
