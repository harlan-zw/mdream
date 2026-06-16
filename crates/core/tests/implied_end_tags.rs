//! Browser recovery: implied end tags (HTML §13.1.2.4 optional tags +
//! tree-construction). Malformed-but-valid markup that omits end tags must
//! recover the same way browsers do, so the missing close does not nest or drop
//! content. Mirrors the JS engine's `implied-end-tags.test.ts`.
use mdream::{MarkdownStreamProcessor, types::HTMLToMarkdownOptions, html_to_markdown};

fn convert(html: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn stream(chunks: &[&str]) -> String {
    let mut p = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut out = String::new();
    for c in chunks {
        out.push_str(&p.process_chunk(c));
    }
    out.push_str(&p.finish());
    out
}

// ── <p> ──

#[test]
fn unclosed_p_followed_by_p_keeps_both_paragraphs() {
    // Regression: the second <p> used to nest inside the first, dropping "two".
    assert_eq!(convert("<p>one<p>two"), "one\n\ntwo");
    assert_eq!(convert("<p>a<p>b<p>c"), "a\n\nb\n\nc");
}

#[test]
fn unclosed_p_closed_by_block_elements_still_works() {
    // Already-working cases must not regress.
    assert_eq!(convert("<p>one<div>two</div>"), "one\n\ntwo");
    assert_eq!(convert("<p>one<ul><li>x</li></ul>"), "one\n\n- x");
    assert_eq!(convert("<p>a<h2>b</h2>"), "a\n\n## b");
    assert_eq!(convert("<p>a<blockquote>b</blockquote>"), "a\n\n> b");
}

#[test]
fn well_formed_paragraphs_are_unchanged() {
    assert_eq!(convert("<p>one</p><p>two</p>"), "one\n\ntwo");
}

// ── <li> ──

#[test]
fn unclosed_li_followed_by_li_are_siblings() {
    // Regression: the second <li> used to wrongly nest under the first.
    assert_eq!(convert("<ul><li>one<li>two</ul>"), "- one\n- two");
    assert_eq!(convert("<ol><li>one<li>two<li>three</ol>"), "1. one\n2. two\n3. three");
}

#[test]
fn unclosed_li_at_eof_is_kept() {
    assert_eq!(convert("<ul><li>one<li>two"), "- one\n- two");
}

#[test]
fn nested_lists_with_unclosed_li_keep_structure() {
    // Inner <li> closes only within the inner list; the outer item is untouched.
    assert_eq!(
        convert("<ul><li>a<ul><li>b<li>c</ul><li>d</ul>"),
        "- a\n  - b\n  - c\n- d",
    );
}

#[test]
fn well_formed_list_is_unchanged() {
    assert_eq!(convert("<ul><li>one</li><li>two</li></ul>"), "- one\n- two");
}

// ── tables ──

#[test]
fn implicit_cell_and_row_ends_build_a_clean_table() {
    // Regression: a bare <tr>/<td> used to leak into the cell output.
    assert_eq!(
        convert("<table><tr><td>a<td>b<tr><td>c<td>d</table>"),
        "| a | b |\n| --- | --- |\n| c | d |",
    );
}

#[test]
fn implicit_section_ends_build_a_clean_table() {
    // <thead>/<tbody> auto-close each other; cells/rows close on the section.
    assert_eq!(
        convert("<table><thead><tr><th>H<tbody><tr><td>D</table>"),
        "| H |\n| --- |\n| D |",
    );
}

#[test]
fn well_formed_table_is_unchanged() {
    assert_eq!(
        convert("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>"),
        "| a | b |\n| --- | --- |\n| c | d |",
    );
}

// ── definition lists ──
//
// `<dl>`/`<dt>`/`<dd>` keep their raw-HTML passthrough (valid inline markup for
// GitHub-flavoured Markdown); the recovery only fixes the implied nesting, so a
// malformed list produces the same clean tags as its well-formed equivalent.

#[test]
fn unclosed_dt_dd_recover_to_clean_raw_tags() {
    // Regression: <dt>/<dd> used to nest endlessly (e.g. `…</dd></dt></dd></dt>`).
    assert_eq!(
        convert("<dl><dt>Coffee<dd>Black hot drink</dl>"),
        "<dl><dt>Coffee</dt>\n<dd>Black hot drink</dd>\n</dl>",
    );
}

#[test]
fn definition_list_alternating_dt_dd_close_each_other() {
    assert_eq!(
        convert("<dl><dt>Coffee<dd>Hot drink<dt>Milk<dd>Cold drink</dl>"),
        "<dl><dt>Coffee</dt>\n<dd>Hot drink</dd>\n<dt>Milk</dt>\n<dd>Cold drink</dd>\n</dl>",
    );
}

#[test]
fn definition_list_multiple_definitions_per_term() {
    assert_eq!(
        convert("<dl><dt>Term<dd>Def 1<dd>Def 2</dl>"),
        "<dl><dt>Term</dt>\n<dd>Def 1</dd>\n<dd>Def 2</dd>\n</dl>",
    );
}

#[test]
fn malformed_definition_list_matches_well_formed() {
    assert_eq!(
        convert("<dl><dt>Coffee<dd>Hot drink</dl>"),
        convert("<dl><dt>Coffee</dt><dd>Hot drink</dd></dl>"),
    );
}

// ── nested anchors ──

#[test]
fn nested_anchor_closes_the_open_one() {
    // Regression: nested <a> produced invalid nested markdown `[one [two](/2)](/1)`.
    assert_eq!(convert("<a href=/1>one<a href=/2>two</a>"), "[one](/1) [two](/2)");
    // Intervening inline formatting is closed along with the anchor.
    assert_eq!(convert("<a href=/1>one<b>bold<a href=/2>two</a>"), "[one**bold**](/1) [two](/2)");
}

#[test]
fn well_formed_and_cross_block_anchors_unchanged() {
    assert_eq!(convert("<a href=/1>one</a><a href=/2>two</a>"), "[one](/1) [two](/2)");
    // A closed anchor in another block is not affected.
    assert_eq!(convert("<div><a href=/1>one</div><a href=/2>two</a>"), "[one](/1)\n\n[two](/2)");
}

// ── headings ──

#[test]
fn heading_closes_open_heading() {
    // Regression: `<h1>a<h2>b` rendered "# a ## b" on one invalid line.
    assert_eq!(convert("<h1>a<h2>b</h2>"), "# a\n\n## b");
    assert_eq!(convert("<h2>a<h2>b"), "## a\n\n## b");
}

#[test]
fn well_formed_headings_unchanged() {
    assert_eq!(convert("<h1>a</h1><h2>b</h2>"), "# a\n\n## b");
    assert_eq!(convert("<h1><em>a</em></h1>"), "# _a_");
}

// ── trailing content at EOF ──

#[test]
fn trailing_text_at_eof_is_not_dropped() {
    assert_eq!(convert("<p>hello"), "hello");
    assert_eq!(convert("hello"), "hello");
    assert_eq!(convert("<b>bold"), "**bold**");
}

// ── streaming: recovery must run only after the start tag is complete ──

#[test]
fn streaming_split_inside_trigger_tag_matches_whole() {
    // Splitting the triggering tag across chunks must not change the result; the
    // recovery runs only after the tag is confirmed complete.
    for (chunks, whole) in [
        (vec!["<p>one<p", ">two"], "<p>one<p>two"),
        (vec!["<ul><li>one<l", "i>two</ul>"], "<ul><li>one<li>two</ul>"),
        (
            vec!["<table><tr><td>a<t", "d>b<tr><td>c<td>d</table>"],
            "<table><tr><td>a<td>b<tr><td>c<td>d</table>",
        ),
        (vec!["<dl><dt>Coffee<d", "d>Hot drink</dl>"], "<dl><dt>Coffee<dd>Hot drink</dl>"),
    ] {
        assert_eq!(stream(&chunks).trim(), convert(whole), "chunks: {chunks:?}");
    }
}
