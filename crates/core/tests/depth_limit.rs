use mdream::{
  FilterConfig, HTMLToMarkdownOptions, MarkdownStreamProcessor, PluginConfig, TagOverrideConfig,
  TailwindConfig, html_to_markdown,
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
fn implied_ends_recover_across_the_overflow_boundary() {
  let html = format!("<p>A{}<em>B<div>C", "<span>".repeat(LIMIT - 1));
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "AB\n\nC"
  );
}

#[test]
fn links_and_list_items_recover_across_the_overflow_boundary() {
  let link = format!("<a href=\"x\">A{}<em>B</a>C", "<span>".repeat(LIMIT - 1));
  assert_eq!(
    html_to_markdown(&link, HTMLToMarkdownOptions::default()),
    "[AB](x)C"
  );

  let list = format!("<ul><li>A{}<em>B<li>C</ul>", "<span>".repeat(LIMIT - 2));
  assert_eq!(
    html_to_markdown(&list, HTMLToMarkdownOptions::default()),
    "- AB\n- C"
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
fn visible_table_and_image_content_survives_overflow() {
  let html = format!(
    "{}<table><tr><td>cell</td></tr></table><span><img src=\"x\" alt=\"image\"></span>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "cell![image](x)\n\nafter"
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

#[test]
fn template_content_stays_inert_inside_the_flattened_subtree() {
  let html = format!(
    "{}{}<template><b>hidden</template>{}{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "<span>".repeat(LIMIT),
    "</span>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "after"
  );
}

#[test]
fn filtered_content_stays_hidden_in_overflow() {
  let html = format!(
    "{}<div style=\"display:none\"></span><img src=\"x\" alt=\"secret\"></div>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::default()),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(&html, options), "after");
}

#[test]
fn included_flattened_root_overrides_excluded_ancestors() {
  let html = format!(
    "{}<nav>KEEP</nav>{}",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::include(&["nav"])),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(&html, options), "KEEP");
}

#[test]
fn included_flattened_root_stays_hidden_under_a_hidden_ancestor() {
  let html = format!(
    "<div hidden>{}<nav>HIDDEN</nav>{}</div>",
    "<div>".repeat(LIMIT - 1),
    "</div>".repeat(LIMIT - 1),
  );
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: Some(FilterConfig::include(&["nav"])),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(&html, options), "");
}

#[test]
fn output_neutral_plugins_keep_visible_overflow_content() {
  let html = format!(
    "{}<span>visible</span>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  for plugins in [
    PluginConfig {
      filter: Some(FilterConfig::default()),
      ..Default::default()
    },
    PluginConfig {
      tailwind: Some(TailwindConfig),
      ..Default::default()
    },
  ] {
    let options = HTMLToMarkdownOptions {
      plugins: Some(plugins),
      ..Default::default()
    };
    assert_eq!(html_to_markdown(&html, options), "visible\n\nafter");
  }
}

#[test]
fn self_closing_content_stays_inert_inside_overflow_templates() {
  let html = format!(
    "{}<template><script></template></script><img src=\"x\" alt=\"secret\"><hr></template>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "after"
  );
}

#[test]
fn excluded_raw_aliases_stay_inert_in_overflow() {
  let html = format!(
    "{}<x-raw>secret</y-raw>still secret</x-raw>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  let options = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![
        ("x-raw".to_string(), TagOverrideConfig::alias("script")),
        ("y-raw".to_string(), TagOverrideConfig::alias("script")),
      ]),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(&html, options), "after");
}

#[test]
fn hidden_raw_overflow_root_scans_as_raw_text() {
  let html = format!(
    "{}<script hidden>let x = \"<script>\"</script>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  for plugins in [
    PluginConfig {
      filter: Some(FilterConfig::default()),
      ..Default::default()
    },
    PluginConfig {
      tailwind: Some(TailwindConfig),
      ..Default::default()
    },
  ] {
    let options = HTMLToMarkdownOptions {
      plugins: Some(plugins),
      ..Default::default()
    };
    assert_eq!(html_to_markdown(&html, options), "after");
  }
}

#[test]
fn only_plugin_hidden_subtrees_start_opaque_overflow() {
  let html = format!(
    "{}<span class=\"secret hidden\"><img src=\"x\" alt=\"secret\"></span>{}<p>after</p>",
    "<div>".repeat(LIMIT),
    "</div>".repeat(LIMIT),
  );
  for plugins in [
    PluginConfig {
      filter: Some(FilterConfig {
        exclude: Some(vec![".secret".to_string()]),
        ..Default::default()
      }),
      ..Default::default()
    },
    PluginConfig {
      tailwind: Some(TailwindConfig),
      ..Default::default()
    },
  ] {
    let options = HTMLToMarkdownOptions {
      plugins: Some(plugins),
      ..Default::default()
    };
    assert_eq!(html_to_markdown(&html, options), "after");
  }
}
