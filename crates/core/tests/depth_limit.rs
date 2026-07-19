use mdream::{HTMLToMarkdownOptions, MarkdownStreamProcessor, html_to_markdown};

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
fn conversion_stops_when_nesting_exceeds_the_limit() {
  let html = format!("<p>before</p>{}discarded", "<div>".repeat(100_000),);
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    "before",
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
fn streaming_stops_consuming_after_the_limit() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut output = stream.process_chunk("<p>before</p>");
  for _ in 0..10_000 {
    output.push_str(&stream.process_chunk("<div>"));
  }
  output.push_str(&stream.process_chunk("discarded"));
  output.push_str(&stream.finish());
  assert_eq!(output.trim_end(), "before");
}

#[test]
fn content_hidden_at_the_limit_cannot_leak() {
  let html = format!(
    "{}<template><strong>hidden</strong></template><p>discarded</p>",
    "<div>".repeat(LIMIT - 1),
  );
  assert_eq!(
    html_to_markdown(&html, HTMLToMarkdownOptions::default()),
    ""
  );
}
