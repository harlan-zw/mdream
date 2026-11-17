//! An `href` or `src` resolves as the URL parser reads it: leading and trailing
//! C0 controls and spaces are stripped first, so they neither hide a scheme nor
//! reach the output.

use mdream::types::{CleanConfig, HtmlToMarkdownOptions, OutputFormat};
use mdream::{MarkdownStreamProcessor, html_to_format};

const ORIGIN: &str = "https://ex.com/a/b/";

fn with_origin() -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    origin: Some(ORIGIN.into()),
    ..Default::default()
  }
}

fn cleaned() -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    origin: Some(ORIGIN.into()),
    clean: Some(CleanConfig::all()),
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
fn padded_urls_resolve_as_the_url_parser_reads_them() {
  for (html, markdown, html_output) in [
    (
      "<a href=\" http://other.example/x\">lead</a>",
      "[lead](http://other.example/x)",
      "<a href=\"http://other.example/x\">lead</a>",
    ),
    (
      "<a href=\" /p \">y</a>",
      "[y](https://ex.com/p)",
      "<a href=\"https://ex.com/p\">y</a>",
    ),
    (
      "<a href=\"&#9;/t&#10;\">t</a>",
      "[t](https://ex.com/t)",
      "<a href=\"https://ex.com/t\">t</a>",
    ),
    (
      "<img src=\" /i.png \" alt=\"i\">",
      "![i](https://ex.com/i.png)",
      "<img src=\"https://ex.com/i.png\" alt=\"i\">",
    ),
    (
      "<a href=\" https://x.com/ \">https://x.com/</a>",
      "<https://x.com/>",
      "<a href=\"https://x.com/\">https://x.com/</a>",
    ),
  ] {
    assert_converts(html, &with_origin(), OutputFormat::Markdown, markdown);
    assert_converts(html, &with_origin(), OutputFormat::Html, html_output);
  }
  // Without an origin the stripped URL is the one written.
  assert_eq!(
    html_to_format(
      "<a href=\" /p \">y</a>",
      HtmlToMarkdownOptions::default(),
      OutputFormat::Markdown
    ),
    "[y](/p)"
  );
}

#[test]
fn padded_unsafe_urls_are_still_rejected() {
  for (html, expected) in [
    ("<a href=\" javascript:alert(1)\">x</a>", "x"),
    ("<a href=\"&#9;java&#10;script:alert(1) \">x</a>", "x"),
    ("<a href=\" data:text/html,x\">d</a>", "d"),
    (
      "<p><img src=\" data:image/png;base64,AAAA\" alt=\"d\">i</p>",
      "<p>i</p>",
    ),
    (
      "<p><img src=\" javascript:alert(1)\" alt=\"j\">i</p>",
      "<p>i</p>",
    ),
  ] {
    assert_converts(html, &with_origin(), OutputFormat::Html, expected);
    assert_converts(
      html,
      &HtmlToMarkdownOptions::default(),
      OutputFormat::Html,
      expected,
    );
  }
  // `emptyLinks` drops what cannot navigate, padded or not.
  assert_converts(
    "<a href=\" javascript:alert(1)\">x</a> <a href=\" data:text/html,x\">d</a>",
    &cleaned(),
    OutputFormat::Markdown,
    "x d",
  );
}

#[test]
fn padded_fragments_are_same_document_links() {
  // `fragments` and `selfLinkHeadings` treat them as the unpadded links.
  let html = "<h2>Q<a href=\" #q\">#</a></h2><h2><a href=\" #r \">R</a></h2><p><a href=\" #q\">up</a> <a href=\" #nope\">gone</a></p>";
  let expected = "## Q \\#\n\n## R\n\n[up](#q) gone";
  assert_eq!(
    html_to_format(
      &html.replace("\" #", "\"#").replace(" \"", "\""),
      cleaned(),
      OutputFormat::Markdown
    ),
    expected
  );
  assert_converts(html, &cleaned(), OutputFormat::Markdown, expected);
}

// Each rule on its own leaves the stream free to yield, so a link it may still
// rewrite has to hold the output back however its href is padded.
#[test]
fn padded_fragments_stream_like_unpadded_ones() {
  let pad = "word ".repeat(3000);
  for clean in [
    CleanConfig {
      self_link_headings: true,
      ..Default::default()
    },
    CleanConfig {
      fragments: true,
      ..Default::default()
    },
  ] {
    let options = HtmlToMarkdownOptions {
      origin: Some(ORIGIN.into()),
      clean: Some(clean),
      ..Default::default()
    };
    for html in [
      format!("<p>{pad}</p><h2><a href=\" #q\">Q {pad}</a></h2><p>{pad}</p>"),
      format!("<h2 id=q>Q</h2><p>{pad}<a href=\" #q\">up {pad}</a> {pad}</p>"),
    ] {
      let expected = html_to_format(
        &html.replace("\" #", "\"#"),
        options.clone(),
        OutputFormat::Markdown,
      );
      assert_eq!(
        html_to_format(&html, options.clone(), OutputFormat::Markdown),
        expected
      );
      for size in [1, 7, 64, 1000] {
        let splits: Vec<usize> = (size..html.len()).step_by(size).collect();
        assert_eq!(
          stream(&html, &splits, options.clone(), OutputFormat::Markdown),
          expected,
          "{size}-byte chunks"
        );
      }
    }
  }
}
