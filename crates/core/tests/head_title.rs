//! `<title>` is document metadata that browsers never render. The frontmatter
//! plugin reads it; without the plugin it leaves no text in the output.
use mdream::types::{FrontmatterConfig, HTMLToMarkdownOptions, PluginConfig};
use mdream::{MarkdownStreamProcessor, OutputFormat, html_to_format};

const PAGE: &str = "<html><head><title>Page</title></head><body><p>Body</p></body></html>";

fn stream(html: &str, chunk: usize) -> String {
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut out = String::new();
  for piece in html.as_bytes().chunks(chunk) {
    out.push_str(&processor.process_chunk(std::str::from_utf8(piece).unwrap()));
  }
  out.push_str(&processor.finish());
  out
}

#[test]
fn title_text_is_dropped_without_frontmatter() {
  let options = HTMLToMarkdownOptions::default;
  assert_eq!(
    html_to_format(PAGE, options(), OutputFormat::Markdown),
    "Body"
  );
  assert_eq!(html_to_format(PAGE, options(), OutputFormat::Text), "Body");
  assert_eq!(
    html_to_format(PAGE, options(), OutputFormat::Html),
    "<p>Body</p>"
  );
  for chunk in [1, 5, PAGE.len()] {
    assert_eq!(stream(PAGE, chunk), "Body", "chunk size {chunk}");
  }
}

#[test]
fn title_outside_head_is_dropped() {
  assert_eq!(
    html_to_format(
      "<p>a</p><title>T</title><p>b</p>",
      HTMLToMarkdownOptions::default(),
      OutputFormat::Markdown
    ),
    "a\n\nb"
  );
}

#[test]
fn frontmatter_still_reads_the_title() {
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      frontmatter: Some(FrontmatterConfig::default()),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(
    html_to_format(PAGE, options, OutputFormat::Markdown),
    "---\ntitle: Page\n---\n\nBody"
  );
}

#[test]
fn extraction_still_reads_the_title() {
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      extraction: Some(mdream::ExtractionConfig::new(&["title"])),
      ..Default::default()
    }),
    ..Default::default()
  };
  let result = mdream::html_to_markdown_result(PAGE, options);
  assert_eq!(result.markdown, "Body");
  assert_eq!(
    result.extracted.expect("title extracted")[0].text_content,
    "Page"
  );
}

#[test]
fn extraction_reads_the_title_with_frontmatter_on() {
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      frontmatter: Some(FrontmatterConfig::default()),
      extraction: Some(mdream::ExtractionConfig::new(&["title"])),
      ..Default::default()
    }),
    ..Default::default()
  };
  let result = mdream::html_to_markdown_result(PAGE, options);
  assert_eq!(result.markdown, "---\ntitle: Page\n---\n\nBody");
  assert_eq!(
    result.extracted.expect("title extracted")[0].text_content,
    "Page"
  );
}
