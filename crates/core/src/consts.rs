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

/// Fast, strict tag name to ID lookup.
///
/// Dispatches on (first byte, length) for fast rejection, then verifies the
/// remaining bytes inline so that unknown tags (e.g. `<ex>`, `<fxxm>`, custom
/// elements) never collide with built-ins sharing the same (first-byte, length)
/// signature. Single-character arms need no extra check — the length and first
/// byte together uniquely identify the string. Multi-character arms compare the
/// tail bytes via slice equality, which the compiler lowers to a small fixed
/// memcmp (typically a single word load + compare).
/// Returns `None` for any tag not in the built-in set; callers can opt those
/// tags into a rendering via `tagOverrides`.
/// Longest built-in HTML tag name (`blockquote`, `figcaption`); also the size
/// of the stack buffer used for the case-insensitive lookup.
const MAX_BUILTIN_TAG_LEN: usize = 10;

#[inline]
pub fn get_tag_id(name: &str) -> Option<u8> {
    get_tag_id_bytes(name.as_bytes())
}

/// Case-insensitive built-in tag lookup over raw bytes.
///
/// Lowercases ASCII into a stack-allocated `MAX_BUILTIN_TAG_LEN` buffer, avoiding the heap
/// allocation `name.to_ascii_lowercase()` would incur when the input contains
/// uppercase bytes. Returns `None` for any tag not in the built-in set.
#[inline]
pub fn get_tag_id_ci_bytes(name: &[u8]) -> Option<u8> {
    let len = name.len();
    if len == 0 || len > MAX_BUILTIN_TAG_LEN {
        return None;
    }
    // Fast path: already-lowercase (the HTML5 common case) dispatches directly
    // without copying. Only fall through to the stack-buffer lowercase when an
    // uppercase byte is actually present.
    let mut has_upper = false;
    let mut i = 0;
    while i < len {
        if name[i].is_ascii_uppercase() { has_upper = true; break; }
        i += 1;
    }
    if !has_upper {
        return get_tag_id_bytes(name);
    }
    let mut buf = [0u8; MAX_BUILTIN_TAG_LEN];
    let mut j = 0;
    while j < len {
        buf[j] = name[j].to_ascii_lowercase();
        j += 1;
    }
    get_tag_id_bytes(&buf[..len])
}

#[inline]
fn get_tag_id_bytes(bytes: &[u8]) -> Option<u8> {
    let len = bytes.len();
    if len == 0 || len > MAX_BUILTIN_TAG_LEN {
        return None;
    }
    // Each arm reads tail bytes directly: `&bytes[1..]` against a fixed-length
    // byte literal. The length is constrained by the match pattern, so the
    // comparison is a single fixed-size memcmp.
    match (bytes[0], len) {
        // 1-char tags: first byte + length uniquely identifies the string.
        (b'a', 1) => Some(TAG_A),
        (b'b', 1) => Some(TAG_B),
        (b'i', 1) => Some(TAG_I),
        (b'p', 1) => Some(TAG_P),
        (b'q', 1) => Some(TAG_Q),
        (b'u', 1) => Some(TAG_U),
        // 2-char tags: verify byte 1 only.
        (b'b', 2) if bytes[1] == b'r' => Some(TAG_BR),
        (b'd', 2) => match bytes[1] { b'd' => Some(TAG_DD), b'l' => Some(TAG_DL), b't' => Some(TAG_DT), _ => None },
        (b'e', 2) if bytes[1] == b'm' => Some(TAG_EM),
        (b'h', 2) => match bytes[1] {
            b'r' => Some(TAG_HR),
            b'1' => Some(TAG_H1), b'2' => Some(TAG_H2), b'3' => Some(TAG_H3),
            b'4' => Some(TAG_H4), b'5' => Some(TAG_H5), b'6' => Some(TAG_H6),
            _ => None,
        },
        (b'l', 2) if bytes[1] == b'i' => Some(TAG_LI),
        (b'o', 2) if bytes[1] == b'l' => Some(TAG_OL),
        (b'r', 2) => match bytes[1] { b'p' => Some(TAG_RP), b't' => Some(TAG_RT), _ => None },
        (b't', 2) => match bytes[1] { b'r' => Some(TAG_TR), b'd' => Some(TAG_TD), b'h' => Some(TAG_TH), _ => None },
        (b'u', 2) if bytes[1] == b'l' => Some(TAG_UL),
        // 3-char tags: verify bytes 1-2.
        (b'b', 3) if &bytes[1..] == b"do" => Some(TAG_BDO),
        (b'c', 3) if &bytes[1..] == b"ol" => Some(TAG_COL),
        (b'd', 3) => match &bytes[1..] {
            b"el" => Some(TAG_DEL), b"fn" => Some(TAG_DFN), b"iv" => Some(TAG_DIV), _ => None
        },
        (b'i', 3) => match &bytes[1..] { b"mg" => Some(TAG_IMG), b"ns" => Some(TAG_INS), _ => None },
        (b'k', 3) if &bytes[1..] == b"bd" => Some(TAG_KBD),
        (b'm', 3) if &bytes[1..] == b"ap" => Some(TAG_MAP),
        (b'n', 3) if &bytes[1..] == b"av" => Some(TAG_NAV),
        (b'p', 3) if &bytes[1..] == b"re" => Some(TAG_PRE),
        (b's', 3) => match &bytes[1..] {
            b"ub" => Some(TAG_SUB), b"up" => Some(TAG_SUP), b"vg" => Some(TAG_SVG), _ => None
        },
        (b'v', 3) if &bytes[1..] == b"ar" => Some(TAG_VAR),
        (b'w', 3) if &bytes[1..] == b"br" => Some(TAG_WBR),
        (b'x', 3) if &bytes[1..] == b"mp" => Some(TAG_XMP),
        // 4-char tags.
        (b'a', 4) => match &bytes[1..] { b"bbr" => Some(TAG_ABBR), b"rea" => Some(TAG_AREA), _ => None },
        (b'b', 4) => match &bytes[1..] { b"ase" => Some(TAG_BASE), b"ody" => Some(TAG_BODY), _ => None },
        (b'c', 4) => match &bytes[1..] { b"ite" => Some(TAG_CITE), b"ode" => Some(TAG_CODE), _ => None },
        (b'f', 4) if &bytes[1..] == b"orm" => Some(TAG_FORM),
        (b'h', 4) => match &bytes[1..] { b"ead" => Some(TAG_HEAD), b"tml" => Some(TAG_HTML), _ => None },
        (b'l', 4) if &bytes[1..] == b"ink" => Some(TAG_LINK),
        (b'm', 4) => match &bytes[1..] {
            b"ain" => Some(TAG_MAIN), b"ark" => Some(TAG_MARK), b"eta" => Some(TAG_META), _ => None
        },
        (b'p', 4) if &bytes[1..] == b"ath" => Some(TAG_PATH),
        (b'r', 4) if &bytes[1..] == b"uby" => Some(TAG_RUBY),
        (b's', 4) => match &bytes[1..] { b"amp" => Some(TAG_SAMP), b"pan" => Some(TAG_SPAN), _ => None },
        (b't', 4) if &bytes[1..] == b"ime" => Some(TAG_TIME),
        // 5-char tags.
        (b'a', 5) => match &bytes[1..] { b"side" => Some(TAG_ASIDE), b"udio" => Some(TAG_AUDIO), _ => None },
        (b'e', 5) if &bytes[1..] == b"mbed" => Some(TAG_EMBED),
        (b'i', 5) if &bytes[1..] == b"nput" => Some(TAG_INPUT),
        (b'l', 5) if &bytes[1..] == b"abel" => Some(TAG_LABEL),
        (b'm', 5) if &bytes[1..] == b"eter" => Some(TAG_METER),
        (b'p', 5) if &bytes[1..] == b"aram" => Some(TAG_PARAM),
        (b's', 5) => match &bytes[1..] { b"tyle" => Some(TAG_STYLE), b"mall" => Some(TAG_SMALL), _ => None },
        (b't', 5) => match &bytes[1..] {
            b"able" => Some(TAG_TABLE),
            b"body" => Some(TAG_TBODY),
            b"foot" => Some(TAG_TFOOT),
            b"itle" => Some(TAG_TITLE),
            b"rack" => Some(TAG_TRACK),
            b"head" => Some(TAG_THEAD),
            _ => None,
        },
        (b'v', 5) if &bytes[1..] == b"ideo" => Some(TAG_VIDEO),
        // 6-char tags.
        (b'b', 6) if &bytes[1..] == b"utton" => Some(TAG_BUTTON),
        (b'c', 6) => match &bytes[1..] { b"anvas" => Some(TAG_CANVAS), b"enter" => Some(TAG_CENTER), _ => None },
        (b'd', 6) if &bytes[1..] == b"ialog" => Some(TAG_DIALOG),
        (b'f', 6) => match &bytes[1..] { b"ooter" => Some(TAG_FOOTER), b"igure" => Some(TAG_FIGURE), _ => None },
        (b'h', 6) if &bytes[1..] == b"eader" => Some(TAG_HEADER),
        (b'i', 6) if &bytes[1..] == b"frame" => Some(TAG_IFRAME),
        (b'k', 6) if &bytes[1..] == b"eygen" => Some(TAG_KEYGEN),
        (b'l', 6) if &bytes[1..] == b"egend" => Some(TAG_LEGEND),
        (b'o', 6) => match &bytes[1..] { b"bject" => Some(TAG_OBJECT), b"ption" => Some(TAG_OPTION), _ => None },
        (b's', 6) => match &bytes[1..] {
            b"cript" => Some(TAG_SCRIPT),
            b"elect" => Some(TAG_SELECT),
            b"ource" => Some(TAG_SOURCE),
            b"trong" => Some(TAG_STRONG),
            _ => None,
        },
        // 7-char tags.
        (b'a', 7) => match &bytes[1..] { b"rticle" => Some(TAG_ARTICLE), b"ddress" => Some(TAG_ADDRESS), _ => None },
        (b'c', 7) if &bytes[1..] == b"aption" => Some(TAG_CAPTION),
        (b'd', 7) if &bytes[1..] == b"etails" => Some(TAG_DETAILS),
        (b's', 7) => match &bytes[1..] { b"ection" => Some(TAG_SECTION), b"ummary" => Some(TAG_SUMMARY), _ => None },
        // 8-char tags.
        (b'f', 8) if &bytes[1..] == b"ieldset" => Some(TAG_FIELDSET),
        (b'n', 8) => match &bytes[1..] { b"oscript" => Some(TAG_NOSCRIPT), b"oframes" => Some(TAG_NOFRAMES), _ => None },
        (b'p', 8) if &bytes[1..] == b"rogress" => Some(TAG_PROGRESS),
        (b't', 8) => match &bytes[1..] { b"emplate" => Some(TAG_TEMPLATE), b"extarea" => Some(TAG_TEXTAREA), _ => None },
        // 9-char and 10-char tags.
        (b'p', 9) if &bytes[1..] == b"laintext" => Some(TAG_PLAINTEXT),
        (b'b', 10) if &bytes[1..] == b"lockquote" => Some(TAG_BLOCKQUOTE),
        (b'f', 10) if &bytes[1..] == b"igcaption" => Some(TAG_FIGCAPTION),
        _ => None,
    }
}
