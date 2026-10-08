#![no_main]
use libfuzzer_sys::fuzz_target;
use mdream::{
  MarkdownStreamProcessor, html_to_markdown_without_text_flush, types::HtmlToMarkdownOptions,
};

// Feeds one HTML document through the streaming processor split into small,
// fixed-width chunks (rounded up to char boundaries). Unlike `fuzz_streaming`
// (arbitrary `Vec<String>`), this drives narrow chunk boundaries through the
// drain, where multibyte codepoints straddle internal buffer offsets. Seed
// corpus entries are plain text: first byte = chunk width, rest = HTML. ASCII
// digits 1-9 encode their numeric width so regression seeds remain readable.
fuzz_target!(|data: &[u8]| {
  let Some((&width, html_bytes)) = data.split_first() else {
    return;
  };
  let width = if width.is_ascii_digit() && width != b'0' {
    (width - b'0') as usize
  } else {
    (width as usize).max(1)
  };
  let html = String::from_utf8_lossy(html_bytes);

  let generated = html_bytes.first() == Some(&0xff);
  let html = if generated {
    let unit = String::from_utf8_lossy(&html_bytes[1..]).replace('<', "&lt;");
    if unit.is_empty() {
      return;
    }
    let mut body = String::from("<p>");
    while body.len() < 128 * 1024 {
      body.push_str(&unit);
    }
    body.push_str("</p>");
    body
  } else {
    html.into_owned()
  };
  let cap = if generated { 1024 * 1024 } else { 0 };
  let mut processor = MarkdownStreamProcessor::new(HtmlToMarkdownOptions {
    max_node_bytes: cap,
    ..Default::default()
  });
  let mut streamed = String::new();
  let mut start = 0;
  while start < html.len() {
    let end = html.ceil_char_boundary((start + width).min(html.len()));
    let piece = processor.process_chunk(&html[start..end]);
    if generated {
      streamed.push_str(&piece);
    }
    start = end;
  }
  let last = processor.finish();
  if generated {
    streamed.push_str(&last);
    let oracle = html_to_markdown_without_text_flush(&html, HtmlToMarkdownOptions::default());
    assert!(!processor.truncated());
    assert_eq!(streamed, oracle.markdown);
  }
});
