use mdream::{
  HTMLToMarkdownOptions, MarkdownStreamProcessor, PluginConfig, TagOverrideConfig, html_to_markdown,
};

const LIMIT: usize = 512;

#[test]
fn content_below_the_limit_is_unchanged() {
  let html = format!("{}deep{}", "<div>".repeat(LIMIT), "</div>".repeat(LIMIT));
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "deep"
  );
}

#[test]
fn conversion_continues_when_nesting_exceeds_the_materialized_limit() {
  let html = format!(
    "<p>before</p>{}inside{}<p>after</p>",
    "<div>".repeat(100_000),
    "</div>".repeat(100_000),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "before\n\ninside\n\nafter",
  );
}

#[test]
fn self_closing_elements_at_the_limit_do_not_stop_conversion() {
  let html = format!(
    "{}<br>kept{}",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  let output = html_to_markdown(&html, HTMLToMarkdownOptions::default());
  assert!(output.contains("kept"), "got: {output:?}");
}

#[test]
fn implied_end_recovery_does_not_trigger_the_limit() {
  let html = "<p>item".repeat(1_000);
  let output = html_to_markdown(&html, HTMLToMarkdownOptions::default());
  assert_eq!(output.matches("item").count(), 1_000);
}

#[test]
fn later_siblings_survive_implied_ends_in_overflow() {
  let html = format!(
    "{}<p>one<p>two</p>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "one two\n\nafter"
  );
}

#[test]
fn mismatched_builtin_closes_inside_overflow_are_ignored() {
  let html = format!(
    "{}<span><em>inside</table></span>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "inside\n\nafter"
  );
}

#[test]
fn streaming_continues_after_the_limit() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = stream.process_chunk("<p>before</p>");
  for _ in 0..10_000 {
    output.push_str(&stream.process_chunk("<div>"));
  }
  output.push_str(&stream.process_chunk("inside"));
  for _ in 0..10_000 {
    output.push_str(&stream.process_chunk("</div>"));
  }
  output.push_str(&stream.process_chunk("<p>after</p>"));
  output.push_str(&stream.finish());
  assert_eq!(output.trim_end(), "before\n\ninside\n\nafter");
}

#[test]
fn content_hidden_at_the_limit_cannot_leak() {
  let html = format!(
    "{}<template><strong>hidden</strong></template><p>visible</p>{}",
    "<div>".repeat(LIMIT - 1),
    "</div>".repeat(LIMIT - 1),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "visible"
  );
}

#[test]
fn skipped_cdata_override_does_not_emit_or_pop_its_parent() {
  let html = format!(
    "{}<![CDATA[hidden]]><p>visible</p>{}",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "#cdata-section".to_string(),
        TagOverrideConfig {
          enter: Some("[".to_string()),
          exit: Some("]".to_string()),
          ..Default::default()
        },
      )]),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(&html, options), "visible");
}

#[test]
fn raw_text_stays_hidden_beyond_the_materialized_limit() {
  let html = format!(
    "{}<script></div><p>hidden</p></script><p>visible</p>{}",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "visible"
  );
}

#[test]
fn builtin_closes_are_case_insensitive_in_overflow() {
  let html = format!(
    "{}<SCRIPT>hidden</SCRIPT><p>visible</p>{}",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "visible"
  );
}

#[test]
fn streamed_raw_text_close_can_split_across_chunks() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = stream.process_chunk(&format!("{}<script>hidden</scr", "<div>".repeat(LIMIT)));
  output.push_str(&stream.process_chunk(&format!(
    "ipt><p>visible</p>{}<p>tail</p>",
    "</div>".repeat(LIMIT)
  )));
  output.push_str(&stream.finish());
  assert_eq!(output, "visible\n\ntail");
}

#[test]
fn matching_tag_depth_context_survives_255() {
  let html = format!(
    "{}{}x > y{}",
    "<blockquote>".repeat(300),
    "</blockquote>".repeat(255),
    "</blockquote>".repeat(45),
  );
  assert!(html_to_markdown(&html, HTMLToMarkdownOptions::default()).contains("\\>"));
}

#[test]
fn structural_ancestors_survive_the_overflow_boundary() {
  let html = format!(
    "<blockquote><blockquote>ALPHA{}<head><p>X</p>{}OMEGA</blockquote></blockquote>ZED",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "> > ALPHA\n> >\n> > X\n> >\n> > OMEGA\n\nZED"
  );
}
