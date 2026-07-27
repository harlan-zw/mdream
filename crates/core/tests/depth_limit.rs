use mdream::{
  ConversionError, HTMLToMarkdownOptions, MarkdownStreamProcessor, PluginConfig, TagOverrideConfig,
  html_to_markdown, try_html_to_markdown, try_html_to_markdown_result,
};

const LIMIT: usize = 512;
const HARD_LIMIT: usize = 4096;

#[test]
fn content_below_the_limit_is_unchanged() {
  let html = format!("{}deep{}", "<div>".repeat(LIMIT), "</div>".repeat(LIMIT));
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "deep"
  );
}

#[test]
fn content_and_later_siblings_survive_the_element_stack_limit() {
  let html = format!(
    "<p>before</p>{}deep{}<p>after</p>",
    "<div>".repeat(LIMIT + 32),
    "</div>".repeat(LIMIT + 32),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "before\n\ndeep\n\nafter",
  );
}

#[test]
fn result_reports_compact_fallback_as_degraded() {
  let exact = format!("{}deep{}", "<div>".repeat(LIMIT), "</div>".repeat(LIMIT));
  assert!(
    !try_html_to_markdown_result(&exact, HTMLToMarkdownOptions::default())
      .unwrap()
      .degraded
  );

  for semantic_html in [
    "<table><tr><td>cell</td></tr></table>",
    r#"<img src="image.png" alt="image">"#,
    r#"<a href="https://example.com">link</a>"#,
  ] {
    let html = format!(
      "{}{semantic_html}{}",
      "<div>".repeat(LIMIT),
      "</div>".repeat(LIMIT),
    );
    assert!(
      try_html_to_markdown_result(&html, HTMLToMarkdownOptions::default())
        .unwrap()
        .degraded,
      "compact fallback was not reported for {semantic_html}",
    );
  }
}

#[test]
fn stream_reports_compact_fallback_as_degraded() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  stream
    .try_process_chunk(&format!("{}<img>", "<div>".repeat(LIMIT)))
    .unwrap();
  assert!(stream.degraded());
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
fn implied_end_recovery_past_the_element_stack_limit_keeps_later_siblings() {
  let html = format!(
    "{}<p>one<p>two{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "one two\n\nafter",
  );
}

#[test]
fn streaming_preserves_content_and_later_siblings_past_the_element_stack_limit() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = stream.process_chunk("<p>before</p>");
  for _ in 0..LIMIT + 32 {
    output.push_str(&stream.process_chunk("<div>"));
  }
  output.push_str(&stream.process_chunk("deep"));
  for _ in 0..LIMIT + 32 {
    output.push_str(&stream.process_chunk("</div>"));
  }
  output.push_str(&stream.process_chunk("<p>after</p>"));
  output.push_str(&stream.finish());
  assert_eq!(output.trim_end(), "before\n\ndeep\n\nafter");
  assert_eq!(stream.failure(), None);
}

#[test]
fn content_hidden_past_the_element_stack_limit_cannot_leak() {
  let html = format!(
    "{}<template><strong>hidden</strong></template>{}<p>shown</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "shown"
  );
}

#[test]
fn streaming_raw_text_past_the_element_stack_limit_stays_hidden() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = stream.process_chunk(&"<div>".repeat(LIMIT));
  output.push_str(&stream.process_chunk("<script>const leak = '<b>hidden</b>';</scr"));
  output.push_str(&stream.process_chunk("ipt><p>shown</p>"));
  output.push_str(&stream.process_chunk(&"</div>".repeat(LIMIT)));
  output.push_str(&stream.process_chunk("<p>after</p>"));
  output.push_str(&stream.finish());
  assert_eq!(output.trim_end(), "shown\n\nafter");
  assert_eq!(stream.failure(), None);
}

#[test]
fn skipped_cdata_override_does_not_emit_or_pop_its_parent_past_the_element_stack_limit() {
  let html = format!(
    "{}<![CDATA[hidden]]>{}<p>shown</p>",
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
  assert_eq!(html_to_markdown(&html, options), "shown");
}

#[test]
fn skipped_cdata_override_does_not_consume_the_hard_depth_budget() {
  let html = format!(
    "{}<![CDATA[hidden]]>{}kept{}",
    "<div>".repeat(LIMIT),
    "<div>".repeat(HARD_LIMIT - LIMIT),
    "</div>".repeat(HARD_LIMIT),
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
  assert_eq!(try_html_to_markdown(&html, options), Ok("kept".to_string()));
}

#[test]
fn mismatched_and_custom_closes_past_the_element_stack_limit_do_not_desync() {
  let html = format!(
    "{}<x-outer><x-inner>inside</x-outer></span>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "inside\n\nafter",
  );
}

#[test]
fn scoped_stray_close_bomb_past_the_element_stack_limit_stays_linear() {
  let html = format!(
    "{}<target><template>{}hidden{}{}</template></target>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "<span>".repeat(3_000),
    "</target>".repeat(10_000),
    "</span>".repeat(3_000),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "after",
  );
}

#[test]
fn void_and_self_closing_elements_past_the_element_stack_limit_do_not_desync() {
  let html = format!(
    "{}<br><img><custom />inside{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "inside\n\nafter",
  );
}

#[test]
fn contextual_escaping_survives_u8_counter_boundaries() {
  for depth in [255, 256, 511, 512] {
    let html = format!(
      "{}{}x > y{}",
      "<blockquote>".repeat(depth),
      "</blockquote>".repeat(depth - 1),
      "</blockquote>",
    );
    let output = html_to_markdown(&html, HTMLToMarkdownOptions::default());
    assert!(
      output.contains("x \\> y"),
      "depth {depth} lost blockquote escaping: {output:?}",
    );
  }
}

#[test]
fn hard_logical_depth_limit_is_terminal_and_observable() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let error = ConversionError::ElementDepthLimitExceeded {
    max_depth: HARD_LIMIT,
    attempted_depth: HARD_LIMIT + 1,
  };
  assert_eq!(
    stream.try_process_chunk(&"<div>".repeat(HARD_LIMIT + 1)),
    Err(error),
  );
  assert_eq!(stream.failure(), Some(error));
  assert_eq!(stream.try_process_chunk("discarded"), Err(error));
  assert_eq!(stream.try_finish(), Err(error));
}

#[test]
fn one_shot_hard_logical_depth_limit_returns_a_tagged_error() {
  let html = "<div>".repeat(HARD_LIMIT + 1);
  assert_eq!(
    try_html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    Err(ConversionError::ElementDepthLimitExceeded {
      max_depth: HARD_LIMIT,
      attempted_depth: HARD_LIMIT + 1,
    }),
  );
}

#[test]
fn self_closing_element_beyond_the_hard_logical_depth_returns_a_tagged_error() {
  let html = format!("{}<br>", "<div>".repeat(HARD_LIMIT));
  assert_eq!(
    try_html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    Err(ConversionError::ElementDepthLimitExceeded {
      max_depth: HARD_LIMIT,
      attempted_depth: HARD_LIMIT + 1,
    }),
  );
}

#[test]
fn implied_end_recovery_crosses_from_the_compact_stack_into_the_rich_stack() {
  let html = format!("<p>A{}<em>B<div>C", "<span>".repeat(LIMIT - 1));
  assert_eq!(
    try_html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    Ok("AB\n\nC".to_string()),
  );
}

#[test]
fn compact_head_recovery_keeps_rich_ancestors_open() {
  let html = format!(
    "<blockquote><blockquote>ALPHA{}<head><p>X</p>{}OMEGA</blockquote></blockquote>ZED",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    try_html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    Ok("> > ALPHA\n> >\n> > X\n> >\n> > OMEGA\n\nZED".to_string()),
  );
}

#[test]
fn streaming_hard_logical_depth_limit_returns_a_tagged_error() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  assert_eq!(
    stream.try_process_chunk(&"<div>".repeat(HARD_LIMIT + 1)),
    Err(ConversionError::ElementDepthLimitExceeded {
      max_depth: HARD_LIMIT,
      attempted_depth: HARD_LIMIT + 1,
    }),
  );
}

#[test]
fn compact_custom_name_memory_limit_is_terminal_and_observable() {
  let mut html = "<div>".repeat(LIMIT);
  for index in 0..3_000 {
    html.push_str(&format!("<custom-{index:04}-{}>", "x".repeat(32)));
  }

  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let error = ConversionError::ElementNameMemoryLimitExceeded {
    max_bytes: 64 * 1024,
  };
  assert_eq!(stream.try_process_chunk(&html), Err(error));
  assert_eq!(stream.failure(), Some(error));
}

#[test]
fn compact_custom_name_memory_limit_returns_a_distinct_error() {
  let mut html = "<div>".repeat(LIMIT);
  for index in 0..3_000 {
    html.push_str(&format!("<custom-{index:04}-{}>", "x".repeat(32)));
  }

  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  assert_eq!(
    stream.try_process_chunk(&html),
    Err(ConversionError::ElementNameMemoryLimitExceeded {
      max_bytes: 64 * 1024,
    }),
  );
}

#[test]
fn compact_custom_name_count_limit_is_terminal_and_observable() {
  let mut html = "<div>".repeat(LIMIT + 1);
  for index in 0..=HARD_LIMIT - LIMIT {
    html.push_str(&format!("<x-{index:x}></x-{index:x}>"));
  }

  assert_eq!(
    try_html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    Err(ConversionError::ElementNameCountLimitExceeded {
      max_names: HARD_LIMIT - LIMIT,
    }),
  );
}

#[test]
fn exact_hard_logical_depth_limit_remains_processable() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = stream.process_chunk(&"<div>".repeat(HARD_LIMIT));
  assert_eq!(stream.failure(), None);
  output.push_str(&stream.process_chunk("kept"));
  output.push_str(&stream.process_chunk(&"</div>".repeat(HARD_LIMIT)));
  output.push_str(&stream.finish());
  assert_eq!(output.trim_end(), "kept");
  assert_eq!(stream.failure(), None);
}
