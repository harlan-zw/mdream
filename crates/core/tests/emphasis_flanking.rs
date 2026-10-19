//! A delimiter run next to a word character on one side and punctuation on the
//! other is neither left- nor right-flanking in CommonMark. An opener that
//! cannot open turns its pair into raw HTML; a closer that cannot close is
//! followed by a character reference, which starts with punctuation.

use mdream::CleanConfig;
use mdream::MarkdownStreamProcessor;
use mdream::types::HtmlToMarkdownOptions;
use mdream::{html_to_markdown, html_to_text};

const CASES: &[(&str, &str)] = &[
  (
    r#"<p>a<strong><span><span><a href="/x">b</a></span></span></strong><span>c</span></p>"#,
    "a<strong>[b](/x)</strong>c",
  ),
  (
    r#"<p><strong><span><a href="/x">b</a></span></strong><span><span>c</span></span></p>"#,
    "**[b](/x)**&#99;",
  ),
  (
    r#"<p><i>a</i><b><a href="/y">x</a></b></p>"#,
    "*a*<strong>[x](/y)</strong>",
  ),
  (
    r#"<p><b><a href="/x">a</a></b><i>c</i></p>"#,
    "**[a](/x)***&#99;*",
  ),
  (
    r#"<p><b><i>a</i></b><b><a href="/y">x</a></b></p>"#,
    "***a***<strong>[x](/y)</strong>",
  ),
  (
    r#"<p><b><a href="/x">a</a></b><b><i>c</i></b></p>"#,
    "**[a](/x)*****&#99;***",
  ),
  (
    r#"<p>a<strong><a href="/x">b</a></strong></p>"#,
    "a<strong>[b](/x)</strong>",
  ),
  (
    r#"<p><strong><a href="/x">b</a></strong>c</p>"#,
    "**[b](/x)**&#99;",
  ),
  (
    r#"<p>a<b><a href="/x">b</a></b>c</p>"#,
    "a<strong>[b](/x)</strong>c",
  ),
  (
    r#"<p>a<em><img src="/i.png" alt="i"></em>c</p>"#,
    "a<em>![i](/i.png)</em>c",
  ),
  ("<p>a<i><code>x</code></i>c</p>", "a<em>`x`</em>c"),
  (
    r#"<p>a<strong><em><a href="/x">b</a></em></strong>c</p>"#,
    "a<strong>*[b](/x)*</strong>c",
  ),
  (
    r#"<p>a<del><a href="/x">b</a></del>c</p>"#,
    "a ~~[b](/x)~~&#99;",
  ),
  (r#"<p><s><a href="/x">b</a></s>c</p>"#, "~~[b](/x)~~&#99;"),
  ("<p>a<strong>!b</strong></p>", "a<strong>!b</strong>"),
  ("<p><strong>b!</strong>c</p>", "**b!**&#99;"),
  (
    r#"<p><strong><a href="/x">b</a></strong><span>c</span></p>"#,
    "**[b](/x)**&#99;",
  ),
  (
    r#"<p>a<strong>b <a href="/x">c</a></strong>d</p>"#,
    "a**b [c](/x)**&#100;",
  ),
  // A no-break space counts as whitespace next to a delimiter run.
  (
    r#"<p>a&nbsp;<strong><a href="/x">b</a></strong>c</p>"#,
    "a\u{a0}**[b](/x)**&#99;",
  ),
  (
    r#"<table><tr><th>h</th></tr><tr><td>a<strong><a href="/x">b</a></strong>c</td></tr></table>"#,
    "| h |\n| --- |\n| a<strong>[b](/x)</strong>c |",
  ),
  (
    r#"<blockquote><p>a<strong><a href="/x">b</a></strong>c</p></blockquote>"#,
    "> a<strong>[b](/x)</strong>c",
  ),
  // Delimiters that flank stay as they are.
  (
    r#"<p>a <strong><a href="/x">b</a></strong> c</p>"#,
    "a **[b](/x)** c",
  ),
  ("<p>a<strong>b</strong>c</p>", "a**b**c"),
  (
    r#"<p><a href="/y">a<strong>b!</strong></a>c</p>"#,
    "[a**b!**](/y)c",
  ),
  // A strikethrough opener is not followed by a separator.
  (r#"<p><del><a href="/x">b</a></del></p>"#, "~~[b](/x)~~"),
  // A block inside a decided pair leaves its closer to be written as decided.
  (
    r#"<div>a<strong><a href="/x">b</a><div>c</div></strong>d</div><p>next</p>"#,
    "a<strong>[b](/x) c</strong>d\n\nnext",
  ),
  (
    "<div>x<em>!<p>c</p></em>d</div><p>next</p>",
    "x<em>! c</em>d\n\nnext",
  ),
  (
    "<ul><li>a<strong><code>b</code><ul><li>c</li></ul></strong>d</li></ul><p>next</p>",
    "- a<strong>`b`  - c</strong>d\n\nnext",
  ),
  (
    "<div>a<strong>!b<hr></strong>d</div><p>next</p>",
    "a<strong>!b ---</strong>d\n\nnext",
  ),
  (
    "<div>a<strong>!b<figure><figcaption>c</figcaption></figure></strong>d</div><p>next</p>",
    "a<strong>!b*c*</strong>d\n\nnext",
  ),
  (
    "<div>a<strong>b<div>c!</div></strong>d</div><p>next</p>",
    "a**b c!**&#100;\n\nnext",
  ),
];

fn stream_chunks(html: &str, chunk: usize, options: &HtmlToMarkdownOptions) -> String {
  let mut processor = MarkdownStreamProcessor::new(options.clone());
  let mut out = String::new();
  for part in html.as_bytes().chunks(chunk) {
    out.push_str(&processor.process_chunk(std::str::from_utf8(part).unwrap()));
  }
  out.push_str(&processor.finish());
  out
}

#[test]
fn writes_flanking_delimiters_or_raw_html() {
  for &(html, expected) in CASES {
    assert_eq!(
      html_to_markdown(html, HtmlToMarkdownOptions::default()),
      expected,
      "html={html:?}"
    );
  }
}

#[test]
fn streaming_matches_one_shot_at_every_chunk_size() {
  for options in [
    HtmlToMarkdownOptions::default(),
    HtmlToMarkdownOptions::default().with_wrap_width(6),
  ] {
    for &(html, _) in CASES {
      let expected = html_to_markdown(html, options.clone());
      for chunk in 1..=html.len() {
        assert_eq!(
          stream_chunks(html, chunk, &options),
          expected,
          "chunk={chunk} html={html:?}"
        );
      }
    }
  }
}

#[test]
fn open_emphasis_still_yields_content_before_close() {
  let mut stream = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  let first = stream.process_chunk(r#"<p>a<b><a href="/x">link</a><span>"#);
  assert!(
    first.contains("a<strong>[link](/x)"),
    "content held until close: {first:?}"
  );
  let mut full = first;
  full.push_str(&stream.process_chunk("more</span></b>c</p>"));
  full.push_str(&stream.finish());
  assert_eq!(full, "a<strong>[link](/x)more</strong>c");

  let mut stream = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  let first = stream.process_chunk("<p><b>x!<span>");
  assert!(first.contains("x!"), "content held until close: {first:?}");
  let mut full = first;
  full.push_str(&stream.process_chunk("</span></b>c</p>"));
  full.push_str(&stream.finish());
  assert_eq!(full, "**x!**&#99;");
}

#[test]
fn unwrapped_heading_link_retains_pending_emphasis_closer() {
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig {
    self_link_headings: true,
    ..Default::default()
  });
  for (html, expected) in [
    (
      r##"<h2><em>x</em><a href="#x"><strong>!b</strong></a></h2>"##,
      "## *x*<strong>!b</strong>",
    ),
    (
      r##"<h2><strong>b!</strong><a href="#x">c</a></h2>"##,
      "## **b!**&#99;",
    ),
    (
      r##"<h2><a href="#x">x</a><strong>!b</strong></h2>"##,
      "## x<strong>!b</strong>",
    ),
    (
      r##"<h2>x<a href="#x"><strong>!b</strong></a></h2>"##,
      "## x **!b**",
    ),
    (
      r##"<h2><a href="#x"><strong>b!</strong></a>c</h2>"##,
      "## **b!**&#99;",
    ),
    (
      r##"<h2><a href="#x"><strong><em>b!</em></strong></a><span>c</span></h2>"##,
      "## ***b!***&#99;",
    ),
    (
      r##"<h2><a href="/x"><strong>b!</strong></a>c</h2>"##,
      "## [**b!**](/x)c",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html}"
      );
    }
  }
}

#[test]
fn deferred_fragment_cleanup_preserves_emphasis() {
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig {
    fragments: true,
    ..Default::default()
  });
  for (html, expected) in [
    (
      r##"<p><em>x</em><a href="#missing"><strong>!b</strong></a></p>"##,
      "*x*<strong>!b</strong>",
    ),
    (
      r##"<p><em>x</em><a href="#found"><strong>!b</strong></a></p><h2>found</h2>"##,
      "*x*[<strong>!b</strong>](#found)\n\n## found",
    ),
    (
      r##"<p><a href="#missing"><em>x</em></a><em>!b</em></p>"##,
      "*x*<em>!b</em>",
    ),
    (
      r##"<p>x<a href="#missing"></a><strong>!b</strong></p>"##,
      "x **!b**",
    ),
    (
      r##"<p><em>x</em><a href="#missing"></a><em>!b</em></p>"##,
      "*x*<em>!b</em>",
    ),
    (
      r##"<p><em>x</em><a href="#one"></a><a href="#two"></a><em>!b</em></p>"##,
      "*x* *!b*",
    ),
    (
      r##"<p><strong>b!</strong><a href="#missing"></a>c</p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="#missing">c</a></p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="#found">c</a></p><h2>found</h2>"##,
      "**b!**[&#99;](#found)\n\n## found",
    ),
    (
      r##"<p><a href="#missing">x</a><strong>!b</strong></p>"##,
      "x<strong>!b</strong>",
    ),
    (
      r##"<p><a href="#found">x</a><strong>!b</strong></p><h2>found</h2>"##,
      "[x](#found)<strong>!b</strong>\n\n## found",
    ),
    (
      r##"<p>x<a href="#missing"><strong>!b</strong></a></p>"##,
      "x **!b**",
    ),
    (r##"<p><a href="#missing"><strong></strong></a>c</p>"##, "c"),
    (
      r##"<p><a href="#missing"><strong>b!</strong> tail</a>c</p>"##,
      "**b!** tailc",
    ),
    (
      r##"<p><a href="/external"><strong>b!</strong></a>c</p>"##,
      "[**b!**](/external)c",
    ),
    (
      r##"<p><a href="#missing"><strong>b!</strong></a>c</p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><a href="#found"><strong>b!</strong></a>c</p><h2>found</h2>"##,
      "[**b!**](#found)&#99;\n\n## found",
    ),
    (
      r##"<p><a href="#missing"><strong><em>b!</em></strong></a>c</p>"##,
      "***b!***&#99;",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html}"
      );
    }
  }
}

#[test]
fn heading_slugs_still_match_fragment_links() {
  // A heading slug reads a character reference and a link's text as written,
  // so neither is used while fragment cleaning collects slugs; raw tags
  // outside a link are dropped from the slug.
  for (html, expected) in [
    (
      r#"<h2><strong><a href="/x">b</a></strong>c</h2>"#,
      "## **[b](/x)**&#99;",
    ),
    (
      r#"<h2><a href="/x">a<strong>!b</strong></a></h2>"#,
      "## [a<strong>!b</strong>](/x)",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, HtmlToMarkdownOptions::default()),
      expected,
      "html={html:?}"
    );
  }
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig::all());
  for (html, expected) in [
    (
      r##"<h2><strong><a href="/x">b</a></strong>c</h2><p><a href="#bc">to</a></p>"##,
      "## **[b](/x)**c\n\n[to](#bc)",
    ),
    (
      r##"<h2><a href="/y"><strong><code>b</code></strong>c</a></h2><p><a href="#bc">t</a></p>"##,
      "## [**`b`**c](/y)\n\n[t](#bc)",
    ),
    (
      r##"<h2><a href="/x">a<strong>!b</strong></a></h2><p><a href="#ab">t</a></p>"##,
      "## [a**!b**](/x)\n\n[t](#ab)",
    ),
    (
      r##"<h2>a<strong>!b</strong>c</h2><p><a href="#abc">t</a></p>"##,
      "## a<strong>!b</strong>c\n\n[t](#abc)",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html:?}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html:?}"
      );
    }
  }
}

#[test]
fn wraps_at_the_space_moved_past_a_closer() {
  // `<b>b </b>c` writes its space after the closer; it breaks like any other
  // space between words.
  for (width, html, expected) in [
    (6, "<p>1<strong>b </strong>x</p>", "1**b**\nx"),
    (80, "<p>1<strong>b </strong>x</p>", "1**b** x"),
    (
      12,
      "<p>a<strong>!bb </strong>&nbsp;c</p>",
      "a<strong>!bb</strong>\n\u{a0}c",
    ),
    (
      12,
      "<blockquote><blockquote>1<strong><del>b </del></strong>x</blockquote></blockquote>",
      "> > 1<strong>~~b~~</strong>\n> > x",
    ),
  ] {
    let options = HtmlToMarkdownOptions::default().with_wrap_width(width);
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html:?}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html:?}"
      );
    }
  }
  // Plain text keeps a space-only text before the close as written, as JS does.
  assert_eq!(
    html_to_text(
      "<p>w <em>lo b Hel<span></span> </em>xx</p>",
      HtmlToMarkdownOptions::default().with_wrap_width(12)
    ),
    "w lo b Hel xx"
  );
}

#[test]
fn only_markdown_drops_the_space_after_a_tilde() {
  // A strikethrough opener must touch its content; plain text has no
  // delimiters and keeps the separator.
  let html = "<p>x~<q>q</q></p>";
  assert_eq!(
    html_to_markdown(html, HtmlToMarkdownOptions::default()),
    "x\\~\"q\""
  );
  assert_eq!(
    html_to_text(html, HtmlToMarkdownOptions::default()),
    "x~ \"q\""
  );
}

#[test]
fn keeps_delimiters_where_a_fix_cannot_help() {
  // An opener before whitespace cannot open; a raw one at a block start would
  // open an HTML block.
  assert_eq!(
    html_to_markdown(
      r#"<p><strong><br><a href="/x">b</a></strong>c</p>"#,
      HtmlToMarkdownOptions::default()
    ),
    "**  \n[b](/x)**c"
  );
  assert_eq!(
    html_to_markdown(
      r#"<p>a<strong>&nbsp;<a href="/x">b</a></strong>c</p>"#,
      HtmlToMarkdownOptions::default()
    ),
    "a**\u{a0} [b](/x)**c"
  );
  assert_eq!(
    html_to_markdown(
      "<p><code>a<strong>[b]</strong>c</code></p>",
      HtmlToMarkdownOptions::default()
    ),
    "`a**[b]**c`"
  );
  // `<kbd>`, `<samp>` and `<var>` are code spans as well.
  for (html, expected) in [
    ("<p><kbd><strong>b!</strong>c</kbd></p>", "`**b!**c`"),
    ("<p><kbd>a<strong>!b</strong></kbd></p>", "`a**!b**`"),
    ("<p><samp><em>(b)</em>c</samp></p>", "`*(b)*c`"),
    ("<p><var>a<em>!b</em>c</var></p>", "`a*!b*c`"),
    (
      "<p>a<strong><kbd>b</kbd></strong>c</p>",
      "a<strong>`b`</strong>c",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, HtmlToMarkdownOptions::default()),
      expected,
      "html={html:?}"
    );
  }
}
