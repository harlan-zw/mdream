use mdream::{HtmlToMarkdownOptions, html_to_markdown};

fn main() -> std::io::Result<()> {
    mdream_rust_bundle::run(|html| html_to_markdown(html, HtmlToMarkdownOptions::default()))
}
