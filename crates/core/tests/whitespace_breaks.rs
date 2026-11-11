//! Block spacing, hard breaks, and inline whitespace at element boundaries.
use mdream::types::{
  CleanConfig, ExtractionConfig, FilterConfig, HtmlToMarkdownOptions, OutputFormat, PluginConfig,
  TagOverrideConfig,
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

#[test]
fn relocated_link_space_is_a_wrap_boundary() {
  for (html, expected) in [
    (
      r#"<a href="x">text <span></span></a>tail"#,
      "[text](x)\ntail",
    ),
    (
      r#"<a href="x"><img src="i" alt="A"> <span></span></a>tail"#,
      "[![A](i)](x)\ntail",
    ),
  ] {
    assert_eq!(md_wrapped(html, 12), expected);
    for width in 1..=html.len() {
      let mut processor =
        MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default().with_wrap_width(12));
      let mut output = String::new();
      for chunk in html.as_bytes().chunks(width) {
        output.push_str(&processor.process_chunk(std::str::from_utf8(chunk).unwrap()));
      }
      output.push_str(&processor.finish());
      assert_eq!(output, expected, "chunk width={width}");
    }
  }
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
    ("<p>a&#9; &#9;</p><p>b</p>", "a\n\nb"),
    ("<ul><li>a&#9;<ul><li>b</li></ul></li></ul>", "a\nb"),
    ("<pre>a&#9;</pre>x", "a\n\nx"),
    ("<div><pre>x<b>a&#9;</b></pre>y</div>", "xa\n\ny"),
    // Preformatted text and table cells keep their tabs: in a row, the tab
    // before a non-first cell is the column separator.
    ("<pre>a&#9;<br>x</pre>", "a\t\nx"),
    ("<pre>a&#9;<p>b</p></pre>", "a\t\n\nb"),
    (
      "<table><tr><td>a&#9;</td></tr><tr><td>b</td></tr></table>",
      "a\t\nb",
    ),
    ("<table><tr><td>a&#9;<br>x</td></tr></table>", "a\t\nx"),
    ("<table><tr><td>a</td><td><br>b</td></tr></table>", "a\t\nb"),
    (
      "<table><tr><td>a</td><td>&#9;<br>b</td></tr></table>",
      "a\t\t\nb",
    ),
    (
      "<table><tr><td>a</td><td>b&#9;<br>c</td></tr></table>",
      "a\tb\t\nc",
    ),
    (
      "<table><tr><td>a</td><td>b&#9; <br>c</td></tr></table>",
      "a\tb\t\nc",
    ),
    ("<table><tr><th>a</th><th><br>b</th></tr></table>", "a\t\nb"),
    (
      "<table><tr><td><pre>a &#9;</pre><br>c</td></tr></table>",
      "a \t\nc",
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

// ── wrapWidth at a separator trimmed from an inline element ──

fn assert_every_text_chunking(html: &str, options: &HtmlToMarkdownOptions, expected: &str) {
  assert_eq!(html_to_text(html, options.clone()), expected, "html={html}");
  for chunk in 1..=html.len() {
    let mut p = MarkdownStreamProcessor::new_with_format(options.clone(), OutputFormat::Text);
    let mut out = String::new();
    for c in html.as_bytes().chunks(chunk) {
      out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "html={html} chunk={chunk}");
  }
}

#[test]
fn wrap_breaks_at_a_separator_trimmed_from_an_inline_element() {
  // The space `</span>` or `</em>` trims is the only break point, so a line
  // that would pass the width breaks there.
  let wrap = |width| HtmlToMarkdownOptions::default().with_wrap_width(width);
  for (html, width, expected) in [
    ("<p><span>aaaaa </span>bbbb</p>", 6, "aaaaa\nbbbb"),
    ("<p><em>aaaaaaaaaaa </em>b</p>", 12, "*aaaaaaaaaaa*\nb"),
    (
      "<p><a href=\"/x\">aaaaa </a>bbbb cc</p>",
      12,
      "[aaaaa](/x)\nbbbb cc",
    ),
    ("<p><code>aaaaa </code>bbbb cc</p>", 6, "`aaaaa`\nbbbb\ncc"),
    (
      "<p><em>aaaaa </em><span>bbbb </span>cccc dd</p>",
      6,
      "*aaaaa*\nbbbb\ncccc\ndd",
    ),
    (
      "<ul><li><em>aaaaaaa </em>bbbb cc dddd</li></ul>",
      12,
      "- *aaaaaaa*\n  bbbb cc\n  dddd",
    ),
    (
      "<ol><li><strong>aaaaa </strong>bbbb cc</li></ol>",
      6,
      "1. **aaaaa**\n   bbbb\n   cc",
    ),
    (
      "<blockquote><p><em>aaaaaaa </em>bbbb cc dddd</p></blockquote>",
      12,
      "> *aaaaaaa*\n> bbbb cc dddd",
    ),
    (
      "<blockquote><ul><li><span>aaaaa </span>bbbb cc</li></ul></blockquote>",
      6,
      "> - aaaaa\n>   bbbb\n>   cc",
    ),
    (
      "<p><strong>aaaaa </strong>bbbb cc</p>",
      80,
      "**aaaaa** bbbb cc",
    ),
  ] {
    assert_every_chunking(html, &wrap(width), expected);
  }
  for (html, width, expected) in [
    ("<p><span>aaaaa </span>bbbb</p>", 6, "aaaaa\nbbbb"),
    ("<p><em>aaaaaaaaaaa </em>b</p>", 12, "aaaaaaaaaaa\nb"),
    (
      "<p>wwww<a href=\"/c\"><span>x</span> </a>yyyy end</p>",
      12,
      "wwwwx yyyy\nend",
    ),
  ] {
    assert_every_text_chunking(html, &wrap(width), expected);
  }
}

#[test]
fn wrap_never_breaks_before_a_block_marker() {
  // Text escaped mid-line leaves `-`, `>`, `#`, `1)`, `===` or `~~~` bare, so a
  // break before one would open a list, quote, heading or fence. The marker
  // keeps its space and overflows instead.
  let wrap = |width| HtmlToMarkdownOptions::default().with_wrap_width(width);
  for (html, width, expected) in [
    (
      "<p>The configuration guide explains each option in detail, so read it first <b>Price </b>- 5 dollars per month for every user seat.</p>",
      80,
      "The configuration guide explains each option in detail, so read it first **Price** -\n5 dollars per month for every user seat.",
    ),
    (
      "<p>The configuration guide explains each option in detail, so read it before <code>count </code>&gt; 5 triggers the warning in the log.</p>",
      80,
      "The configuration guide explains each option in detail, so read it before `count` >\n5 triggers the warning in the log.",
    ),
    (
      "<p>The configuration guide explains each option in detail, so read it to see <a href=\"/issues\">Issue </a># 42 for the full discussion.</p>",
      80,
      "The configuration guide explains each option in detail, so read it to see [Issue](/issues) #\n42 for the full discussion.",
    ),
    (
      "<p>The configuration guide explains each option in detail, so read it until the <em>end </em>---</p><p>Next paragraph.</p>",
      80,
      "The configuration guide explains each option in detail, so read it until the *end* ---\n\nNext paragraph.",
    ),
    ("<p><span>aaaaa </span>- bbbb</p>", 6, "aaaaa -\nbbbb"),
    ("<p>aaaaa - bbbb</p>", 6, "aaaaa -\nbbbb"),
    ("<p>aaaaa &gt;b</p>", 6, "aaaaa >b"),
    ("<p>aaaaa ## b</p>", 6, "aaaaa ##\nb"),
    ("<p>aaaaa 1) bb</p>", 6, "aaaaa 1)\nbb"),
    ("<p>aaaaa ===</p>", 6, "aaaaa ==="),
    ("<ul><li>aaaaa - bbbb</li></ul>", 8, "- aaaaa -\n  bbbb"),
    // A raw HTML line skips the GFM escape, so `~~~` would open a fence that
    // swallows the rest of the document.
    (
      "<details><summary>S</summary><code>aaaaaaaa </code>~~~</details><p>After.</p>",
      12,
      "<details>\n\n<summary>S</summary>\n\n\n\n<code>aaaaaaaa</code> ~~~</details>\n\n\n\nAfter.",
    ),
    (
      "<details><summary>S</summary><code>aaaaaaaa</code> - x</details><p>After.</p>",
      12,
      "<details>\n\n<summary>S</summary>\n\n\n\n<code>aaaaaaaa</code> -\nx</details>\n\n\n\nAfter.",
    ),
    // Escaped or not a marker: the break stays.
    ("<p>aaaaa * bbbb</p>", 6, "aaaaa\n\\*\nbbbb"),
    ("<p>aaaaa 1.5 bb</p>", 6, "aaaaa\n1.5 bb"),
    ("<p>aaaaa ####### b</p>", 6, "aaaaa\n#######\nb"),
  ] {
    assert_every_chunking(html, &wrap(width), expected);
  }
  // Plain text has no block syntax to protect.
  assert_every_text_chunking(
    "<p><span>aaaaa </span>- bbbb</p>",
    &wrap(6),
    "aaaaa\n- bbbb",
  );
}

#[test]
fn wrap_only_protects_ordered_markers_starting_at_one() {
  let options = HtmlToMarkdownOptions::default().with_wrap_width(6);
  for (marker, expected) in [
    ("2015.", "aaaaa\n2015.\nbb"),
    ("0)", "aaaaa\n0) bb"),
    ("2.", "aaaaa\n2. bb"),
    ("2)", "aaaaa\n2) bb"),
    ("1.", "aaaaa 1.\nbb"),
    ("1)", "aaaaa 1)\nbb"),
    ("01.", "aaaaa 01.\nbb"),
    ("000000001)", "aaaaa 000000001)\nbb"),
    ("0000000001)", "aaaaa\n0000000001)\nbb"),
  ] {
    for text in ["aaaaa ", "<span>aaaaa </span>"] {
      let html = format!("<p>{text}{marker} bb</p>");
      assert_every_chunking(&html, &options, expected);
    }
  }
  assert_every_chunking(
    "<p>browsers since July 2015.</p>",
    &HtmlToMarkdownOptions::default().with_wrap_width(20),
    "browsers since July\n2015.",
  );
}

#[test]
fn horizontal_rule_stays_separate_inside_filtered_list_items() {
  let options = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::include(&["hr", "p"])),
      ..Default::default()
    }),
    ..Default::default()
  };
  for (html, expected) in [
    ("<ul><li><p>b</p><hr></li></ul>", "b\n\n---"),
    ("<ul><li><p>b</p><hr><p>c</p></li></ul>", "b\n\n---\n\nc"),
    (
      "<ul><li><ul><li><p>b</p><hr></li></ul></li></ul>",
      "b\n\n---",
    ),
    ("<ul><li><hr></li></ul>", "---"),
    (
      "<p>before</p><ul><li><ul><li><hr></li></ul></li></ul><p>after</p>",
      "before\n\n---\n\nafter",
    ),
    (
      "<ul><li><ul><li><hr><p>after</p></li></ul></li></ul>",
      "---\n\nafter",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
}

#[test]
fn wrapped_ordered_marker_completed_by_an_inline_node_is_escaped() {
  for delimiter in [".", ")"] {
    let html = format!("<p><span>aaaaa </span><span>1</span>{delimiter} bb</p>");
    let expected = format!("aaaaa\n1\\{delimiter} bb");
    assert_every_chunking(
      &html,
      &HtmlToMarkdownOptions::default().with_wrap_width(6),
      &expected,
    );
  }
  for (tail, expected) in [
    ("<span>0</span>1) bb", "aaaaa\n01\\)\nbb"),
    ("<span>00000000</span>1) bb", "aaaaa\n000000001\\)\nbb"),
    ("<span>000000000</span>1) bb", "aaaaa\n0000000001)\nbb"),
    ("<span>2</span>) bb", "aaaaa\n2) bb"),
    ("<span>1</span>0) bb", "aaaaa\n10) bb"),
    ("<span>1</span>.5 bb", "aaaaa\n1.5 bb"),
    ("<span>1</span> bb", "aaaaa\n1 bb"),
    ("<span>1 </span>) bb", "aaaaa\n1 ) bb"),
  ] {
    assert_every_chunking(
      &format!("<p><span>aaaaa </span>{tail}</p>"),
      &HtmlToMarkdownOptions::default().with_wrap_width(6),
      expected,
    );
  }
  for (html, width, expected) in [
    (
      "<ul><li>x<ul><li><span>aaaaa </span><span>1</span>) bb</li></ul></li></ul>",
      10,
      "- x\n  - aaaaa\n    1\\) bb",
    ),
    (
      "<blockquote><p><span>aaaaa </span><span>1</span>) bb</p></blockquote>",
      6,
      "> aaaaa\n> 1\\) bb",
    ),
    (
      "<p><span>aaaaa </span><span>1</span>) bb</p>",
      0,
      "aaaaa 1) bb",
    ),
  ] {
    assert_every_chunking(
      html,
      &HtmlToMarkdownOptions::default().with_wrap_width(width),
      expected,
    );
  }
  assert_every_text_chunking(
    "<p><span>aaaaa </span><span>1</span>) bb</p>",
    &HtmlToMarkdownOptions::default().with_wrap_width(6),
    "aaaaa\n1) bb",
  );
}

#[test]
fn split_ordered_marker_is_escaped_with_and_without_wrapping() {
  for width in [0, 40] {
    let options = HtmlToMarkdownOptions::default().with_wrap_width(width);
    for (html, expected) in [
      ("<p>1<span>. x</span></p>", "1\\. x"),
      ("<p>aaaa<br>1<span>. x</span></p>", "aaaa  \n1\\. x"),
      ("<p>aaaa<br>2<span>. x</span></p>", "aaaa  \n2\\. x"),
      ("<p>aa<br><br>2<span>. x</span></p>", "aa  \n  \n2\\. x"),
      ("<p>aaaa</p><p>2<span>. x</span></p>", "aaaa\n\n2\\. x"),
      ("<p>2<span>) x</span></p>", "2\\) x"),
      ("<p>1<span>0. x</span></p>", "10\\. x"),
      ("<p>12345678<span>9. x</span></p>", "123456789\\. x"),
      ("<p>12345678<span>90. x</span></p>", "1234567890. x"),
      ("<ul><li>1<span>. x</span></li></ul>", "- 1\\. x"),
      (
        "<blockquote><p>1<span>. x</span></p></blockquote>",
        "> 1\\. x",
      ),
      ("<p>a 1<span>. x</span></p>", "a 1. x"),
      ("<p>1<span>.5 x</span></p>", "1.5 x"),
      ("<p><span>1 </span>. x</p>", "1 . x"),
    ] {
      assert_every_chunking(html, &options, expected);
    }
  }
}

#[test]
fn split_marker_is_escaped_after_streaming_drain() {
  let prefix = "x".repeat(9000);
  let html = format!("<p>{prefix}</p><p><span>aaaaa </span><span>1</span>) bb</p>");
  let expected = format!("{prefix}\n\naaaaa\n1\\) bb");
  let options = HtmlToMarkdownOptions::default().with_wrap_width(6);
  assert_eq!(html_to_markdown(&html, options.clone()), expected);
  for size in [3, 1024] {
    let mut stream = MarkdownStreamProcessor::new(options.clone());
    let mut output = String::new();
    for chunk in html.as_bytes().chunks(size) {
      output.push_str(&stream.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    output.push_str(&stream.finish());
    assert_eq!(output.trim_end(), expected);
  }
}

#[test]
fn filtered_rule_keeps_both_block_boundaries() {
  let options = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::include(&["hr", "p", "br", "span"])),
      ..Default::default()
    }),
    ..Default::default()
  };
  for (html, expected) in [
    ("<ul><li><hr><span>c</span></li></ul>", "---\n\nc"),
    ("<ul><li><p>b</p><br><hr></li></ul>", "b  \n\n---"),
  ] {
    assert_every_chunking(html, &options, expected);
  }
  assert_every_chunking(
    "<ul><li>b<br><hr></li></ul>",
    &HtmlToMarkdownOptions::default(),
    "- b  \n  ***",
  );
}

#[test]
fn continued_line_gets_no_marker_from_a_dropped_blockquote() {
  // A blockquote the filter or a literal override dropped writes no `>`, so a
  // wrapped or hard-broken line inside it must not start with one either.
  let include = |selector: &str| HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::include(&[selector])),
      ..Default::default()
    }),
    ..Default::default()
  };
  let literal = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "blockquote".to_string(),
        TagOverrideConfig {
          enter: Some("[".to_string()),
          exit: Some("]".to_string()),
          ..Default::default()
        },
      )]),
      ..Default::default()
    }),
    ..Default::default()
  };
  for (html, options, expected) in [
    (
      "<blockquote><p><span>aaaaaaa </span>bbbb</p></blockquote>",
      include("p").with_wrap_width(8),
      "aaaaaaa\nbbbb",
    ),
    (
      "<blockquote><p>aaaaaaa b</p></blockquote>",
      include("p").with_wrap_width(8),
      "aaaaaaa\nb",
    ),
    (
      "<blockquote><p>aaaaaaa<br>b</p></blockquote>",
      include("p"),
      "aaaaaaa  \nb",
    ),
    (
      "<blockquote><p>aaaaaaa b</p></blockquote>",
      literal.clone().with_wrap_width(8),
      "[\n\naaaaaaa\nb\n\n]",
    ),
    (
      "<blockquote><p>aaaaaaa<br>b</p></blockquote>",
      literal,
      "[\n\naaaaaaa  \nb\n\n]",
    ),
    // A rendered blockquote still prefixes every line.
    (
      "<blockquote><blockquote><p>aaaaaaa b</p></blockquote></blockquote>",
      include("blockquote").with_wrap_width(8),
      "> > aaaaaaa\n> > b",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
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

// ── Inline delimiters around removed content ──

#[test]
fn space_after_removed_content_stays_outside_the_opening_delimiter() {
  let options = HtmlToMarkdownOptions::default();
  for html in [
    r#"<p>Install. <strong><svg><path d="M0"/></svg> Warning:</strong> read</p>"#,
    "<p>Install. <strong><script>x</script> Warning:</strong> read</p>",
    "<p>Install. <strong><span></span> Warning:</strong> read</p>",
    // With nothing to merge into, the space moves in front of the delimiter.
    "<p>Install.<strong><svg></svg> Warning:</strong> read</p>",
    "<p>Install.<strong> Warning:</strong> read</p>",
  ] {
    assert_every_chunking(html, &options, "Install. **Warning:** read");
  }
  let hidden = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::default()),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_every_chunking(
    "<p>Install. <strong><span hidden>!</span> Warning:</strong> read</p>",
    &hidden,
    "Install. **Warning:** read",
  );
  // Text that is only spaces still parts the words.
  assert_every_chunking("<p>x<em><span hidden>h</span> </em>y</p>", &hidden, "x y");
  assert_every_chunking(
    "<p>x<em><span hidden>h</span> <span>y</span></em></p>",
    &hidden,
    "x *y*",
  );
  assert_eq!(
    md("<p>Install. <em><svg></svg> Warning:</em> read</p>"),
    "Install. *Warning:* read"
  );
  assert_eq!(
    md("<p>Install. <del><svg></svg> Warning:</del> read</p>"),
    "Install. ~~Warning:~~ read"
  );
  assert_eq!(
    md("<p><strong><svg></svg> Warning:</strong> read</p>"),
    "**Warning:** read"
  );
  assert_eq!(
    md("<p>x<em><strong><svg></svg> y</strong></em> z</p>"),
    "x ***y*** z"
  );
  assert_eq!(
    md("<ul><li><strong><svg></svg> y</strong></li></ul>"),
    "- **y**"
  );
  // Removed content alone leaves an empty pair, dropped like any other.
  assert_eq!(
    md("<p>a <strong><svg></svg></strong> b</p>"),
    md("<p>a <strong></strong> b</p>")
  );
  // A code span keeps the spaces of its content.
  assert_eq!(
    md("<p>Install. <code><svg></svg> Warning:</code> read</p>"),
    "Install. ` Warning:` read"
  );
}

#[test]
fn moved_space_stays_out_of_the_start_of_link_text() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    (
      "<p><a href=\"/x\"><strong><svg></svg> now</strong></a></p>",
      "[**now**](/x)",
    ),
    (
      "<p>Go<a href=\"/x\"><strong> now</strong></a></p>",
      "Go [**now**](/x)",
    ),
    // Nothing else parts the words, so the space stays after the bracket.
    (
      "<p><em>x</em><a href=\"/x\"><strong> now</strong></a></p>",
      "*x*[ **now**](/x)",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
}

#[test]
fn blank_opening_emphasis_keeps_the_word_separator() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<p>a<strong> <span>b</span></strong></p>", "a **b**"),
    ("<p>a<strong> </strong>b</p>", "a b"),
    ("<p>a<em> <span>b</span></em></p>", "a *b*"),
    ("<p>a<b>\n<span>b</span></b></p>", "a **b**"),
    ("<p>a<i>\t <span>b</span></i></p>", "a *b*"),
    ("<p>a<cite>   <span>b</span></cite></p>", "a *b*"),
    ("<p>a<strong> <svg></svg>b</strong></p>", "a **b**"),
    ("<p>a<strong> <em>b</em></strong></p>", "a ***b***"),
    (
      "<p>a<strong><em> <span>b</span></em></strong></p>",
      "a ***b***",
    ),
    (
      "<p><em>x</em><strong> <span>b</span></strong></p>",
      "*x* **b**",
    ),
    // Already parted, or at the start of the line: nothing to add.
    ("<p>a <strong> <span>b</span></strong></p>", "a **b**"),
    ("<p><strong> <span>b</span></strong></p>", "**b**"),
    ("<p>a<br><strong> <span>b</span></strong></p>", "a  \n**b**"),
    // An empty pair owes its separator to what follows it, once.
    ("<p>a<strong> </strong> b</p>", "a b"),
    ("<p>a<em> </em><strong> </strong>b</p>", "a b"),
    ("<p>a<strong> </strong><em></em> b</p>", "a b"),
    ("<p>a<strong> </strong></p>", "a"),
  ] {
    assert_every_chunking(html, &options, expected);
  }
  assert_eq!(
    md("<ul><li>a<strong> <span>b</span></strong></li></ul>"),
    "- a **b**"
  );
  assert_eq!(md("<h2>a<strong> </strong>b</h2>"), "## a b");
  assert_eq!(
    md("<table><tr><th>h</th></tr><tr><td>a<strong> <span>b</span></strong></td></tr></table>"),
    "| h |\n| --- |\n| a **b** |"
  );
  assert_eq!(
    md(r#"<p><a href="/x">a<strong> <span>b</span></strong></a></p>"#),
    "[a **b**](/x)"
  );
  assert_eq!(
    md(r#"<p><a href="/x"><span>x</span><strong> </strong><em></em></a></p>"#),
    "[x](/x)"
  );
}

#[test]
fn blank_behind_an_element_that_writes_nothing_keeps_the_word_separator() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    (
      r#"<p>Click<strong><span class="w"> <a href="/x">here</a></span></strong> now</p>"#,
      "Click **[here](/x)** now",
    ),
    (
      "<p>a<strong><span> <span>b</span></span></strong></p>",
      "a **b**",
    ),
    ("<p>a<strong><span> </span></strong>b</p>", "a b"),
    ("<p>a<strong><span> </span>b</strong></p>", "a **b**"),
    (
      "<p>a<em><span> <strong>b</strong></span></em></p>",
      "a ***b***",
    ),
    (
      "<p>a<strong><font> <span>b</span></font></strong></p>",
      "a **b**",
    ),
    (
      "<p>a<strong><span>\n</span><span>b</span></strong></p>",
      "a **b**",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
}

#[test]
fn blank_that_follows_no_opener_is_owed_to_later_text() {
  let options = HtmlToMarkdownOptions::default();
  // A line break or the end of the block drops it, later text that brings its
  // own space needs no other, and code keeps its content as written.
  for (html, expected) in [
    // A nested pair of the same kind writes no delimiter of its own.
    ("<p><i>x<i> <svg></svg></i></i></p>", "*x*"),
    ("<p>a<b>x<b> <svg></svg></b></b>z</p>", "a**x**z"),
    ("<p><i>a<i> <svg></svg> x</i></i></p>", "*a x*"),
    (
      "<p>x<b>y<b> <strong></strong><br>z</b></b></p>",
      "x**y  \nz**",
    ),
    // Code keeps its content as written, and the blank is none of it.
    ("<p><code>a<del> </del></code>z</p>", "`a `z"),
    (
      "<p><code>a<strong> <svg></svg> b</strong></code></p>",
      "`a** b**`",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
  let no_strong_delimiters = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "strong".to_string(),
        TagOverrideConfig {
          enter: Some(String::new()),
          exit: Some(String::new()),
          ..Default::default()
        },
      )]),
      ..Default::default()
    }),
    ..Default::default()
  };
  for html in [
    "<p>a<strong> <svg></svg> b</strong></p>",
    "a<strong> <svg></svg> b</strong>",
  ] {
    assert_every_chunking(html, &no_strong_delimiters, "a b");
  }
  let clean = HtmlToMarkdownOptions {
    clean: Some(CleanConfig::all()),
    ..Default::default()
  };
  assert_every_chunking(
    r##"<p>a<b>x<b> <a href="#"></a></b></b></p>"##,
    &clean,
    "a**x**",
  );
  // The link clean drops is no text; the `z` after the pair is.
  assert_every_chunking(
    r##"<p><i>x<i> <a href="#"></a></i></i>z</p>"##,
    &clean,
    "*x* z",
  );
}

#[test]
fn quote_around_a_moved_separator_is_dropped_when_empty() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<p>a<q><em> </em></q>b</p>", "a b"),
    ("<p>a<strong><q><em> </em></q></strong>b</p>", "a b"),
    ("<p>a<strong><q><em> </em></q>c</strong>b</p>", "a **c**b"),
    (
      "<p>a<strong><q><em> </em></q><em>c</em></strong>b</p>",
      "a ***c***b",
    ),
    (
      "<p>a<em><q><strong> <svg></svg></strong></q></em> b</p>",
      "a b",
    ),
    ("<p><q><cite>&#32;</cite></q></p>", ""),
  ] {
    assert_every_chunking(html, &options, expected);
  }
  // Text output writes no delimiters, so the separator stays where it was written.
  assert_eq!(
    text(r##"<p>a <q><span>y </span><q><a href="#"></a></q></q>z</p>"##),
    "a \"y \"z"
  );
  assert_eq!(
    text(r##"<p><q><i>y </i><q><a href="#"></a></q></q></p>"##),
    "\"y \""
  );
}

#[test]
fn blank_opening_an_inline_wrapper_keeps_the_word_separator() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<p>a<span> <span>b</span></span></p>", "a b"),
    ("<p>a<span> <strong>b</strong></span></p>", "a **b**"),
    ("<p>a<font> <b>x</b></font></p>", "a **x**"),
    ("<p>a<label> <span>b</span></label></p>", "a b"),
    ("<p>a<abbr> <span>b</span></abbr></p>", "a b"),
    ("<p>a<small> <span>b</span></small></p>", "a b"),
    ("<p>a<u> <span>b</span></u></p>", "a<u> b</u>"),
    ("<p>a<span><span> <span>b</span></span></span></p>", "a b"),
    (
      "<p>a<font><small> <label><b>x</b></label></small></font></p>",
      "a **x**",
    ),
    ("<p>a<span>\n  <span>b</span></span>c</p>", "a bc"),
    ("<p>a<span> </span>b</p>", "a b"),
    ("<p>a<span> <strong></strong></span>b</p>", "a b"),
    (
      "<p>a<strong>x<span> <span>b</span></span></strong></p>",
      "a**x b**",
    ),
    ("<p><strong>a<span> </span></strong>b</p>", "**a** b"),
    (
      r#"<p>a<span> <img src="/i.png" alt="i"></span></p>"#,
      "a ![i](/i.png)",
    ),
    // Already parted, or at the start of the line: nothing to add.
    ("<p>a <span> <span>b</span></span></p>", "a b"),
    ("<p><span> <strong>b</strong></span></p>", "**b**"),
    ("<p>a<br><span> <span>b</span></span></p>", "a  \nb"),
    ("<p>a<span> </span></p>", "a"),
    // A link or quote opener already parts it from a word, and code keeps its
    // content as written.
    (r#"<p>a<a href="/x"> <span>b</span></a></p>"#, "a [b](/x)"),
    ("<p>a<q> <span>b</span></q></p>", "a \"b\""),
    ("<p>a<code> <span>b</span></code></p>", "a`b`"),
    ("<p><code>a<span> <span>b</span></span></code></p>", "`ab`"),
  ] {
    assert_every_chunking(html, &options, expected);
  }
  assert_eq!(
    md("<ul><li>a<span> <span>b</span></span></li></ul>"),
    "- a b"
  );
  assert_eq!(md("<h2>a<span> <span>b</span></span></h2>"), "## a b");
  assert_eq!(
    md("<blockquote><p>a<span> <span>b</span></span></p></blockquote>"),
    "> a b"
  );
  assert_eq!(
    md("<table><tr><th>h</th></tr><tr><td>a<span> <span>b</span></span></td></tr></table>"),
    "| h |\n| --- |\n| a b |"
  );
  assert_eq!(md("a<span> <span>b</span></span>"), "a b");
}

#[test]
fn blank_opening_an_inline_wrapper_is_no_wrap_boundary() {
  // A line break may not take its place and set the text at a line start.
  for (html, width, expected) in [
    (
      "<p>aaaa<span> <span>1. b</span></span></p>",
      6,
      "aaaa 1.\nb",
    ),
    ("<p>aaaaaa<span> <span>b</span></span></p>", 6, "aaaaaa b"),
    (
      "<ul><li>aaaa<span> <span>1. b</span></span></li></ul>",
      8,
      "- aaaa 1.\n  b",
    ),
    (
      r#"<p><a href="https://example.com/docs/getting-started/installation/index.html">Read the docs</a><span> <span>1. Install the CLI</span></span></p>"#,
      80,
      "[Read the docs](https://example.com/docs/getting-started/installation/index.html) 1.\nInstall the CLI",
    ),
    // Nor at one an empty pair took along and gave back.
    (
      "<p>aaaa<span> <strong></strong><span>1. b</span></span></p>",
      6,
      "aaaa 1.\nb",
    ),
    (
      "<p>aaaa<span> <strong><svg></svg></strong><span>1. b</span></span></p>",
      6,
      "aaaa 1.\nb",
    ),
    ("<p>aaaa<strong> </strong>1. b</p>", 6, "aaaa 1.\nb"),
    (
      "<p>aaaa<b>x </b><strong></strong>1. b</p>",
      6,
      "aaaa**x** 1.\nb",
    ),
  ] {
    let options = HtmlToMarkdownOptions::default().with_wrap_width(width);
    assert_every_chunking(html, &options, expected);
  }
}

#[test]
fn separator_before_a_raw_line_break_is_preserved() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<h2>w<strong>a </strong><br>b</h2>", "## w**a** <br>b"),
    ("<h2>w<strong> </strong><br>b</h2>", "## w <br>b"),
    ("<h2>w<span> <br>b</span></h2>", "## w <br>b"),
    (
      "<table><tr><th>h</th></tr><tr><td>w<strong>a </strong><br>b</td></tr></table>",
      "| h |\n| --- |\n| w**a** <br>b |",
    ),
  ] {
    assert_every_chunking(html, &options, expected);
  }
}

#[test]
fn blank_after_a_literal_override_opener_is_dropped() {
  let with_override = |tag: &str, config: TagOverrideConfig| {
    HtmlToMarkdownOptions::default()
      .with_plugins(PluginConfig::default().with_tag_override(tag, config))
  };
  // The opener may already be streamed, so the blank cannot move in front of
  // it, and after it the blank would split it from the content.
  let span = with_override("span", TagOverrideConfig::wrap("**", "**"));
  for (html, expected) in [
    ("<p>a<span> <i>x</i></span>z</p>", "a***x***z"),
    ("<p>a<span> <b>x</b></span></p>", "a****x****"),
    ("<p>a<span> <span>x</span></span>z</p>", "a****x****z"),
    ("<p>a<span> </span>z</p>", "a****z"),
    ("<p>a<b><span> <i>x</i></span></b>z</p>", "a*****x*****z"),
  ] {
    assert_every_chunking(html, &span, expected);
  }
  assert_every_chunking(
    "<p>a<u> <i>x</i></u>z</p>",
    &with_override("u", TagOverrideConfig::wrap("__", "__")),
    "a__*x*__z",
  );
  assert_every_chunking(
    "<p>a<sup> <span>2</span></sup>z</p>",
    &with_override("sup", TagOverrideConfig::wrap("^", "^")),
    "a^2^z",
  );
  assert_every_chunking(
    "<p>a<b> <i>x</i></b>z</p>",
    &with_override("b", TagOverrideConfig::wrap("<B>", "</B>")),
    "a<B>*x*</B>z",
  );
  // An override that writes no opener keeps the separator.
  assert_every_chunking(
    "<p>a<span> <i>x</i></span>z</p>",
    &with_override("span", TagOverrideConfig::wrap("", "")),
    "a *x*z",
  );
  assert_every_chunking(
    "<p>a<span> <i>x</i></span>z</p>",
    &with_override(
      "span",
      TagOverrideConfig {
        exit: Some("!".to_string()),
        ..Default::default()
      },
    ),
    "a *x*!z",
  );
}

#[test]
fn code_like_content_is_left_as_written() {
  assert_eq!(md("<p><kbd>a<strong> x</strong></kbd></p>"), "`a** x**`");
  assert_eq!(md("<p><samp>a<em> x</em></samp></p>"), "`a* x*`");
  assert_eq!(md("<p><var>a<b><svg></svg> x</b></var></p>"), "`a** x**`");
  assert_eq!(md("<p><code>a<strong> x</strong></code></p>"), "`a** x**`");
}

#[test]
fn text_inline_separators_survive_every_chunk_width() {
  for (html, expected) in [
    ("a<figcaption> </figcaption>b", "ab"),
    (
      "<figure>a<figcaption><span> </span></figcaption>b</figure>",
      "ab",
    ),
    (
      "a<figcaption><span> <span>b</span></span></figcaption>c",
      "a\n\nb\n\nc",
    ),
    ("<p>a<span>x </span>&nbsp;<span>b</span></p>", "ax \u{a0}b"),
    ("<p>a<span> <span>b</span></span></p>", "a b"),
    ("<p>a<span> <strong>b</strong></span></p>", "a b"),
    ("<p>a<font> <b>x</b></font></p>", "a x"),
    ("<p>a<label> <span>b</span></label></p>", "a b"),
    ("<p>a<abbr> <span>b</span></abbr></p>", "a b"),
    ("<p>a<small> <span>b</span></small></p>", "a b"),
    ("<p>a<u> <span>b</span></u></p>", "a b"),
    ("<p>a<span><span> <span>b</span></span></span></p>", "a b"),
    ("<p>a<span>\n  <span>b</span></span>c</p>", "a bc"),
    ("<p>a<span> </span>b</p>", "a b"),
    ("<p>a<span> <strong></strong></span>b</p>", "a b"),
    (
      "<p>a<strong>x<span> <span>b</span></span></strong></p>",
      "ax b",
    ),
    ("<p><strong>a<span> </span></strong>b</p>", "a b"),
    ("<p>a <span> <span>b</span></span></p>", "a b"),
    ("<p><span> <strong>b</strong></span></p>", "b"),
    ("<p>a<br><span> <span>b</span></span></p>", "a\nb"),
    ("<p>a<span> </span></p>", "a"),
    ("<p>a<span> </span></p><p>b</p>", "a\n\nb"),
    ("a<span> <span>b</span></span>", "a b"),
    ("<span> <span>b</span></span>", "b"),
    ("<p>a<span> </span>&nbsp;<span>b</span></p>", "a \u{a0}b"),
    ("<p>a<span>x </span>&#160;<span>b</span></p>", "ax \u{a0}b"),
    ("<p>a<span>x </span>\u{a0}<span>b</span></p>", "ax \u{a0}b"),
    ("<p>a<span>&nbsp;<span>b</span></span></p>", "a\u{a0}b"),
    ("<p><span>&nbsp;<span>b</span></span></p>", "b"),
    ("<p>a<code> <span>b</span></code></p>", "a b"),
    ("<p><code>a<span> <span>b</span></span></code></p>", "a b"),
    ("<pre>a<span> <span>b</span></span></pre>", "a b"),
    ("<p>a<q> <span>b</span></q></p>", "a \"b\""),
    ("<p>a<q><span> </span></q>b</p>", "a b"),
    ("<p>a<a href=\"/x\"> <span>b</span></a></p>", "a b"),
    (
      "<p>a<span> <img src=\"/i.png\" alt=\"i\"></span></p>",
      "a i",
    ),
    ("<ul><li>a<span> <span>b</span></span></li></ul>", "a b"),
    ("<h2>a<span> <span>b</span></span></h2>", "a b"),
    (
      "<blockquote><p>a<span> <span>b</span></span></p></blockquote>",
      "a b",
    ),
    (
      "<table><tr><th>h</th></tr><tr><td>a<span> <span>b</span></span></td></tr></table>",
      "h\na b",
    ),
    (
      "<figure>x<figcaption><span> <span>b</span></span></figcaption></figure>",
      "x\n\nb",
    ),
    ("<p>a</p><p><span> <span>b</span></span></p>", "a\n\nb"),
    (
      "<p>a</p><p><span>&nbsp;<span>b</span></span></p>",
      "a\n\n\u{a0}b",
    ),
  ] {
    assert_eq!(text(html), expected, "html={html}");
    let chars: Vec<char> = html.chars().collect();
    for width in 1..=chars.len() {
      let mut stream = MarkdownStreamProcessor::new_with_format(
        HtmlToMarkdownOptions::default(),
        mdream::types::OutputFormat::Text,
      );
      let mut output = String::new();
      for chunk in chars.chunks(width) {
        output.push_str(&stream.process_chunk(&chunk.iter().collect::<String>()));
      }
      output.push_str(&stream.finish());
      assert_eq!(output, expected, "html={html} width={width}");
    }
  }
}

#[test]
fn text_wraps_recovered_separators_at_every_chunk_width() {
  for (html, expected) in [
    ("<p>aaa<span> <span>b</span></span></p>", "aaa\nb"),
    ("<p>aaa<span> </span>b</p>", "aaa\nb"),
    ("<p>aaa<span> <span>bb cc</span></span></p>", "aaa\nbb\ncc"),
    ("<p>aa<span> <span>b</span></span></p>", "aa\nb"),
    ("<p>a<span> <span>b</span></span></p>", "a b"),
    ("<pre>aaa<span> <span>b</span></span></pre>", "aaa b"),
  ] {
    let options = HtmlToMarkdownOptions::default().with_wrap_width(3);
    assert_eq!(html_to_text(html, options.clone()), expected, "html={html}");
    for width in 1..=html.len() {
      let mut stream = MarkdownStreamProcessor::new_with_format(
        options.clone(),
        mdream::types::OutputFormat::Text,
      );
      let mut output = String::new();
      for chunk in html.as_bytes().chunks(width) {
        output.push_str(&stream.process_chunk(std::str::from_utf8(chunk).unwrap()));
      }
      output.push_str(&stream.finish());
      assert_eq!(output, expected, "html={html} width={width}");
    }
  }
}

#[test]
fn recovered_separators_match_ordinary_separators_before_inline_producers() {
  for producer in [
    "<strong>b</strong>",
    "<em>b</em>",
    "<code>b</code>",
    "<a href=\"/x\">b</a>",
  ] {
    for (before, after) in [
      ("<p>", "</p>"),
      ("<ul><li>", "</li></ul>"),
      ("<blockquote><p>", "</p></blockquote>"),
      ("<blockquote><ul><li>", "</li></ul></blockquote>"),
    ] {
      for width in [0, 6, 8, 12] {
        let ordinary = format!("{before}aaaaa {producer}{after}");
        let recovered = format!("{before}<span>aaaaa </span>{producer}{after}");
        let options = HtmlToMarkdownOptions::default().with_wrap_width(width);
        let expected = html_to_markdown(&ordinary, options.clone());
        assert_every_chunking(&ordinary, &options, &expected);
        assert_every_chunking(&recovered, &options, &expected);
      }
    }
  }
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

/// A separator written on its own is no part of the link text, so the
/// redundant-title check keeps a `title` the text merely starts with, and
/// still drops one the whole text repeats.
#[test]
fn redundant_link_title_ignores_a_standalone_separator() {
  let cases = [
    (
      "<a href=\"/x\" title=\"Q\"><div>x</div> ",
      "[x Q](/x \"Q\")",
    ),
    ("<i><<a title=e href=/\"><p>U</p> ", "*< [U e](/\" \"e\")*"),
    ("<a href=\"/x\" title=\"Q\">Q</a>", "[Q](/x)"),
    ("<a title=\"T\" href=\"/x\">T </a>", "[T](/x)"),
    // A drain between the separator and the text must not change the answer.
    (
      "<a href title=\"Aa Bbbbbbbbb\"><span>< </span><o>Aa Bbbbbbbbb</",
      "[< Aa Bbbbbbbbb](<> \"Aa Bbbbbbbbb\")",
    ),
  ];
  for (html, expected) in cases {
    assert_eq!(md(html), expected, "{html}");
    for width in 1..=html.len() {
      assert_eq!(md_streamed(html, width), expected, "{html}, width {width}");
    }
  }
}

/// A blank at the fragment root is a word separator the output places, so
/// both engines keep it, including after a block element that writes nothing.
#[test]
fn retained_blank_at_the_fragment_root_separates_words() {
  let cases = [
    ("<span><svg>x</svg> <span>c</span></span>", "x c"),
    ("<span><svg>x</svg> <b>c</b></span>", "x **c**"),
    ("<span><svg>x</svg> y</span>", "x y"),
    ("<span> <span>c</span></span>", "c"),
    // Only a whitespace-only blank is exempt; a text node that starts with a
    // blank still loses it at a line start.
    ("<span><div>x</div> y</span>", "x\n\ny"),
  ];
  for (html, expected) in cases {
    assert_eq!(md(html), expected, "{html}");
    for width in 1..=html.len() {
      assert_eq!(md_streamed(html, width), expected, "{html}, width {width}");
    }
  }
}

/// An element that writes nothing is no boundary in text output either, so an
/// empty quotation around it still drops its pair.
#[test]
fn text_output_drops_an_empty_quotation_around_a_dropped_element() {
  let cases = [
    ("<p>a<q><strong> <svg></svg></strong></q> b</p>", "a  b"),
    ("<p>a<q><svg></svg></q>b</p>", "a b"),
    ("<p>a<q></q>b</p>", "a b"),
    ("<p>a<q>x</q>b</p>", "a \"x\"b"),
    (
      "<p>a<em><q><strong> <svg></svg></strong></q></em> b</p>",
      "a  b",
    ),
  ];
  for (html, expected) in cases {
    assert_eq!(text(html), expected, "{html}");
  }
}

// Review regressions: check the same expected output at every short split.
#[test]
fn review_div_empty() {
  let html = r#"<ul><li><span>Aa </span><i></i><div><span>Bb</span></div></li></ul>"#;
  let expected = "- Aa Bb";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_div_icons() {
  let html =
    r#"<ul><li><span>Aa </span><i><svg></svg></i><div><i><svg></svg></i>Bb</div></li></ul>"#;
  let expected = "- Aa Bb";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_div_buttons() {
  let html = r#"<button><div>Aa</div> </button> <button><div><span>Bb</span></div></button>"#;
  let expected = "Aa Bb";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_div_main() {
  let html = r#"<ul><li><span>Aa </span><div><i></i>Bb</div></li></ul>"#;
  let expected = "- Aa Bb";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_icon() {
  let html = r#"<figure><img src="/a.png"><button><svg></svg> </button><figcaption>Caption text</figcaption></figure>"#;
  let expected = "![](/a.png)\n\n*Caption text*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_em() {
  let html = r#"<figure><img src="/a.png"><button><svg></svg> </button><figcaption><em>The x.</em></figcaption></figure>"#;
  let expected = "![](/a.png)\n\n**The x.**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_main() {
  let html = r#"<button><span>x</span> </button><figcaption>Caption text</figcaption>"#;
  let expected = "x\n\n*Caption text*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_table_cell_inline_openers() {
  for (content, expected) in [
    (
      "<figure><button>A </button><figcaption><code>B</code></figcaption></figure>",
      "| A *`B`* |\n| --- |",
    ),
    (
      "<figure><button>A </button><figcaption><em>B</em></figcaption></figure>",
      "| A **B** |\n| --- |",
    ),
    (
      r#"<img src="/a.png"><button><svg></svg> </button><figcaption><em>B</em></figcaption>"#,
      "| ![](/a.png) **B** |\n| --- |",
    ),
    (
      r#"<img src="/a.png"><button><svg></svg> </button><figcaption><code>B</code></figcaption>"#,
      "| ![](/a.png) *`B`* |\n| --- |",
    ),
  ] {
    let html = format!("<table><tr><td>{content}</td></tr></table>");
    assert_eq!(md(&html), expected, "content={content}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(&html, width), expected, "chunk width={width}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "split={split}");
    }
  }
}

#[test]
fn review_link_raw() {
  let html = r#"<p>D<span> <a href="/x" title="7"><mark></mark>7</a></span></p>"#;
  let expected = "D [<mark></mark>7](/x)";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_title_read() {
  let html = r#"<p><a href="/x" title="Read more "><span>Read more </span></a></p>"#;
  let expected = "[Read more](/x)";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_title_e() {
  for (html, expected) in [
    (r#"<a href="/x" title="e ">e</a>"#, "[e](/x)"),
    (r#"<a title="e ">e</a>"#, "e"),
  ] {
    assert_eq!(md(html), expected);
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "split={split}");
    }
  }
}

#[test]
fn review_raw_script() {
  let html = r#"<p>a<span> <script>s</script><span> <b>D</b></span></span></p>"#;
  let expected = "a **D**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_raw_style() {
  let html = r#"<p>a<span> <style>s</style><span> <b>D</b></span></span></p>"#;
  let expected = "a **D**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn unread_raw_text_of_blanks_ends_the_whitespace_run() {
  // A body nothing reads ends the whitespace run before it, even when it is
  // all whitespace. An empty body ends nothing.
  for tag in [
    "style", "iframe", "noscript", "noembed", "datalist", "noframes",
  ] {
    for (body, expected) in [
      (" ", "a **D**"),
      ("\n\t", "a **D**"),
      ("s ", "a **D**"),
      ("", "a**D**"),
    ] {
      let html = format!("<p>a<span> <{tag}>{body}</{tag}><span> <b>D</b></span></span></p>");
      assert_every_split(&html, &HtmlToMarkdownOptions::default(), expected);
    }
  }
  // `<title>` text is metadata the parser reads, so its blanks still collapse.
  assert_every_split(
    "<p>a<span> <title> </title><span> <b>D</b></span></span></p>",
    &HtmlToMarkdownOptions::default(),
    "a**D**",
  );
}

#[test]
fn dropped_raw_text_ends_the_whitespace_run_in_every_mode() {
  // Whether the body is skipped or an extraction selector reads it, the
  // Markdown is the same: it must not depend on the selectors.
  for plugins in [
    PluginConfig {
      filter: Some(FilterConfig::exclude(&["nav"])),
      ..Default::default()
    },
    PluginConfig {
      extraction: Some(ExtractionConfig::new(&["a[href]"])),
      ..Default::default()
    },
    PluginConfig {
      extraction: Some(ExtractionConfig::new(&["span"])),
      ..Default::default()
    },
  ] {
    let options = HtmlToMarkdownOptions {
      plugins: Some(plugins),
      ..Default::default()
    };
    for tag in [
      "style", "iframe", "noscript", "noembed", "datalist", "noframes",
    ] {
      for (body, expected) in [(" ", "a **D**"), ("s ", "a **D**"), ("", "a**D**")] {
        let html = format!("<p>a<span> <{tag}>{body}</{tag}><span> <b>D</b></span></span></p>");
        assert_every_split(&html, &options, expected);
      }
    }
  }
}

#[test]
fn opener_run_survives_repeated_blanks_without_leaking_to_siblings() {
  for depth in [2, 8, 254] {
    let html = format!(
      "<p>a{}{}b{}<span> </span>c</p><p><span> <b>d</b></span></p>",
      "<s><cite>".repeat(depth),
      " <svg></svg>".repeat(32),
      "</cite></s>".repeat(depth)
    );
    let expected = format!(
      "a {}b{} c\n\n**d**",
      "~~*".repeat(depth),
      "*~~".repeat(depth)
    );
    assert_eq!(md(&html), expected);
    for width in [1, 2, 3, 11] {
      assert_eq!(
        md_streamed(&html, width),
        expected,
        "depth={depth}, width={width}"
      );
    }
    if depth <= 8 {
      for split in 0..=html.len() {
        let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
        let mut out = p.process_chunk(&html[..split]);
        out.push_str(&p.process_chunk(&html[split..]));
        out.push_str(&p.finish());
        assert_eq!(out, expected, "depth={depth}, split={split}");
      }
    }
  }
}

#[test]
fn empty_raw_text_closer_does_not_count_as_body_text() {
  for tag in ["script", "style"] {
    let html = format!("<p>a<span> <{tag}></{tag}><span> <b>D</b></span></span></p>");
    let expected = "a**D**";
    assert_eq!(md(&html), expected);
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(&html, width), expected, "{tag}, width={width}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "{tag}, split={split}");
    }
  }
}

#[test]
fn review_caption_lifecycle_empty_em() {
  let html = r#"<strong><button>A </button><figcaption><em></em></figcaption></strong>"#;
  let expected = "**A**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_empty_code() {
  let html = r#"<strong><span>A </span><figcaption><code></code></figcaption></strong>"#;
  let expected = "**A**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_outer_em() {
  let html = r#"<em><button>A </button><figcaption><em></em></figcaption></em>"#;
  let expected = "*A*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_empty_caption() {
  let html = r#"<strong><button>A </button><figcaption></figcaption></strong>"#;
  let expected = "**A**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_empty_following_text() {
  let html = r#"<strong><button>A </button><figcaption><em></em></figcaption>B</strong>"#;
  let expected = "**A B**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_empty_svg() {
  let html = r#"<table><tr><td><button>A </button><figcaption><b><svg></svg></b>B</figcaption></td></tr></table>"#;
  let expected = "| A *B* |\n| --- |";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_ol_code() {
  let html =
    r#"<ol><li><button>A<i></i> </button><figcaption><code>B</code></figcaption></li></ol>"#;
  let expected = "1. A\n\n   *`B`*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_ul_code() {
  let html =
    r#"<ul><li><button>A<i></i> </button><figcaption><code>B</code></figcaption></li></ul>"#;
  let expected = "- A\n\n  *`B`*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_ol_code_no_empty() {
  let html = r#"<ol><li><button>A </button><figcaption><code>B</code></figcaption></li></ol>"#;
  let expected = "1. A\n\n   *`B`*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_lifecycle_ul_code_empty_em() {
  let html =
    r#"<ul><li><button>A </button><figcaption><em> </em><code>B</code></figcaption></li></ul>"#;
  let expected = "- A\n\n  *`B`*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected, "chunk width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn review_caption_additional_0() {
  let html = r#"<kbd><a href="/f" title="Lima "></a><figcaption><a href="/f" title="Lima "><br></a></figcaption></kbd>"#;
  let expected = "`[Lima](/f) *[  \nLima](/f)*`";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected);
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected);
  }
}

#[test]
fn review_caption_additional_1() {
  let html =
    r#"<a href="/f" title="Lima "></a><figcaption><samp><br></samp><mark></mark></figcaption>"#;
  let expected = "[Lima](/f) *<mark></mark>*";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected);
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected);
  }
}

#[test]
fn review_caption_additional_2() {
  let html = r#"<figcaption><s>1. Lima </s><figcaption><svg></svg> Lima</figcaption></figcaption>"#;
  let expected = "*~~1. Lima~~ *Lima**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected);
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected);
  }
}

#[test]
fn review_caption_additional_3() {
  let html = r#"<code><a href="/f" title="Lima "></a></code>"#;
  let expected = "`[Lima ](/f \"Lima \")`";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected);
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected);
  }
}

#[test]
fn code_span_link_drops_title_repeating_trimmed_text() {
  for (html, expected) in [
    (
      r#"<code><a href="/f" title="Lima "><span>Lima </span></a></code>"#,
      "`[Lima](/f)`",
    ),
    (
      r#"<code>x<a href="/f" title="Lima ">Lima </a>y</code>"#,
      "`x [Lima](/f) y`",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn review_caption_additional_4() {
  let html = r#"<button>A </button><figcaption><em><br>B</em></figcaption>"#;
  let expected = "A\n\n  \n**B**";
  assert_eq!(md(html), expected);
  for width in [1, 2, 3, 11] {
    assert_eq!(md_streamed(html, width), expected);
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected);
  }
}

#[test]
fn caption_excluded_wrapper_0() {
  use mdream::{PluginConfig, TagOverrideConfig};
  let html = r#"<q><kbd>1. Lima
</kbd><figcaption><samp><script></script><img src="/n"></samp></figcaption></q>"#;
  let expected = "\"`1. Lima` *`![](/n)`*\"";
  let options = HtmlToMarkdownOptions {
    plugins: Some(
      PluginConfig::default().with_tag_override("x-q", TagOverrideConfig::alias("blockquote")),
    ),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(html, options.clone()), expected);
  for width in [1, 2, 3, 11] {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = String::new();
    for chunk in html.as_bytes().chunks(width) {
      out.push_str(&p.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn caption_excluded_wrapper_1() {
  use mdream::{PluginConfig, TagOverrideConfig};
  let html = r#"<var><a href="/f" title="Lima "></a><figcaption><strong><style></style></strong>1. Lima</figcaption></var>"#;
  let expected = "`[Lima](/f) *1. Lima*%";
  let options = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig::default().with_tag_override(
      "var",
      TagOverrideConfig {
        exit: Some("%".into()),
        ..Default::default()
      },
    )),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(html, options.clone()), expected);
  for width in [1, 2, 3, 11] {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = String::new();
    for chunk in html.as_bytes().chunks(width) {
      out.push_str(&p.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn caption_excluded_wrapper_2() {
  use mdream::{PluginConfig, TagOverrideConfig};
  let html = r#"<q><kbd><code><li><script>x</script><script>x</script></li><svg></svg></code><figcaption>1. Lima
</figcaption></kbd><figcaption><samp><cite><script>x</script><img src="/n"></cite><button>
 Lima</button></samp><samp>
<strong><script>x</script> </strong></samp></figcaption></q>"#;
  let expected = "\"``- `*1. Lima*` *`*![](/n)* Lima`*\"";
  let options = HtmlToMarkdownOptions {
    plugins: Some(
      PluginConfig::default().with_tag_override("x-q", TagOverrideConfig::alias("blockquote")),
    ),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(html, options.clone()), expected);
  for width in [1, 2, 3, 11] {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = String::new();
    for chunk in html.as_bytes().chunks(width) {
      out.push_str(&p.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn caption_excluded_wrapper_3() {
  use mdream::{PluginConfig, TagOverrideConfig};
  let html = r#"<var><strong><samp><li><i></i> </li><a href="/f" title="Lima ">  </a></samp><figcaption><strong> <style></style></strong><cite><svg></svg>1. Lima</cite></figcaption></strong><s><var><blockquote><style></style>Kilo</blockquote><div> Lima Lima</div></var><script>x</script></s></var>"#;
  let expected = "`**`- [Lima](/f)` **1. Lima****~~`>  Kilo Lima Lima%~~%";
  let options = HtmlToMarkdownOptions {
    plugins: Some(PluginConfig::default().with_tag_override(
      "var",
      TagOverrideConfig {
        exit: Some("%".into()),
        ..Default::default()
      },
    )),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(html, options.clone()), expected);
  for width in [1, 2, 3, 11] {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = String::new();
    for chunk in html.as_bytes().chunks(width) {
      out.push_str(&p.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    out.push_str(&p.finish());
    assert_eq!(out, expected, "width={width}");
  }
  for split in 0..=html.len() {
    let mut p = MarkdownStreamProcessor::new(options.clone());
    let mut out = p.process_chunk(&html[..split]);
    out.push_str(&p.process_chunk(&html[split..]));
    out.push_str(&p.finish());
    assert_eq!(out, expected, "split={split}");
  }
}

#[test]
fn caption_emphasis_after_leading_break() {
  let options = HtmlToMarkdownOptions {
    plugins: Some(
      PluginConfig::default().with_tag_override("code", TagOverrideConfig::wrap("^", "^")),
    ),
    ..Default::default()
  };
  for (html, expected) in [
    (
      r#"<kbd><samp><var><span><i></i>Kilo</span><ul><img src="/n">Kilo</ul></var><q><a href="/f" title="Lima "><svg></svg><style></style></a><strong><svg></svg><script>x</script></strong></q></samp><figcaption><cite><kbd> <svg></svg></kbd><em><br>Kilo</em></cite><a href="/f" title="Lima "><ul>
<br></ul> </a></figcaption></kbd>"#,
      "```Kilo![](/n)Kilo`\" [Lima](/f)\"`   \n***Kilo**[  \nLima](/f)*`",
    ),
    (
      r#"<figcaption><cite><kbd><svg></svg></kbd><br>Kilo</cite></figcaption>"#,
      "**Kilo**",
    ),
    (
      r#"<figcaption><cite><kbd><svg></svg></kbd><br><br>Kilo</cite></figcaption>"#,
      "**Kilo**",
    ),
    (
      r#"<figcaption><cite><kbd><svg></svg></kbd><br></cite></figcaption>"#,
      "",
    ),
    (
      r#"<figcaption><cite><kbd><svg></svg></kbd><br>Kilo</cite> Lima</figcaption>"#,
      "**Kilo* Lima*",
    ),
  ] {
    assert_eq!(html_to_markdown(html, options.clone()), expected, "{html}");
    for width in [1, 2, 3, 11] {
      let mut p = MarkdownStreamProcessor::new(options.clone());
      let mut out = String::new();
      for chunk in html.as_bytes().chunks(width) {
        out.push_str(&p.process_chunk(std::str::from_utf8(chunk).unwrap()));
      }
      out.push_str(&p.finish());
      assert_eq!(out, expected, "width={width} {html}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(options.clone());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "split={split} {html}");
    }
  }
}

#[test]
fn caption_delimiter_context() {
  for (html, expected) in [
    (
      r#"<code>A<br><figcaption><em><br>B</em></figcaption></code>"#,
      "`A\n**\nB**`",
    ),
    (
      r#"<code><figcaption><em><br></em><em><br>B</em></figcaption>C</code>"#,
      "`**\nB**C`",
    ),
    (
      r#"<figure><button>A </button><figcaption><em><br></em><em><br>B</em></figcaption></figure>"#,
      "A   \n**B**",
    ),
    (
      r#"A<figcaption><br><em><br>B</em></figcaption>"#,
      "A  \n  \n**B**",
    ),
    // A child that renders nothing leaves the separator to the caption.
    (
      r#"<button>A </button><figcaption><script></script></figcaption>B"#,
      "A B",
    ),
    (
      r#"<h2><button>A </button><figcaption><style>s</style><code>B</code></figcaption></h2>"#,
      "## A *`B`*",
    ),
    (
      r#"<table><tr><td><button>A </button><figcaption><script>s</script><em>B</em></figcaption></td></tr></table>"#,
      "| A **B** |\n| --- |",
    ),
    // So does a block inside a delimiter the caption already opened with.
    (
      r#"<a href="/r"><em>A </em><figcaption><s><p>N</p></s></figcaption></a>"#,
      "[*A* *~~N~~*](/r)",
    ),
    (
      r#"<h3><em>A </em><figcaption><s><ul><em>N</em></ul></s></figcaption></h3>"#,
      "### *A* *~~*N*~~*",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "split={split} {html}");
    }
  }
}

#[test]
fn trimmed_separator_survives_an_empty_pair_before_a_block_on_the_same_line() {
  for (html, expected) in [
    (
      r#"<ul><li><div><span>Aa </span><i></i></div><span>Bb</span></li></ul>"#,
      "- Aa Bb",
    ),
    (
      r#"<ul><li><a href="/x">Aa </a><i></i><div></div><span>Bb</span></li></ul>"#,
      "- [Aa](/x) Bb",
    ),
    (
      r#"<h2><span>Aa </span><b><i></i></b><section></section><span>Bb</span></h2>"#,
      "## Aa Bb",
    ),
    (
      r#"<table><tr><td><span>Aa </span><i></i><div></div><b>Bb</b></td></tr></table>"#,
      "| Aa **Bb** |\n| --- |",
    ),
    (
      r#"<table><tr><td><span>Aa </span><q></q><ul><b>Bb</b></ul> Cc</td></tr></table>"#,
      "| Aa <ul>**Bb**</ul> Cc |\n| --- |",
    ),
    (
      r#"<strong><button><span>Aa</span> </button><b><svg></svg></b><span><script>s</script><code></code></span>Bb</strong>"#,
      "**Aa Bb**",
    ),
    // A line end still takes it.
    (
      r#"<ul><li><span>Aa </span><i></i><div></div></li><li>x</li></ul>"#,
      "- Aa\n- x",
    ),
    (
      r#"<ul><li><span>Aa </span><i></i><hr>Bb</li></ul>"#,
      "- Aa\n\n  ---\n\n  Bb",
    ),
    // So does the block when no pair took the separator along, or when the
    // separator is a blank that opened an inline element.
    (
      r#"<ul><li><span>Aa </span><div></div><span>Bb</span></li></ul>"#,
      "- AaBb",
    ),
    (
      r#"<ul><li>Aa<span> <div></div></span>Bb</li></ul>"#,
      "- AaBb",
    ),
    (
      r#"<ul><li>Aa<span> <i></i><div></div></span>Bb</li></ul>"#,
      "- AaBb",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "split={split} {html}");
    }
  }
}

#[test]
fn decoded_blank_keeps_a_code_span_beside_a_dropped_element() {
  for (html, expected) in [
    (r#"<p>h<kbd>&#32;<svg></svg></kbd>B</p>"#, "h` `B"),
    (r#"<p>h<code><svg></svg>&#32;</code>B</p>"#, "h` `B"),
    (r#"<p>h<q>&#32;<svg></svg></q>B</p>"#, "h \" \"B"),
    (r#"<p><code><script>x</script>&#32;</code></p>"#, "` `"),
    (
      r#"<ul><li><kbd>&#32;<svg></svg></kbd>B</li></ul>"#,
      "- ` `B",
    ),
    (r#"<p><b><kbd><svg></svg>&#32;</kbd></b>B</p>"#, "**` `**B"),
    (r#"<p>h<kbd>&#32;<b><svg></svg></b></kbd>B</p>"#, "h` `B"),
    // No text, literal whitespace, or an emphasis pair still leave it empty.
    (r#"<p>a<code><svg></svg></code>b</p>"#, "ab"),
    (r#"<p>a<kbd><svg></svg> </kbd>b</p>"#, "ab"),
    (r#"<p><code>&#32;</code></p>"#, ""),
    (r#"<p>h<em>&#32;<svg></svg></em>B</p>"#, "h B"),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
    for split in 0..=html.len() {
      let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
      let mut out = p.process_chunk(&html[..split]);
      out.push_str(&p.process_chunk(&html[split..]));
      out.push_str(&p.finish());
      assert_eq!(out, expected, "split={split} {html}");
    }
  }
}

#[test]
fn quote_after_an_opener_run_keeps_its_own_space() {
  for (html, expected) in [
    (
      r#"<em><strong><blockquote>L</blockquote></strong></em>"#,
      "***>  L***",
    ),
    (
      r#"<cite><cite><blockquote>K</blockquote></cite></cite>"#,
      "**>  K**",
    ),
    (
      r#"<s><b><blockquote>x</blockquote></b></s>"#,
      "~~**>  x**~~",
    ),
    (r#"<em><blockquote>L</blockquote></em>"#, "*>  L*"),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn link_title_after_a_dropped_empty_pair_is_kept() {
  for (html, expected) in [
    (
      r#"<a href="/f" title="Lima ">Lima<i></i></a>"#,
      r#"[Lima](/f "Lima ")"#,
    ),
    (
      r#"<a href="/f" title="Lima ">Lima<var></var></a>"#,
      r#"[Lima](/f "Lima ")"#,
    ),
    (
      r#"<a href="/f" title="Lima"><span>Lima </span><svg></svg></a>"#,
      "[Lima](/f)",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn decoded_blank_in_nested_code_spans_settles_at_a_block_that_writes_nothing() {
  for (html, expected) in [
    (
      "<p>h<code>&#32;<kbd>&#32;</kbd><svg></svg></code>B</p>",
      "h` `B",
    ),
    ("<p>h<code>&#32;<i><svg></svg></i></code>B</p>", "h` `B"),
    (
      "<p>h<kbd>&#32;<samp><svg></svg>&#32;</samp></kbd>B</p>",
      "h` ` ``B",
    ),
    (
      "<p>h<kbd><samp>&#32;</samp><svg></svg>&#32;</kbd>B</p>",
      "h` `B",
    ),
    ("<p>h<s><kbd>&#32;<svg></svg></kbd></s>B</p>", "h ~~` `~~B"),
    ("<p>h<kbd>&#32;<s><svg></svg></s></kbd>B</p>", "h` `B"),
    (
      "<p>h<kbd>&#32;<samp><var><svg></svg></var></samp></kbd>B</p>",
      "h` `B",
    ),
    (
      "<p>h<kbd><samp>&#32;<var>&#32;<svg></svg></var></samp></kbd>B</p>",
      "h`` ` ```B",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn written_space_after_a_leading_blank_survives_an_element_that_starts_no_line() {
  for (html, expected) in [
    ("Aa<span> </span> <form><span>Bb</span></form>", "Aa Bb"),
    (
      "Aa<span> </span> <fieldset><span>Bb</span></fieldset>",
      "Aa Bb",
    ),
    ("Aa<span> </span> <select><span>Bb</span></select>", "Aa Bb"),
    ("Aa<span> </span>\n<form><span>Bb</span></form>", "Aa Bb"),
    ("Aa<span> </span> <form></form><span>Bb</span>", "Aa Bb"),
    ("Aa<strong> </strong> <form><span>Bb</span></form>", "Aa Bb"),
    (
      "Aa<span> </span> <address>Bb</address>",
      "Aa <address>Bb</address>",
    ),
    (
      "<ul><li>Aa<span> </span> <form><span>Bb</span></form></li></ul>",
      "- Aa Bb",
    ),
    (
      "<table><tr><td>Aa<span> </span> <blockquote>Bb</blockquote></td></tr></table>",
      "| Aa > Bb |\n| --- |",
    ),
    (
      r#"<a href="/x">Aa<span> </span> <form><span>Bb</span></form></a>"#,
      "[Aa Bb](/x)",
    ),
    (
      "<strong>Aa<span> </span> <form><span>Bb</span></form></strong>",
      "**Aa Bb**",
    ),
    // The blank alone writes nothing there, and a decoded one stays owed.
    ("Aa<span> </span><form><span>Bb</span></form>", "AaBb"),
    ("<strong>h<span> </span>&#32;</strong>x", "**h** x"),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
  for (html, expected) in [
    ("Aa<span> </span> <form><span>Bb</span></form>", "Aa Bb"),
    ("Aa<span> </span> <form></form><span>Bb</span>", "Aa Bb"),
    (
      "<ul><li>Aa<span> </span> <form><span>Bb</span></form></li></ul>",
      "Aa Bb",
    ),
    ("Aa<span> </span><form><span>Bb</span></form>", "AaBb"),
  ] {
    assert_text_every_split(html, expected);
  }
}

#[test]
fn paragraph_in_a_list_item_opens_its_block_after_a_trimmed_inline_element() {
  for (html, expected) in [
    (
      "<ul><li><span><span>Aa</span> </span><p>Bb</p></li></ul>",
      "- Aa\n\n  Bb",
    ),
    (
      "<ul><li><span><span>Aa</span> </span><i></i> <p>Bb</p></li></ul>",
      "- Aa\n\n  Bb",
    ),
    (
      "<ol><li><span><span>Aa</span> </span><i></i><p>Bb</p><p>Cc</p></li></ol>",
      "1. Aa\n\n   Bb\n\n   Cc",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn link_title_is_compared_once_text_follows_a_dropped_empty_pair() {
  for (html, expected) in [
    (
      r#"<blockquote><br><em>h</em><i></i></blockquote><a href="/x" title="x">x</a>"#,
      ">   \n> *h*\n\n[x](/x)",
    ),
    (
      r#"<blockquote><br><em>x</em><i></i></blockquote><a href="/x" title="x">x</a>"#,
      ">   \n> *x*\n\n[x](/x)",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn inline_code_in_a_list_item_keeps_its_separator_after_an_element_that_writes_nothing() {
  for (html, expected) in [
    (
      "<ul><li><code>Aa</code> <table></table><code>Bb</code></li></ul>",
      "- `Aa` `Bb`",
    ),
    (
      "<ul><li>Aa<span> </span> <p><code>Bb</code></p></li></ul>",
      "- Aa `Bb`",
    ),
    (
      "<ul><li>Aa<span> </span> <section><code>Bb</code></section></li></ul>",
      "- Aa `Bb`",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
}

#[test]
fn decoded_blank_after_a_leading_blank_survives_an_element_that_starts_no_line() {
  for (html, expected) in [
    ("Aa<span> </span>&#32;<form><span>Bb</span></form>", "Aa Bb"),
    (
      "Aa<span> </span>&#32; <form><span>Bb</span></form>",
      "Aa Bb",
    ),
    ("Aa<span> </span>&#9;<form><span>Bb</span></form>", "Aa Bb"),
    ("Aa<span> </span>&#32;<form></form><span>Bb</span>", "Aa Bb"),
    (
      "<b>Aa</b><i> </i>&#32;<form><span>Bb</span></form>",
      "**Aa** Bb",
    ),
    (
      "Aa<span> </span>&#32;<address>Bb</address>",
      "Aa <address>Bb</address>",
    ),
    (
      "<ul><li>Aa<span> </span>&#32;<form><span>Bb</span></form></li></ul>",
      "- Aa Bb",
    ),
    (
      "<table><tr><td>Aa<span> </span>&#32;<form><span>Bb</span></form></td></tr></table>",
      "| Aa Bb |\n| --- |",
    ),
    // An emphasis closer still leaves it outside, and a line end takes it.
    ("<strong>h<span> </span>&#32;</strong>x", "**h** x"),
    ("Aa<span> </span>&#32;<p>Bb</p>", "Aa\n\nBb"),
    // A space written after it is still output like any other.
    (
      "<strong>Aa<span> </span>&#32;<i></i> <blockquote></blockquote>Bb</strong>",
      "**Aa Bb**",
    ),
    (
      "Aa<span> </span>&#32;<blockquote>Bb</blockquote>",
      "Aa\n\n> Bb",
    ),
    // So does the line a deferred fence opens.
    (
      "<ul><li>Aa<span> </span>&#32;<pre>Bb</pre></li></ul>",
      "- Aa\n\n  ```\n  Bb\n  ```",
    ),
    (
      "<ul><li><span>Aa </span><i></i><pre>Bb</pre></li></ul>",
      "- Aa\n\n  ```\n  Bb\n  ```",
    ),
    (
      "<h2><span>Aa </span><i></i><pre>Bb</pre></h2>",
      "## Aa```\nBb\n```",
    ),
  ] {
    assert_eq!(md(html), expected, "{html}");
    for width in [1, 2, 3, 11] {
      assert_eq!(md_streamed(html, width), expected, "width={width} {html}");
    }
  }
  for (html, expected) in [
    ("Aa<span> </span>&#32;<form><span>Bb</span></form>", "Aa Bb"),
    ("Aa<span> </span>&#32;<form></form><span>Bb</span>", "Aa Bb"),
    (
      "<ul><li>Aa<span> </span>&#32;<form><span>Bb</span></form></li></ul>",
      "Aa Bb",
    ),
    ("<strong>h<span> </span>&#32;</strong>x", "h x"),
  ] {
    assert_text_every_split(html, expected);
  }
}
