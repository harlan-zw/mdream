// `clean.fragments` rewrites recorded `[text](#frag)` links in `get_markdown`
// by slicing the buffer at stored offsets. The stored start can drift off the
// `[` when other output (headings, lists, blockquotes) shifts the buffer after
// an anchor is recorded, so a stale offset pointed at a `]` instead and the
// slice panicked with `begin > end`.
//
// Found by `fuzz_options`: unclosed `<a href="#frag">` anchors inside `<h4>`
// headings, with every clean flag on except `empty_link_text`.

use mdream::types::{CleanConfig, HTMLToMarkdownOptions};

#[test]
fn fragment_rewrite_survives_drifted_link_offset() {
  let clean = CleanConfig {
    urls: true,
    fragments: true,
    empty_links: true,
    blank_lines: true,
    redundant_links: true,
    self_link_headings: true,
    empty_images: true,
    empty_link_text: false,
  };
  let options = HTMLToMarkdownOptions {
    origin: Some("https://example.com/".to_string()),
    clean_urls: true,
    clean: Some(clean),
    ..Default::default()
  };
  let html = ">\0r></+<><:i>\0<hr>\u{8}<a href=\"#frag\">\0r></+<><:i>\u{11}\0\0\0>6>{{{\0\0<>lg\u{11}i\u{8}lih<h4>{{{<il>\u{11}nsubex\0&<2r><0++<><:i>\u{11}\0\0\0<hr>\u{8}<a href=\"#frag\">\0r></+<><:i\0>\u{11}\0\0\0>4>{{{<li>\u{11}ex\0&<hr></+<><:i>\u{11}\0e><oh4>><\u{8}<a href=\"#frag\">";
  let _ = mdream::html_to_markdown(html, options);
}

// Accurate offset tracking keeps the recorded bracket start on the `[` even
// when the `> ` quote prefix inserted at blockquote close rewrites the buffer
// around it, so cleanup sees a genuine `[text](#frag)` shape and strips the
// broken wrapper instead of bailing. This pins the fixed behaviour: before the
// per-offset tracking, the drifted entry was either deleted outright or left
// whole, never cleanly unwrapped.
#[test]
fn drifted_fragment_link_is_unwrapped_after_blockquote_rewrite() {
  let clean = CleanConfig {
    urls: true,
    fragments: true,
    empty_links: true,
    blank_lines: true,
    redundant_links: true,
    self_link_headings: true,
    empty_images: true,
    empty_link_text: false,
  };
  let options = HTMLToMarkdownOptions {
    origin: Some("https://example.com/".to_string()),
    clean_urls: true,
    clean: Some(clean),
    ..Default::default()
  };
  // The anchor opens before the blockquote, so the `> ` quote prefix inserted
  // at blockquote close shifts the recorded bracket start off the `[`.
  let html = "<a href=#p><blockquote><a href>";
  let markdown = mdream::html_to_markdown(html, options);
  assert_eq!(markdown, "> []()");
}
