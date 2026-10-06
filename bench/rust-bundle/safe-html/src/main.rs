use mdream::{HtmlToMarkdownOptions, html_to_html};

fn main() -> std::io::Result<()> {
    mdream_rust_bundle::run(|html| html_to_html(html, HtmlToMarkdownOptions::default()))
}
