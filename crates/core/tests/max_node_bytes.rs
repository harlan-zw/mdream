// Test-only peak-allocation tracker; the crate itself stays unsafe-free.
#![allow(unsafe_code)]

//! `max_node_bytes` drops content past a per-node byte cap so adversarial input
//! cannot balloon the streamer. Two buffers grow with a single node: the text
//! buffered for one text node (~5x its size in peak heap), and the raw bytes of
//! an unterminated tag or comment the parser cannot consume yet (~3x).
//!
//! Two more grow with a whole element rather than one node: an open code fence
//! pins the output buffer until its delimiter is known (~0.9x the block), and a
//! row's width forces a delimiter row of 7 bytes a column.
//!
//! The cap must bound memory, stay inert by default, and — since it changes what
//! is emitted — cut at a point that depends only on content, never on chunking.

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use mdream::types::HTMLToMarkdownOptions;
use mdream::{MarkdownStreamProcessor, html_to_markdown_result};

// Peak-allocation tracker, per-thread so parallel tests do not pollute each other.

struct Tracking;

#[derive(Clone, Copy)]
struct Acct {
  on: bool,
  live: isize,
  peak: isize,
}

thread_local! {
  static ACCT: Cell<Acct> = const {
    Cell::new(Acct { on: false, live: 0, peak: 0 })
  };
}

fn account(delta: isize) {
  let _ = ACCT.try_with(|cell| {
    let mut acct = cell.get();
    if !acct.on {
      return;
    }
    acct.live += delta;
    if acct.live > acct.peak {
      acct.peak = acct.live;
    }
    cell.set(acct);
  });
}

unsafe impl GlobalAlloc for Tracking {
  unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
    let p = unsafe { System.alloc(layout) };
    if !p.is_null() {
      account(layout.size() as isize);
    }
    p
  }
  unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
    account(-(layout.size() as isize));
    unsafe { System.dealloc(ptr, layout) };
  }
}

#[global_allocator]
static ALLOC: Tracking = Tracking;

fn options(cap: usize) -> HTMLToMarkdownOptions {
  let opts = HTMLToMarkdownOptions::default();
  if cap == 0 {
    opts
  } else {
    opts.with_max_node_bytes(cap)
  }
}

fn stream(html: &str, chunk: usize, cap: usize) -> String {
  let mut p = MarkdownStreamProcessor::new(options(cap));
  let mut out = String::new();
  for c in html.as_bytes().chunks(chunk) {
    out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
  }
  out.push_str(&p.finish());
  out
}

/// Peak live bytes while streaming `html`.
fn peak(html: &str, chunk: usize, cap: usize) -> u64 {
  ACCT.set(Acct {
    on: true,
    live: 0,
    peak: 0,
  });
  let mut p = MarkdownStreamProcessor::new(options(cap));
  let mut sink = 0usize;
  for c in html.as_bytes().chunks(chunk) {
    sink += p.process_chunk(std::str::from_utf8(c).unwrap()).len();
  }
  sink += p.finish().len();
  let mut acct = ACCT.get();
  acct.on = false;
  ACCT.set(acct);
  // A dropped token can legitimately leave no output; keep the work regardless.
  std::hint::black_box(sink);
  acct.peak.max(0) as u64
}

fn repeat_to(unit: &str, target: usize) -> String {
  let mut s = String::with_capacity(target + unit.len());
  while s.len() < target {
    s.push_str(unit);
  }
  s
}

const HUGE: usize = 2 * 1024 * 1024;
const CAP: usize = 64 * 1024;

// The point of the option. Uncapped these cost ~10MB of peak heap for a 2MB
// document; the cap has to make that a window instead.
#[test]
fn one_huge_text_node_no_longer_costs_the_document() {
  for (name, html) in [
    ("p", format!("<p>{}</p>", repeat_to("word ", HUGE))),
    (
      "pre",
      format!("<pre><code>{}</code></pre>", repeat_to("x = 1;\n", HUGE)),
    ),
  ] {
    let capped = peak(&html, 8 * 1024, CAP);
    let uncapped = peak(&html, 8 * 1024, 0);
    assert!(
      uncapped > (HUGE * 2) as u64,
      "{name}: fixture should be pathological uncapped, got {uncapped}"
    );
    // Measures ~300KB. Loose so it tracks the ceiling, not allocator bookkeeping.
    assert!(
      capped < (HUGE / 4) as u64,
      "{name}: capped peak {capped} should be a window, not the {HUGE} byte node"
    );
  }
}

// The cap changes output, so where it cuts must not depend on chunk boundaries.
// Clamping at the append rather than after it is what makes this hold.
#[test]
fn the_cut_point_does_not_depend_on_chunking() {
  let html = format!("<p>{}</p><p>after</p>", repeat_to("word ", 64 * 1024));
  let expected = stream(&html, 4096, 4096);
  for chunk in [37, 512, 8192, 1024 * 1024] {
    assert_eq!(stream(&html, chunk, 4096), expected, "chunk={chunk}");
  }
}

// Truncation drops content, never structure: the node still closes and later
// siblings survive intact.
#[test]
fn truncation_keeps_the_document_structure() {
  let html = format!("<p>{}</p><p>after</p>", repeat_to("word ", 4096));
  let out = stream(&html, 512, 64);
  let (first, rest) = out.split_once("\n\n").expect("paragraph break");
  assert!(
    first.len() <= 64,
    "text should stop at the cap, got {} bytes",
    first.len()
  );
  assert!(first.starts_with("word word"), "kept text: {first:.40}");
  assert_eq!(rest, "after", "the following sibling must be untouched");
}

// A node under the cap is emitted whole, so the cap is a ceiling and not a rewrite.
#[test]
fn content_below_the_cap_is_untouched() {
  let html = "<h1>T</h1><p>a <em>b</em> c</p><ul><li>x</li></ul><pre><code>k\n</code></pre>";
  for chunk in [7, 64, 4096] {
    assert_eq!(
      stream(html, chunk, 1024 * 1024),
      stream(html, chunk, 0),
      "chunk={chunk}"
    );
  }
}

// Nothing may change for callers who never set the option.
#[test]
fn the_default_is_inert() {
  let docs = [
    "<h1>Title</h1><p>Para one.</p><p>Para <strong>two</strong>.</p>",
    "<ul><li>a</li><li>b<ul><li>b1</li><li>b2</li></ul></li></ul>",
    "<table><tr><th>A</th></tr><tr><td>1</td></tr></table>",
    "<blockquote><p>q</p></blockquote><p>after</p>",
    "<pre><code>let x = 1;\nlet y = 2;</code></pre>",
  ];
  for doc in docs {
    let expected = stream(doc, 1024 * 1024, 0);
    for chunk in [3, 17, 256] {
      assert_eq!(
        stream(doc, chunk, 0),
        expected,
        "doc={doc:.30} chunk={chunk}"
      );
    }
  }
}

// An unterminated tag or comment is carried raw between chunks, so it grows with
// the token. Past the cap it must be dropped instead of carried.
#[test]
fn an_unterminated_token_is_dropped_rather_than_carried() {
  for (name, html) in [
    (
      "attribute",
      format!("<p class=\"{}\">x</p>", repeat_to("a", HUGE)),
    ),
    ("comment", format!("<!--{}", repeat_to("a", HUGE))),
    ("tag", format!("<p {}", repeat_to("a", HUGE))),
  ] {
    let uncapped = peak(&html, 8 * 1024, 0);
    let capped = peak(&html, 8 * 1024, CAP);
    assert!(
      uncapped > HUGE as u64,
      "{name}: fixture should be pathological uncapped, got {uncapped}"
    );
    assert!(
      capped < (HUGE / 4) as u64,
      "{name}: capped peak {capped} should be a window, not the {HUGE} byte token"
    );
  }
}

// Only the token is dropped. The scan that finds its end stays quote-aware, so it
// resumes at the real `>` and the element's content and siblings still convert.
#[test]
fn dropping_a_token_keeps_the_surrounding_document() {
  let filler = repeat_to("a", 256 * 1024);
  for (name, html, expected) in [
    (
      "over-long attribute",
      format!("<p class=\"{filler}\">seen</p><p>after</p>"),
      "seen\n\nafter",
    ),
    (
      "over-long comment",
      format!("<!--{filler}--><p>after</p>"),
      "after",
    ),
    (
      "junk in a closing tag",
      format!("</p {filler}><p>after</p>"),
      "after",
    ),
  ] {
    assert_eq!(stream(&html, 8 * 1024, CAP), expected, "case={name}");
  }
}

// As with text, dropping must cut at a content-determined point.
#[test]
fn the_discard_does_not_depend_on_chunking() {
  let html = format!(
    "<p class=\"{}\">seen</p><p>after</p>",
    repeat_to("a", 256 * 1024)
  );
  let expected = stream(&html, 4096, 4096);
  for chunk in [61, 1024, 8192, 1024 * 1024] {
    assert_eq!(stream(&html, chunk, 4096), expected, "chunk={chunk}");
  }
}

// A code fence cannot be closed until the longest backtick run inside it is known,
// so the block pins the buffer however small its text nodes are. The cap is
// measured against the block, not the node.
#[test]
fn an_open_code_fence_stops_pinning_the_whole_block() {
  let html = format!(
    "<pre><code>{}</code></pre>",
    repeat_to("<span>x = 1;</span>\n", HUGE)
  );
  let uncapped = peak(&html, 8 * 1024, 0);
  let capped = peak(&html, 8 * 1024, CAP);
  assert!(
    uncapped > (HUGE / 2) as u64,
    "fixture should pin the block uncapped, got {uncapped}"
  );
  assert!(
    capped < (HUGE / 4) as u64,
    "capped peak {capped} should be a window, not the block"
  );
}

// Truncating a code block must still leave a well-formed fence around it.
#[test]
fn a_truncated_code_block_is_still_a_valid_fence() {
  let html = format!(
    "<pre><code class=\"language-rust\">{}</code></pre><p>after</p>",
    repeat_to("<span>let x = 1;</span>\n", 64 * 1024)
  );
  let out = stream(&html, 512, 64);
  let mut lines = out.lines();
  assert_eq!(
    lines.next(),
    Some("```rust"),
    "opener with language: {out:.60}"
  );
  let rest: Vec<&str> = lines.collect();
  let close = rest
    .iter()
    .position(|line| *line == "```")
    .expect("closing fence");
  assert!(close > 0, "block should keep some content: {out:.80}");
  assert!(
    rest[..close].iter().all(|line| *line == "let x = 1;"),
    "content must be intact, not mangled: {out:.80}"
  );
  assert_eq!(
    rest[close + 1..].join("\n").trim(),
    "after",
    "the following sibling must survive"
  );
}

// One row of many cells forces a delimiter row of 7 bytes a column, so a 200k-cell
// row costs megabytes before any of it can be written.
#[test]
fn a_single_enormous_table_row_is_bounded() {
  let html = format!("<table><tr>{}</tr></table>", repeat_to("<td>x</td>", HUGE));
  let uncapped = peak(&html, 8 * 1024, 0);
  let capped = peak(&html, 8 * 1024, CAP);
  assert!(
    uncapped > (HUGE) as u64,
    "fixture should be pathological uncapped, got {uncapped}"
  );
  assert!(
    capped < (HUGE / 4) as u64,
    "capped peak {capped} should be a window, not the row"
  );
}

// Dropping cells must keep the table rectangular: a row wider than its delimiter
// row is not a table at all. Cells past the cap are ones GFM would discard anyway.
#[test]
fn a_capped_table_stays_rectangular() {
  let html = format!(
    "<table><tr>{}</tr><tr>{}</tr></table>",
    repeat_to("<td>h</td>", 400),
    repeat_to("<td>v</td>", 400)
  );
  let out = stream(&html, 256, 70);
  let lines: Vec<&str> = out.lines().filter(|l| !l.is_empty()).collect();
  assert!(lines.len() >= 3, "expected a table, got {out:.120}");
  let width = lines[0].matches('|').count();
  assert!(width > 2, "row should keep some cells: {:?}", lines[0]);
  for (index, line) in lines.iter().take(3).enumerate() {
    assert_eq!(
      line.matches('|').count(),
      width,
      "line {index} has a different width: {line:?}"
    );
  }
  assert!(
    lines[1].contains("---"),
    "second line should be the delimiter row: {:?}",
    lines[1]
  );
}

// Tables narrower than the cap must be byte-identical.
#[test]
fn ordinary_tables_are_untouched() {
  let html = "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>";
  assert_eq!(stream(html, 64, CAP), stream(html, 64, 0));
  let many_rows = format!(
    "<table>{}</table>",
    repeat_to("<tr><td>a</td><td>b</td></tr>", 64 * 1024)
  );
  assert_eq!(stream(&many_rows, 4096, CAP), stream(&many_rows, 4096, 0));
}

/// Streamed output plus whether the cap fired producing it.
fn stream_reporting(html: &str, chunk: usize, cap: usize) -> (String, bool) {
  let mut p = MarkdownStreamProcessor::new(options(cap));
  let mut out = String::new();
  for c in html.as_bytes().chunks(chunk) {
    out.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
  }
  out.push_str(&p.finish());
  (out, p.truncated())
}

/// The five shapes the cap is there to bound, each far larger than `CAP`.
fn truncating_fixtures() -> Vec<(&'static str, String)> {
  let filler = repeat_to("a", 256 * 1024);
  vec![
    (
      "text node",
      format!("<p>{}</p>", repeat_to("word ", 256 * 1024)),
    ),
    ("attribute", format!("<p class=\"{filler}\">x</p>")),
    ("comment", format!("<!--{filler}")),
    (
      "code block",
      format!(
        "<pre><code>{}</code></pre>",
        repeat_to("<span>x = 1;</span>\n", 256 * 1024)
      ),
    ),
    (
      "table row",
      format!(
        "<table><tr>{}</tr></table>",
        repeat_to("<td>x</td>", 256 * 1024)
      ),
    ),
  ]
}

// `false` has to be a guarantee, or callers cannot trust the output.
#[test]
fn complete_output_reports_no_truncation() {
  let docs = [
    "<h1>T</h1><p>a <em>b</em> c</p><ul><li>x</li></ul>",
    "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>",
    "<pre><code>let x = 1;\nlet y = 2;</code></pre>",
    "<!-- a comment --><p>after</p>",
  ];
  for doc in docs {
    for cap in [0, CAP] {
      let (_, truncated) = stream_reporting(doc, 64, cap);
      assert!(!truncated, "doc={doc:.40} cap={cap}");
    }
    assert!(
      !html_to_markdown_result(doc, options(CAP)).truncated,
      "one-shot doc={doc:.40}"
    );
  }
}

// Every kind of drop has to be visible, not just the two that shorten the output.
#[test]
fn every_kind_of_truncation_is_reported() {
  for (name, html) in truncating_fixtures() {
    let (_, truncated) = stream_reporting(&html, 8 * 1024, CAP);
    assert!(truncated, "{name}: truncation went unreported");
    let (_, uncapped) = stream_reporting(&html, 8 * 1024, 0);
    assert!(
      !uncapped,
      "{name}: reported truncation with the cap disabled"
    );

    // One-shot sees the whole document at once, so a terminated tag never has to be
    // discarded however long its attributes are; the other four still truncate.
    let one_shot = html_to_markdown_result(&html, options(CAP)).truncated;
    assert_eq!(
      one_shot,
      name != "attribute",
      "{name}: one-shot reported {one_shot}"
    );
  }
}

// `true` is deliberately conservative, and this is why a byte count would lie:
// skipping a comment or an attribute costs the output nothing.
#[test]
fn truncation_is_reported_even_when_no_output_is_lost() {
  for (name, html) in truncating_fixtures() {
    let (capped, truncated) = stream_reporting(&html, 8 * 1024, CAP);
    let (uncapped, _) = stream_reporting(&html, 8 * 1024, 0);
    assert!(truncated, "{name}");
    if name == "attribute" || name == "comment" {
      assert_eq!(capped, uncapped, "{name}: output should be unaffected");
    } else {
      assert!(
        capped.len() < uncapped.len(),
        "{name}: output should be shorter"
      );
    }
  }
}
