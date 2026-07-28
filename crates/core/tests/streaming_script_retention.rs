// Script data is dropped from the output, so buffering it retains the whole
// element to emit nothing. Only extraction reads it.
//
// One test, so the process-wide peak is not perturbed by a sibling test running
// concurrently; other test binaries are separate processes. In `streaming_drain.rs`
// this measured 287 bytes alone but 30 KiB to 135 KiB against the 256 KiB budget
// under the parallel runner, because a concurrent case there allocates 32 MiB.
#![allow(unsafe_code)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

use mdream::MarkdownStreamProcessor;
use mdream::types::{ExtractionConfig, HTMLToMarkdownOptions, PluginConfig};

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

#[test]
fn excluded_script_data_is_not_retained() {
  let mut html = String::with_capacity(2 * 1024 * 1024 + 64);
  html.push_str("<p>before</p><script>");
  while html.len() < 2 * 1024 * 1024 {
    html.push_str("var filler = 1; function f() { return 2; } ");
  }
  html.push_str("</script><p>after</p>");

  for (label, options) in [
    ("without extraction", HTMLToMarkdownOptions::default()),
    (
      "without an active extraction",
      HTMLToMarkdownOptions {
        plugins: Some(PluginConfig {
          extraction: Some(ExtractionConfig::new(&["p"])),
          ..Default::default()
        }),
        ..Default::default()
      },
    ),
  ] {
    let mut processor = MarkdownStreamProcessor::new(options);
    // Keep LIVE as the allocator's true process-wide total; resetting it would
    // make deallocations for pre-existing allocations underflow.
    let baseline = LIVE.load(Ordering::Relaxed);
    PEAK.store(baseline, Ordering::Relaxed);
    let mut out = String::new();
    for chunk in html.as_bytes().chunks(8 * 1024) {
      out.push_str(&processor.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    out.push_str(&processor.finish());
    let peak = PEAK.load(Ordering::Relaxed).saturating_sub(baseline);

    assert_eq!(out.trim(), "before\n\nafter");
    assert!(
      peak < 256 * 1024,
      "{label}: peak {peak} should not scale with the {} byte script",
      html.len()
    );
  }
}
