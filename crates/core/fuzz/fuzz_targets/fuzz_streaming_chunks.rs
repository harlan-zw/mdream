#![no_main]
use libfuzzer_sys::fuzz_target;
use mdream::{MarkdownStreamProcessor, types::HTMLToMarkdownOptions};

// Feeds one HTML document through the streaming processor split into small,
// fixed-width chunks (rounded up to char boundaries). Unlike `fuzz_streaming`
// (arbitrary `Vec<String>`), this drives narrow chunk boundaries through the
// drain, where multibyte codepoints straddle internal buffer offsets. Seed
// corpus entries are plain text: first byte = chunk width, rest = HTML.
fuzz_target!(|data: &[u8]| {
  let Some((&width, html_bytes)) = data.split_first() else {
    return;
  };
  let width = (width as usize).max(1);
  let html = String::from_utf8_lossy(html_bytes);

  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut start = 0;
  while start < html.len() {
    let mut end = (start + width).min(html.len());
    while end < html.len() && !html.is_char_boundary(end) {
      end += 1;
    }
    let _ = processor.process_chunk(&html[start..end]);
    start = end;
  }
  let _ = processor.finish();
});
