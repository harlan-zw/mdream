//! A stream collects the same frontmatter and extracted elements as a one-shot
//! conversion, so bindings can hand them to callbacks after `finish()`.
use mdream::types::{ExtractionConfig, FrontmatterConfig, HtmlToMarkdownOptions, PluginConfig};
use mdream::{MarkdownStreamProcessor, html_to_markdown_result};

fn options() -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      frontmatter: Some(FrontmatterConfig::default()),
      extraction: Some(ExtractionConfig::new(&["a[href]"])),
      ..Default::default()
    }),
    ..Default::default()
  }
}

#[test]
fn stream_plugin_data_matches_one_shot() {
  let html = r#"<html><head><title>Page</title><meta name="description" content="About"></head><body><p><a href="/a">A</a> and <a href="/b">B</a></p></body></html>"#;
  let one_shot = html_to_markdown_result(html, options());

  for size in [1, 7, html.len()] {
    let mut stream = MarkdownStreamProcessor::new(options());
    for chunk in html.as_bytes().chunks(size) {
      stream.process_chunk(std::str::from_utf8(chunk).unwrap());
    }
    stream.finish();
    assert_eq!(
      stream.frontmatter(),
      one_shot.frontmatter,
      "chunk size {size}"
    );
    let extracted = stream.take_extracted().expect("links extracted");
    let hrefs: Vec<_> = extracted
      .iter()
      .flat_map(|e| {
        e.attributes
          .iter()
          .filter(|(k, _)| k == "href")
          .map(|(_, v)| v.as_str())
      })
      .collect();
    assert_eq!(hrefs, ["/a", "/b"], "chunk size {size}");
    assert!(
      stream.take_extracted().is_none(),
      "extracted elements drain"
    );
  }
}

#[test]
fn stream_plugin_data_is_none_without_plugins() {
  let mut stream = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  stream.process_chunk("<head><title>T</title></head><p>x</p>");
  stream.finish();
  assert!(stream.frontmatter().is_none());
  assert!(stream.take_extracted().is_none());
}
