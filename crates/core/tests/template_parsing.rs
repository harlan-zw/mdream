use mdream::types::{
  ExtractionConfig, FrontmatterConfig, HTMLToMarkdownOptions, IsolateMainConfig, PluginConfig,
};
use mdream::{MarkdownStreamProcessor, html_to_markdown, html_to_markdown_result};

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
fn well_formed_template_subtree_is_inert() {
  assert_eq!(
    convert("<p>Before</p><template><h1>Hidden</h1><p>Also hidden</p></template><p>After</p>"),
    "Before\n\nAfter"
  );
}

#[test]
fn nested_template_close_does_not_leak_outer_template_content() {
  assert_eq!(
    convert("<template><template>x</template><p>leak</p></template><p>after</p>"),
    "after"
  );
}

#[test]
fn template_end_tag_scope_contains_malformed_inner_content() {
  assert_eq!(
    convert("<p>before<template></p><strong>hidden</strong></template>after</p>"),
    "before after"
  );
}

#[test]
fn flow_content_in_template_does_not_close_outer_head() {
  assert_eq!(
    convert("<head><template><p>hidden</p></template></head><p>after</p>"),
    "after"
  );
}

#[test]
fn extraction_sees_parsed_template_content_without_rendering_it() {
  let result = html_to_markdown_result(
    "<template><strong class=\"target\">hidden</strong></template><p>after</p>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        extraction: Some(ExtractionConfig::new(&[".target"])),
        ..Default::default()
      }),
      ..Default::default()
    },
  );

  assert_eq!(result.markdown, "after");
  let extracted = result.extracted.expect("template descendant extracted");
  assert_eq!(extracted.len(), 1);
  assert_eq!(extracted[0].tag_name, "strong");
  assert_eq!(extracted[0].text_content, "hidden");
}

#[test]
fn inert_content_does_not_affect_isolate_main_or_frontmatter_state() {
  let html = "<head><template><title>Hidden</title><meta name=\"description\" content=\"Hidden description\"></template><title>Visible</title></head><template><main>Hidden main</main></template><main><p>Visible body</p></main>";
  let result = html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        frontmatter: Some(FrontmatterConfig::default()),
        isolate_main: Some(IsolateMainConfig),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert_eq!(result, "---\ntitle: Visible\n---\n\nVisible body");
}

#[test]
fn streaming_matches_at_every_chunk_boundary() {
  let html = "<p>before</p><template><template><strong>hidden</strong></template><p>still hidden</p></template><p>after</p>";
  let expected = stream(&[html]);
  assert_eq!(expected.trim(), "before\n\nafter");

  for split in 0..=html.len() {
    let actual = stream(&[&html[..split], &html[split..]]);
    assert_eq!(actual, expected, "split at byte {split}");
  }
}
