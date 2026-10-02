#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::{
  MarkdownStreamProcessor, html_to_markdown,
  types::{CleanConfig, HTMLToMarkdownOptions},
};

#[derive(Arbitrary, Debug)]
struct StreamInput {
  chunks: Vec<String>,
}

fuzz_target!(|input: StreamInput| {
  // Fragment cleanup holds Markdown until finish, making one-shot parity valid.
  // The default streams below also check that draining never changes output.
  let options = HTMLToMarkdownOptions {
    clean: Some(CleanConfig {
      fragments: true,
      ..Default::default()
    }),
    ..Default::default()
  };
  let mut processor = MarkdownStreamProcessor::new(options.clone());
  let mut incremental = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut undrained = mdream::fuzz_bridge::new_drain_disabled(
    HTMLToMarkdownOptions::default(),
    mdream::OutputFormat::Markdown,
  );
  let mut drained_output = String::new();
  let mut undrained_output = String::new();
  let mut streamed = String::new();
  for chunk in &input.chunks {
    streamed.push_str(&processor.process_chunk(chunk));
    drained_output.push_str(&incremental.process_chunk(chunk));
    undrained_output.push_str(&undrained.process_chunk(chunk));
  }
  streamed.push_str(&processor.finish());
  drained_output.push_str(&incremental.finish());
  undrained_output.push_str(&undrained.finish());
  assert_eq!(
    drained_output, undrained_output,
    "draining changed output: chunks={:?}",
    input.chunks
  );

  let html = input.chunks.concat();
  let one_shot = html_to_markdown(&html, options);
  assert_eq!(
    streamed, one_shot,
    "streaming diverged from one-shot: chunks={:?}",
    input.chunks
  );
});
