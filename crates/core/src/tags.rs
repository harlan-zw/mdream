use std::sync::LazyLock;
use crate::consts::*;
use crate::types::TagHandler;

impl Default for TagHandler {
    fn default() -> Self {
        Self {
            is_self_closing: false,
            is_non_nesting: false,
            collapses_inner_white_space: false,
            is_inline: false,
            spacing: None,
            excludes_text_nodes: false,
            needs_attributes: false,
        }
    }
}

// Static handler table - metadata only, no fn pointers.
// Enter/exit output is generated via match on tag_id in convert.rs.
static TAG_HANDLERS: LazyLock<[Option<TagHandler>; MAX_TAG_ID]> = LazyLock::new(|| {
    let mut table: [Option<TagHandler>; MAX_TAG_ID] = std::array::from_fn(|_| None);

    table[TAG_HEAD as usize] = Some(TagHandler {
        spacing: Some(NO_SPACING),
        collapses_inner_white_space: true,
        ..Default::default()
    });
    table[TAG_DETAILS as usize] = Some(TagHandler::default());
    table[TAG_SUMMARY as usize] = Some(TagHandler::default());
    table[TAG_TITLE as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        is_non_nesting: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_SCRIPT as usize] = Some(TagHandler {
        excludes_text_nodes: true,
        is_non_nesting: true,
        ..Default::default()
    });
    table[TAG_STYLE as usize] = Some(TagHandler {
        is_non_nesting: true,
        excludes_text_nodes: true,
        ..Default::default()
    });
    table[TAG_META as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        is_self_closing: true,
        spacing: Some(NO_SPACING),
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_BR as usize] = Some(TagHandler {
        is_self_closing: true,
        spacing: Some(NO_SPACING),
        collapses_inner_white_space: true,
        is_inline: true,
        ..Default::default()
    });

    let heading = TagHandler { collapses_inner_white_space: true, ..Default::default() };
    table[TAG_H1 as usize] = Some(TagHandler { ..heading });
    table[TAG_H2 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H3 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H4 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H5 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H6 as usize] = Some(TagHandler { collapses_inner_white_space: true, ..Default::default() });

    table[TAG_HR as usize] = Some(TagHandler {
        is_self_closing: true,
        ..Default::default()
    });
    table[TAG_STRONG as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_B as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_EM as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_I as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_DEL as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_SUB as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_SUP as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_INS as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_BLOCKQUOTE as usize] = Some(TagHandler {
        spacing: Some(BLOCKQUOTE_SPACING),
        ..Default::default()
    });
    table[TAG_CODE as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_UL as usize] = Some(TagHandler::default());
    table[TAG_LI as usize] = Some(TagHandler {
        spacing: Some(LIST_ITEM_SPACING),
        ..Default::default()
    });
    table[TAG_A as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_IMG as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        is_self_closing: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_TABLE as usize] = Some(TagHandler::default());
    table[TAG_THEAD as usize] = Some(TagHandler {
        spacing: Some(TABLE_ROW_SPACING),
        excludes_text_nodes: true,
        ..Default::default()
    });
    table[TAG_TR as usize] = Some(TagHandler {
        excludes_text_nodes: true,
        spacing: Some(TABLE_ROW_SPACING),
        ..Default::default()
    });
    table[TAG_TH as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        needs_attributes: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_TD as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_P as usize] = Some(TagHandler::default());
    table[TAG_DIV as usize] = Some(TagHandler::default());
    table[TAG_SPAN as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_NAV as usize] = Some(TagHandler::default());
    table[TAG_LABEL as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_BUTTON as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        is_inline: true,
        ..Default::default()
    });
    table[TAG_BODY as usize] = Some(TagHandler { spacing: Some(NO_SPACING), ..Default::default() });
    table[TAG_CENTER as usize] = Some(TagHandler {
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_TBODY as usize] = Some(TagHandler {
        spacing: Some(NO_SPACING),
        excludes_text_nodes: true,
        ..Default::default()
    });
    table[TAG_TFOOT as usize] = Some(TagHandler {
        spacing: Some(TABLE_ROW_SPACING),
        excludes_text_nodes: true,
        ..Default::default()
    });
    table[TAG_KBD as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_OL as usize] = Some(TagHandler::default());
    table[TAG_PRE as usize] = Some(TagHandler::default());

    for id in [TAG_FOOTER, TAG_FORM] {
        table[id as usize] = Some(TagHandler { spacing: Some(NO_SPACING), ..Default::default() });
    }
    for id in [TAG_COL, TAG_EMBED, TAG_PARAM, TAG_SOURCE, TAG_TRACK] {
        table[id as usize] = Some(TagHandler { spacing: Some(NO_SPACING), is_self_closing: true, ..Default::default() });
    }
    for id in [TAG_LINK, TAG_AREA, TAG_BASE, TAG_WBR, TAG_INPUT, TAG_KEYGEN] {
        table[id as usize] = Some(TagHandler {
            is_self_closing: true,
            spacing: Some(NO_SPACING),
            is_inline: true,
            collapses_inner_white_space: true,
            ..Default::default()
        });
    }
    for id in [TAG_SVG, TAG_SELECT, TAG_FIELDSET, TAG_LEGEND, TAG_AUDIO, TAG_VIDEO, TAG_CANVAS, TAG_MAP, TAG_DIALOG, TAG_METER, TAG_PROGRESS, TAG_TEMPLATE] {
        table[id as usize] = Some(TagHandler { spacing: Some(NO_SPACING), ..Default::default() });
    }
    for id in [TAG_TEXTAREA, TAG_OPTION, TAG_IFRAME, TAG_NOFRAMES, TAG_XMP, TAG_PLAINTEXT] {
        table[id as usize] = Some(TagHandler {
            is_non_nesting: true,
            spacing: Some(NO_SPACING),
            ..Default::default()
        });
    }
    for id in [TAG_ABBR, TAG_SMALL, TAG_TIME, TAG_BDO, TAG_RUBY, TAG_RT, TAG_RP] {
        table[id as usize] = Some(TagHandler {
            collapses_inner_white_space: true,
            spacing: Some(NO_SPACING),
            is_inline: true,
            ..Default::default()
        });
    }

    table[TAG_MARK as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_Q as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    for id in [TAG_SAMP, TAG_VAR] {
        table[id as usize] = Some(TagHandler {
            collapses_inner_white_space: true,
            spacing: Some(NO_SPACING),
            is_inline: true,
            ..Default::default()
        });
    }
    table[TAG_NOSCRIPT as usize] = Some(TagHandler {
        excludes_text_nodes: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_ASIDE as usize] = Some(TagHandler { spacing: Some(NO_SPACING), ..Default::default() });
    table[TAG_U as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_CITE as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_DFN as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_ADDRESS as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_DL as usize] = Some(TagHandler {
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_DT as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some([0, 1]),
        ..Default::default()
    });
    table[TAG_ARTICLE as usize] = Some(TagHandler::default());
    table[TAG_SECTION as usize] = Some(TagHandler::default());
    table[TAG_HEADER as usize] = Some(TagHandler::default());
    table[TAG_MAIN as usize] = Some(TagHandler::default());
    table[TAG_FIGURE as usize] = Some(TagHandler::default());
    table[TAG_FIGCAPTION as usize] = Some(TagHandler {
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_DD as usize] = Some(TagHandler {
        spacing: Some([0, 1]),
        ..Default::default()
    });

    table
});

/// Get tag handler by ID from static lookup table. O(1), no allocation.
#[inline]
pub fn get_tag_handler(tag_id: u8) -> Option<&'static TagHandler> {
    if (tag_id as usize) < MAX_TAG_ID {
        TAG_HANDLERS[tag_id as usize].as_ref()
    } else {
        None
    }
}
