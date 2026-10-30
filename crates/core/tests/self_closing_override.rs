//! `isSelfClosing` in `tagOverrides` decides whether a start tag opens an
//! element, wherever a built-in void tag is recognized.
use mdream::types::{HtmlToMarkdownOptions, PluginConfig, TagOverrideConfig};
use mdream::{MarkdownStreamProcessor, get_tag_id, html_to_markdown};

fn options(overrides: Vec<(&str, TagOverrideConfig)>) -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(
        overrides
          .into_iter()
          .map(|(name, config)| (name.to_string(), config))
          .collect(),
      ),
      ..Default::default()
    }),
    ..Default::default()
  }
}

fn marked(is_self_closing: bool) -> TagOverrideConfig {
  TagOverrideConfig {
    enter: Some("[".to_string()),
    exit: Some("]".to_string()),
    is_self_closing: Some(is_self_closing),
    ..Default::default()
  }
}

fn flag(is_self_closing: bool) -> TagOverrideConfig {
  TagOverrideConfig {
    is_self_closing: Some(is_self_closing),
    ..Default::default()
  }
}

fn stream_at(html: &str, config: &[(&str, TagOverrideConfig)], split: usize) -> String {
  let mut processor = MarkdownStreamProcessor::new(options(config.to_vec()));
  let (head, tail) = html.split_at(split);
  let mut output = processor.process_chunk(head);
  output.push_str(&processor.process_chunk(tail));
  output.push_str(&processor.finish());
  output
}

/// A start tag parked mid-scan must resolve as it does when read whole.
fn assert_converts(html: &str, config: &[(&str, TagOverrideConfig)], expected: &str) {
  assert_eq!(html_to_markdown(html, options(config.to_vec())), expected);
  for split in 0..=html.len() {
    assert_eq!(
      stream_at(html, config, split),
      expected,
      "split {split}: {html:?}"
    );
  }
}

#[test]
fn custom_element_takes_no_content() {
  let plain = [("x-y", flag(true))];
  assert_converts("<p>a <x-y> 2</p>", &plain, "a  2");
  let config = [("x-y", marked(true))];
  assert_converts("<p>a <x-y>text</x-y> b</p>", &config, "a []text b");
  assert_converts("<p>a <x-y><x-y>in</x-y></x-y> b</p>", &config, "a [][]in b");
  assert_converts(
    r#"<p>a <x-y title="1>2">text</x-y> b</p>"#,
    &config,
    "a []text b",
  );
  assert_converts("<p>a <X-Y>text</X-Y> b</p>", &config, "a []text b");
}

#[test]
fn builtin_tag_takes_no_content() {
  let config = [("em", marked(true))];
  assert_converts("<p>a<em>b</em>c</p>", &config, "a[]bc");
  assert_converts("<p>a<EM>b</EM>c</p>", &config, "a[]bc");
}

#[test]
fn void_builtin_can_hold_content() {
  let config = [("br", marked(false))];
  assert_converts("<p>a<br>b</br>c</p>", &config, "a[b]c");
  assert_converts("<p>a<BR>b</BR>c</p>", &config, "a[b]c");
  assert_converts("<p>a<br/>b</p>", &config, "a[]b");
}

#[test]
fn override_without_the_flag_keeps_the_handler() {
  let config = [(
    "br",
    TagOverrideConfig {
      enter: Some("[".to_string()),
      exit: Some("]".to_string()),
      ..Default::default()
    },
  )];
  assert_converts("<p>a<br>b</p>", &config, "a[]b");
}

#[test]
fn alias_follows_its_own_entry_not_the_target_entry() {
  let inherited = [("x-y", TagOverrideConfig::alias("br")), ("br", flag(false))];
  assert_converts("<p>a<x-y>b</x-y>c</p>", &inherited, "a  \nbc");

  let reopened = [(
    "x-y",
    TagOverrideConfig {
      alias_tag_id: get_tag_id("br"),
      ..marked(false)
    },
  )];
  assert_converts("<p>a<x-y>b</x-y>c</p>", &reopened, "a[b]c");

  let closed = [(
    "x-y",
    TagOverrideConfig {
      alias_tag_id: get_tag_id("em"),
      ..marked(true)
    },
  )];
  assert_converts("<p>a<x-y>b</x-y>c</p>", &closed, "a[]bc");
}

#[test]
fn key_list_too_long_to_index_still_resolves() {
  let names: Vec<String> = (0..300).map(|i| format!("x-{i}")).collect();
  let mut config: Vec<(&str, TagOverrideConfig)> = names
    .iter()
    .map(|name| (name.as_str(), TagOverrideConfig::default()))
    .collect();
  config.push(("br", marked(false)));
  assert_eq!(
    html_to_markdown("<p>a<br>b</br>c</p>", options(config)),
    "a[b]c"
  );
}

#[test]
fn cdata_section_closes_without_its_content() {
  let config = [("#cdata-section", marked(true))];
  assert_converts("<p>a <![CDATA[x]]> c</p><p>d</p>", &config, "a [] c\n\nd");
  let alias = [("#cdata-section", TagOverrideConfig::alias("br"))];
  assert_converts("<p>a <![CDATA[x]]> c</p><p>d</p>", &alias, "a  \n c\n\nd");
}

#[test]
fn reopened_rule_separates_its_children_in_a_list_item() {
  let config = [("hr", flag(false))];
  assert_converts("<ul><li><hr>x</hr></li></ul>", &config, "- ***\n\n  x");
  assert_converts("<ul><li><hr></hr>x</li></ul>", &config, "- ***\n\n  x");
}

#[test]
fn heading_in_reopened_break_continues_its_line() {
  let config = [("br", flag(false))];
  assert_converts("<br><h1></h1></br>b c", &config, "# b c");
}

#[test]
fn end_tag_closes_a_reopened_void_past_the_depth_limit() {
  let open = "<div>".repeat(512);
  let close = "</div>".repeat(512);
  // The `</br>` ends the overflow root, so the inner `<div>` is its own root
  // and its end tag leaves the 512 outer ones to close the document.
  let html = format!("{open}<br>a</br><div>b</div><p>c</p>{close}<p>d</p>");
  let config = [("br", flag(false))];
  assert_eq!(
    html_to_markdown(&html, options(config.to_vec())),
    "a b c\n\nd"
  );
}
