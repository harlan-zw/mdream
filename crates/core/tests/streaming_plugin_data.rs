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

#[test]
fn text_pieces_preserve_extractions_and_filtered_main_content() {
  use mdream::types::{FilterConfig, IsolateMainConfig};
  let text = "ordinary ~ prose é &amp; text ".repeat(5000);
  let html = format!(
    "<head><title>Page</title></head><nav>noise</nav><main><p><a href='/x'>{text}</a></p><p>after</p></main>"
  );
  let opts = HtmlToMarkdownOptions {
    max_node_bytes: 128 * 1024,
    plugins: Some(PluginConfig {
      frontmatter: Some(FrontmatterConfig::default()),
      extraction: Some(ExtractionConfig::new(&["main", "a[href]"])),
      filter: Some(FilterConfig::exclude(&["nav"])),
      isolate_main: Some(IsolateMainConfig),
      ..Default::default()
    }),
    ..Default::default()
  };
  let one_shot = html_to_markdown_result(&html, opts.clone());
  assert!(!one_shot.truncated);
  let expected = one_shot.extracted.unwrap();
  for width in [1, 7, 4096, 65536, html.len()] {
    let mut stream = MarkdownStreamProcessor::new(opts.clone());
    let mut output = String::new();
    let mut start = 0;
    while start < html.len() {
      let end = html.ceil_char_boundary((start + width).min(html.len()));
      output.push_str(&stream.process_chunk(&html[start..end]));
      start = end;
    }
    output.push_str(&stream.finish());
    assert!(!stream.truncated());
    assert_eq!(output, one_shot.markdown);
    assert_eq!(stream.frontmatter(), one_shot.frontmatter);
    let actual = stream.take_extracted().unwrap();
    assert_eq!(actual.len(), expected.len());
    for (actual, expected) in actual.iter().zip(&expected) {
      assert_eq!(actual.selector, expected.selector);
      assert_eq!(actual.tag_name, expected.tag_name);
      assert_eq!(actual.text_content, expected.text_content);
      assert_eq!(actual.attributes, expected.attributes);
    }
  }
}
