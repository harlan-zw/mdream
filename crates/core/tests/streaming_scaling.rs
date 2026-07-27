//! Streaming must stay linear in input size.
//!
//! A construct that withholds a tag boundary (a text run or rawtext body longer
//! than one chunk) used to be re-fed as raw input on every chunk, so the work
//! was quadratic. Cost is measured against the same document converted in one
//! shot, which is linear by construction, so the ratio is independent of how
//! fast the machine is.

use std::hint::black_box;
use std::time::{Duration, Instant};

use mdream::MarkdownStreamProcessor;
use mdream::html_to_markdown;
use mdream::types::HTMLToMarkdownOptions;

const CHUNK: usize = 8 * 1024;

fn stream(html: &str) -> usize {
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut bytes = 0;
  for chunk in html.as_bytes().chunks(CHUNK) {
    bytes += processor
      .process_chunk(std::str::from_utf8(chunk).unwrap())
      .len();
  }
  bytes + processor.finish().len()
}

fn fastest<F: FnMut() -> usize>(mut run: F) -> Duration {
  let mut best = Duration::MAX;
  for _ in 0..3 {
    let start = Instant::now();
    black_box(run());
    best = best.min(start.elapsed());
  }
  best
}

/// Streaming cost relative to one-shot. Linear streaming stays a small multiple;
/// quadratic streaming grows without bound as the document grows.
fn overhead_vs_one_shot(html: &str) -> f64 {
  let streamed = fastest(|| stream(html));
  let one_shot = fastest(|| html_to_markdown(html, HTMLToMarkdownOptions::default()).len());
  streamed.as_secs_f64() / one_shot.as_secs_f64().max(f64::MIN_POSITIVE)
}

fn assert_linear(label: &str, html: &str) {
  let overhead = overhead_vs_one_shot(html);
  // Generous: the fix lands near 1-2x, the quadratic behaviour was >100x at this
  // size. Anything under 20x cannot be quadratic here.
  assert!(
    overhead < 20.0,
    "{label}: streaming cost {overhead:.1}x one-shot for {} bytes, expected linear",
    html.len()
  );
}

fn repeat_to(prefix: &str, unit: &str, target: usize, suffix: &str) -> String {
  let mut html = String::with_capacity(target + prefix.len() + suffix.len() + unit.len());
  html.push_str(prefix);
  while html.len() < target {
    html.push_str(unit);
  }
  html.push_str(suffix);
  html
}

const SIZE: usize = 4 * 1024 * 1024;

#[test]
fn streaming_a_text_run_longer_than_the_chunk_stays_linear() {
  let html = repeat_to("<p>", "lorem ipsum dolor sit amet ", SIZE, "</p>");
  assert_linear("text run", &html);
}

#[test]
fn streaming_a_style_body_longer_than_the_chunk_stays_linear() {
  let html = repeat_to(
    "<style>",
    ".c { color: #fff; } ",
    SIZE,
    "</style><p>after</p>",
  );
  assert_linear("style body", &html);
}

#[test]
fn streaming_a_script_body_longer_than_the_chunk_stays_linear() {
  let html = repeat_to("<script>", "var x = 1; ", SIZE, "</script><p>after</p>");
  assert_linear("script body", &html);
}

#[test]
fn streaming_a_title_longer_than_the_chunk_stays_linear() {
  let html = repeat_to("<title>", "words in a very long title ", SIZE, "</title>");
  assert_linear("title", &html);
}
