use mdream::{HTMLToMarkdownOptions, html_to_markdown};

fn main() -> std::io::Result<()> {
    mdream_rust_bundle::run(|html| html_to_markdown(html, HTMLToMarkdownOptions::default()))
}
