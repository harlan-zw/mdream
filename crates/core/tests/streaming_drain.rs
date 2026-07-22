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

// Splits on char boundaries so multibyte input can be fed in small chunks.
fn stream_chars(html: &str, max_bytes: usize, opts: HTMLToMarkdownOptions) -> String {
  let mut p = MarkdownStreamProcessor::new(opts);
  let mut out = String::new();
  let mut start = 0;
  while start < html.len() {
    let mut end = (start + max_bytes.max(1)).min(html.len());
    while end < html.len() && !html.is_char_boundary(end) {
      end += 1;
    }
    out.push_str(&p.process_chunk(&html[start..end]));
    start = end;
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
  "<p>before <strong></strong><em>after</em></p>",
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
        assert_eq!(got, expected, "mismatch: chunk={chunk} html={html:?}");
      }
    }
  }
}

// Streaming must equal one-shot for these parse-layer cases (drain-transparent).
// Each asserts across chunk sizes so a boundary landing anywhere is covered.
fn assert_stream_matches(html: &str, opts: HTMLToMarkdownOptions) {
  let expected = html_to_markdown(html, opts.clone());
  for chunk in 1..=html.len().max(1) {
    assert_eq!(
      stream_chunks(html, chunk, opts.clone()),
      expected,
      "mismatch: chunk={chunk} html={html:?}"
    );
  }
}

// A chunk boundary inside an escape context (code/pre/table/link) returned the
// already-escaped text as the unparsed remainder, so it was re-escaped on the
// next chunk and backslashes multiplied (`\\`` → `\\\\``…).
#[test]
fn streaming_does_not_re_escape_carried_text() {
  for html in [
    "<pre><code>const x = `hi ${y}`;</code></pre>",
    "<p>use <code>a`b</code> here</p>",
    "<table><tr><td>a`b</td><td>c\\d</td></tr></table>",
    r#"<p>text with <a href="/x">a [bracket] link</a> end</p>"#,
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

// A code block ending a list item dropped the next item's list marker in
// streaming (`2.` became a plain continuation indent).
#[test]
fn streaming_keeps_list_marker_after_code_block() {
  for html in [
    "<ol><li>one<pre><code>cmd</code></pre></li><li>two</li></ol>",
    "<ul><li>one<pre><code>cmd</code></pre></li><li>two</li></ul>",
    "<ol><li>one<pre><code>a</code></pre></li><li>two</li><li>three</li></ol>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

#[test]
fn streaming_keeps_closing_fence_after_cleaned_empty_link_in_pre() {
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  assert_stream_matches(
    r#"<pre><code>b c<em></em><a href="/x"><svg></svg></a></code></pre>"#,
    opts,
  );
}

// A raw-passthrough element (<summary>) containing a foreign child (<svg>) lost
// the `<` of its closing tag in streaming (`</summary>` → ` /summary>`).
#[test]
fn streaming_keeps_raw_close_tag_after_foreign_child() {
  for html in [
    "<summary>text <svg></svg></summary>",
    "<details><summary>text <svg><polyline points=\"1 2\"></polyline></svg></summary><p>b</p></details>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

// Script data is dropped from output; a chunk boundary landing inside the
// script (or across its `</script>` close tag) must still leave the surrounding
// content identical to one-shot. Guards the script-data carry path, which now
// carries only the unconsumed tail instead of re-feeding consumed script bytes.
#[test]
fn streaming_drops_script_without_disturbing_neighbors() {
  for html in [
    "<p>before</p><script>var x = 1; if (a < b) { y(); }</script><p>after</p>",
    "<script>a()</script><script>b()</script><p>ok</p>",
    r#"<p>x</p><script>let s = "</scr" + "ipt>end";</script><p>y</p>"#,
    "<p>one</p><script>\n  line1\n  line2\n</script><p>two</p>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

// Regression: the streaming buffer was sliced/drained on raw byte offsets that
// could land mid-codepoint, panicking on non-ASCII input.
#[test]
fn multibyte_drain_matches_one_shot() {
  const UNIT: &str = r#"<div><a href="/a">link</a> <span>&ldquo;Create&rdquo;</span></div>"#;
  let doc = format!("<article>{}</article>", UNIT.repeat(40));
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };

  let expected = html_to_markdown(&doc, opts.clone());
  assert!(expected.contains('“') && !expected.is_empty());
  for max_bytes in [1usize, 2, 3, 5, 8, 64] {
    let got = stream_chars(&doc, max_bytes, opts.clone());
    assert_eq!(
      got,
      expected,
      "mismatch at max_bytes={max_bytes}"
    );
  }
}

// A rewrite-after-yield can leave a chunk/drain offset inside a multibyte
// codepoint; the streaming buffer must never be sliced there. A panic here
// fails the test.
#[test]
fn streaming_multibyte_never_panics() {
  const CASES: &[&str] = &[
    "<blockquote>”<br>\n</><p>🎉",
    "<a href=\"/x\">link</a>“<strong></strong>—漢字",
    "<ul><li>é<a href=\"/x\"></a>…</li></ul>🎉&mdash;",
  ];
  for &html in CASES {
    for max_bytes in [1usize, 2, 3, 4, 5, 7, 11] {
      let _ = stream_chars(html, max_bytes, HTMLToMarkdownOptions::default());
    }
  }
}

// An empty link or inline marker that closes in a later chunk is truncated
// away; the drain must keep the two bytes of block spacing before its
// reach-back point so the next block counts newlines correctly. Without it the
// close leaked a stray `[` and, once that was held back, an extra blank line.
#[test]
fn streaming_dropped_empty_element_keeps_block_spacing() {
  let cases = [
    r##"<h3>Set priority</h3><a class="anchor-link" href="#x"></a><p>The value.</p>"##,
    r#"<h2>Section</h2><a href="/x"><svg></svg></a><p>Body text.</p>"#,
    "<p>First para.</p><em></em><p>Second para.</p>",
    // A heading in a list item trailed by an empty anchor-link icon: the space
    // before the dropped `[` leaked, then the following block trimmed it.
    r##"<ul><li><h3>NetSparkle</h3><a class="anchor-link" href="#x"><span><svg></svg></span></a></li></ul><p>Copyright.</p>"##,
  ];
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  for html in cases {
    let expected = html_to_markdown(html, opts.clone());
    for chunk in 1..=32 {
      assert_eq!(
        stream_chunks(html, chunk, opts.clone()),
        expected,
        "mismatch: chunk={chunk} html={html:?}"
      );
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

  assert_eq!(actual, expected);
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

  assert_eq!(actual, expected);
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

  assert_eq!(actual, expected);
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

// A text node ending in `&nbsp;` (U+00A0) before a sibling inline was trimmed
// at the element boundary by `str::trim_end` (nbsp is Unicode whitespace). In
// streaming the nbsp was already yielded, so the truncation shifted the reach-
// back and dropped the next element's leading char (`2013, 09:53` →
// `2013,\u{a0}9:53`, losing the `0`). Trailing nbsp is now kept.
#[test]
fn streaming_keeps_trailing_nbsp_before_sibling() {
  let cases: &[&str] = &[
    r"<p>answered on <span>03 Apr 2013,&nbsp;</span><span>09:53 AM</span></p>",
    r"<p><span>a b,&nbsp;</span><span>0</span></p>",
  ];
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  for html in cases {
    let expected = html_to_markdown(html, opts.clone());
    assert!(expected.contains('\u{a0}'), "nbsp should be preserved: {expected:?}");
    for chunk in 1..=html.len().max(1) {
      let got = stream_chunks(html, chunk, opts.clone());
      assert_eq!(got, expected, "chunk={chunk} html={html:?}");
    }
  }
}

// A raw-HTML block (`<dl>`/`<dt>`/`<dd>`, `<details>`, `<address>`) closes with
// a literal tag glued onto its predecessor, trimming the block-spacing newline
// before it (`</dd>\n</dl>` → `</dd></dl>`). Once the buffer drains past that
// newline it was already yielded and can't be un-sent, so the trim shifted the
// close tag and dropped the `<` of `</dl>`. Needs enough preceding content to
// force a drain before the final close.
#[test]
fn streaming_keeps_raw_block_close_after_drain() {
  let mut html = String::from("<article>");
  for i in 0..400 {
    html.push_str(&format!("<p>Filler paragraph number {i} with some words.</p>"));
  }
  html.push_str(
    "<dl><dt>MPN:</dt><dd>D100-V36-PBO-1WZ</dd>\
     <dt>Availability:</dt><dd>Ships in 2-3 days</dd></dl></article>",
  );
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  let expected = html_to_markdown(&html, opts.clone());
  assert!(expected.contains("</dl>"));
  for chunk in [1usize, 7, 16, 31, 32, 33, 64, 128, 256, 512] {
    assert_eq!(
      stream_chunks(&html, chunk, opts.clone()),
      expected,
      "mismatch: chunk={chunk}"
    );
  }
}

// Enough preceding content to force the buffer to drain before the tail case.
fn drain_filler() -> String {
  let mut s = String::new();
  for i in 0..400 {
    s.push_str(&format!("<p>Filler paragraph number {i} with some words.</p>"));
  }
  s
}

// A block separator (`\n\n`) is written before an inline element that later
// turns out empty (an image with no alt / an empty link) and is dropped. When
// that element is the last content, one-shot holds the trailing newlines and
// finalize drops them; streaming had yielded the `\n\n` the moment the `[`
// appeared. The block-separator hold now also covers the newlines before an
// open link bracket, so the orphan `\n\n` is never emitted.
#[test]
fn streaming_drops_block_separator_before_empty_trailing_link() {
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  let html = format!(
    "{}<div>Alpha 12345</div>\
     <a href=\"https://e.com/x\"><img src=\"https://e.com/i.png\" alt=\"\"></a>",
    drain_filler()
  );
  let expected = html_to_markdown(&html, opts.clone());
  assert!(expected.trim_end().ends_with("Alpha 12345"), "one-shot has no trailing link: {expected:?}");
  for chunk in [4usize, 7, 16, 64] {
    assert_eq!(stream_chunks(&html, chunk, opts.clone()), expected, "chunk={chunk}");
  }
}

// Same as above but the dropped trailing element is an empty inline marker
// (`<em></em>`): the newlines before its open `_`/`*` marker must also be held.
#[test]
fn streaming_drops_block_separator_before_empty_trailing_marker() {
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  let html = format!("{}<div>Bolt 1 db</div><em></em>", drain_filler());
  let expected = html_to_markdown(&html, opts.clone());
  assert!(expected.trim_end().ends_with("Bolt 1 db"), "one-shot tail: {expected:?}");
  for chunk in [4usize, 7, 16, 64] {
    assert_eq!(stream_chunks(&html, chunk, opts.clone()), expected, "chunk={chunk}");
  }
}

// A trailing whitespace run inside `<pre>` is still mutable until the code
// element closes. Streaming must not emit bytes that one-shot trims before
// writing the closing fence.
#[test]
fn streaming_holds_mutable_trailing_pre_whitespace() {
  for html in [
    "<pre><code>alpha\n</code></pre>",
    "<pre><code>alpha\n\n</code></pre>",
    "<pre><code>alpha  </code></pre>",
  ] {
    let expected = html_to_markdown(html, HTMLToMarkdownOptions::default());
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, HTMLToMarkdownOptions::default()),
        expected,
        "chunk={chunk} html={html:?}"
      );
    }
  }
}

// Inside a list item a nested block renders on one line (NO_SPACING). A word,
// a <br>, then that block: once the word has been drained out of the buffer the
// inter-token space it anchored sat at the buffer start and was trimmed away,
// gluing the word to the block's text (`New Domain` -> `NewDomain`). Spacing
// now consults the last flushed byte so the separator survives the drain.
#[test]
fn streaming_keeps_inter_token_space_across_drain() {
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  for inner in [
    "<li><a href=\"/t\">Schedule</a> New<br> <div>Domain Services</div></li>",
    "<li><a href=\"/t\">Schedule</a> New<br>\n  <div>Domain Services</div></li>",
  ] {
    let html = format!("{}<ul>{inner}</ul>", drain_filler());
    let expected = html_to_markdown(&html, opts.clone());
    for chunk in 1..=40usize {
      assert_eq!(
        stream_chunks(&html, chunk, opts.clone()),
        expected,
        "chunk={chunk} inner={inner:?}"
      );
    }
  }
}

// A block boundary counts the newlines already in the buffer from its last two
// bytes. When an empty list item renders a lone `-` marker and the block spacing
// before it has been drained away, the `-` sits alone at the buffer start and
// the byte before it (a newline) is gone; the boundary then miscounted and
// emitted an extra blank line (`-\n\n[link]` instead of `-\n[link]`). Newline
// counting now consults the last flushed byte so the count survives the drain.
// The nested `div > form` and the ragged inline whitespace reproduce the exact
// buffer state; every small chunk size lands a boundary that triggers it.
#[test]
fn streaming_keeps_block_newline_count_across_drain() {
  let opts = HTMLToMarkdownOptions {
    clean: Some(safe_clean()),
    ..Default::default()
  };
  let html = "<div class=\"wrap\">\n\t\t\t\t        \
    <form action=\"https://ex.example/act?x=1&amp;id=42\" class=\"foo bar wrap\" \
    data-flag method=\"post\"><a aria-controls=\"dd\"\n       aria-expanded=\"false\"\n\
    \x20      class=\"btn menu-btn\"\n       data-dropdown=\"dd\"\n       href=\"#\"\n    >\n\
    \x20       <span>Alpha Beta Gamma</a>\n    <li>\n            </li>\n    </form>\
    <div class=\"badges\"><a href=\"/other-link/\" target=\"_blank\" class=\"bp\"> Delta</a></div></div>";
  let expected = html_to_markdown(html, opts.clone());
  assert!(expected.contains("-\n[Delta]"), "one-shot tightens the list/block gap: {expected:?}");
  for chunk in 1..=40usize {
    assert_eq!(
      stream_chunks(html, chunk, opts.clone()),
      expected,
      "chunk={chunk}"
    );
  }
}
