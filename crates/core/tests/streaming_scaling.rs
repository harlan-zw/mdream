//! Streaming must stay linear in input size.
//!
//! A construct that withholds a tag boundary (a text run or rawtext body longer
//! than one chunk) used to be re-fed as raw input on every chunk, so the work
//! was quadratic.
//!
//! The gate here is allocation volume, not elapsed time: the re-feed allocated a
//! carry that grew with the run, once per chunk, so the byte count it produced is
//! quadratic too. Volume is deterministic, so this can gate CI on a shared
//! runner, where a wall-clock threshold could not. `streaming_cost_vs_one_shot`
//! below measures the time directly and is `#[ignore]`d for that reason.

#![allow(unsafe_code)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use mdream::MarkdownStreamProcessor;
use mdream::html_to_markdown;
use mdream::types::HTMLToMarkdownOptions;

// Counts every allocation request. `realloc` is deliberately left to the trait
// default, which routes through `alloc`, so buffer growth is visible here.
struct Counting;

static TOTAL: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for Counting {
  unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
    let p = unsafe { System.alloc(layout) };
    if !p.is_null() {
      TOTAL.fetch_add(layout.size(), Ordering::Relaxed);
    }
    p
  }
  unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
    unsafe { System.dealloc(ptr, layout) };
  }
}

#[global_allocator]
static ALLOC: Counting = Counting;

const CHUNK: usize = 8 * 1024;
const SIZE: usize = 4 * 1024 * 1024;

/// Measured allocation per input byte at this size, before the fix and after:
/// text run 777x -> 8x, style body 773x -> 4x, title 775x -> 6x. The script body
/// was already linear in volume (4x -> 0x); it retained the element instead,
/// which `streaming_script_retention` covers. This sits an order of magnitude
/// clear of both sides.
const MAX_ALLOCATION_PER_BYTE: f64 = 64.0;

/// Splits on char boundaries, so the helper stays valid if a case gains
/// multibyte input. Each yielded chunk is dropped, as a wire consumer would.
fn stream(html: &str) -> usize {
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut bytes = 0;
  let mut start = 0;
  while start < html.len() {
    let mut end = (start + CHUNK).min(html.len());
    while end < html.len() && !html.is_char_boundary(end) {
      end += 1;
    }
    bytes += processor.process_chunk(&html[start..end]).len();
    start = end;
  }
  bytes + processor.finish().len()
}

/// Bytes allocated while streaming `html`, as a multiple of the document size.
fn allocation_per_byte(html: &str) -> f64 {
  let before = TOTAL.load(Ordering::Relaxed);
  black_box(stream(html));
  let allocated = TOTAL.load(Ordering::Relaxed).saturating_sub(before);
  allocated as f64 / html.len() as f64
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

/// Each body is one run longer than the chunk, so none of them offers the tag
/// boundary that flushes the text buffer.
fn cases() -> [(&'static str, String); 4] {
  [
    (
      "text run",
      repeat_to("<p>", "lorem ipsum dolor sit amet ", SIZE, "</p>"),
    ),
    (
      "style body",
      repeat_to(
        "<style>",
        ".c { color: #fff; } ",
        SIZE,
        "</style><p>after</p>",
      ),
    ),
    (
      "script body",
      repeat_to("<script>", "var x = 1; ", SIZE, "</script><p>after</p>"),
    ),
    (
      "title",
      repeat_to("<title>", "words in a very long title ", SIZE, "</title>"),
    ),
  ]
}

// One test, so the process-wide counter is not perturbed by a sibling test
// running concurrently. Other test binaries are separate processes.
#[test]
fn streaming_a_run_longer_than_the_chunk_allocates_linearly() {
  for (label, html) in cases() {
    let per_byte = allocation_per_byte(&html);
    eprintln!("{label}: {per_byte:.2}x document allocated");
    assert!(
      per_byte < MAX_ALLOCATION_PER_BYTE,
      "{label}: allocated {per_byte:.1}x the {} byte document, expected linear",
      html.len()
    );
  }
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

/// The same defect measured as elapsed time, normalised against one-shot
/// conversion so the number does not depend on machine speed. Wall clock is too
/// noisy on a shared runner to gate a required check, so this is opt-in:
/// `cargo test --release --test streaming_scaling -- --ignored --nocapture`.
#[test]
#[ignore = "timing-based; run manually"]
fn streaming_cost_vs_one_shot() {
  for (label, html) in cases() {
    let streamed = fastest(|| stream(&html));
    let one_shot = fastest(|| html_to_markdown(&html, HTMLToMarkdownOptions::default()).len());
    let overhead = streamed.as_secs_f64() / one_shot.as_secs_f64().max(f64::MIN_POSITIVE);
    eprintln!("{label}: streamed {streamed:?}, one-shot {one_shot:?} ({overhead:.1}x)");
  }
}
