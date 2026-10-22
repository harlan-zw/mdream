//! Block spacing, hard breaks, and inline whitespace at element boundaries.
use mdream::types::{
  CleanConfig, FilterConfig, HtmlToMarkdownOptions, PluginConfig, TagOverrideConfig,
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
fn separator_before_a_raw_line_break_is_dropped() {
  let options = HtmlToMarkdownOptions::default();
  for (html, expected) in [
    ("<h2>w<strong>a </strong><br>b</h2>", "## w**a**<br>b"),
    ("<h2>w<strong> </strong><br>b</h2>", "## w<br>b"),
    ("<h2>w<span> <br>b</span></h2>", "## w<br>b"),
    (
      "<table><tr><th>h</th></tr><tr><td>w<strong>a </strong><br>b</td></tr></table>",
      "| h |\n| --- |\n| w**a**<br>b |",
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
fn setext_underline_after_a_hard_break_is_escaped() {
  assert_every_chunking(
    "<p>Line one<br>===</p>",
    &HtmlToMarkdownOptions::default(),
    "Line one  \n\\===",
  );
  assert_eq!(md("<p>Line one<br>=</p>"), "Line one  \n\\=");
  assert_eq!(md("<p>Line one<br>--</p>"), "Line one  \n\\--");
  assert_eq!(md("<p>Line one<br>---</p>"), "Line one  \n\\---");
  assert_eq!(
    md("<ul><li>Line one<br>===</li></ul>"),
    "- Line one  \n  \\==="
  );
  assert_eq!(
    md("<blockquote><p>Line one<br>===</p></blockquote>"),
    "> Line one  \n> \\==="
  );
  assert_eq!(md("<p>a&#10;===</p>"), "a\n\\===");
  // Other text on the line keeps it a paragraph line.
  assert_eq!(md("<p>Line one<br>==x</p>"), "Line one  \n==x");
  assert_eq!(md("<p>Line one<br>= =</p>"), "Line one  \n= =");
  assert_eq!(md("<p>a = b</p>"), "a = b");
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
