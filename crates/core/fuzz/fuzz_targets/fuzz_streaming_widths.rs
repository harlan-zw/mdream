#![no_main]
use libfuzzer_sys::fuzz_target;
use mdream::{
  MarkdownStreamProcessor, html_to_markdown,
  types::{CleanConfig, HTMLToMarkdownOptions},
};

// Test each document at several widths so a boundary-sensitive bug does not
// depend on the mutator also finding its exact chunk width.
const WIDTHS: [usize; 8] = [1, 2, 3, 5, 7, 13, 64, 4096];

fuzz_target!(|data: &[u8]| {
  let html = String::from_utf8_lossy(data);
  // Hold Markdown until finish for one-shot parity; compare default streaming
  // with draining on and off at every width as well.
  let options = HTMLToMarkdownOptions {
    clean: Some(CleanConfig {
      fragments: true,
      ..Default::default()
    }),
    ..Default::default()
  };
  let expected = html_to_markdown(&html, options.clone());

  for width in WIDTHS {
    let mut processor = MarkdownStreamProcessor::new(options.clone());
    let mut incremental = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut undrained = mdream::fuzz_bridge::new_drain_disabled(
      HTMLToMarkdownOptions::default(),
      mdream::OutputFormat::Markdown,
    );
    let mut drained_output = String::new();
    let mut undrained_output = String::new();
    let mut streamed = String::new();
    let mut start = 0;
    while start < html.len() {
      let mut end = (start + width).min(html.len());
      while end < html.len() && !html.is_char_boundary(end) {
        end += 1;
      }
      streamed.push_str(&processor.process_chunk(&html[start..end]));
      drained_output.push_str(&incremental.process_chunk(&html[start..end]));
      undrained_output.push_str(&undrained.process_chunk(&html[start..end]));
      start = end;
    }
    streamed.push_str(&processor.finish());
    drained_output.push_str(&incremental.finish());
    undrained_output.push_str(&undrained.finish());
    assert_eq!(
      drained_output, undrained_output,
      "draining changed output at width {width}: html={html:?}"
    );

    assert_eq!(
      streamed, expected,
      "width {width} diverged from one-shot: html={html:?}"
    );
  }
});
