// A completed link stored the whole buffer length in `last_content_cache_len`,
// a field `drain_streamed_prefix` reads as a length back from the end. That put
// the retained-tail start at 0, so the drain released nothing.
//
// Feeding one element per chunk makes every drain land right after a link
// close, so already-yielded output accumulated for the whole document. Under
// fixed-size frames the next text resets the cache, limiting the cost to one
// skipped drain cycle.
//
// Peak allocation is process-wide, so this lives in its own test binary rather
// than in `streaming_drain.rs`: a concurrent test allocating tens of MB would
// swamp the budget asserted here.
#![allow(unsafe_code)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

use mdream::MarkdownStreamProcessor;
use mdream::types::{CleanConfig, HTMLToMarkdownOptions};

struct Tracking;

static LIVE: AtomicUsize = AtomicUsize::new(0);
static PEAK: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for Tracking {
  unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
    let p = unsafe { System.alloc(layout) };
    if !p.is_null() {
      let live = LIVE.fetch_add(layout.size(), Ordering::Relaxed) + layout.size();
      PEAK.fetch_max(live, Ordering::Relaxed);
    }
    p
  }
  unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
    LIVE.fetch_sub(layout.size(), Ordering::Relaxed);
    unsafe { System.dealloc(ptr, layout) };
  }
}

#[global_allocator]
static ALLOC: Tracking = Tracking;

fn safe_clean() -> CleanConfig {
  // Everything except `fragments`, which needs the whole buffer.
  CleanConfig {
    urls: true,
    fragments: false,
    empty_links: true,
    blank_lines: true,
    redundant_links: true,
    self_link_headings: true,
    empty_images: true,
    empty_link_text: true,
  }
}

fn assert_released(label: &str, unit: &str, iterations: usize, opts: HTMLToMarkdownOptions) {
  let mut p = MarkdownStreamProcessor::new(opts);
  // Keep LIVE as the allocator's true process-wide total; resetting it would
  // make deallocations for pre-existing allocations underflow.
  let baseline = LIVE.load(Ordering::Relaxed);
  PEAK.store(baseline, Ordering::Relaxed);
  let mut yielded: u64 = 0;
  for _ in 0..iterations {
    yielded += p.process_chunk(unit).len() as u64; // wire would send + drop this
  }
  yielded += p.finish().len() as u64;
  let peak = PEAK.load(Ordering::Relaxed).saturating_sub(baseline) as u64;

  assert!(
    yielded > iterations as u64,
    "{label}: expected real output, got {yielded} bytes"
  );
  assert!(
    peak < 256 * 1024,
    "{label}: peak {peak} should be a bounded window, not ~{yielded} yielded"
  );
}

#[test]
fn completed_links_do_not_pin_yielded_output() {
  const ITERATIONS: usize = 50_000;

  let clean = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };

  for (label, unit) in [
    ("ordinary", r#"<a href="/x">x</a>"#),
    ("titled", r#"<a href="/x" title="t">x</a>"#),
    // `redundant_links` rewrites this to bare text before the autolink close is
    // reached, so only the clean-off run exercises that path.
    (
      "autolink",
      r#"<a href="https://example.com">https://example.com</a>"#,
    ),
  ] {
    assert_released(label, unit, ITERATIONS, HTMLToMarkdownOptions::default());
    assert_released(label, unit, ITERATIONS, clean.clone());
  }
}
