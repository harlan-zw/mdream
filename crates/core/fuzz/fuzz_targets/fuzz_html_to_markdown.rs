#![no_main]
use libfuzzer_sys::fuzz_target;
use mdream::{html_to_markdown, html_to_markdown_result, types::HtmlToMarkdownOptions};

fuzz_target!(|data: &str| {
    // Basic conversion - should never panic
    let _ = html_to_markdown(data, HtmlToMarkdownOptions::default());

    // Full result path
    let _ = html_to_markdown_result(data, HtmlToMarkdownOptions::default());
});
