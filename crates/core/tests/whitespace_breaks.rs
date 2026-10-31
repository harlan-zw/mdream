//! Block spacing, hard breaks, and inline whitespace at element boundaries.
use mdream::types::{
  CleanConfig, HtmlToMarkdownOptions, OutputFormat, PluginConfig, TagOverrideConfig,
};
use mdream::{MarkdownStreamProcessor, html_to_markdown, html_to_text};

fn md(html: &str) -> String {
  html_to_markdown(html, HtmlToMarkdownOptions::default())
}

fn text(html: &str) -> String {
  html_to_text(html, HtmlToMarkdownOptions::default())
}

fn md_streamed(html: &str, chunk: usize) -> String {
  let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  let mut out = String::new();
  for c in html.as_bytes().chunks(chunk) {
    out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
  }
  out.push_str(&p.finish());
  out
}

fn md_wrapped(html: &str, width: usize) -> String {
  html_to_markdown(
    html,
    HtmlToMarkdownOptions::default().with_wrap_width(width),
  )
}

// ── Block spacing after a one-character line ──

#[test]
fn block_after_one_character_line_gets_full_spacing() {
  assert_eq!(text("<p>a</p><ul><li>b</li><li>c</li></ul>"), "a\n\nb\nc");
  assert_eq!(text("a<li>b<li>c"), "a\nb\nc");
  assert_eq!(md("<p>a</p><span>b</span><p>c</p>"), "a\n\nb\n\nc");
  // Longer lines already worked; keep them equal.
  assert_eq!(text("<p>a</p><ul><li>bb</li><li>c</li></ul>"), "a\n\nbb\nc");
}

// ── Blank image alt in text output ──

#[test]
fn blank_image_alt_adds_no_blank_line() {
  assert_eq!(text("A<p><img alt=\" \"><p>B"), "A\n\nB");
}

// ── Whitespace after <br> ──

#[test]
fn whitespace_after_br_keeps_the_hard_break() {
  assert_eq!(md("<p><span>x<br> </span>a</p>"), "x  \na");
  assert_eq!(text("<p><span>x<br> </span>a</p>"), "x\na");
  assert_eq!(md("<li>ew<br> <div>D"), "- ew  \n\n  D");
  assert_eq!(md("<li>ew<br>\n<div>D"), "- ew  \n\n  D");
}

// ── Paragraph boundary after a hard break in a list item ──

#[test]
fn paragraph_after_a_hard_break_in_a_list_item_keeps_the_blank_line() {
  // Outside a list item the block boundary after a hard break keeps the
  // paragraph blank line; list-item boundaries must not lose it.
  assert_eq!(md("<p>q<br></p><p>X"), "q  \n\nX");
  assert_eq!(md("<li><p>q<br> <p>X"), "- q  \n\n  X");
  assert_eq!(md("<li><p>q<br><p>X"), "- q  \n\n  X");
  // A div boundary behaves the same, in one-shot and streaming.
  assert_eq!(md("<li>q<br><div>X"), "- q  \n\n  X");
  assert_eq!(md_streamed("<li>q<br><div>X", 4), "- q  \n\n  X");
  // The separator survives streaming chunk boundaries.
  let html = "<li><p>q<br> <p>X";
  for chunk in [3, 7, html.len()] {
    assert_eq!(md_streamed(html, chunk), "- q  \n\n  X", "chunk={chunk}");
  }
}

#[test]
fn fenced_block_after_a_hard_break_in_a_list_item_keeps_the_blank_line() {
  // A fence cannot interrupt a paragraph, so it must not share the break's
  // line: the separator precedes the fence opener instead of replacing it.
  assert_eq!(md("<li>q<br> <pre>x</pre>"), "- q  \n\n  ```\n  x\n  ```");
  assert_eq!(md("<li>q<br><pre>x</pre>"), "- q  \n\n  ```\n  x\n  ```");
  // A code fence opened by <code> behaves the same.
  assert_eq!(
    md("<li>q<br> <pre><code>x</code></pre>"),
    "- q  \n\n  ```\n  x\n  ```"
  );
  // The separator survives streaming chunk boundaries.
  for html in [
    "<li>q<br> <pre>x</pre>",
    "<li>q<br><pre>x</pre>",
    "<li>q<br> <pre><code>x</code></pre>",
  ] {
    for chunk in [3, 7, html.len()] {
      assert_eq!(
        md_streamed(html, chunk),
        "- q  \n\n  ```\n  x\n  ```",
        "html={html} chunk={chunk}"
      );
    }
  }
}

#[test]
fn table_after_a_hard_break_in_a_list_item_keeps_the_blank_line() {
  // A GFM table cannot interrupt a paragraph either, so the row marker must
  // not share the break's line.
  assert_eq!(
    md("<li>q<br> <table><tr><td>X</td></tr></table>"),
    "- q  \n\n  | X |\n  | --- |"
  );
  assert_eq!(
    md("<li>q<br><table><tr><td>X</td></tr></table>"),
    "- q  \n\n  | X |\n  | --- |"
  );
  // The separator survives streaming chunk boundaries.
  for html in [
    "<li>q<br> <table><tr><td>X</td></tr></table>",
    "<li>q<br><table><tr><td>X</td></tr></table>",
  ] {
    for chunk in [3, 7, html.len()] {
      assert_eq!(
        md_streamed(html, chunk),
        "- q  \n\n  | X |\n  | --- |",
        "html={html} chunk={chunk}"
      );
    }
  }
}

#[test]
fn retracted_inline_marker_after_a_hard_break_keeps_the_blank_line() {
  // An empty inline pair or a truncated empty code span rewinds the buffer to
  // the break's line-end state, so the hard-break state must survive it too.
  assert_eq!(md("<li>q<br><em></em><p>X"), "- q  \n\n  X");
  assert_eq!(md("<li>q<br><code></code><p>X"), "- q  \n\n  X");
  assert_eq!(md("<li>q<br><strong></strong><div>X"), "- q  \n\n  X");
  // The separator also survives streaming chunk boundaries.
  for html in ["<li>q<br><em></em><p>X", "<li>q<br><code></code><p>X"] {
    for chunk in [3, 7, html.len()] {
      assert_eq!(
        md_streamed(html, chunk),
        "- q  \n\n  X",
        "html={html} chunk={chunk}"
      );
    }
  }
}

/// One-shot output, and streamed output at every chunk size, equal `expected`.
fn assert_every_chunking(html: &str, options: &HtmlToMarkdownOptions, expected: &str) {
  assert_eq!(
    html_to_markdown(html, options.clone()),
    expected,
    "html={html}"
  );
  for chunk in 1..=html.len() {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = String::new();
    for c in html.as_bytes().chunks(chunk) {
      out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "html={html} chunk={chunk}");
  }
}

#[test]
fn output_after_a_hard_break_leaves_one_paragraph_separator() {
  // Output after the break reopens its line, so a block inside the item gets
  // the separator it gets without the break, never a second one.
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<li>q<br>t<p>X", "- q  \n  t\n\n  X"),
    ("<li><p>q<br>t</p><p>X", "- q  \n  t\n\n  X"),
    ("<li>q<br><span>t</span><p>X", "- q  \n  t\n\n  X"),
    ("<li>q<br>t<div>X", "- q  \n  t X"),
    ("<li><b>q<br></b><p>X", "- **q  \n  **\n\n  X"),
    ("<li><a href=\"/x\">q<br></a><p>X", "- [q  \n  ](/x)\n\n  X"),
    ("<li><blockquote>q<br></blockquote><p>X", "- \n  > q\n\n  X"),
    (
      "<li>q<br><figcaption>c</figcaption><p>X",
      "- q  \n\n  *c*\n\n  X",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
  // A skipped link writes no brackets, but its text still follows the break.
  let empty_links = HtmlToMarkdownOptions {
    clean: Some(CleanConfig {
      empty_links: true,
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_every_chunking(
    "<li>q<br><a href=\"javascript:void(0)\">t</a><p>X",
    &empty_links,
    "- q  \n  t\n\n  X",
  );
}

#[test]
fn dropped_construct_after_a_hard_break_keeps_the_blank_line() {
  // Dropping an empty link rewinds the output to the break's line end, as an
  // empty inline pair does, even when the dropped part held a break of its own.
  let empty_link_text = HtmlToMarkdownOptions {
    clean: Some(CleanConfig {
      empty_link_text: true,
      ..Default::default()
    }),
    ..Default::default()
  };
  for html in [
    "<li>q<br><a href=\"/x\"></a><p>X",
    "<li>q<br><a href=\"/x\"> </a><div>X",
    "<li>q<br><a href=\"/x\"><em></em></a><p>X",
    "<li>q<br><a href=\"/x\"><br></a><p>X",
    "<li>q<br><em><br></em><p>X",
    "<li>q<br><em><br><br></em><p>X",
  ] {
    assert_every_chunking(html, &empty_link_text, "- q  \n\n  X");
  }
}

// ── <br> inside <pre> ──

#[test]
fn br_after_whitespace_in_pre_stays_a_line_break() {
  assert_eq!(md("<pre>a <br>b</pre>"), "```\na \nb\n```");
  assert_eq!(md("<pre>t  <br>s</pre>"), "```\nt  \ns\n```");
  assert_eq!(text("<pre>a <br>b</pre>"), "a \nb");
  assert_eq!(md("<pre>a\n<br>b</pre>"), "```\na\n\nb\n```");
  assert_eq!(md("<pre>a <b><br></b>c</pre>"), "```\na \nc\n```");
  // Without the whitespace the break already worked.
  assert_eq!(md("<pre>a<br>b</pre>"), "```\na\nb\n```");
}

// ── Raw <pre> in a table cell ──

/// Like `assert_every_chunking`, plus every two-piece split.
fn assert_every_split(html: &str, options: &HtmlToMarkdownOptions, expected: &str) {
  assert_every_chunking(html, options, expected);
  for split in (1..html.len()).filter(|&split| html.is_char_boundary(split)) {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "html={html} split={split}");
  }
}

#[test]
fn raw_pre_in_a_table_cell_keeps_its_trailing_whitespace() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    (
      "<table><tr><td><pre>a </pre></td></tr></table>",
      "| <pre>a </pre> |\n| --- |",
    ),
    (
      "<table><tr><td><pre>  a  </pre>x</td></tr></table>",
      "| <pre>  a  </pre>x |\n| --- |",
    ),
    (
      "<table><tr><td><pre>a <b>x</b> </pre></td></tr></table>",
      "| <pre>a x </pre> |\n| --- |",
    ),
    (
      "<table><tr><td><pre>a &#10; </pre></td></tr></table>",
      "| <pre>a <br> </pre> |\n| --- |",
    ),
    (
      "<table><tr><th><pre>* </pre></th><td>z</td></tr></table>",
      "| <pre>* </pre> | z |\n| --- | --- |",
    ),
    // Outside a cell the fence still drops the trailing spaces.
    ("<pre>a </pre>", "```\na\n```"),
  ] {
    assert_every_split(html, &options, expected);
  }
}

// ── Trailing tabs at a plain-text line end ──

fn assert_text_every_split(html: &str, expected: &str) {
  assert_eq!(text(html), expected, "html={html}");
  for chunk in 1..=html.len() {
    let mut p = MarkdownStreamProcessor::new_with_format(
      HtmlToMarkdownOptions::default(),
      OutputFormat::Text,
    );
    let mut out = String::new();
    for c in html.as_bytes().chunks(chunk) {
      out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "html={html} chunk={chunk}");
  }
  for split in 1..html.len() {
    let mut p = MarkdownStreamProcessor::new_with_format(
      HtmlToMarkdownOptions::default(),
      OutputFormat::Text,
    );
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "html={html} split={split}");
  }
}

#[test]
fn plain_text_line_end_drops_a_trailing_tab_run() {
  for (html, expected) in [
    ("<p>a&#9;<br>x</p>", "a\nx"),
    ("<p>a &#9;<br>x</p>", "a\nx"),
    ("<p><span>a&#9;</span><br>x</p>", "a\nx"),
    ("<table><tr><td>a&#9;<br>x</td></tr></table>", "a\nx"),
    ("<p>a&#9; &#9;</p><p>b</p>", "a\n\nb"),
    ("<ul><li>a&#9;<ul><li>b</li></ul></li></ul>", "a\nb"),
    ("<pre>a&#9;</pre>x", "a\n\nx"),
    ("<div><pre>x<b>a&#9;</b></pre>y</div>", "xa\n\ny"),
    // Preformatted text and table rows keep their tabs.
    ("<pre>a&#9;<br>x</pre>", "a\t\nx"),
    ("<pre>a&#9;<p>b</p></pre>", "a\t\n\nb"),
    (
      "<table><tr><td>a&#9;</td></tr><tr><td>b</td></tr></table>",
      "a\t\nb",
    ),
  ] {
    assert_text_every_split(html, expected);
  }
  // Markdown keeps the tab before its hard break.
  assert_eq!(md("<p>a&#9;<br>x</p>"), "a\t  \nx");
}

// ── Raw <br> after a closed inline element ──

#[test]
fn raw_br_keeps_the_space_a_closed_inline_element_deferred() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<h2>a<em>x </em><br>x</h2>", "## a*x* <br>x"),
    ("<h2><em>x </em><br><br>x</h2>", "## *x* <br><br>x"),
    ("<h2>a<a href=\"/l\">x </a><br>x</h2>", "## a [x](/l) <br>x"),
    (
      "<table><tr><td>a<em>x </em><br>x</td></tr></table>",
      "| a*x* <br>x |\n| --- |",
    ),
    // A Markdown hard break still subsumes the space.
    ("<p>a<em>x </em><br>x</p>", "a*x*  \nx"),
  ] {
    assert_every_split(html, &options, expected);
  }
}

// ── Empty figcaption ──

#[test]
fn figcaption_with_only_markers_emits_nothing() {
  // `****` alone on a line is a thematic break; an empty caption must not
  // invent one. An empty caption is dropped like `<figcaption></figcaption>`.
  assert_eq!(md("e<figcaption><em><div></div></em></figcaption>A"), "eA");
  assert_eq!(md("e<figcaption><em><div></figcaption>A"), "eA");
  assert_eq!(md("<figcaption><em><div></div></em></figcaption>"), "");
  assert_eq!(md("e<figcaption><em></em></figcaption>A"), "eA");
  assert_eq!(
    md("e<figcaption><b><del><div></div></del></b></figcaption>A"),
    "eA"
  );
  // A link is content even when empty.
  assert_eq!(
    md("<figcaption><a href=\"/x\"><br></a></figcaption>"),
    "*[  \n](/x)*"
  );
  let html = "e<figcaption><em><div></div></em></figcaption>A";
  for chunk in 1..=html.len() {
    assert_eq!(md_streamed(html, chunk), "eA", "chunk={chunk}");
  }
}

// ── wrapWidth in a figcaption ──

#[test]
fn wrapped_caption_text_owns_no_leading_space() {
  // `* C*` at a line start is a list item, not emphasis.
  assert_eq!(
    md_wrapped("<figcaption><div>C</div></figcaption>", 40),
    "*C*"
  );
  assert_eq!(md_wrapped("<figcaption><blockquote>x", 40), "> *x*");
  // Unwrapped output is the reference.
  assert_eq!(md("<figcaption><div>C</div></figcaption>"), "*C*");
}

// ── tagOverrides spacing on a built-in inline tag ──

fn md_block_override(html: &str, tag: &str) -> String {
  html_to_markdown(
    html,
    HtmlToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(vec![(
          tag.to_string(),
          TagOverrideConfig {
            is_inline: Some(false),
            spacing: Some([2, 2]),
            ..Default::default()
          },
        )]),
        ..Default::default()
      }),
      ..Default::default()
    },
  )
}

#[test]
fn block_override_on_inline_tag_keeps_its_spacing() {
  assert_eq!(md_block_override("e<span>m</span>", "span"), "e\n\nm");
  assert_eq!(md_block_override("e<span>m</span>x", "span"), "e\n\nm\n\nx");
  // A custom element with the same override already worked.
  assert_eq!(md_block_override("e<x-foo>m</x-foo>", "x-foo"), "e\n\nm");
}

// ── Link text before an empty element ──

#[test]
fn link_text_drops_the_space_before_an_empty_element() {
  assert_eq!(md(r#"<a href="/x">A <span></span> </a>"#), "[A](/x)");
  assert_eq!(md(r#"x <a href="/x">A <i></i></a>y"#), "x [A](/x) y");
  assert_eq!(
    md_streamed(r#"<a href="/x">A <svg></svg> </a> b"#, 1),
    "[A](/x) b"
  );
  // The title still matches the trimmed text.
  assert_eq!(
    md(r#"<a href="/x" title="Ab ">Ab <span></span></a>"#),
    "[Ab](/x)"
  );
  // A hard break's continuation indent stays.
  assert_eq!(
    md(r#"<ul><li><a href="/x">q<br> </a></li></ul>"#),
    "- [q  \n  ](/x)"
  );
}

#[test]
fn raw_html_blocks_end_before_following_markdown() {
  let cases = [
    (
      "<dl><dd><details>X</details></dd></dl><strong>B</strong>",
      "<dl><dd>\n\n<details>X</details>\n\n\n\n</dd></dl>\n\n**B**",
    ),
    (
      "<blockquote><address>A</address><blockquote><strong>B</strong></blockquote></blockquote>",
      "> <address>A</address>\n>\n> > **B**",
    ),
    (
      "<address>A</address><sup>Z</sup> tail",
      "<address>A</address>\n\n<sup>Z</sup> tail",
    ),
    ("<address>A</address> tail", "<address>A</address>\n\ntail"),
    (
      "<address>A</address>&#32;&#32;&#32;&#32;tail",
      "<address>A</address>\n\ntail",
    ),
    (
      "<address>A</address>&#9;tail",
      "<address>A</address>\n\ntail",
    ),
    (
      "<address>A</address>&#13;&#10;tail",
      "<address>A</address>\n\ntail",
    ),
    (
      "<address>A</address>&nbsp;tail",
      "<address>A</address>\n\n\u{a0}tail",
    ),
    (
      "<address>A</address>&#32;&#11;tail",
      "<address>A</address>\n\n\u{b}tail",
    ),
    (
      "<ul><li><address>A</address> tail</li></ul>",
      "- <address>A</address>\n\n  tail",
    ),
    (
      "<blockquote><address>A</address> tail</blockquote>",
      "> <address>A</address>\n>\n> tail",
    ),
    (
      "<address>A</address> <b>x</b>",
      "<address>A</address> \n\n**x**",
    ),
    (
      "<ul><li><address>A</address><blockquote><strong>B</strong></blockquote></li></ul>",
      "- <address>A</address>\n\n  > **B**",
    ),
    (
      "<p>PPPPPPPPPPPPPPPPPP</p><blockquote><dl>A</dl><strong>B</strong></blockquote>",
      "PPPPPPPPPPPPPPPPPP\n\n> <dl>A</dl>\n>\n> **B**",
    ),
    (
      "<address>A</address><strong>B</strong>",
      "<address>A</address>\n\n**B**",
    ),
    (
      "<ul><li><address>A</address><strong>B</strong></li></ul>",
      "- <address>A</address>\n\n  **B**",
    ),
    (
      "prefix <address>A</address><strong>B</strong>",
      "prefix <address>A</address>**B**",
    ),
    ("<dl>A</dl><strong>B</strong>", "<dl>A</dl>\n\n**B**"),
    (
      "<ul><li><dl>A</dl><strong>B</strong></li></ul>",
      "- <dl>A</dl>\n\n  **B**",
    ),
    (
      "prefix <dl>A</dl><strong>B</strong>",
      "prefix <dl>A</dl>**B**",
    ),
    ("<dt>A</dt><strong>B</strong>", "<dt>A</dt>\n\n**B**"),
    (
      "<ul><li><dt>A</dt><strong>B</strong></li></ul>",
      "- <dt>A</dt>\n\n  **B**",
    ),
    (
      "prefix <dt>A</dt><strong>B</strong>",
      "prefix <dt>A</dt>\n**B**",
    ),
    ("<dd>A</dd><strong>B</strong>", "<dd>A</dd>\n\n**B**"),
    (
      "<ul><li><dd>A</dd><strong>B</strong></li></ul>",
      "- <dd>A</dd>\n\n  **B**",
    ),
    (
      "prefix <dd>A</dd><strong>B</strong>",
      "prefix <dd>A</dd>\n**B**",
    ),
    (
      "<details>A</details><strong>B</strong>",
      "<details>A</details>\n\n\n\n**B**",
    ),
    (
      "<ul><li><details>A</details><strong>B</strong></li></ul>",
      "- <details>A</details>\n\n**B**",
    ),
    (
      "prefix <details>A</details><strong>B</strong>",
      "prefix\n\n<details>A</details>\n\n\n\n**B**",
    ),
    (
      "<summary>A</summary><strong>B</strong>",
      "<summary>A</summary>\n\n\n\n**B**",
    ),
    (
      "<ul><li><summary>A</summary><strong>B</strong></li></ul>",
      "- <summary>A</summary>\n\n**B**",
    ),
    (
      "prefix <summary>A</summary><strong>B</strong>",
      "prefix\n\n<summary>A</summary>\n\n\n\n**B**",
    ),
    (
      "<ul><li><dl><dt>T</dt><dd>D</dd></dl><strong>B</strong></li></ul>",
      "- <dl><dt>T</dt><dd>D</dd></dl>\n\n  **B**",
    ),
    (
      "<address>A</address><code>C</code>",
      "<address>A</address>\n\n`C`",
    ),
    ("<dd>D</dd><a href=\"/x\">L</a>", "<dd>D</dd>\n\n[L](/x)"),
    (
      "<blockquote><address>A</address><em>E</em></blockquote>",
      "> <address>A</address>\n>\n> *E*",
    ),
    (
      "<ol start=\"12\"><li><address>A</address><em>E</em></li></ol>",
      "12. <address>A</address>\n\n    *E*",
    ),
    (
      "<ul><li>outer<ul><li><address>A</address><strong>B</strong></li></ul></li></ul>",
      "- outer\n  - <address>A</address>\n\n    **B**",
    ),
    (
      "<address>A</address><br><strong>B</strong>",
      "<address>A</address>  \n\n**B**",
    ),
    ("<dt>A</dt><br><strong>B</strong>", "<dt>A</dt>\n  \n**B**"),
    (
      "<dt>A</dt><h2><a href=\"/x\">Heading</a></h2>",
      "<dt>A</dt>\n\n## [Heading](/x)",
    ),
    (
      "<ul><li><address>A</address><pre>C</pre></li></ul>",
      "- <address>A</address>\n\n  ```\n  C\n  ```",
    ),
    (
      "<ul><li><address>A</address><ul><li>B</li></ul></li></ul>",
      "- <address>A</address>\n\n  - B",
    ),
    (
      "<address><p>A</p></address><strong>B</strong>",
      "<address>A</address>\n\n**B**",
    ),
    (
      "<address>A</address>&lt;literal&gt; *text*",
      "<address>A</address>\n\n\\<literal> \\*text\\*",
    ),
    (
      "<address>A</address><address>B</address><strong>B</strong>",
      "<address>A</address><address>B</address>\n\n**B**",
    ),
    ("<address>A</address>", "<address>A</address>"),
    (
      "<ul><li><address>A</address></li><li><strong>B</strong></li></ul>",
      "- <address>A</address>\n- **B**",
    ),
    (
      "<table><tr><th>H</th></tr><tr><td><address>A</address><strong>B</strong></td></tr></table>",
      "| H |\n| --- |\n| <address>A</address>**B** |",
    ),
    (
      "<table><tr><th>H</th></tr><tr><td><dl>A</dl><strong>B</strong></td></tr></table>",
      "| H |\n| --- |\n| <dl>A</dl>**B** |",
    ),
    (
      "<table><tr><th>H</th></tr><tr><td><dt>A</dt><strong>B</strong></td></tr></table>",
      "| H |\n| --- |\n| <dt>A</dt>**B** |",
    ),
    (
      "<table><tr><th>H</th></tr><tr><td><dd>A</dd><strong>B</strong></td></tr></table>",
      "| H |\n| --- |\n| <dd>A</dd>**B** |",
    ),
    (
      "<table><tr><th>H</th></tr><tr><td><details>A</details><strong>B</strong></td></tr></table>",
      "| H |\n| --- |\n| <details>A</details>**B** |",
    ),
    (
      "<table><tr><th>H</th></tr><tr><td><summary>A</summary><strong>B</strong></td></tr></table>",
      "| H |\n| --- |\n| <summary>A</summary>**B** |",
    ),
  ];
  for (html, expected) in cases {
    assert_eq!(md(html), expected, "{html}");
    for width in 1..=html.len() {
      assert_eq!(md_streamed(html, width), expected, "{html}, width {width}");
    }
  }
}
