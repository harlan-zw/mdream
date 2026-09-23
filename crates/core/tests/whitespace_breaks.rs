//! Block spacing, hard breaks, and inline whitespace at element boundaries.
use mdream::types::{HTMLToMarkdownOptions, PluginConfig, TagOverrideConfig};
use mdream::{MarkdownStreamProcessor, html_to_markdown, html_to_text};

fn md(html: &str) -> String {
  html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn text(html: &str) -> String {
  html_to_text(html, HTMLToMarkdownOptions::default())
}

fn md_streamed(html: &str, chunk: usize) -> String {
  let mut p = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
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
    HTMLToMarkdownOptions::default().with_wrap_width(width),
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
    HTMLToMarkdownOptions {
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
