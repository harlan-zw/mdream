//! Select insertion-mode recovery for optional option/optgroup end tags.
use mdream::{MarkdownStreamProcessor, html_to_markdown, types::HTMLToMarkdownOptions};

fn convert(html: &str) -> String {
  html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn stream(chunks: &[&str]) -> String {
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut out = String::new();
  for chunk in chunks {
    out.push_str(&processor.process_chunk(chunk));
  }
  out.push_str(&processor.finish());
  out
}

#[test]
fn omitted_option_end_tags_create_sibling_options_and_keep_following_content() {
  assert_eq!(
    convert("<select><option>one<option>two</select><p>after</p>"),
    "one two\n\nafter",
  );
}

#[test]
fn omitted_and_explicit_option_end_tags_match() {
  assert_eq!(
    convert("<select><option>one<option>two</select><p>after</p>"),
    convert("<select><option>one</option><option>two</option></select><p>after</p>"),
  );
}

#[test]
fn omitted_optgroup_end_tags_close_the_option_and_previous_group() {
  assert_eq!(
    convert(
      "<select><optgroup label=a><option>one<option>two<optgroup label=b><option>three</select><p>after</p>",
    ),
    "one two three\n\nafter",
  );
}

#[test]
fn well_formed_optgroup_select_is_unchanged() {
  assert_eq!(
    convert(
      "<select><optgroup label=a><option>one</option><option>two</option></optgroup><option>three</option></select><p>after</p>",
    ),
    "one two three\n\nafter",
  );
}

#[test]
fn nested_select_start_closes_the_open_select() {
  assert_eq!(
    convert("<select><option>one<select><option>two</select><p>after</p>"),
    "one two\n\nafter",
  );
}

#[test]
fn streaming_select_recovery_matches_batch() {
  for (chunks, whole) in [
    (
      vec!["<select><option>one<op", "tion>two</select><p>after</p>"],
      "<select><option>one<option>two</select><p>after</p>",
    ),
    (
      vec![
        "<select><optgroup label=a><option>one<option>two<opt",
        "group label=b><option>three</sel",
        "ect><p>after</p>",
      ],
      "<select><optgroup label=a><option>one<option>two<optgroup label=b><option>three</select><p>after</p>",
    ),
  ] {
    let split = stream(&chunks);
    assert_eq!(split, stream(&[whole]), "chunks: {chunks:?}");
    assert_eq!(split.trim(), convert(whole));
  }
}
