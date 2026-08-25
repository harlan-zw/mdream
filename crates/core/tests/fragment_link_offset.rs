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

// A drifted entry whose range no longer starts at `[` must be left untouched.
// The rewrite path used to advance the cursor past `[adj_start..adj_end)`
// without pushing those bytes, silently deleting the whole span from the
// output instead of leaving it as-is for the normal cursor copy.
#[test]
fn drifted_invalid_fragment_link_is_left_as_is() {
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
  // at blockquote close shifts the recorded bracket start off the `[`. The
  // recorded range then holds `> []()](#p)`: not a `[text](#frag)` shape, so
  // every byte of it has to survive into the markdown.
  let html = "<a href=#p><blockquote><a href>";
  let markdown = mdream::html_to_markdown(html, options);
  assert_eq!(markdown, "[> []()](#p)");
}
