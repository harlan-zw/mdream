use std::borrow::Cow;
use std::sync::LazyLock;
use crate::consts::*;
use crate::types::{HandlerContext, TagHandler};

fn resolve_url(url: &str, origin: Option<&str>) -> String {
    if url.is_empty() {
        return url.to_string();
    }
    if url.starts_with("//") {
        return format!("https:{}", url);
    }
    if url.starts_with('#') {
        return url.to_string();
    }
    if let Some(orig) = origin {
        if url.starts_with('/') {
            let clean_origin = orig.trim_end_matches('/');
            return format!("{}{}", clean_origin, url);
        }
        if url.starts_with("./") {
            return format!("{}/{}", orig, &url[2..]);
        }
        if !url.starts_with("http") {
            let clean_url = url.strip_prefix('/').unwrap_or(url);
            return format!("{}/{}", orig, clean_url);
        }
    }
    url.to_string()
}

fn is_inside_table_cell(ctx: &HandlerContext) -> bool {
    ctx.depth_map[TAG_TD as usize] > 0
}

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

static HEADING_PREFIXES: [&str; 6] = ["# ", "## ", "### ", "#### ", "##### ", "###### "];

impl Default for TagHandler {
    fn default() -> Self {
        Self {
            enter: None,
            exit: None,
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

// Strong and Emphasis are shared
fn enter_strong(ctx: &HandlerContext) -> Option<Cow<'static, str>> {
    if ctx.depth_map[TAG_B as usize] > 1 {
        return Some(Cow::Borrowed(""));
    }
    Some(Cow::Borrowed(MARKDOWN_STRONG))
}
fn exit_strong(ctx: &HandlerContext) -> Option<Cow<'static, str>> {
    if ctx.depth_map[TAG_B as usize] > 1 {
        return Some(Cow::Borrowed(""));
    }
    Some(Cow::Borrowed(MARKDOWN_STRONG))
}

fn enter_emphasis(ctx: &HandlerContext) -> Option<Cow<'static, str>> {
    if ctx.depth_map[TAG_I as usize] > 1 {
        return Some(Cow::Borrowed(""));
    }
    Some(Cow::Borrowed(MARKDOWN_EMPHASIS))
}
fn exit_emphasis(ctx: &HandlerContext) -> Option<Cow<'static, str>> {
    if ctx.depth_map[TAG_I as usize] > 1 {
        return Some(Cow::Borrowed(""));
    }
    Some(Cow::Borrowed(MARKDOWN_EMPHASIS))
}

fn enter_heading(ctx: &HandlerContext) -> Option<Cow<'static, str>> {
    let depth = (ctx.node.tag_id.unwrap_or(TAG_H1) - TAG_H1) as usize;
    if ctx.depth_map[TAG_A as usize] > 0 {
        Some(Cow::Owned(format!("<h{}>", depth + 1)))
    } else {
        Some(Cow::Borrowed(HEADING_PREFIXES[depth]))
    }
}

fn exit_heading(ctx: &HandlerContext) -> Option<Cow<'static, str>> {
    let depth = (ctx.node.tag_id.unwrap_or(TAG_H1) - TAG_H1 + 1) as usize;
    if ctx.depth_map[TAG_A as usize] > 0 {
        Some(Cow::Owned(format!("</h{}>", depth)))
    } else {
        None
    }
}

fn handle_heading() -> TagHandler {
    TagHandler {
        enter: Some(enter_heading),
        exit: Some(exit_heading),
        collapses_inner_white_space: true,
        ..Default::default()
    }
}

// Static handler table - constructed once, referenced forever
static TAG_HANDLERS: LazyLock<[Option<TagHandler>; MAX_TAG_ID]> = LazyLock::new(|| {
    let mut table: [Option<TagHandler>; MAX_TAG_ID] = std::array::from_fn(|_| None);

    table[TAG_HEAD as usize] = Some(TagHandler {
        spacing: Some(NO_SPACING),
        collapses_inner_white_space: true,
        ..Default::default()
    });
    table[TAG_DETAILS as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<details>"))),
        exit: Some(|_| Some(Cow::Borrowed("</details>\n\n"))),
        ..Default::default()
    });
    table[TAG_SUMMARY as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<summary>"))),
        exit: Some(|_| Some(Cow::Borrowed("</summary>\n\n"))),
        ..Default::default()
    });
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
        enter: Some(|ctx| {
            if is_inside_table_cell(ctx) {
                Some(Cow::Borrowed("<br>"))
            } else {
                None
            }
        }),
        is_self_closing: true,
        spacing: Some(NO_SPACING),
        collapses_inner_white_space: true,
        is_inline: true,
        ..Default::default()
    });

    let heading = handle_heading();
    table[TAG_H1 as usize] = Some(TagHandler { ..heading });
    // Clone heading for each - TagHandler is Copy-like (fn pointers + bools)
    table[TAG_H2 as usize] = Some(TagHandler { enter: heading.enter, exit: heading.exit, collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H3 as usize] = Some(TagHandler { enter: heading.enter, exit: heading.exit, collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H4 as usize] = Some(TagHandler { enter: heading.enter, exit: heading.exit, collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H5 as usize] = Some(TagHandler { enter: heading.enter, exit: heading.exit, collapses_inner_white_space: true, ..Default::default() });
    table[TAG_H6 as usize] = Some(TagHandler { enter: heading.enter, exit: heading.exit, collapses_inner_white_space: true, ..Default::default() });

    table[TAG_HR as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed(MARKDOWN_HORIZONTAL_RULE))),
        is_self_closing: true,
        ..Default::default()
    });
    table[TAG_STRONG as usize] = Some(TagHandler {
        enter: Some(enter_strong),
        exit: Some(exit_strong),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_B as usize] = Some(TagHandler {
        enter: Some(enter_strong),
        exit: Some(exit_strong),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_EM as usize] = Some(TagHandler {
        enter: Some(enter_emphasis),
        exit: Some(exit_emphasis),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_I as usize] = Some(TagHandler {
        enter: Some(enter_emphasis),
        exit: Some(exit_emphasis),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_DEL as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH))),
        exit: Some(|_| Some(Cow::Borrowed(MARKDOWN_STRIKETHROUGH))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_SUB as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<sub>"))),
        exit: Some(|_| Some(Cow::Borrowed("</sub>"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_SUP as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<sup>"))),
        exit: Some(|_| Some(Cow::Borrowed("</sup>"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_INS as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<ins>"))),
        exit: Some(|_| Some(Cow::Borrowed("</ins>"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_BLOCKQUOTE as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            let depth = std::cmp::max(1, ctx.depth_map[TAG_BLOCKQUOTE as usize]);
            let mut prefix = "> ".repeat(depth as usize);
            if ctx.depth_map[TAG_LI as usize] > 0 {
                let indent = "  ".repeat(ctx.depth_map[TAG_LI as usize] as usize);
                prefix = format!("\n{}{}", indent, prefix);
            }
            Some(Cow::Owned(prefix))
        }),
        spacing: Some(BLOCKQUOTE_SPACING),
        ..Default::default()
    });
    table[TAG_CODE as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if ctx.depth_map[TAG_PRE as usize] > 0 {
                let lang = get_language_from_class(ctx.node.attributes.get("class"));
                Some(Cow::Owned(format!("{}{}\n", MARKDOWN_CODE_BLOCK, lang)))
            } else {
                Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
            }
        }),
        exit: Some(|ctx| {
            if ctx.depth_map[TAG_PRE as usize] > 0 {
                Some(Cow::Borrowed("\n```"))
            } else {
                Some(Cow::Borrowed(MARKDOWN_INLINE_CODE))
            }
        }),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_UL as usize] = Some(TagHandler {
        enter: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("<ul>")) } else { None }),
        exit: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("</ul>")) } else { None }),
        ..Default::default()
    });
    table[TAG_LI as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if is_inside_table_cell(ctx) {
                return Some(Cow::Borrowed("<li>"));
            }
            let ul_depth = ctx.depth_map[TAG_UL as usize];
            let ol_depth = ctx.depth_map[TAG_OL as usize];
            let depth = if ul_depth + ol_depth > 0 { (ul_depth + ol_depth - 1) as usize } else { 0 };
            let is_ordered = ctx.depth_map[TAG_OL as usize] > 0 && ctx.ancestors.last().map(|p| p.tag_id == Some(TAG_OL)).unwrap_or(false);
            let indent = "  ".repeat(depth);
            let marker = if is_ordered { format!("{}. ", ctx.node.index + 1) } else { "- ".to_string() };
            Some(Cow::Owned(format!("{}{}", indent, marker)))
        }),
        exit: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("</li>")) } else { None }),
        spacing: Some(LIST_ITEM_SPACING),
        ..Default::default()
    });
    table[TAG_A as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if ctx.node.attributes.contains_key("href") { Some(Cow::Borrowed("[")) } else { None }
        }),
        exit: Some(|ctx| {
            if let Some(href) = ctx.node.attributes.get("href") {
                let resolved_href = resolve_url(href, ctx.options.origin.as_deref());
                let mut title = ctx.node.attributes.get("title").map(|s| s.as_str()).unwrap_or("");
                if let Some(cache) = ctx.last_content_cache {
                    if cache == title {
                        title = "";
                    }
                }
                if !title.is_empty() {
                    Some(Cow::Owned(format!("]({} \"{}\")", resolved_href, title)))
                } else {
                    Some(Cow::Owned(format!("]({})", resolved_href)))
                }
            } else {
                Some(Cow::Borrowed(""))
            }
        }),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_IMG as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            let alt = ctx.node.attributes.get("alt").map(|s| s.as_str()).unwrap_or("");
            let src = ctx.node.attributes.get("src").map(|s| s.as_str()).unwrap_or("");
            let resolved_src = resolve_url(src, ctx.options.origin.as_deref());
            Some(Cow::Owned(format!("![{}]({})", alt, resolved_src)))
        }),
        collapses_inner_white_space: true,
        is_self_closing: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        needs_attributes: true,
        ..Default::default()
    });
    table[TAG_TABLE as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if is_inside_table_cell(ctx) { return Some(Cow::Borrowed("<table>")); }
            None
        }),
        exit: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("</table>")) } else { None }),
        ..Default::default()
    });
    table[TAG_THEAD as usize] = Some(TagHandler {
        enter: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("<thead>")) } else { None }),
        exit: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("</thead>")) } else { None }),
        spacing: Some(TABLE_ROW_SPACING),
        excludes_text_nodes: true,
        ..Default::default()
    });
    table[TAG_TR as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if is_inside_table_cell(ctx) { return Some(Cow::Borrowed("<tr>")); }
            Some(Cow::Borrowed("| "))
        }),
        exit: Some(|ctx| {
            if is_inside_table_cell(ctx) || ctx.depth_map[TAG_TABLE as usize] > 1 {
                return Some(Cow::Borrowed("</tr>"));
            }
            Some(Cow::Borrowed(" |"))
        }),
        excludes_text_nodes: true,
        spacing: Some(TABLE_ROW_SPACING),
        ..Default::default()
    });
    table[TAG_TH as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if ctx.depth_map[TAG_TABLE as usize] > 1 { return Some(Cow::Borrowed("<th>")); }
            if ctx.node.index == 0 { Some(Cow::Borrowed("")) } else { Some(Cow::Borrowed(" | ")) }
        }),
        exit: Some(|ctx| {
            if ctx.depth_map[TAG_TABLE as usize] > 1 { return Some(Cow::Borrowed("</th>")); }
            None
        }),
        collapses_inner_white_space: true,
        needs_attributes: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_TD as usize] = Some(TagHandler {
        enter: Some(|ctx| {
            if ctx.depth_map[TAG_TABLE as usize] > 1 { return Some(Cow::Borrowed("<td>")); }
            if ctx.node.index == 0 { Some(Cow::Borrowed("")) } else { Some(Cow::Borrowed(" | ")) }
        }),
        exit: Some(|ctx| {
            if ctx.depth_map[TAG_TABLE as usize] > 1 { return Some(Cow::Borrowed("</td>")); }
            None
        }),
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
        enter: Some(|ctx| if ctx.depth_map[TAG_TABLE as usize] > 1 { Some(Cow::Borrowed("<center>")) } else { None }),
        exit: Some(|ctx| if ctx.depth_map[TAG_TABLE as usize] > 1 { Some(Cow::Borrowed("</center>")) } else { None }),
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
        enter: Some(|_| Some(Cow::Borrowed("`"))),
        exit: Some(|_| Some(Cow::Borrowed("`"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_OL as usize] = Some(TagHandler {
        enter: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("<ol>")) } else { None }),
        exit: Some(|ctx| if is_inside_table_cell(ctx) { Some(Cow::Borrowed("</ol>")) } else { None }),
        ..Default::default()
    });
    table[TAG_PRE as usize] = Some(TagHandler {
        ..Default::default()
    });

    // Grouped handlers
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
            enter: Some(|_| Some(Cow::Borrowed(""))),
            exit: Some(|_| Some(Cow::Borrowed(""))),
            collapses_inner_white_space: true,
            spacing: Some(NO_SPACING),
            is_inline: true,
            ..Default::default()
        });
    }

    table[TAG_MARK as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<mark>"))),
        exit: Some(|_| Some(Cow::Borrowed("</mark>"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_Q as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("\""))),
        exit: Some(|_| Some(Cow::Borrowed("\""))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    for id in [TAG_SAMP, TAG_VAR] {
        table[id as usize] = Some(TagHandler {
            enter: Some(|_| Some(Cow::Borrowed("`"))),
            exit: Some(|_| Some(Cow::Borrowed("`"))),
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
        enter: Some(|_| Some(Cow::Borrowed("<u>"))),
        exit: Some(|_| Some(Cow::Borrowed("</u>"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_CITE as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("*"))),
        exit: Some(|_| Some(Cow::Borrowed("*"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_DFN as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("**"))),
        exit: Some(|_| Some(Cow::Borrowed("**"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_ADDRESS as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<address>"))),
        exit: Some(|_| Some(Cow::Borrowed("</address>"))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_DL as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<dl>"))),
        exit: Some(|_| Some(Cow::Borrowed("</dl>"))),
        spacing: Some(NO_SPACING),
        ..Default::default()
    });
    table[TAG_DT as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<dt>"))),
        exit: Some(|_| Some(Cow::Borrowed("</dt>"))),
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
        enter: Some(|_| Some(Cow::Borrowed(MARKDOWN_EMPHASIS))),
        exit: Some(|_| Some(Cow::Borrowed(MARKDOWN_EMPHASIS))),
        collapses_inner_white_space: true,
        spacing: Some(NO_SPACING),
        is_inline: true,
        ..Default::default()
    });
    table[TAG_DD as usize] = Some(TagHandler {
        enter: Some(|_| Some(Cow::Borrowed("<dd>"))),
        exit: Some(|_| Some(Cow::Borrowed("</dd>"))),
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
