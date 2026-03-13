// Constants converted from const.ts

pub const TAG_HTML: u8 = 0;
pub const TAG_HEAD: u8 = 1;
pub const TAG_DETAILS: u8 = 2;
pub const TAG_SUMMARY: u8 = 3;
pub const TAG_TITLE: u8 = 4;
pub const TAG_META: u8 = 5;
pub const TAG_BR: u8 = 6;
pub const TAG_H1: u8 = 7;
pub const TAG_H2: u8 = 8;
pub const TAG_H3: u8 = 9;
pub const TAG_H4: u8 = 10;
pub const TAG_H5: u8 = 11;
pub const TAG_H6: u8 = 12;
pub const TAG_HR: u8 = 13;
pub const TAG_STRONG: u8 = 14;
pub const TAG_B: u8 = 15;
pub const TAG_EM: u8 = 16;
pub const TAG_I: u8 = 17;
pub const TAG_DEL: u8 = 18;
pub const TAG_SUB: u8 = 19;
pub const TAG_SUP: u8 = 20;
pub const TAG_INS: u8 = 21;
pub const TAG_BLOCKQUOTE: u8 = 22;
pub const TAG_CODE: u8 = 23;
pub const TAG_UL: u8 = 24;
pub const TAG_LI: u8 = 25;
pub const TAG_A: u8 = 26;
pub const TAG_IMG: u8 = 27;
pub const TAG_TABLE: u8 = 28;
pub const TAG_THEAD: u8 = 29;
pub const TAG_TR: u8 = 30;
pub const TAG_TH: u8 = 31;
pub const TAG_TD: u8 = 32;
pub const TAG_OL: u8 = 33;
pub const TAG_PRE: u8 = 34;
pub const TAG_P: u8 = 35;
pub const TAG_DIV: u8 = 36;
pub const TAG_SPAN: u8 = 37;
pub const TAG_TBODY: u8 = 38;
pub const TAG_TFOOT: u8 = 39;
pub const TAG_FORM: u8 = 40;
pub const TAG_NAV: u8 = 41;
pub const TAG_LABEL: u8 = 42;
pub const TAG_BUTTON: u8 = 43;
pub const TAG_BODY: u8 = 44;
pub const TAG_CENTER: u8 = 45;
pub const TAG_KBD: u8 = 46;
pub const TAG_FOOTER: u8 = 47;
pub const TAG_PATH: u8 = 48;
pub const TAG_SVG: u8 = 49;
pub const TAG_ARTICLE: u8 = 50;
pub const TAG_SECTION: u8 = 51;
pub const TAG_SCRIPT: u8 = 52;
pub const TAG_STYLE: u8 = 53;
pub const TAG_LINK: u8 = 54;
pub const TAG_AREA: u8 = 55;
pub const TAG_BASE: u8 = 56;
pub const TAG_COL: u8 = 57;
pub const TAG_EMBED: u8 = 58;
pub const TAG_INPUT: u8 = 59;
pub const TAG_KEYGEN: u8 = 60;
pub const TAG_PARAM: u8 = 61;
pub const TAG_SOURCE: u8 = 62;
pub const TAG_TRACK: u8 = 63;
pub const TAG_WBR: u8 = 64;
pub const TAG_SELECT: u8 = 65;
pub const TAG_TEXTAREA: u8 = 66;
pub const TAG_OPTION: u8 = 67;
pub const TAG_FIELDSET: u8 = 68;
pub const TAG_LEGEND: u8 = 69;
pub const TAG_AUDIO: u8 = 70;
pub const TAG_VIDEO: u8 = 71;
pub const TAG_CANVAS: u8 = 72;
pub const TAG_IFRAME: u8 = 73;
pub const TAG_MAP: u8 = 74;
pub const TAG_DIALOG: u8 = 75;
pub const TAG_METER: u8 = 76;
pub const TAG_PROGRESS: u8 = 77;
pub const TAG_TEMPLATE: u8 = 78;
pub const TAG_ABBR: u8 = 79;
pub const TAG_MARK: u8 = 80;
pub const TAG_Q: u8 = 81;
pub const TAG_SAMP: u8 = 82;
pub const TAG_SMALL: u8 = 83;
pub const TAG_NOSCRIPT: u8 = 84;
pub const TAG_NOFRAMES: u8 = 85;
pub const TAG_XMP: u8 = 86;
pub const TAG_PLAINTEXT: u8 = 87;
pub const TAG_ASIDE: u8 = 88;
pub const TAG_U: u8 = 89;
pub const TAG_CITE: u8 = 90;
pub const TAG_DFN: u8 = 91;
pub const TAG_VAR: u8 = 92;
pub const TAG_TIME: u8 = 93;
pub const TAG_BDO: u8 = 94;
pub const TAG_RUBY: u8 = 95;
pub const TAG_RT: u8 = 96;
pub const TAG_RP: u8 = 97;
pub const TAG_DD: u8 = 98;
pub const TAG_DT: u8 = 99;
pub const TAG_ADDRESS: u8 = 100;
pub const TAG_DL: u8 = 101;
pub const TAG_FIGURE: u8 = 102;
pub const TAG_OBJECT: u8 = 103;
pub const TAG_MAIN: u8 = 104;
pub const TAG_HEADER: u8 = 105;
pub const TAG_FIGCAPTION: u8 = 106;
pub const TAG_CAPTION: u8 = 107;

pub const MAX_TAG_ID: usize = 108;

/// Reverse lookup: tag ID → static tag name string.
/// Avoids allocating a String for known tags.
pub static TAG_NAMES: [&str; MAX_TAG_ID] = {
    let mut names = [""; MAX_TAG_ID];
    names[TAG_HTML as usize] = "html";
    names[TAG_HEAD as usize] = "head";
    names[TAG_DETAILS as usize] = "details";
    names[TAG_SUMMARY as usize] = "summary";
    names[TAG_TITLE as usize] = "title";
    names[TAG_META as usize] = "meta";
    names[TAG_BR as usize] = "br";
    names[TAG_H1 as usize] = "h1";
    names[TAG_H2 as usize] = "h2";
    names[TAG_H3 as usize] = "h3";
    names[TAG_H4 as usize] = "h4";
    names[TAG_H5 as usize] = "h5";
    names[TAG_H6 as usize] = "h6";
    names[TAG_HR as usize] = "hr";
    names[TAG_STRONG as usize] = "strong";
    names[TAG_B as usize] = "b";
    names[TAG_EM as usize] = "em";
    names[TAG_I as usize] = "i";
    names[TAG_DEL as usize] = "del";
    names[TAG_SUB as usize] = "sub";
    names[TAG_SUP as usize] = "sup";
    names[TAG_INS as usize] = "ins";
    names[TAG_BLOCKQUOTE as usize] = "blockquote";
    names[TAG_CODE as usize] = "code";
    names[TAG_UL as usize] = "ul";
    names[TAG_LI as usize] = "li";
    names[TAG_A as usize] = "a";
    names[TAG_IMG as usize] = "img";
    names[TAG_TABLE as usize] = "table";
    names[TAG_THEAD as usize] = "thead";
    names[TAG_TR as usize] = "tr";
    names[TAG_TH as usize] = "th";
    names[TAG_TD as usize] = "td";
    names[TAG_OL as usize] = "ol";
    names[TAG_PRE as usize] = "pre";
    names[TAG_P as usize] = "p";
    names[TAG_DIV as usize] = "div";
    names[TAG_SPAN as usize] = "span";
    names[TAG_TBODY as usize] = "tbody";
    names[TAG_TFOOT as usize] = "tfoot";
    names[TAG_FORM as usize] = "form";
    names[TAG_NAV as usize] = "nav";
    names[TAG_LABEL as usize] = "label";
    names[TAG_BUTTON as usize] = "button";
    names[TAG_BODY as usize] = "body";
    names[TAG_CENTER as usize] = "center";
    names[TAG_KBD as usize] = "kbd";
    names[TAG_FOOTER as usize] = "footer";
    names[TAG_PATH as usize] = "path";
    names[TAG_SVG as usize] = "svg";
    names[TAG_ARTICLE as usize] = "article";
    names[TAG_SECTION as usize] = "section";
    names[TAG_SCRIPT as usize] = "script";
    names[TAG_STYLE as usize] = "style";
    names[TAG_LINK as usize] = "link";
    names[TAG_AREA as usize] = "area";
    names[TAG_BASE as usize] = "base";
    names[TAG_COL as usize] = "col";
    names[TAG_EMBED as usize] = "embed";
    names[TAG_INPUT as usize] = "input";
    names[TAG_KEYGEN as usize] = "keygen";
    names[TAG_PARAM as usize] = "param";
    names[TAG_SOURCE as usize] = "source";
    names[TAG_TRACK as usize] = "track";
    names[TAG_WBR as usize] = "wbr";
    names[TAG_SELECT as usize] = "select";
    names[TAG_TEXTAREA as usize] = "textarea";
    names[TAG_OPTION as usize] = "option";
    names[TAG_FIELDSET as usize] = "fieldset";
    names[TAG_LEGEND as usize] = "legend";
    names[TAG_AUDIO as usize] = "audio";
    names[TAG_VIDEO as usize] = "video";
    names[TAG_CANVAS as usize] = "canvas";
    names[TAG_IFRAME as usize] = "iframe";
    names[TAG_MAP as usize] = "map";
    names[TAG_DIALOG as usize] = "dialog";
    names[TAG_METER as usize] = "meter";
    names[TAG_PROGRESS as usize] = "progress";
    names[TAG_TEMPLATE as usize] = "template";
    names[TAG_ABBR as usize] = "abbr";
    names[TAG_MARK as usize] = "mark";
    names[TAG_Q as usize] = "q";
    names[TAG_SAMP as usize] = "samp";
    names[TAG_SMALL as usize] = "small";
    names[TAG_NOSCRIPT as usize] = "noscript";
    names[TAG_NOFRAMES as usize] = "noframes";
    names[TAG_XMP as usize] = "xmp";
    names[TAG_PLAINTEXT as usize] = "plaintext";
    names[TAG_ASIDE as usize] = "aside";
    names[TAG_U as usize] = "u";
    names[TAG_CITE as usize] = "cite";
    names[TAG_DFN as usize] = "dfn";
    names[TAG_VAR as usize] = "var";
    names[TAG_TIME as usize] = "time";
    names[TAG_BDO as usize] = "bdo";
    names[TAG_RUBY as usize] = "ruby";
    names[TAG_RT as usize] = "rt";
    names[TAG_RP as usize] = "rp";
    names[TAG_DD as usize] = "dd";
    names[TAG_DT as usize] = "dt";
    names[TAG_ADDRESS as usize] = "address";
    names[TAG_DL as usize] = "dl";
    names[TAG_FIGURE as usize] = "figure";
    names[TAG_OBJECT as usize] = "object";
    names[TAG_MAIN as usize] = "main";
    names[TAG_HEADER as usize] = "header";
    names[TAG_FIGCAPTION as usize] = "figcaption";
    names[TAG_CAPTION as usize] = "caption";
    names
};

pub const ELEMENT_NODE: u8 = 1;
pub const TEXT_NODE: u8 = 2;

pub const MARKDOWN_STRONG: &str = "**";
pub const MARKDOWN_EMPHASIS: &str = "_";
pub const MARKDOWN_STRIKETHROUGH: &str = "~~";
pub const MARKDOWN_CODE_BLOCK: &str = "```";
pub const MARKDOWN_INLINE_CODE: &str = "`";
pub const MARKDOWN_HORIZONTAL_RULE: &str = "---";

pub const NO_SPACING: [u8; 2] = [0, 0];
pub const DEFAULT_BLOCK_SPACING: [u8; 2] = [2, 2];
pub const BLOCKQUOTE_SPACING: [u8; 2] = [1, 1];
pub const LIST_ITEM_SPACING: [u8; 2] = [1, 0];
pub const TABLE_ROW_SPACING: [u8; 2] = [0, 1];

pub const LT_CHAR: u8 = 60; // '<'
pub const GT_CHAR: u8 = 62; // '>'
pub const SLASH_CHAR: u8 = 47; // '/'
pub const EQUALS_CHAR: u8 = 61; // '='
pub const QUOTE_CHAR: u8 = 34; // '"'
pub const APOS_CHAR: u8 = 39; // '\''
pub const EXCLAMATION_CHAR: u8 = 33; // '!'
pub const AMPERSAND_CHAR: u8 = 38; // '&'
pub const BACKSLASH_CHAR: u8 = 92; // '\'
pub const DASH_CHAR: u8 = 45; // '-'
pub const SPACE_CHAR: u8 = 32; // ' '
pub const TAB_CHAR: u8 = 9; // '\t'
pub const NEWLINE_CHAR: u8 = 10; // '\n'
pub const CARRIAGE_RETURN_CHAR: u8 = 13; // '\r'
pub const BACKTICK_CHAR: u8 = 96; // '`'
pub const PIPE_CHAR: u8 = 124; // '|'
pub const OPEN_BRACKET_CHAR: u8 = 91; // '['
pub const CLOSE_BRACKET_CHAR: u8 = 93; // ']'

/// Fast tag name to ID lookup using first-byte dispatch + length checks.
/// Avoids string comparison overhead for common tags.
#[inline]
pub fn get_tag_id(name: &str) -> Option<u8> {
    let bytes = name.as_bytes();
    let len = bytes.len();
    if len == 0 || len > 10 {
        return None;
    }
    // Dispatch on first byte and length for fast rejection
    match (bytes[0], len) {
        (b'a', 1) => Some(TAG_A),
        (b'a', 4) if bytes[1] == b'b' => Some(TAG_ABBR), // abbr
        (b'a', 4) if bytes[1] == b'r' => Some(TAG_AREA), // area
        (b'a', 5) if bytes[1] == b's' => Some(TAG_ASIDE), // aside
        (b'a', 5) if bytes[1] == b'u' => Some(TAG_AUDIO), // audio
        (b'a', 7) if bytes[1] == b'r' => Some(TAG_ARTICLE),
        (b'a', 7) if bytes[1] == b'd' => Some(TAG_ADDRESS),
        (b'a', _) => None,
        (b'b', 1) => Some(TAG_B),
        (b'b', 2) if bytes[1] == b'r' => Some(TAG_BR),
        (b'b', 3) if bytes[1] == b'd' => Some(TAG_BDO),
        (b'b', 4) if bytes[1] == b'a' => Some(TAG_BASE),
        (b'b', 4) if bytes[1] == b'o' => Some(TAG_BODY),
        (b'b', 6) if bytes[1] == b'u' => Some(TAG_BUTTON),
        (b'b', 10) => Some(TAG_BLOCKQUOTE),
        (b'b', _) => None,
        (b'c', 3) if bytes[1] == b'o' => Some(TAG_COL),
        (b'c', 4) if bytes[1] == b'i' => Some(TAG_CITE),
        (b'c', 4) if bytes[1] == b'o' => Some(TAG_CODE),
        (b'c', 6) if bytes[1] == b'a' => Some(TAG_CANVAS),
        (b'c', 6) if bytes[1] == b'e' => Some(TAG_CENTER),
        (b'c', 7) => Some(TAG_CAPTION),
        (b'c', _) => None,
        (b'd', 2) if bytes[1] == b'd' => Some(TAG_DD),
        (b'd', 2) if bytes[1] == b'l' => Some(TAG_DL),
        (b'd', 2) if bytes[1] == b't' => Some(TAG_DT),
        (b'd', 3) if bytes[1] == b'e' => Some(TAG_DEL),
        (b'd', 3) if bytes[1] == b'f' => Some(TAG_DFN),
        (b'd', 3) if bytes[1] == b'i' => Some(TAG_DIV),
        (b'd', 6) if bytes[1] == b'i' => Some(TAG_DIALOG),
        (b'd', 7) => Some(TAG_DETAILS),
        (b'd', _) => None,
        (b'e', 2) => Some(TAG_EM),
        (b'e', 5) => Some(TAG_EMBED),
        (b'e', _) => None,
        (b'f', 4) => Some(TAG_FORM),
        (b'f', 6) if bytes[2] == b'o' => Some(TAG_FOOTER),
        (b'f', 6) if bytes[2] == b'g' => Some(TAG_FIGURE),
        (b'f', 8) if bytes[1] == b'i' => {
            match name {
                "fieldset" => Some(TAG_FIELDSET),
                _ => None,
            }
        }
        (b'f', 10) => Some(TAG_FIGCAPTION),
        (b'f', _) => None,
        (b'h', 2) if bytes[1] == b'r' => Some(TAG_HR),
        (b'h', 2) => match bytes[1] {
            b'1' => Some(TAG_H1), b'2' => Some(TAG_H2), b'3' => Some(TAG_H3),
            b'4' => Some(TAG_H4), b'5' => Some(TAG_H5), b'6' => Some(TAG_H6),
            _ => None,
        },
        (b'h', 4) if bytes[1] == b'e' => Some(TAG_HEAD),
        (b'h', 4) if bytes[1] == b't' => Some(TAG_HTML),
        (b'h', 6) => Some(TAG_HEADER),
        (b'h', _) => None,
        (b'i', 1) => Some(TAG_I),
        (b'i', 3) if bytes[1] == b'm' => Some(TAG_IMG),
        (b'i', 3) if bytes[1] == b'n' => Some(TAG_INS),
        (b'i', 5) => Some(TAG_INPUT),
        (b'i', 6) => Some(TAG_IFRAME),
        (b'i', _) => None,
        (b'k', 3) => Some(TAG_KBD),
        (b'k', 6) => Some(TAG_KEYGEN),
        (b'k', _) => None,
        (b'l', 2) => Some(TAG_LI),
        (b'l', 4) if bytes[1] == b'i' => Some(TAG_LINK),
        (b'l', 5) => Some(TAG_LABEL),
        (b'l', 6) => Some(TAG_LEGEND),
        (b'l', _) => None,
        (b'm', 3) if bytes[1] == b'a' => {
            match name { "map" => Some(TAG_MAP), _ => None }
        }
        (b'm', 4) if bytes[1] == b'a' => {
            match name { "main" => Some(TAG_MAIN), "mark" => Some(TAG_MARK), _ => None }
        }
        (b'm', 4) if bytes[1] == b'e' => Some(TAG_META),
        (b'm', 5) => Some(TAG_METER),
        (b'm', _) => None,
        (b'n', 3) => Some(TAG_NAV),
        (b'n', 8) if bytes[2] == b's' => Some(TAG_NOSCRIPT),
        (b'n', 8) if bytes[2] == b'f' => Some(TAG_NOFRAMES),
        (b'n', _) => None,
        (b'o', 2) if bytes[1] == b'l' => Some(TAG_OL),
        (b'o', 6) if bytes[1] == b'b' => Some(TAG_OBJECT),
        (b'o', 6) if bytes[1] == b'p' => Some(TAG_OPTION),
        (b'o', _) => None,
        (b'p', 1) => Some(TAG_P),
        (b'p', 3) => Some(TAG_PRE),
        (b'p', 4) => Some(TAG_PATH),
        (b'p', 5) if bytes[1] == b'a' => Some(TAG_PARAM),
        (b'p', 8) if bytes[1] == b'r' => Some(TAG_PROGRESS),
        (b'p', 9) => Some(TAG_PLAINTEXT),
        (b'p', _) => None,
        (b'q', 1) => Some(TAG_Q),
        (b'q', _) => None,
        (b'r', 2) if bytes[1] == b'p' => Some(TAG_RP),
        (b'r', 2) if bytes[1] == b't' => Some(TAG_RT),
        (b'r', 4) => Some(TAG_RUBY),
        (b'r', _) => None,
        (b's', 3) if bytes[1] == b'u' => {
            match bytes[2] { b'b' => Some(TAG_SUB), b'p' => Some(TAG_SUP), _ => None }
        }
        (b's', 3) if bytes[1] == b'v' => Some(TAG_SVG),
        (b's', 4) if bytes[1] == b'a' => Some(TAG_SAMP),
        (b's', 4) if bytes[1] == b'p' => Some(TAG_SPAN),
        (b's', 5) if bytes[1] == b't' => Some(TAG_STYLE),
        (b's', 5) if bytes[1] == b'm' => Some(TAG_SMALL),
        (b's', 6) if bytes[1] == b'c' => Some(TAG_SCRIPT),
        (b's', 6) if bytes[1] == b'e' => Some(TAG_SELECT),
        (b's', 6) if bytes[1] == b'o' => Some(TAG_SOURCE),
        (b's', 6) if bytes[1] == b't' => Some(TAG_STRONG),
        (b's', 7) if bytes[1] == b'e' => Some(TAG_SECTION),
        (b's', 7) if bytes[1] == b'u' => Some(TAG_SUMMARY),
        (b's', _) => None,
        (b't', 2) if bytes[1] == b'r' => Some(TAG_TR),
        (b't', 2) if bytes[1] == b'd' => Some(TAG_TD),
        (b't', 2) if bytes[1] == b'h' => Some(TAG_TH),
        (b't', 4) if bytes[1] == b'i' => Some(TAG_TIME),
        (b't', 5) if bytes[1] == b'a' => Some(TAG_TABLE),
        (b't', 5) if bytes[1] == b'b' => Some(TAG_TBODY),
        (b't', 5) if bytes[1] == b'f' => Some(TAG_TFOOT),
        (b't', 5) if bytes[1] == b'i' => Some(TAG_TITLE),
        (b't', 5) if bytes[1] == b'r' => Some(TAG_TRACK),
        (b't', 5) if bytes[1] == b'h' => Some(TAG_THEAD),
        (b't', 8) if bytes[1] == b'e' => {
            match name { "template" => Some(TAG_TEMPLATE), "textarea" => Some(TAG_TEXTAREA), _ => None }
        }
        (b't', _) => None,
        (b'u', 1) => Some(TAG_U),
        (b'u', 2) => Some(TAG_UL),
        (b'u', _) => None,
        (b'v', 3) if bytes[1] == b'a' => Some(TAG_VAR),
        (b'v', 5) => Some(TAG_VIDEO),
        (b'v', _) => None,
        (b'w', 3) => Some(TAG_WBR),
        (b'w', _) => None,
        (b'x', 3) => Some(TAG_XMP),
        _ => None,
    }
}
