use std::hint::black_box;

use mdream::{HTMLToMarkdownOptions, OutputFormat, html_to_format};

fn main() -> std::io::Result<()> {
    let format = black_box(OutputFormat::Markdown);
    mdream_rust_bundle::run(|html| html_to_format(html, HTMLToMarkdownOptions::default(), format))
}
