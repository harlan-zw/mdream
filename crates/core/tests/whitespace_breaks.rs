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
  html_to_markdown(html, HTMLToMarkdownOptions::default().with_wrap_width(width))
}

// ── Blank image alt in text output ──

#[test]
fn blank_image_alt_adds_no_blank_line() {
  assert_eq!(text("A<p><img alt=\" \"><p>B"), "A\n\nB");
}
