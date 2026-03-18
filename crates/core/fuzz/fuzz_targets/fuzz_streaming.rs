#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::{MarkdownStreamProcessor, types::HTMLToMarkdownOptions};

#[derive(Arbitrary, Debug)]
struct StreamInput {
    chunks: Vec<String>,
}

fuzz_target!(|input: StreamInput| {
    let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());

    for chunk in &input.chunks {
        let _ = processor.process_chunk(chunk);
    }
    let _ = processor.finish();
});
