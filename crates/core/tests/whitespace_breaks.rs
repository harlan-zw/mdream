//! Block spacing, hard breaks, and inline whitespace at element boundaries.
use mdream::types::{HTMLToMarkdownOptions, PluginConfig, TagOverrideConfig};
use mdream::{html_to_markdown, html_to_text};

fn md(html: &str) -> String {
  html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn text(html: &str) -> String {
  html_to_text(html, HTMLToMarkdownOptions::default())
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
  assert_eq!(md("<li>ew<br> <div>D"), "- ew  \n  D");
  assert_eq!(md("<li>ew<br>\n<div>D"), "- ew  \n  D");
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
