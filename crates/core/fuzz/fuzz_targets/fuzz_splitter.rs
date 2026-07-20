#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::splitter::{split_markdown, html_to_markdown_chunks, SplitterOptions};
use mdream::types::HTMLToMarkdownOptions;

#[derive(Arbitrary, Debug)]
struct SplitterInput {
    html: String,
    chunk_size: u16,
    chunk_overlap: u16,
}

fuzz_target!(|input: SplitterInput| {
    let chunk_size = (input.chunk_size as usize).max(1);
    let chunk_overlap = (input.chunk_overlap as usize) % chunk_size;

    let split_opts = SplitterOptions {
        chunk_size,
        chunk_overlap,
        ..Default::default()
    };

    // Fuzz split_markdown with the input as raw markdown
    let _ = split_markdown(&input.html, &split_opts);

    // Fuzz html_to_markdown_chunks end-to-end
    let _ = html_to_markdown_chunks(&input.html, HTMLToMarkdownOptions::default(), &split_opts);
});
