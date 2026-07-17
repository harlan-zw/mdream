//! End-tag tokenizer and tree-construction recovery regressions.
use mdream::{MarkdownStreamProcessor, html_to_markdown, types::HTMLToMarkdownOptions};

fn convert(html: &str) -> String {
  html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn stream(chunks: &[&str]) -> String {
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = String::new();
  for chunk in chunks {
    output.push_str(&processor.process_chunk(chunk));
  }
  output.push_str(&processor.finish());
  output
}

#[test]
fn unmatched_end_tag_is_ignored_without_closing_open_elements() {
  assert_eq!(convert("<p><strong>x</nope>y</strong>z</p>"), "**xy**z");
  assert_eq!(convert("</nope><p>kept</p>"), "kept");
}

#[test]
fn end_tag_attributes_and_trailing_solidus_do_not_change_its_name() {
  assert_eq!(convert("<p><strong>x</strong foo>y</p>"), "**x**y");
  assert_eq!(convert("<p><strong>x</strong/>y</p>"), "**x**y");
}

#[test]
fn unknown_custom_end_tag_only_matches_the_same_custom_name() {
  assert_eq!(
    convert("<p><x-one><strong>a</x-nope>b</strong>c</x-one>d</p>"),
    "**ab**cd"
  );
}

#[test]
fn malformed_end_tags_are_buffered_across_stream_chunks() {
  for (chunks, whole) in [
    (
      vec!["<p><strong>x</stro", "ng foo>y</p>"],
      "<p><strong>x</strong foo>y</p>",
    ),
    (
      vec!["<p><strong>x</strong data-x=\">", "\">y</p>"],
      "<p><strong>x</strong data-x=\">\">y</p>",
    ),
  ] {
    assert_eq!(
      stream(&chunks).trim_end(),
      convert(whole),
      "chunks: {chunks:?}"
    );
  }
}

#[test]
fn matching_ancestor_end_tag_still_closes_its_descendants() {
  assert_eq!(convert("<div><p><strong>x</div><p>y</p>"), "**x**\n\ny");
}
