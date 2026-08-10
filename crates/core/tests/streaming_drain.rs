// Test-only peak-allocation tracker; the crate itself stays unsafe-free.
#![allow(unsafe_code)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use mdream::MarkdownStreamProcessor;
use mdream::types::{
  CleanConfig, HTMLToMarkdownOptions, OutputFormat, PluginConfig, TagOverrideConfig,
};
use mdream::{html_to_format_result, html_to_markdown};

// ── Peak-allocation tracking allocator ──
// Streaming must free already-yielded output; a criterion/time bench can't show
// that, so we track live bytes and assert the peak stays bounded.

struct Tracking;

/// Accounting is per-thread. Process-wide counters measure whatever else the
/// harness is doing: tests run in parallel, and one building a multi-megabyte
/// fixture lands in another's peak, so the bound has to be either loose enough
/// to be meaningless or flaky. A thread only sees its own allocations, so two
/// measurements can run at once.
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

/// `try_with` because TLS is already gone late in thread teardown, and a `Cell`
/// with a const initialiser never allocates, so this cannot recurse back into
/// the allocator.
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

/// Peak live bytes while `feed` runs, and the total output it produced. The
/// output is dropped as it arrives, the way a wire consumer would.
fn measure_peak(html: &str, chunk: usize, opts: HTMLToMarkdownOptions) -> (u64, u64) {
  ACCT.set(Acct {
    on: true,
    live: 0,
    peak: 0,
  });
  let mut p = MarkdownStreamProcessor::new(opts);
  let mut total_out: u64 = 0;
  for c in html.as_bytes().chunks(chunk) {
    total_out += p.process_chunk(std::str::from_utf8(c).unwrap()).len() as u64;
  }
  total_out += p.finish().len() as u64;
  let mut acct = ACCT.get();
  acct.on = false;
  ACCT.set(acct);
  // Freeing something allocated before the measurement can drive `live`
  // negative; the peak is what matters and it can only be >= 0.
  (acct.peak.max(0) as u64, total_out)
}

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
  r#"<p>See <a href="https://example.com" title="Example site">Example</a> then more.</p>"#,
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

fn assert_stream_matches_every_split(html: &str, opts: HTMLToMarkdownOptions) {
  let expected = html_to_markdown(html, opts.clone());
  for split in (0..=html.len()).filter(|&split| html.is_char_boundary(split)) {
    let mut stream = MarkdownStreamProcessor::new(opts.clone());
    let mut actual = stream.process_chunk(&html[..split]);
    actual.push_str(&stream.process_chunk(&html[split..]));
    actual.push_str(&stream.finish());
    assert_eq!(actual, expected, "split={split} html={html:?}");
  }
}

#[test]
fn streaming_every_split_supports_multibyte_html() {
  assert_stream_matches_every_split("<p>café 😀</p>", HTMLToMarkdownOptions::default());
}

// CDATA is dropped unless opted into, so the fixture cases never reach it. Both
// of its carry paths (a boundary inside the `<![CDATA[` opener, and an
// unterminated section) hold text in the buffer while carrying only the token,
// so a leading text run is the case that would duplicate if they disagreed.
fn cdata_emitted() -> HTMLToMarkdownOptions {
  HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "#cdata-section".to_string(),
        TagOverrideConfig {
          enter: Some("[".to_string()),
          exit: Some("]".to_string()),
          spacing: Some([0, 0]),
          is_inline: Some(true),
          ..Default::default()
        },
      )]),
      ..Default::default()
    }),
    ..Default::default()
  }
}

#[test]
fn streaming_cdata_matches_one_shot_at_every_boundary() {
  for html in [
    "<p>a<![CDATA[x]]>b</p>",
    "<p>before text <![CDATA[payload here]]> after text</p>",
    "<p>lead<![CDATA[one]]>mid<![CDATA[two]]>tail</p>",
    "<p>text</p><![CDATA[between blocks]]><p>more</p>",
  ] {
    // Chunk sizes from 1 up feed the opener a byte at a time, so the partial
    // `<![CDATA[` path is hit repeatedly; every_split covers each single cut.
    assert_stream_matches(html, cdata_emitted());
    assert_stream_matches_every_split(html, cdata_emitted());
  }
}

#[test]
fn streaming_gfm_hard_break_matches_every_split() {
  for html in [
    "<p>first<br>second</p>",
    r"<p>before\<br>after<br><br>last</p>",
    "<ul><li>first<br>second</li></ul>",
    "<blockquote><p>first<br>second</p></blockquote>",
    "<table><tr><td>first<br>second</td></tr></table>",
    "<h1>first<br>second</h1>",
    "<address>first<br>second</address>",
    "<code>first<br>second</code>",
  ] {
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

#[test]
fn streaming_blockquote_structure_matches_every_split() {
  for html in [
    "<blockquote><p>intro</p><ul><li>one</li><li>two</li></ul></blockquote>",
    "<blockquote>lead<table><tr><td>a</td></tr></table>tail</blockquote>",
    "<blockquote><ul><li>one<ul><li>sub</li></ul></li></ul></blockquote>",
    "<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>",
  ] {
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// The nested-separator collapse stranded `content_start` past the buffer end, which
// panicked when streaming picked a yield boundary. Needs leading text so a drain
// rebases first, and no text between the opens so the outer frame is still empty.
#[test]
fn streaming_nested_blockquote_separator_collapse_matches_one_shot() {
  for html in [
    "a<blockquote><blockquote>",
    "a<blockquote><blockquote>x",
    "a<blockquote><blockquote></blockquote></blockquote>",
    "a<blockquote><blockquote>b</blockquote></blockquote>",
    // Any block open as the inner element.
    "a<blockquote><div><blockquote>",
    "a<blockquote><blockquote><blockquote><blockquote>d",
    // Strands two frames at once, so rebasing only the innermost still panics.
    "<pre><blockquote><br><blockquote><blockquote>",
    // A list indent makes `content_start` non-zero within the line.
    "<ul><li>a<blockquote><blockquote>x</blockquote></blockquote></li></ul>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches(
      html,
      HTMLToMarkdownOptions {
        clean: Some(safe_clean()),
        ..Default::default()
      },
    );
  }
}

#[test]
fn streaming_large_nested_blockquote_drains_without_changing_output() {
  let mut html = String::from("<blockquote><blockquote><blockquote>");
  while html.len() < 24 * 1024 {
    html.push_str("<p>quoted paragraph</p>");
  }
  html.push_str("</blockquote></blockquote></blockquote>");

  let expected = html_to_markdown(&html, HTMLToMarkdownOptions::default());
  for chunk in [97usize, 1024, 8192] {
    assert_eq!(
      stream_chunks(&html, chunk, HTMLToMarkdownOptions::default()),
      expected,
      "chunk={chunk}"
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

#[test]
fn streaming_gfm_text_escaping_matches_every_split() {
  for html in [
    r"<p>&#35; heading [label](url) and *bar* ~~baz~~ `qux` &amp;copy;</p><p>> quote</p><p>1. item</p><p>---</p>",
    r#"<ol start="10"><li>> quote</li><li>after</li></ol>"#,
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

#[test]
fn streaming_cmark_block_structure_matches_every_split() {
  for html in [
    "<ul><li>text <hr>after</li></ul>",
    "<ul><li><blockquote>text<hr></blockquote>after</li></ul>",
    "<ol><li><span>parent<ul><li>child</li><li>child 2</li></ul></span></li></ol>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

#[test]
fn streaming_gfm_link_and_image_serialization_matches_every_split() {
  for html in [
    r#"<a href="">text</a>"#,
    r#"<a href="docs/a b">text</a>"#,
    r#"<a href="docs/(a)\file">text</a>"#,
    r#"<a href="/x" title="say &quot;hi&quot; \ path">text</a>"#,
    r#"<img src="/x.png" alt="a ] \ *bold* _em_ &#96;code&#96;">"#,
    r#"<img src="/x.png" alt="alt" title="say &quot;hi&quot; \ path">"#,
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
  }
}

#[test]
fn streaming_code_delimiter_widening_matches_every_split() {
  for html in [
    "<p>before <code>a `b` c</code> after</p>",
    "<pre><code>before\n```line-leading\n````\nafter</code></pre>",
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
    assert_eq!(got, expected, "mismatch at max_bytes={max_bytes}");
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
    // Inline element still open at yield: the hold-back offsets are read
    // before the yield bounds are floored, so a drifted one sliced mid-char.
    "><li><br>é<a><td><li><li>",
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

  let (peak, total_out) = measure_peak(&html, 8 * 1024, HTMLToMarkdownOptions::default());

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
    assert!(
      expected.contains('\u{a0}'),
      "nbsp should be preserved: {expected:?}"
    );
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
    html.push_str(&format!(
      "<p>Filler paragraph number {i} with some words.</p>"
    ));
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
    s.push_str(&format!(
      "<p>Filler paragraph number {i} with some words.</p>"
    ));
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
  assert!(
    expected.trim_end().ends_with("Alpha 12345"),
    "one-shot has no trailing link: {expected:?}"
  );
  for chunk in [4usize, 7, 16, 64] {
    assert_eq!(
      stream_chunks(&html, chunk, opts.clone()),
      expected,
      "chunk={chunk}"
    );
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
  assert!(
    expected.trim_end().ends_with("Bolt 1 db"),
    "one-shot tail: {expected:?}"
  );
  for chunk in [4usize, 7, 16, 64] {
    assert_eq!(
      stream_chunks(&html, chunk, opts.clone()),
      expected,
      "chunk={chunk}"
    );
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

// An inline marker is held back until its element is known to be non-empty, and
// with it the whitespace run before it, which a drop-then-trim would take. That
// run is the whole ASCII set: `<q>` writes a `"` that leaves the `\r` before it
// no longer trailing, so the `\r` was yielded, then the empty `<q>` was dropped
// and finalize trimmed back past it -- output one-shot never wrote. Needs
// `<pre>` (elsewhere the `\r` normalises to a space) and text output (a fence
// would leave the run mid-buffer), but the hold applies to every marker.
#[test]
fn streaming_holds_full_whitespace_run_before_a_droppable_marker() {
  for html in ["<pre>a\r<q>", "<pre>a\t<q>", "<pre>a \r<q>", "<pre>a\r<em>"] {
    let expected =
      html_to_format_result(html, HTMLToMarkdownOptions::default(), OutputFormat::Text).markdown;
    for chunk in 1..=html.len() {
      let mut p = MarkdownStreamProcessor::new_with_format(
        HTMLToMarkdownOptions::default(),
        OutputFormat::Text,
      );
      let mut actual = String::new();
      for c in html.as_bytes().chunks(chunk) {
        actual.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
      }
      actual.push_str(&p.finish());
      assert_eq!(actual, expected, "chunk={chunk} html={html:?}");
    }
  }
}

// A block boundary trims the trailing spaces of the run before it, and the
// cached run length has to shrink with them. Left stale, it outruns the buffer
// wherever a drain has already cut the front, and the reach-back trim's
// `cache_len <= buf_len` guard then skips the retraction entirely -- so the
// block spacing the empty `<ol/>` wrote survived as `\n\n` where one-shot
// retracts it to the pending space of the run it replaced. One-shot escapes the
// stale length only because nothing has left its buffer, leaving the count exact
// by coincidence.
#[test]
fn streaming_retracts_empty_block_spacing_after_a_space_trim() {
  let html = "<pre>ace><source>tity;      <ol/> <d/>*";
  let expected =
    html_to_format_result(html, HTMLToMarkdownOptions::default(), OutputFormat::Text).markdown;
  assert_eq!(expected, "ace>tity; *");
  for chunk in 1..=html.len() {
    let mut p = MarkdownStreamProcessor::new_with_format(
      HTMLToMarkdownOptions::default(),
      OutputFormat::Text,
    );
    let mut actual = String::new();
    for c in html.as_bytes().chunks(chunk) {
      actual.push_str(&p.process_chunk(std::str::from_utf8(c).unwrap()));
    }
    actual.push_str(&p.finish());
    assert_eq!(actual, expected, "chunk={chunk} html={html:?}");
  }
}

// A heading's exit escapes the trailing `#` run GFM would read as an ATX closing
// sequence, so the run must stay held while the heading is open. `<em>` writes a
// `*` after the run, which left it no longer trailing at the buffer end and
// released it -- then the empty `<em>` was dropped, the run became trailing
// again, and the exit inserted its `\` into bytes already sent. The stray byte
// surfaced at the far end: `- ####` for one-shot's `- \###`.
#[test]
fn streaming_holds_heading_hashes_behind_a_droppable_marker() {
  for html in [
    "<li><h3><em>",
    "<h3><em>",
    "<h3>a #<em>",
    "<li><h3><a href=/u>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
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
  assert!(
    expected.contains("-\n[Delta]"),
    "one-shot tightens the list/block gap: {expected:?}"
  );
  for chunk in 1..=40usize {
    assert_eq!(
      stream_chunks(html, chunk, opts.clone()),
      expected,
      "chunk={chunk}"
    );
  }
}

// A text run is parsed once across however many chunks it spans instead of
// being re-fed as raw input, so a run longer than the chunk resumes rather than
// restarting. The existing cases are all shorter than one chunk, which cannot
// exercise that.
#[test]
fn streaming_long_text_run_matches_one_shot() {
  let long = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(40);
  for html in [
    format!("<p>{long}</p>"),
    format!("<p>{long}</p><p>after</p>"),
    format!("<p>a  b{long}   c</p>"),
    format!("<pre>{long}</pre>"),
    format!("<p>{long}&amp;{long}</p>"),
    format!("<p>{long}<em>x</em>{long}</p>"),
    format!("<style>{long}</style><p>after</p>"),
    format!("<script>{long}</script><p>after</p>"),
    format!("<!--{long}--><p>after</p>"),
    format!("<p>café {long} 😀</p>"),
  ] {
    let expected = html_to_markdown(&html, HTMLToMarkdownOptions::default());
    for chunk in [1usize, 2, 3, 7, 64, 997, 8192] {
      assert_eq!(
        stream_chars(&html, chunk, HTMLToMarkdownOptions::default()),
        expected,
        "chunk={chunk} len={}",
        html.len()
      );
    }
  }
}

// A text run that spans a chunk boundary must not shift with the boundary, at
// any split point, including inside multibyte characters' neighbourhoods.
#[test]
fn streaming_text_run_spanning_chunks_matches_every_split() {
  for html in [
    "<p>the quick brown fox jumps over the lazy dog and keeps running onwards</p>",
    "<p>double  spaces   and\ttabs\nand newlines spread across a longer run</p>",
    "<p>entity &amp; heavy &lt;text&gt; run that continues past a boundary</p>",
    "<p>trailing whitespace sensitive run ending in a space <em>x</em></p>",
    "<pre>preformatted  run   keeping    spacing across a chunk boundary</pre>",
  ] {
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// Real-world documents at several chunk sizes: the broadest guard that chunking
// never changes the output.
#[test]
fn streaming_matches_one_shot_on_fixtures() {
  const FIXTURES: &[(&str, &str)] = &[
    ("wikipedia", include_str!("fixtures/wikipedia-small.html")),
    ("mdn", include_str!("fixtures/mdn-array.html")),
    ("react", include_str!("fixtures/react-learn.html")),
    ("vuejs", include_str!("fixtures/vuejs-docs.html")),
    ("nuxt", include_str!("fixtures/nuxt-example.html")),
    (
      "github",
      include_str!("fixtures/github-markdown-complete.html"),
    ),
  ];
  for (name, html) in FIXTURES {
    for opts in [
      HTMLToMarkdownOptions::default(),
      HTMLToMarkdownOptions {
        clean: Some(safe_clean()),
        ..Default::default()
      },
    ] {
      let expected = html_to_markdown(html, opts.clone());
      assert!(!expected.trim().is_empty(), "{name} produced no output");
      for chunk in [997usize, 4096, 8192, 65536] {
        assert_eq!(
          stream_chars(html, chunk, opts.clone()),
          expected,
          "{name} diverged at chunk={chunk}"
        );
      }
    }
  }
}

// A chunk boundary inside a batched ASCII run must not change whitespace
// collapsing, at any split point.
#[test]
fn streaming_text_whitespace_batching_matches_every_split() {
  for html in [
    "<p>one two three four</p>",
    "<p>a  b</p>",
    "<p>a   b   c</p>",
    "<p> leading and trailing </p>",
    "<p>a <b>bold word</b> c</p>",
    "<p>one two<span> three four</span>five six</p>",
    "<p>a\tb c\nd  e</p>",
    "<p>plain a &amp; b more words</p>",
    "<p>hazard a *b* c words</p>",
    "<p>word café word ok</p>",
    "<pre>keep  double   spaces</pre>",
    "<p>trailing space before tag <em>x</em></p>",
  ] {
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// A `<br>`'s hard break, trimmed off when the inline element closes, can be the
// whole buffer after a drain, so the trim empties it and the pending separator
// was suppressed as if this were the start of output. Each case needs a block
// inside the inline element for the drain to reach that far, and content after
// the close to want the separator.
#[test]
fn streaming_pending_space_after_drained_hard_break_matches_one_shot() {
  for html in [
    "<span><p></p>x<br>\n</span>a",
    "<span><hr>x<br> </span>a",
    "<ul><li><span><p></p>x<br>\n</span>a</li></ul>",
    // A link's `[` is generated markdown, resolved at the other call site.
    "<p><span><em>x</em><br /> </span><a href=\"u\">a",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// A heading's exit escapes a trailing `#` run so GFM does not read it as an ATX
// closing sequence. Streaming used to yield the run before the exit could escape
// it, emitting `## foo ##` where one-shot gives `## foo \#`.
#[test]
fn streaming_heading_trailing_hashes_matches_one_shot() {
  for html in [
    "<h2>foo #</h2>",
    "<h2>foo ##</h2>",
    "<h3>foo ##</h3>",
    "<h1>#</h1>",
    "<h2>foo # bar</h2>",
    "<h2>foo <em>b</em> #</h2>",
    "<h2>foo #</h2><p>after</p>",
    "<h2>a</h2><h2>b #</h2>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// An empty `<li>` inserts a newline at its marker's line start when it resolves,
// so the line stays mutable. Streaming used to yield the marker first, turning
// one-shot's `- a\n\n  -` into `- a\n  --`.
#[test]
fn streaming_empty_nested_item_marker_matches_one_shot() {
  for html in [
    "<ul><li>a<ul><li></li></ul></li></ul>",
    "<ul><li>a<ol><li></li></ol></li></ul>",
    "<ul><li></li></ul>",
    "<ul><li>a<ul><li></li><li>b</li></ul></li></ul>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// A table row's separator depends on what its line already holds, read by
// scanning the buffer back to the last newline. A drain can take that line's
// beginning — or the whole line — so the scan runs out of buffer and reads the
// fragment as a fresh line: an open row is classified as content and separated
// with a blank line, which ends the GFM table and ejects every row after it.
#[test]
fn streaming_table_row_after_drained_line_matches_one_shot() {
  for html in [
    // The line's beginning is drained, leaving a fragment of the open row.
    "<ul><li><table><tr><td></td></tr><tr><td>d</td></tr><tr><td></td></tr></table></li></ul>",
    // The line is drained entirely, so the buffer is empty where one-shot still
    // sees the content the row must be separated from. An open inline element
    // holds the drain boundary far enough to reach that state.
    "<i><div>.<br />\n<table><tr>",
    "<span><div>.<br />\n<table><tr>",
    // The drained prefix is a complete list marker, not paragraph content.
    "<i><li><br><li><tr>",
    // Ordered markers remain recognizable when their leading digit would
    // otherwise be the first byte drained.
    "<ol><li><table><i></table><tr>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// An empty `<li>`'s marker needs a newline inserted at its line start, decided
// at the item's exit. An open inline marker, and an open `<a>`'s `[`, are both
// dropped if their element closes empty, so neither is item content — but a
// chunk boundary materialises them into the buffer, where the item read them as
// content and resolved without the newline one-shot inserts.
#[test]
fn streaming_empty_item_with_open_marker_matches_one_shot() {
  for html in [
    "<li><li><i></li>",
    "<li><li><a href=\"x\"></li>",
    "<li><li><em></li>",
    "<ul><li><li><i></li></ul>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// Past a blank line a raw-HTML region is Markdown again, tracked by scanning the
// buffer for that blank line. A drain can carry those bytes away before the scan
// reaches them, leaving the region suspended forever: streaming then omits every
// escape one-shot writes there.
#[test]
fn streaming_raw_html_blank_line_drained_matches_one_shot() {
  for html in [
    "<dd><p>.<br />*<Foo/Bar>",
    "<dd><tr><a href=\"u\" title=\"t\">_</html>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

#[test]
fn streaming_raw_html_ignores_rewritable_blockquote_separator() {
  let html = "<dd>*<blockquote><blockquote>_";
  assert_stream_matches(html, HTMLToMarkdownOptions::default());
  assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
}

#[test]
fn streaming_raw_html_keeps_stable_blank_line_context() {
  let html = "<dd><ol><i><ol>_";
  assert_stream_matches(html, HTMLToMarkdownOptions::default());
  assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
}

// Every item's marker is immediately followed by a link and an emphasis, the
// shape that holds the empty-item decision open across a chunk boundary. That
// hold pins the drain at the marker's line, so one that outlived its item would
// retain the document instead of a window.
#[test]
fn streaming_memory_bounded_with_empty_item_marker_holds() {
  let mut html = String::with_capacity(8 * 1024 * 1024 + 64);
  html.push_str("<ul>");
  while html.len() < 8 * 1024 * 1024 {
    html.push_str("<li><li><a href=\"/u\">t</a><em>e</em>x</li>");
  }
  html.push_str("</ul>");

  let (peak, total_out) = measure_peak(&html, 8 * 1024, HTMLToMarkdownOptions::default());

  // The conversion really ran...
  assert!(
    total_out > 1024 * 1024,
    "expected >1MB output, got {total_out}"
  );
  // ...and the hold released every item, so memory stayed a window. Measures
  // ~9KB against an 8MB input; the bound is loose enough to absorb allocator
  // and scheduling noise while still failing if the hold ever pins the document.
  assert!(
    peak < 1024 * 1024,
    "peak {peak} should be a bounded window, not ~{} input",
    html.len()
  );
}

// The measurement must ignore other threads: tests run in parallel, and one
// building a multi-megabyte fixture would otherwise land in another's peak.
// Joining the allocating thread while this thread's window is still open is
// what makes the overlap a fact rather than a matter of timing.
#[test]
fn memory_measurement_ignores_other_threads() {
  ACCT.set(Acct {
    on: true,
    live: 0,
    peak: 0,
  });
  let allocated = std::thread::spawn(|| {
    let fixture = vec![7u8; 8 * 1024 * 1024];
    std::hint::black_box(fixture.len())
  })
  .join()
  .unwrap();
  let mut acct = ACCT.get();
  acct.on = false;
  ACCT.set(acct);

  assert_eq!(
    allocated,
    8 * 1024 * 1024,
    "the other thread did not allocate"
  );
  assert!(
    acct.peak < 64 * 1024,
    "peak {} includes another thread's 8MB",
    acct.peak
  );
}

// Yielding does not remove bytes, but `has_streamed_output` is set as soon as any
// are yielded. `flushed_tail` only describes real removed bytes, so reading it on
// the strength of that flag invents a newline before `buffer[0]` and suppresses
// half of the following block separator.
#[test]
fn streaming_block_separator_after_undrained_yield_matches_one_shot() {
  for html in [
    "<table><caption>c</caption>.",
    "<table><p>x</p>.",
    "<table><caption>c</caption><tr>",
    "<td>d</td><table><tr>",
    "<table><p>x</p><dd>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// A block opening inside a list item asks what its line already holds. An emptied
// buffer is the start of the output only until a drain takes that line away;
// afterwards the block is glued to text it should have broken away from.
#[test]
fn streaming_block_open_after_drained_line_matches_one_shot() {
  for html in [
    "<ul><li>.<br />\n<table><caption>c</caption><tr><td>d</td></tr></table>",
    "<ol><li>.<br />\n<table><caption>c</caption><tr><td>d</td></tr></table>",
    "<i><ul><li>.<br />\n<table><caption>c</caption><tr><td>d</td></tr></table>",
    "<ul><li>t<ul><li>.<br />\n<table><caption>c</caption><tr><td>d</td></tr></table>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// The newline an empty item inserts at its marker line moves every buffer offset
// at or past it. An inline element still open across the insertion measures its
// own emptiness from one of them, so leaving it unshifted stops an empty element
// from looking empty and leaks the markers one-shot drops.
#[test]
fn streaming_open_marker_across_item_newline_matches_one_shot() {
  for html in [
    "<li><li><br /><i>",
    "<li><li><br /><em>",
    "<ul><li><ul><li><br /><i>",
    "<tr><li><br /><i>",
    ".<li><br /><i>",
    "<ul><li><blockquote><ul><li>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }

  // The blockquote frames must NOT be shifted with the rest: their
  // `content_start` belongs before the inserted newline. Shifting it moves the
  // quote out of the list item, and because that moves one-shot too, parity
  // cannot see it — so pin the bytes a GFM parser reads back as `li > blockquote`.
  assert_eq!(
    html_to_markdown(
      "<ul><li><blockquote><ul><li>",
      HTMLToMarkdownOptions::default()
    ),
    "- \n  >\n  > -"
  );
}

// An empty blockquote's `>` was dropped for the rest of the document once
// anything had been yielded, because the emptiness test read the global
// `has_streamed_output` instead of asking about the frame's own range.
#[test]
fn streaming_empty_blockquote_marker_matches_one_shot() {
  for html in [
    "<i><blockquote>",
    "<i>><blockquote>",
    "<em>-<blockquote>",
    "<table><dt><blockquote>",
    "<tr><a href=\"u\"><blockquote>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
  // Parity alone cannot see this: both sides agreeing on a dropped `>` would
  // pass. Pin the marker itself.
  assert_eq!(
    html_to_markdown("<i><blockquote>", HTMLToMarkdownOptions::default()),
    "*>*"
  );
}

// Draining resolves a pending marker guard early so it can release its hold. It
// must not insert on the item's behalf: the very next `<li>` drops the pending
// guard, which is how one-shot leaves `<li><li>` tight.
#[test]
fn streaming_marker_guard_defers_to_item_exit_matches_one_shot() {
  for html in [
    "<li><li><br /><ul><li>",
    "<ul><li><ul><li><br /><ul><li>",
    "<tr><li><br /><ul><li>",
    "<td>d</td><li><br /><ul><li>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// Raw HTML is passed through verbatim, so a GFM escape written inside a raw
// region is not an escape: the backslash reaches the reader. The blank line that
// re-enables Markdown must be looked for inside the region, not before it.
#[test]
fn raw_html_region_text_is_not_gfm_escaped() {
  for (html, expected) in [
    (".<ul><li><dd>*", ".\n\n- <dd>*</dd>"),
    ("<p>x</p><li><dd>_", "x\n\n- <dd>_</dd>"),
    ("<caption>c</caption><tr><dd>*", "c\n\n| <dd>*</dd>\n |\n|"),
    // Only inside the region: the leading `*` is still escaped.
    ("*<ul><li><dd>_", "\\*\n\n- <dd>_</dd>"),
  ] {
    assert_eq!(
      html_to_markdown(html, HTMLToMarkdownOptions::default()),
      expected,
      "one-shot for {html:?}"
    );
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// The one-shot finaliser trimmed the buffer with `str::trim_end`, whose Unicode
// set includes U+00A0. Everywhere else nbsp is content, and streaming cannot
// un-send a nbsp it has already yielded, so one-shot deleted a trailing one that
// streaming kept -- silently dropping content in the last case below.
#[test]
fn trailing_nbsp_is_content_and_matches_one_shot() {
  for (html, expected) in [
    ("<p>x</p><p>&nbsp;</p>", "x\n\n\u{a0}"),
    ("<p>x</p><p>a&nbsp;</p>", "x\n\na\u{a0}"),
    ("<p>hello&nbsp;world&nbsp;</p>", "hello\u{a0}world\u{a0}"),
  ] {
    assert_eq!(
      html_to_markdown(html, HTMLToMarkdownOptions::default()),
      expected,
      "one-shot for {html:?}"
    );
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// Every trim that reaches back into the buffer takes the whole ASCII
// whitespace set, but the yield boundary only held back `\n` and spaces, so a
// trailing tab was sent and then trimmed from the buffer alone.
#[test]
fn trailing_tab_is_held_back_like_a_space() {
  for html in ["$&#9", "$&#9;", "a&#9;&#9;", "x&Tab;"] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// A `<pre>` writes its block spacing on open but the fence only when content
// arrives. Treating the element as open was enough to skip the trailing-newline
// hold, so an empty one yielded spacing that finalize then trimmed.
#[test]
fn empty_pre_does_not_yield_block_spacing_finalize_trims() {
  for html in [
    "S<pre>",
    "><pre>",
    "S<pre></pre>",
    "S<pre>  </pre>",
    "S<pre></pre><pre>",
  ] {
    assert_stream_matches(html, HTMLToMarkdownOptions::default());
    assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
  }
}

// `link_bracket_pos` marks where an empty link is truncated back to. It was
// taken from the buffer's last byte being `[`, which is also true of an escaped
// literal `\[` in the text before the link, so the drop cut into that text and
// left its backslash stranded.
#[test]
fn empty_link_text_drop_keeps_a_preceding_escaped_bracket() {
  let opts = HTMLToMarkdownOptions {
    clean: Some(CleanConfig {
      empty_link_text: true,
      ..CleanConfig::default()
    }),
    ..Default::default()
  };
  for html in ["[<A/>", "[<a></a>", "a [ <a href=\"/x\"></a>", "\\[<a></a>"] {
    assert_stream_matches(html, opts.clone());
    assert_stream_matches_every_split(html, opts.clone());
  }
  assert_eq!(html_to_markdown("[<A/>", opts), "\\[");
}

// A line's indent can be split across cuts, and the three-space limit on what
// may precede the `<` that suspends Markdown counts from the line's real start.
// The `<dd>` here sits under five spaces, two of which leave with the drain: a
// fragment read on its own opens with three spaces and a tag, claiming a
// suspension the whole line never had and dropping the `\[` one-shot writes.
#[test]
fn streaming_counts_raw_html_indent_across_a_drain() {
  let html = "<lI><dd/L><oL><lI><oL><I><hr><dd/L>%%&<lI><<o>[";
  assert_stream_matches(html, HTMLToMarkdownOptions::default());
  assert_stream_matches_every_split(html, HTMLToMarkdownOptions::default());
}

// Inside a raw-HTML region Markdown escaping is suspended until a blank line
// closes it, so a drain has to record whether the line it cuts opened such a
// region. The `<dd>` here sits under five spaces of indent, three more than can
// open one, so the escapes stay -- but a lead classified from the first
// non-blank byte alone reads that `<` as a suspension and drops them, leaving a
// bare `[` that gives the output a link the source never had. Drain-only.
#[test]
fn raw_html_escape_suspension_survives_a_drain() {
  let chunks = [
    "<l",
    "I\r><d",
    "L>d<o",
    "L>",
    "",
    "\r",
    "<l",
    "I>%&<hr><dd/L>\u{7}%",
    "\0\0\0\0\0\0<\u{18}<<o",
    "L>/[\u{18}\u{7}]",
  ];
  let html: String = chunks.concat();
  let expected = html_to_markdown(&html, HTMLToMarkdownOptions::default());
  let mut p = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut actual = String::new();
  for c in chunks {
    actual.push_str(&p.process_chunk(c));
  }
  actual.push_str(&p.finish());
  assert_eq!(actual, expected);
}

// A reach-back trim shrinks the last content run, so the cached length must
// shrink too: left stale, the next trim starts behind the run and eats block
// spacing the stream already yielded. Text output only -- a fence makes the run
// real content, so nothing reaches back over it.
#[test]
fn streaming_survives_two_reach_back_trims_over_one_run() {
  let long = "a < b".repeat(18);
  let cases = [
    // Second trim is a block exit, which drops the spacing outright.
    (
      "through\"><=>><h><pre>     \n\n\r\n\r\n\r\n\r\n<source> <source>>".to_string(),
      HTMLToMarkdownOptions::default(),
    ),
    // Second trim is an inline exit, which leaves a pending space behind: the
    // stream kept a bare `\r` where one-shot wrote that space. Straight from
    // fuzz_html_grammar and not reducible -- both nested `<pre>`s and the run
    // that overflows the wrap width are load-bearing.
    (
      format!(
        "<h3 id=># not a heading</tr></pre><pre colspan=\"text-red-500 font-bold line-through\">\
         <h3 src=>\r\n\r\n\r\n[link] (paren)<script/>\r\n\r\n\r\n\r\n\r\n<h1 src=><td id=>\r\n\r\n\
         <pre>\r\n\r\n<source> <source>       \n\n<source> </DIV><h1 src=>\r\n\r\n<DIV></main>\r\n\r\n\
         {long}\r\n\r\n</pre>"
      ),
      HTMLToMarkdownOptions {
        origin: Some("https://example.com/base/".to_string()),
        clean_urls: true,
        clean: Some(safe_clean()),
        wrap_width: 123,
        ..Default::default()
      },
    ),
  ];
  for (html, opts) in cases {
    let expected = html_to_format_result(&html, opts.clone(), OutputFormat::Text).markdown;
    for chunk in 1..=html.len() {
      let mut p = MarkdownStreamProcessor::new_with_format(opts.clone(), OutputFormat::Text);
      let mut actual = String::new();
      let mut start = 0;
      while start < html.len() {
        let mut end = (start + chunk).min(html.len());
        while end < html.len() && !html.is_char_boundary(end) {
          end += 1;
        }
        actual.push_str(&p.process_chunk(&html[start..end]));
        start = end;
      }
      actual.push_str(&p.finish());
      assert_eq!(actual, expected, "chunk={chunk} html={html:?}");
    }
  }
}

// Inside a rawtext element a `</` whose tag name runs past the chunk end is
// carried to the next chunk, but the text before it is already buffered. Not
// advancing the carry point re-fed that text, so a one-shot pass emitted it
// twice while a stream, having consumed it in an earlier chunk, emitted it once.
#[test]
fn rawtext_close_tag_split_across_chunks_is_carried_without_its_text() {
  for tail in [
    "<textarea>></",
    "<textarea>x</",
    "<textarea>x</textare",
    "<title>x</",
    "<style>x</",
  ] {
    // Enough unclosed inline elements to hold the yield boundary back, so the
    // carry lands mid-document rather than at a fresh buffer.
    let html = format!("{}{tail}", "<s><Q>".repeat(400));
    for format in [OutputFormat::Text, OutputFormat::Markdown] {
      let expected =
        html_to_format_result(&html, HTMLToMarkdownOptions::default(), format).markdown;
      for chunk in 1..=3 {
        let mut p =
          MarkdownStreamProcessor::new_with_format(HTMLToMarkdownOptions::default(), format);
        let mut actual = String::new();
        let mut start = 0;
        while start < html.len() {
          let end = (start + chunk).min(html.len());
          actual.push_str(&p.process_chunk(&html[start..end]));
          start = end;
        }
        actual.push_str(&p.finish());
        assert_eq!(
          actual, expected,
          "chunk={chunk} tail={tail:?} format={format:?}"
        );
      }
    }
  }
}

// The rawtext EOF residual is committed by `finalize`, which both paths share, so
// streaming has to keep the text one-shot now keeps. Pin the value, not just the
// parity: before the fix both paths dropped it and agreed on the wrong output.
// Every split matters because the boundary is what produces the residual.
#[test]
fn streaming_matches_one_shot_on_a_rawtext_eof_residual() {
  for (truncated, closed) in [
    ("<textarea>a<", "<textarea>a<</textarea>"),
    ("<textarea>a</", "<textarea>a</</textarea>"),
    ("<textarea>a</tex", "<textarea>a</tex</textarea>"),
    ("<textarea>></", "<textarea>></</textarea>"),
    ("<xmp>a</", "<xmp>a</</xmp>"),
    ("<title>a</", "<title>a</</title>"),
  ] {
    let expected = html_to_markdown(closed, HTMLToMarkdownOptions::default());
    for chunk in 1..=truncated.len() {
      assert_eq!(
        stream_chunks(truncated, chunk, HTMLToMarkdownOptions::default()),
        expected,
        "chunk={chunk} truncated={truncated:?}"
      );
    }
    assert_stream_matches_every_split(truncated, HTMLToMarkdownOptions::default());
  }

  // The one residual EOF still discards: an appropriate end tag already delimited.
  assert_stream_matches("<textarea>a</textarea ", HTMLToMarkdownOptions::default());
  assert_eq!(
    stream_chunks(
      "<textarea>a</textarea ",
      1,
      HTMLToMarkdownOptions::default()
    ),
    "a"
  );
}

// Once the buffer passes the flush threshold, streaming pre-quotes every
// complete line of open blockquote content. A blank line at the tail is not
// complete in that sense: whether it keeps a `>` depends on content that has not
// arrived, and `finalize_blockquote` trims it off the buffer end when none does.
// Quoting it early appended a stray `>` line no one-shot output contains. Needs
// content past the 8 KiB threshold, then a block that leaves the quote on a
// blank line -- and the `>` must still appear when content does follow.
#[test]
fn streaming_holds_a_blockquote_blank_line_until_content_follows() {
  for tail in ["<p>", "<div>", "<html>", "<blockquote>", "<p>y</p>", "<p>y"] {
    let html = format!("a<blockquote>{}{tail}", "x".repeat(8192));
    let expected = html_to_markdown(&html, HTMLToMarkdownOptions::default());
    for chunk in [1usize, 7, 64, 4096] {
      assert_eq!(
        stream_chunks(&html, chunk, HTMLToMarkdownOptions::default()),
        expected,
        "chunk={chunk} tail={tail:?}"
      );
    }
  }
}

#[test]
fn streaming_matches_one_shot_across_blockquote_quoting() {
  assert_stream_matches_every_split(
    "<dd><h2><li><blockquote>a<p><code><p>>aa<<a><<li>`",
    HTMLToMarkdownOptions::default(),
  );
}

// A trim takes the marker's own trailing space, which leaves the marker's
// recorded end past where the item's content now starts, so the element that
// opens the item -- a code span's backtick, or an emphasis marker -- reads as
// content. Streaming resolves the marker as content arrives and settled the
// question on it; one-shot only looks at the item's exit and never saw it, so
// they disagreed on the blank line that keeps an empty item from continuing the
// paragraph above.
#[test]
fn streaming_keeps_an_empty_items_blank_line_across_a_code_span() {
  assert_stream_matches_every_split("a a<li><p><code>", HTMLToMarkdownOptions::default());
}

#[test]
fn streaming_keeps_an_empty_items_blank_line_across_an_inline_marker() {
  assert_stream_matches_every_split("a a<li><html><strong>", HTMLToMarkdownOptions::default());
}

// A code span or fence measures and rewrites itself through buffer offsets, and
// quoting moves the bytes under them. The drain already holds at the open one,
// so flushing past it releases nothing and leaves the fence pointing into the
// quote prefix -- mid-codepoint, where finalizing it panics. Long enough to
// cross the flush threshold while the fence is still open.
#[test]
fn streaming_defers_the_blockquote_flush_while_a_fence_is_open() {
  let html = format!("<blockquote><pre>{}", "\u{e9}\n<br>".repeat(3000));
  let expected = html_to_markdown(&html, HTMLToMarkdownOptions::default());
  for chunk in [512, 4096] {
    assert_eq!(
      stream_chars(&html, chunk, HTMLToMarkdownOptions::default()),
      expected,
      "chunk={chunk}"
    );
  }
}
