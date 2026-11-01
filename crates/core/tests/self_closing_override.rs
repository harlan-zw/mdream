//! `isSelfClosing` in `tagOverrides` decides whether a start tag opens an
//! element, wherever a built-in void tag is recognized.
use mdream::types::{HtmlToMarkdownOptions, OutputFormat, PluginConfig, TagOverrideConfig};
use mdream::{MarkdownStreamProcessor, get_tag_id, html_to_markdown, html_to_text};

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

fn assert_text_converts(html: &str, config: &[(&str, TagOverrideConfig)], expected: &str) {
  assert_eq!(html_to_text(html, options(config.to_vec())), expected);
  for split in 0..=html.len() {
    let mut processor =
      MarkdownStreamProcessor::new_with_format(options(config.to_vec()), OutputFormat::Text);
    let mut output = processor.process_chunk(&html[..split]);
    output.push_str(&processor.process_chunk(&html[split..]));
    output.push_str(&processor.finish());
    assert_eq!(output, expected, "split {split}: {html:?}");
  }
}

fn spaced(is_self_closing: bool, spacing: [u8; 2]) -> TagOverrideConfig {
  TagOverrideConfig {
    spacing: Some(spacing),
    ..flag(is_self_closing)
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
  // Only the enter arms the separator, so text after the end tag gets none.
  assert_converts(
    "<ul><li>a<hr>x</hr>b</li></ul>",
    &config,
    "- a\n\n  ---\n\n  xb",
  );
}

#[test]
fn heading_after_reopened_break_starts_its_own_block() {
  let config = [("br", flag(false))];
  assert_converts("<br><h1></h1></br>b c", &config, "#\n\nb c");
  assert_converts(
    "<p>a</p><br><h2>x</h2>| x |",
    &config,
    "a\n\n  \n\n## x\n\n| x |",
  );
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

#[test]
fn aliased_builtin_end_tag_closes_its_overflow_root() {
  let open = "<div>".repeat(512);
  let close = "</div>".repeat(512);
  let html = format!("{open}<br>a</br><div>b</div><p>c</p>{close}<p>d</p>");
  let config = [(
    "br",
    TagOverrideConfig {
      alias_tag_id: get_tag_id("img"),
      is_self_closing: Some(false),
      ..Default::default()
    },
  )];
  assert_eq!(
    html_to_markdown(&html, options(config.to_vec())),
    "a b c\n\nd"
  );
}

#[test]
fn open_thematic_break_keeps_block_spacing_after_it() {
  let config = [("hr", flag(false))];
  assert_converts("<p>a</p><hr>x<p>b</p>", &config, "a\n\n---\n\nx\n\nb");
  assert_converts("<p>a<hr></p><p>b</p>", &config, "a\n\n---\n\nb");
}

#[test]
fn open_void_keeps_inline_children_inline() {
  // The image's block spacing is zero, so text it holds stays in its line.
  let config = [("img", flag(false))];
  assert_converts(r#"<p>a<img src="a.png">x</p>"#, &config, "a![](a.png)x");
}

#[test]
fn open_void_block_child_keeps_block_spacing() {
  // The same output as the default path, which has no open void to collapse.
  let img = [("img", flag(false))];
  assert_converts(
    r#"<p>a</p><img src="a.png">x<p>b</p>"#,
    &img,
    "a\n\n![](a.png)x\n\nb",
  );
  let br = [("br", flag(false))];
  assert_converts("<p>a</p><br>x<p>b</p>", &br, "a\n\n  \nx\n\nb");
}

#[test]
fn open_void_inline_wrapper_still_keeps_block_child_inline() {
  // Only a br or img ancestor lifts the suppression, so a wrapper keeps it.
  let config = [("br", flag(false))];
  assert_converts(
    "<p>a</p><br><strong>x<p>b</p></strong>y",
    &config,
    "a\n\n  \n**x b**y",
  );
}

#[test]
fn custom_exit_keeps_spacing_after_its_output() {
  let marked = [(
    "hr",
    TagOverrideConfig {
      spacing: Some([0, 2]),
      ..marked(false)
    },
  )];
  assert_converts("<hr>x</hr>y", &marked, "[x]\n\ny");
  let empty_exit = [(
    "hr",
    TagOverrideConfig {
      exit: Some(String::new()),
      ..flag(false)
    },
  )];
  assert_converts("<hr>x</hr>y", &empty_exit, "---\n\nxy");
}

#[test]
fn reopened_void_keeps_its_explicit_spacing() {
  assert_converts(
    "a<br>x</br>y",
    &[("br", spaced(false, [0, 2]))],
    "a  \n\nxy",
  );
  assert_converts(
    r#"<img src="a.png">x</img>y"#,
    &[("img", spaced(false, [0, 2]))],
    "![](a.png)\n\nxy",
  );
  assert_converts(
    "<p>a</p><meta>x</meta>y",
    &[("meta", spaced(false, [2, 2]))],
    "a\n\nxy",
  );
}

#[test]
fn open_void_child_spacing_follows_its_inline_override() {
  let block_em = TagOverrideConfig {
    is_inline: Some(false),
    spacing: Some([2, 2]),
    ..Default::default()
  };
  assert_converts(
    r#"<img src="a.png"><em>x</em>y</img>"#,
    &[("img", flag(false)), ("em", block_em)],
    "![](a.png)\n\n* x*\n\ny",
  );
  let inline_p = TagOverrideConfig {
    is_inline: Some(true),
    ..Default::default()
  };
  assert_converts(
    r#"<img src="a.png"><p>x</p>y</img>"#,
    &[("img", flag(false)), ("p", inline_p)],
    "![](a.png)xy",
  );
}

#[test]
fn plain_text_open_void_boundary_follows_its_start_tag() {
  let hr = [("hr", flag(false))];
  assert_text_converts("<hr>x</hr>y", &hr, "xy");
  assert_text_converts("<p>a</p><hr>x</hr>y", &hr, "a\n\nxy");
  assert_text_converts("a<br>x</br>y", &[("br", flag(false))], "a\nxy");
  assert_text_converts("a<br>x</br>y", &[("br", spaced(false, [0, 2]))], "a\n\nxy");
  let img = [("img", flag(false))];
  assert_text_converts(r#"a<img alt="i">x</img>y"#, &img, "a ixy");
  assert_text_converts(r#"a<img alt="i"><p>x</p>y</img>"#, &img, "a i\n\nx\n\ny");
  assert_text_converts(
    r#"a<img alt="i">x</img>y"#,
    &[("img", spaced(false, [0, 2]))],
    "a i\n\nxy",
  );
}

#[test]
fn void_spacing_unchanged_without_an_open_override() {
  let html = "<p>a</p><hr>x<p>b</p>";
  assert_converts(html, &[], "a\n\n---\n\nx\n\nb");
  let unrelated = [("em", flag(false))];
  assert_converts(html, &unrelated, "a\n\n---\n\nx\n\nb");
}
