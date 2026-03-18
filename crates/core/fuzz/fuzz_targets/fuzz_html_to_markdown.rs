#![no_main]
use libfuzzer_sys::fuzz_target;
use mdream::{html_to_markdown, html_to_markdown_result, types::HTMLToMarkdownOptions};

fuzz_target!(|data: &str| {
    // Basic conversion - should never panic
    let _ = html_to_markdown(data, HTMLToMarkdownOptions::default());

    // Full result path
    let _ = html_to_markdown_result(data, HTMLToMarkdownOptions::default());
});
