//! A `/` in a start tag follows the HTML tokenizer: it opens an unquoted value
//! after `=`, and elsewhere only separates attributes unless a `>` follows it.

use mdream::types::{HtmlToMarkdownOptions, OutputFormat, PluginConfig};
use mdream::{ExtractionConfig, MarkdownStreamProcessor, html_to_format, html_to_markdown_result};

const ORIGIN: &str = "https://ex.com/a/b/";

/// Inputs with the Markdown a browser's attributes give them.
const CASES: &[(&str, &str)] = &[
  ("<a href=/>Home</a>", "[Home](https://ex.com/)"),
  ("<a href= />Home</a>", "[Home](https://ex.com/)"),
  ("<a href=/x/>y</a>", "[y](https://ex.com/x/)"),
  (
    "<img src=\"/i.svg\" /alt=\"tiktok\" >",
    "![tiktok](https://ex.com/i.svg)",
  ),
  ("<img alt=a /src=/i.png>", "![a](https://ex.com/i.png)"),
  ("<a/href=/x>y</a>", "[y](https://ex.com/x)"),
  (
    "<a href=\"/x\"/title=\"t\">y</a>",
    "[y](https://ex.com/x \"t\")",
  ),
  ("<a title/href=/x>y</a>", "[y](https://ex.com/x)"),
  ("<a title /href=/x>y</a>", "[y](https://ex.com/x)"),
  ("<a //href=/x/ >y</a>", "[y](https://ex.com/x/)"),
  // `/>` still self-closes.
  ("<a href=\"/x\"/>y</a>", "[](https://ex.com/x)y"),
  ("<p>a<br/>b</p>", "a  \nb"),
];

fn options() -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    origin: Some(ORIGIN.into()),
    ..Default::default()
  }
}

/// Every attribute readable and the raw tag measured, which scans for `>` ahead
/// of the attribute parse.
fn capped_extraction() -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    origin: Some(ORIGIN.into()),
    max_node_bytes: 64,
    plugins: Some(PluginConfig {
      extraction: Some(ExtractionConfig::new(&["a", "img"])),
      ..Default::default()
    }),
    ..Default::default()
  }
}

fn stream(
  html: &str,
  splits: &[usize],
  options: HtmlToMarkdownOptions,
  format: OutputFormat,
) -> String {
  let mut p = MarkdownStreamProcessor::new_with_format(options, format);
  let mut out = String::new();
  let mut start = 0;
  for &end in splits.iter().chain(std::iter::once(&html.len())) {
    out.push_str(&p.process_chunk(&html[start..end]));
    start = end;
  }
  out.push_str(&p.finish());
  out
}

/// One-shot output, and the stream cut once at every byte or at all of them.
fn assert_converts(
  html: &str,
  options: &HtmlToMarkdownOptions,
  format: OutputFormat,
  expected: &str,
) {
  assert_eq!(
    html_to_format(html, options.clone(), format),
    expected,
    "{html:?}"
  );
  let boundaries: Vec<usize> = (1..html.len()).collect();
  assert_eq!(
    stream(html, &boundaries, options.clone(), format),
    expected,
    "byte chunks: {html:?}"
  );
  for &split in &boundaries {
    assert_eq!(
      stream(html, &[split], options.clone(), format),
      expected,
      "split at {split}: {html:?}"
    );
  }
}

#[test]
fn slashes_in_start_tags_follow_the_tokenizer_at_every_split() {
  // A `/` before `=` is no part of the name, so the quote cannot hide the `>`.
  // Over the cap, the tag is dropped by the scan that only looks for its `>`.
  let over_cap = format!("<a title=\"{}\" /=\"x>y\">z</a>", "t".repeat(64));
  let extra = [
    ("<a href /=\"x>y\">z</a>", "[y\">z]()"),
    (over_cap.as_str(), "y\">z"),
  ];
  for &(html, expected) in CASES.iter().chain(&extra) {
    assert_converts(html, &options(), OutputFormat::Markdown, expected);
    assert_converts(html, &capped_extraction(), OutputFormat::Markdown, expected);
    let html_output = html_to_format(html, options(), OutputFormat::Html);
    assert_converts(html, &options(), OutputFormat::Html, &html_output);
  }
}

#[test]
fn extraction_sees_the_attributes_a_browser_does() {
  let result = html_to_markdown_result(
    "<img src=\"/i.svg\" /alt=\"tiktok\" ><a href /=\"x>y\">z</a>",
    capped_extraction(),
  );
  let attributes: Vec<Vec<(String, String)>> = result
    .extracted
    .expect("img and a extracted")
    .into_iter()
    .map(|element| element.attributes)
    .collect();
  let pairs = |list: &[(&str, &str)]| -> Vec<(String, String)> {
    list
      .iter()
      .map(|&(name, value)| (name.to_string(), value.to_string()))
      .collect()
  };
  // A `/` before `=` is no part of the name, so the quote cannot hide the `>`.
  assert_eq!(
    attributes,
    [
      pairs(&[("src", "/i.svg"), ("alt", "tiktok")]),
      pairs(&[("href", ""), ("=\"x", "")]),
    ]
  );
}
