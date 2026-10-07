//! `<title>` is document metadata that browsers never render. The frontmatter
//! plugin reads it; without the plugin it leaves no text in the output.
use mdream::types::{FrontmatterConfig, HtmlToMarkdownOptions, PluginConfig};
use mdream::{MarkdownStreamProcessor, OutputFormat, html_to_format};

const PAGE: &str = "<html><head><title>Page</title></head><body><p>Body</p></body></html>";

fn stream(html: &str, chunk: usize) -> String {
  let mut processor = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  let mut out = String::new();
  for piece in html.as_bytes().chunks(chunk) {
    out.push_str(&processor.process_chunk(std::str::from_utf8(piece).unwrap()));
  }
  out.push_str(&processor.finish());
  out
}

#[test]
fn title_text_is_dropped_without_frontmatter() {
  let options = HtmlToMarkdownOptions::default;
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
      HtmlToMarkdownOptions::default(),
      OutputFormat::Markdown
    ),
    "a\n\nb"
  );
}

#[test]
fn frontmatter_still_reads_the_title() {
  let options = HtmlToMarkdownOptions {
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
  let options = HtmlToMarkdownOptions {
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
  let options = HtmlToMarkdownOptions {
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

#[test]
fn title_metadata_decodes_entities_once_in_all_formats_and_streams() {
  for (encoded, decoded) in [
    ("A &amp; B", "A & B"),
    ("&#65; &#x1f984; &copy;", "A 🦄 ©"),
    ("&amp;copy; &amp;#65;", "&copy; &#65;"),
  ] {
    let html = format!("<head><title>{encoded}</title></head><p>Body</p>");
    let options = HtmlToMarkdownOptions {
      plugins: Some(PluginConfig {
        frontmatter: Some(FrontmatterConfig::default()),
        extraction: Some(mdream::ExtractionConfig::new(&["title"])),
        ..Default::default()
      }),
      ..Default::default()
    };
    let expected = Some(vec![("title".to_string(), decoded.to_string())]);
    for format in [OutputFormat::Markdown, OutputFormat::Text, OutputFormat::Html] {
      let result = mdream::html_to_format_result(&html, options.clone(), format);
      assert_eq!(result.frontmatter, expected);
      assert_eq!(result.extracted.unwrap()[0].text_content, decoded);
    }
    let markdown = mdream::html_to_markdown(&html, options.clone());
    assert!(markdown.contains(&format!("title: \"{decoded}\"")));
    for chunk in [1, 3, html.len()] {
      let mut processor = MarkdownStreamProcessor::new(options.clone());
      let mut output = String::new();
      for piece in html.as_bytes().chunks(chunk) {
        output.push_str(&processor.process_chunk(std::str::from_utf8(piece).unwrap()));
      }
      output.push_str(&processor.finish());
      assert_eq!(output, markdown);
      assert_eq!(processor.frontmatter(), expected);
    }
  }
}
