use mdream::{HTMLToMarkdownOptions, html_to_html};

fn main() -> std::io::Result<()> {
    mdream_rust_bundle::run(|html| html_to_html(html, HTMLToMarkdownOptions::default()))
}
