// Test-only peak-allocation tracker; the crate itself stays unsafe-free.
#![allow(unsafe_code)]

//! `max_node_bytes` drops content past a per-construct byte cap so adversarial
//! input cannot balloon the streamer. Two buffers grow with a single node: the
//! text buffered for one text node (~5x its size in peak heap), and the raw bytes
//! of a tag or comment the parser cannot consume yet (~3x).
//!
//! Three more grow with a whole element rather than one node: an open code fence
//! pins the output buffer until its delimiter is known (~0.9x the block), a row's
//! width forces a delimiter row of 7 bytes a column, and script text is retained
//! whole for an extraction that reads it (~4x).
//!
//! The cap must bound memory, stay inert by default, and — since it changes what
//! is emitted — cut at a point that depends only on content, never on chunking.

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use mdream::types::{ExtractionConfig, HTMLToMarkdownOptions, PluginConfig};
use mdream::{MarkdownStreamProcessor, TagOverrideConfig, html_to_markdown_result};

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

fn surfaced_cdata_options(cap: usize) -> HTMLToMarkdownOptions {
  HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "#cdata-section".to_string(),
        TagOverrideConfig::default(),
      )]),
      ..Default::default()
    }),
    ..options(cap)
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

fn stream_parts(parts: &[&str], cap: usize) -> (String, bool) {
  let mut p = MarkdownStreamProcessor::new(options(cap));
  let mut out = String::new();
  for part in parts {
    out.push_str(&p.process_chunk(part));
  }
  out.push_str(&p.finish());
  (out, p.truncated())
}

fn assert_capped_text(html: &str, cap: usize, expected: &str, truncated: bool) {
  let result = html_to_markdown_result(html, options(cap));
  assert_eq!(result.markdown, expected, "one-shot html={html:?}");
  assert_eq!(result.truncated, truncated, "one-shot html={html:?}");

  for split in (0..=html.len()).filter(|&split| html.is_char_boundary(split)) {
    let (actual, actual_truncated) = stream_parts(&[&html[..split], &html[split..]], cap);
    assert_eq!(actual, expected, "html={html:?} split={split}");
    assert_eq!(
      actual_truncated, truncated,
      "truncation html={html:?} split={split}"
    );
  }
}

fn extracting(cap: usize, selectors: &[&str]) -> HTMLToMarkdownOptions {
  HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      extraction: Some(ExtractionConfig::new(selectors)),
      ..Default::default()
    }),
    ..options(cap)
  }
}

/// Peak live bytes while streaming `html`.
fn peak(html: &str, chunk: usize, cap: usize) -> u64 {
  peak_with(html, chunk, options(cap))
}

fn peak_with(html: &str, chunk: usize, opts: HTMLToMarkdownOptions) -> u64 {
  ACCT.set(Acct {
    on: true,
    live: 0,
    peak: 0,
  });
  let mut p = MarkdownStreamProcessor::new(opts);
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
//
// Plain ASCII prose in a `<p>` is already a window without the cap: a batchable
// run is flushed in pieces once it passes `TEXT_RUN_FLUSH_THRESHOLD`. That flush
// only splits a run that is batchable end to end, so a word carrying a non-ASCII
// byte leaves the run unsplittable and the whole node buffered. The cap is what
// bounds the runs the flush cannot reach.
#[test]
fn one_huge_text_node_no_longer_costs_the_document() {
  for (name, html) in [
    ("p", format!("<p>{}</p>", repeat_to("wörd ", HUGE))),
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

#[test]
fn a_text_cap_rejects_a_whole_utf8_scalar() {
  for (html, expected) in [
    ("<p>aaaéz</p>", "aaa"),
    ("<p>aa€zz</p>", "aa"),
    ("<p>a😀zzz</p>", "a"),
  ] {
    assert_capped_text(html, 4, expected, true);
  }

  assert_capped_text(
    "<textarea>aaaaaaaaaaaaaaaéz</textarea>",
    16,
    "aaaaaaaaaaaaaaa",
    true,
  );
}

#[test]
fn an_exact_utf8_prefix_does_not_report_truncation() {
  for html in ["<p>aaé</p>", "<p>a€</p>", "<p>😀</p>"] {
    let expected = &html[3..html.len() - 4];
    assert_capped_text(html, 4, expected, false);
  }
}

#[test]
fn a_literal_lt_respects_the_text_cap() {
  for (html, expected) in [("<p>aaaa<3z</p>", "aaaa"), ("<p>aaa<3z</p>", "aaa<")] {
    assert_capped_text(html, 4, expected, true);
  }
  for html in [
    "<textarea>aaaaaaaaaaaaaaaa<z</textarea>",
    "<title>aaaaaaaaaaaaaaaa<z</title>",
  ] {
    assert_capped_text(html, 16, "aaaaaaaaaaaaaaaa", true);
  }
}

#[test]
fn a_rawtext_eof_residual_respects_the_text_cap() {
  for html in ["<textarea>aaaaaaaaaaaaaaa</x", "<title>aaaaaaaaaaaaaaa</x"] {
    assert_capped_text(html, 16, "aaaaaaaaaaaaaaa<", true);
  }
}

#[test]
fn text_exhaustion_ends_at_a_markup_boundary() {
  assert_capped_text("<p>aaaéz</p><p>ok</p>", 4, "aaa\n\nok", true);
  assert_capped_text("<p>aaaé<abcdefgh>ok</p>", 4, "aaa ok", true);
  assert_eq!(
    stream_parts(&["<p>aaa", "é<abc", "defgh", ">ok</p>"], 4),
    ("aaa ok".to_string(), true)
  );
}

#[test]
fn a_fragmented_non_matching_rawtext_close_does_not_end_exhaustion() {
  let html = "<textarea>aaaaaaaaaaaaaaaé</not-a-real-rawtext>ok</textarea>";
  assert_capped_text(html, 16, "aaaaaaaaaaaaaaa", true);
  assert_eq!(
    stream_parts(
      &[
        "<textarea>aaaaaaaaaaaaaaa",
        "é</not",
        "-a-real-rawtext",
        ">",
        "ok</textarea>",
      ],
      16,
    ),
    ("aaaaaaaaaaaaaaa".to_string(), true)
  );
}

#[test]
fn a_fragmented_rawtext_candidate_consumes_the_text_cap() {
  let html = "<textarea>aa</abcdefghijklmnop>z</textarea>";
  let expected = "aa</abcdefghijkl";
  assert_capped_text(html, 16, expected, true);
  assert_eq!(
    stream_parts(&["<textarea>aa</abcdefgh", "ijklmnop", ">z</textarea>"], 16,),
    (expected.to_string(), true)
  );
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

// Each kind of token is ended by its own scanner, and they disagree: a `>` inside
// a quoted end-tag attribute closes a doctype but not an end tag, `--!!>` closes
// nothing, and CDATA ends only at `]]>`. Dropping a token with the wrong scanner
// resumes the document inside it, so its bytes surface as text. Everything after
// each token is under the cap, so capped output must equal uncapped output.
#[test]
fn a_dropped_token_ends_where_an_uncapped_scan_ends_it() {
  let filler = repeat_to("a", 256);
  for (name, token) in [
    ("comment", format!("<!--{filler}--!!>inside the comment-->")),
    ("cdata", format!("<![CDATA[{filler}>inside the cdata]]>")),
    (
      "doctype",
      format!("<!DOCTYPE x=\"{filler}>after the doctype\">"),
    ),
    ("end tag", format!("</x {filler} \"a>inside the tag\">")),
  ] {
    let html = format!("<p>before</p>{token}<p>after</p>");
    assert_eq!(stream(&html, 32, 64), stream(&html, 32, 0), "case={name}");
  }
}

// A close tag dropped past the cap is an ignored token to an uncapped parse: no
// truncation flag, and no separator between the text nodes on either side.
#[test]
fn a_dropped_close_tag_is_an_ignored_token() {
  let html = format!("<p>ab{{}}</{}>cd</p>", "s".repeat(1100));
  assert_capped_text(&html, 1024, "ab{}cd", false);
}

// A matching end tag dropped past the cap still closes its element, exactly
// where the uncapped parse closes it.
#[test]
fn a_dropped_matching_close_tag_still_closes_its_element() {
  let html = format!("<p>ab</p {}>cd</p>", repeat_to("x", 200));
  assert_capped_text(&html, 64, "ab\n\ncd", false);
}

// Comments, CDATA and doctypes are ignored tokens to an uncapped parse: a
// dropped one changes no text state and reports no truncation, at any chunking.
#[test]
fn a_dropped_ignored_token_leaves_no_trace() {
  assert_capped_text(
    &format!("<p>ab<!--{}-->cd</p>", repeat_to("x", 200)),
    64,
    "ab cd",
    false,
  );
  assert_capped_text(
    &format!("<p>ab<![CDATA[{}]]>cd</p>", repeat_to("x", 200)),
    64,
    "ab cd",
    false,
  );
  assert_capped_text(
    &format!("<!DOCTYPE {}><p>ab</p>", repeat_to("x", 200)),
    64,
    "ab",
    false,
  );
}

#[test]
fn a_dropped_comment_keeps_its_abrupt_end_state() {
  assert_capped_text("<!-->z", 1, "z", false);
  assert_capped_text("<!--->z", 1, "z", false);
}

#[test]
fn an_over_cap_partial_declaration_at_eof_reports_truncation() {
  assert_capped_text("<!", 1, "", true);
}

#[test]
fn an_oversized_surfaced_cdata_is_dropped_at_every_chunk_boundary() {
  let html = format!("b<![CDATA[{}>inside]]>a", repeat_to("x", 200));

  for cap in [1, 8, 9, 64] {
    let expected = html_to_markdown_result(&html, options(cap));
    assert!(!expected.truncated, "ignored CDATA cap={cap}");

    let options = surfaced_cdata_options(cap);
    let one_shot = html_to_markdown_result(&html, options.clone());
    assert_eq!(one_shot.markdown, expected.markdown, "one-shot cap={cap}");
    assert!(one_shot.truncated, "one-shot cap={cap}");

    for split in 0..=html.len() {
      let mut processor = MarkdownStreamProcessor::new(options.clone());
      let mut actual = processor.process_chunk(&html[..split]);
      actual.push_str(&processor.process_chunk(&html[split..]));
      actual.push_str(&processor.finish());

      assert_eq!(actual, expected.markdown, "cap={cap} split={split}");
      assert!(processor.truncated(), "cap={cap} split={split}");
    }
  }
}

#[test]
fn surfaced_cdata_uses_its_exact_token_length_for_the_cap() {
  let html = "<![CDATA[x]]>";
  let stream_bytes = |options| {
    let mut processor = MarkdownStreamProcessor::new(options);
    let mut output = String::new();
    for byte in html.as_bytes().chunks(1) {
      output.push_str(&processor.process_chunk(std::str::from_utf8(byte).unwrap()));
    }
    output.push_str(&processor.finish());
    (output, processor.truncated())
  };

  for cap in [html.len() - 1, html.len()] {
    assert_eq!(
      stream_bytes(options(cap)),
      (String::new(), false),
      "ignored CDATA cap={cap}"
    );
  }

  assert_eq!(
    html_to_markdown_result(html, surfaced_cdata_options(html.len())).markdown,
    "x"
  );
  let dropped = html_to_markdown_result(html, surfaced_cdata_options(html.len() - 1));
  assert_eq!(dropped.markdown, "");
  assert!(dropped.truncated);
  assert_eq!(
    stream_bytes(surfaced_cdata_options(html.len())),
    ("x".to_string(), false)
  );
  assert_eq!(
    stream_bytes(surfaced_cdata_options(html.len() - 1)),
    (String::new(), true)
  );
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

// Above `TEXT_RUN_FLUSH_THRESHOLD` the two bounds compose: a run the flush can
// split never reaches the cap, and one it cannot is cut by the cap. Both are
// decided by buffered content, so neither cut may move with the chunk size.
#[test]
fn the_cut_point_does_not_depend_on_chunking_above_the_flush_threshold() {
  // `*` is a GFM hazard, so this run is never batchable and the flush leaves it
  // to the cap.
  let unsplittable = format!("<p>{}</p><p>after</p>", repeat_to("wo*d ", 512 * 1024));
  for cap in [96 * 1024usize, 128 * 1024] {
    let expected = stream(&unsplittable, 4096, cap);
    for chunk in [37, 512, 8192, 1024 * 1024] {
      assert_eq!(
        stream(&unsplittable, chunk, cap),
        expected,
        "cap={cap} chunk={chunk}"
      );
    }
  }
  // Plain prose is split by the flush long before the cap, so a cap this high
  // never fires and the output is the uncapped one.
  let splittable = format!("<p>{}</p><p>after</p>", repeat_to("word ", 512 * 1024));
  assert_eq!(
    stream(&splittable, 8192, 128 * 1024),
    stream(&splittable, 8192, 0)
  );
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
  // Clamping to the cap cuts inside the last node, as the plain-text path does, so
  // the content is a prefix of the original rather than whole nodes only.
  let content = rest[..close].join("\n");
  assert!(
    repeat_to("let x = 1;\n", 64 * 1024).starts_with(&content),
    "content must be a prefix of the input, not mangled: {content:.80}"
  );
  assert!(
    content.len() <= 64,
    "content {} should fit the 64 byte cap",
    content.len()
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
    (
      "emitted attribute",
      format!("<a href=\"https://e.com/{filler}\">link</a>"),
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

    assert!(
      html_to_markdown_result(&html, options(CAP)).truncated,
      "{name}: one-shot truncation went unreported"
    );
  }
}

// `true` is deliberately conservative, and this is why a byte count would lie: a
// `class` or a comment is never emitted, so dropping it costs no output at all.
// An `href` is emitted, so the signal cannot promise either way.
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

// Script data is buffered only for an active extraction, and that buffer used to
// ignore the cap: 2 MB of script cost 8 MB of peak heap with a 64 KB cap set.
#[test]
fn an_extracted_script_is_capped_like_any_text() {
  let html = format!(
    "<p>before</p><script>{}</script><p>after</p>",
    repeat_to("var filler = 1; function f() { return 2; } ", HUGE)
  );
  let uncapped = peak_with(&html, 8 * 1024, extracting(0, &["script"]));
  let capped = peak_with(&html, 8 * 1024, extracting(CAP, &["script"]));
  assert!(
    uncapped > (HUGE / 2) as u64,
    "fixture should retain the script uncapped, got {uncapped}"
  );
  assert!(
    capped < (HUGE / 4) as u64,
    "capped peak {capped} should be a window, not the {} byte script",
    html.len()
  );
}

// A node arriving while the fence sits just under the cap used to be appended
// whole, taking the block to twice the cap.
#[test]
fn a_code_fence_holds_at_most_the_cap() {
  for first in [CAP - 1, CAP / 2, CAP] {
    let html = format!(
      "<pre><code><span>{}</span><span>{}</span></code></pre>",
      repeat_to("a", first),
      repeat_to("b", CAP)
    );
    let out = stream(&html, 8 * 1024, CAP);
    let content = out
      .lines()
      .skip(1)
      .take_while(|line| *line != "```")
      .collect::<Vec<_>>()
      .join("\n");
    assert!(
      content.len() <= CAP,
      "first_node={first}: fence content {} should fit the {CAP} byte cap",
      content.len()
    );
  }
}

// `colspan` used to be added whole after the count check, and a nonzero `align`
// pushed a column unconditionally, so a wide row escaped the cap either way.
#[test]
fn a_wide_row_stays_within_the_column_cap() {
  const SMALL: usize = 700;
  let col_cap = SMALL / 7;
  for (name, cell) in [
    ("plain", "<td>x</td>"),
    ("colspan", "<td colspan=\"255\">x</td>"),
    ("aligned header", "<th align=\"left\">x</th>"),
  ] {
    let html = format!("<table><tr>{}</tr></table>", repeat_to(cell, 64 * 1024));
    let out = stream(&html, 8 * 1024, SMALL);
    let columns = out
      .lines()
      .find(|line| line.contains("---"))
      .unwrap_or_default()
      .matches("---")
      .count();
    assert!(
      columns <= col_cap,
      "{name}: {columns} delimiter columns exceed the {col_cap} the cap allows"
    );
    assert!(
      out.len() < 4 * SMALL,
      "{name}: output {} should stay near the {SMALL} byte cap",
      out.len()
    );
  }
}

// The cap drops a tag on its own length, not on whether a chunk boundary split
// it, so an emitted attribute cannot survive whole in one chunk yet vanish in two.
#[test]
fn an_over_cap_tag_is_dropped_however_it_is_chunked() {
  let filler = repeat_to("a", 256 * 1024);
  for (name, html) in [
    (
      "emitted href",
      format!("<a href=\"https://e.com/{filler}\">link</a><p>after</p>"),
    ),
    (
      "unemitted class",
      format!("<p class=\"{filler}\">seen</p><p>after</p>"),
    ),
  ] {
    let expected = stream(&html, 1024, CAP);
    assert!(
      !expected.contains("aaaa"),
      "{name}: the over-cap attribute should be gone: {expected:.60}"
    );
    for chunk in [7, 4096, 64 * 1024, html.len()] {
      assert_eq!(stream(&html, chunk, CAP), expected, "{name}: chunk={chunk}");
    }
    assert_eq!(
      html_to_markdown_result(&html, options(CAP)).markdown,
      expected,
      "{name}: one-shot must agree with streaming"
    );
  }
}

// A nonzero `align` pushed a column per header unconditionally, so the alignment
// vector grew with the row however tight the cap. The delimiter row it feeds is
// bounded by the output tests; this bounds the vector behind it.
#[test]
fn a_row_of_aligned_headers_does_not_grow_the_alignment_vector() {
  let html = format!(
    "<table><tr>{}</tr></table>",
    repeat_to("<th align=\"left\">x</th>", HUGE)
  );
  let capped = peak(&html, 8 * 1024, 64);
  let uncapped = peak(&html, 8 * 1024, 0);
  assert!(
    uncapped > (HUGE / 8) as u64,
    "fixture should grow the vector uncapped, got {uncapped}"
  );
  assert!(
    capped < 64 * 1024,
    "capped peak {capped} should not scale with the {} byte row",
    html.len()
  );
}

// Alignment is recorded when a header opens but the span is clamped when it
// closes, so a cell the cap drops could still align whichever retained column
// its entry landed on.
#[test]
fn a_dropped_header_does_not_align_a_retained_column() {
  // 63/7 leaves 9 columns, which the first cell's colspan fills on its own.
  let html = "<table><tr><th colspan=\"9\">A</th><th align=\"right\">B</th></tr>\
              <tr><td>x</td></tr></table>";
  let delimiter = |out: &str| {
    out
      .lines()
      .find(|line| line.contains("---"))
      .unwrap_or_default()
      .to_owned()
  };

  let capped = delimiter(&stream(html, 4096, 63));
  assert_eq!(
    capped.matches("---").count(),
    9,
    "the row should keep the columns the cap allows: {capped}"
  );
  assert!(
    !capped.contains(':'),
    "the dropped header must not align a column it does not own: {capped}"
  );
  // Uncapped the cell is kept, so its alignment belongs to a column of its own.
  let uncapped = delimiter(&stream(html, 4096, 0));
  assert_eq!(uncapped.matches("---").count(), 10, "{uncapped}");
  assert_eq!(uncapped.matches("---:").count(), 1, "{uncapped}");
}
