// Test-only peak-allocation tracker; the crate itself stays unsafe-free.
#![allow(unsafe_code)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

use mdream::MarkdownStreamProcessor;
use mdream::html_to_markdown;
use mdream::types::{CleanConfig, HTMLToMarkdownOptions};

// ── Peak-allocation tracking allocator ──
// Streaming must free already-yielded output; a criterion/time bench can't show
// that, so we track live bytes and assert the peak stays bounded.

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

fn stream_chunks(html: &str, chunk: usize, opts: HTMLToMarkdownOptions) -> String {
  let mut p = MarkdownStreamProcessor::new(opts);
  let mut out = String::new();
  for c in html.as_bytes().chunks(chunk) {
    out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
  }
  out.push_str(&p.finish());
  out
}

// Compares chunked streaming against one-shot, so it excludes the
// rewrite-after-yield constructs (autolink text==url, self-link headings,
// redundant `[url](url)`) that diverge from one-shot even on `main`. Drain
// transparency for those is covered by lib.rs `drain_equiv`.
const CORPUS: &[&str] = &[
  "<h1>Title</h1><p>Para one.</p><p>Para <strong>two</strong>.</p>",
  "<ul><li>a</li><li>b<ul><li>b1</li><li>b2</li></ul></li></ul>",
  r#"<p>See <a href="https://example.com">Example</a> and <a href="https://x.io">the X site</a>.</p>"#,
  "<blockquote><p>quote</p><blockquote><p>nested</p></blockquote></blockquote><p>after</p>",
  "<pre><code>let x = 1;\nlet y = 2;</code></pre><p>done</p>",
  "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>",
  r#"<h2>Section</h2><p>text with a <a href="/rel">relative</a> link</p>"#,
];

#[test]
fn streamed_output_matches_one_shot() {
  for &html in CORPUS {
    for opts in [
      HTMLToMarkdownOptions::default(),
      HTMLToMarkdownOptions {
        clean: Some(safe_clean()),
        ..Default::default()
      },
    ] {
      let expected = html_to_markdown(html, opts.clone());
      for chunk in [1usize, 3, 7, 64, html.len().max(1)] {
        let got = stream_chunks(html, chunk, opts.clone());
        assert_eq!(
          got.trim(),
          expected.trim(),
          "mismatch: chunk={chunk} html={html:?}"
        );
      }
    }
  }
}

#[test]
fn streaming_wrap_preserves_the_full_current_column() {
  let html = "<p>alpha <span>beta</span> <span>gamma</span> delta</p>";
  let options = HTMLToMarkdownOptions::default().with_wrap_width(12);
  let expected = html_to_markdown(html, options.clone());
  let mut processor = MarkdownStreamProcessor::new(options);

  let mut actual = processor.process_chunk("<p>alpha <span>beta</span>");
  actual.push_str(&processor.process_chunk(" <span>gamma</span>"));
  actual.push_str(&processor.process_chunk(" delta</p>"));
  actual.push_str(&processor.finish());

  assert_eq!(actual.trim(), expected.trim());
}

#[test]
fn streaming_retains_two_newlines_of_block_context() {
  let html = concat!(
    "<div><h5>Family Pteropodidae</h5><span>[<a href=\"/edit\">edit</a>]</span></div>",
    "<link rel=\"stylesheet\"><div role=\"note\" class=\"hatnote navigation-not-searchable\">",
    "Main article: <a href=\"/list\">List</a></div><p>Members</p>"
  );
  let expected = html_to_markdown(html, HTMLToMarkdownOptions::default());
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());

  let mut actual = processor.process_chunk(concat!(
    "<div><h5>Family Pteropodidae</h5><span>[<a href=\"/edit\">edit</a>]</span></div>",
    "<link rel=\"stylesheet\"><div role=\"note\" class=\"hatnote navig"
  ));
  actual.push_str(&processor.process_chunk(concat!(
    "ation-not-searchable\">Main article: <a href=\"/list\">List</a></div>",
    "<p>Members</p>"
  )));
  actual.push_str(&processor.finish());

  assert_eq!(actual.trim(), expected.trim());
}

#[test]
fn streaming_only_trims_whitespace_at_the_document_start() {
  let html = concat!(
    "<table><tr><td>Miller<br><br><small><div><div><div>One species</div></div>",
    "<ul><li><i>M. gigas</i> (<a href=\"/ghost\">Ghost bat</a>)</li></ul>",
    "</div></small>\n </td><td>Northern Australia</td></tr></table>"
  );
  let expected = html_to_markdown(html, HTMLToMarkdownOptions::default());
  let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());

  let mut actual = processor.process_chunk(concat!(
    "<table><tr><td>Miller<br><br><small><div><div><div>One species</div></div>",
    "<ul><li><i>M. gigas</i> (<a href=\"/ghost\">Ghost bat</a>)</li></ul>",
    "</div></small>\n </td>"
  ));
  actual.push_str(&processor.process_chunk("<td>Northern Australia</td></tr></table>"));
  actual.push_str(&processor.finish());

  assert_eq!(actual.trim(), expected.trim());
}

#[test]
fn streaming_memory_is_bounded_not_document_sized() {
  // Blockquote line-prefixing amplifies ~130x; without draining the emitted
  // Markdown would all pile up in the converter's buffer.
  let mut html = String::with_capacity(2 * 1024 * 1024 + 4096);
  for _ in 0..260 {
    html.push_str("<blockquote>");
  }
  while html.len() < 2 * 1024 * 1024 {
    html.push_str("<p>x</p>");
  }

  let mut p = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut total_out: u64 = 0;

  // Keep LIVE as the allocator's true process-wide total. Resetting it here
  // would make later deallocations for pre-existing allocations underflow.
  let baseline = LIVE.load(Ordering::Relaxed);
  PEAK.store(baseline, Ordering::Relaxed);
  for c in html.as_bytes().chunks(8 * 1024) {
    let out = p.process_chunk(std::str::from_utf8(c).unwrap());
    total_out += out.len() as u64; // wire would send + drop this
  }
  total_out += p.finish().len() as u64;
  let peak = PEAK.load(Ordering::Relaxed).saturating_sub(baseline) as u64;

  // Amplification really happened...
  assert!(
    total_out > 100 * 1024 * 1024,
    "expected >100MB output, got {total_out}"
  );
  // ...yet resident memory stayed a small window, not the whole document.
  assert!(
    peak < 32 * 1024 * 1024,
    "peak {peak} should be a bounded window, not ~{total_out} output"
  );
}
