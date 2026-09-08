use mdream::{HTMLToMarkdownOptions, html_to_text};

fn main() -> std::io::Result<()> {
    mdream_rust_bundle::run(|html| html_to_text(html, HTMLToMarkdownOptions::default()))
}
