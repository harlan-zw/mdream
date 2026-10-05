//! `format: html` streams must equal one-shot output wherever the input splits.
//! The corpus holds every input a parity sweep found diverging: whitespace after
//! a drained chunk was trimmed as if it started the document.

use mdream::MarkdownStreamProcessor;
use mdream::html_to_html;
use mdream::types::{HTMLToMarkdownOptions, OutputFormat};

/// Inputs separated by U+001E, so trailing newlines stay part of each input.
const SWEEP: &str = include_str!("fixtures/html-stream-parity.txt");

/// Each split point costs a full conversion, so larger inputs only stream
/// char by char, which still splits at every boundary at once.
const EVERY_SPLIT_MAX_LEN: usize = 2048;

fn stream_at(html: &str, splits: &[usize]) -> String {
  let mut p =
    MarkdownStreamProcessor::new_with_format(HTMLToMarkdownOptions::default(), OutputFormat::Html);
  let mut out = String::new();
  let mut start = 0;
  for &end in splits.iter().chain(std::iter::once(&html.len())) {
    out.push_str(&p.process_chunk(&html[start..end]));
    start = end;
  }
  out.push_str(&p.finish());
  out
}

fn assert_stream_matches(html: &str) {
  let expected = html_to_html(html, HTMLToMarkdownOptions::default());
  let boundaries: Vec<usize> = (1..html.len())
    .filter(|&i| html.is_char_boundary(i))
    .collect();
  assert_eq!(
    stream_at(html, &boundaries),
    expected,
    "char chunks: {html:?}"
  );
  if html.len() > EVERY_SPLIT_MAX_LEN {
    return;
  }
  for &split in &boundaries {
    assert_eq!(
      stream_at(html, &[split]),
      expected,
      "split at {split}: {html:?}"
    );
  }
}

#[test]
fn html_stream_keeps_space_after_inline_element() {
  for html in [
    "a<br> b",
    "<span>One</span> <span>Two</span>",
    "<strong>a</strong> and <em>b</em>",
    "<div>One</div> <div>Two</div>",
    "  <span>One</span>  ",
    "<span>x = 1;</span>\n",
  ] {
    assert_stream_matches(html);
  }
}

#[test]
fn html_stream_matches_one_shot_on_sweep() {
  let inputs: Vec<&str> = SWEEP.split('\u{1e}').collect();
  assert!(inputs.len() > 200, "sweep corpus failed to load");
  for html in inputs {
    assert_stream_matches(html);
  }
}

// Real pages carry indentation runs between inline elements at every depth.
#[test]
fn html_stream_matches_one_shot_on_fixtures() {
  for (name, html) in [
    ("wikipedia", include_str!("fixtures/wikipedia-small.html")),
    ("mdn", include_str!("fixtures/mdn-array.html")),
    ("nuxt", include_str!("fixtures/nuxt-example.html")),
    (
      "github",
      include_str!("fixtures/github-markdown-complete.html"),
    ),
  ] {
    let expected = html_to_html(html, HTMLToMarkdownOptions::default());
    for chunk in [1usize, 7, 64, 4096] {
      let mut splits = Vec::new();
      let mut at = chunk;
      while at < html.len() {
        while !html.is_char_boundary(at) {
          at += 1;
        }
        splits.push(at);
        at += chunk;
      }
      splits.dedup();
      splits.retain(|&s| s < html.len());
      assert!(
        stream_at(html, &splits) == expected,
        "{name} diverged at chunk={chunk}"
      );
    }
  }
}
