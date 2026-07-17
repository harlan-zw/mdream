use mdream::html_to_markdown;
use mdream::types::HTMLToMarkdownOptions;

fn opts(max_depth: usize) -> HTMLToMarkdownOptions {
  HTMLToMarkdownOptions {
    max_depth: Some(max_depth),
    ..Default::default()
  }
}

#[test]
fn no_effect_below_limit() {
  let html = "<div><blockquote><p>hi <strong>there</strong></p></blockquote></div>";
  assert_eq!(
    html_to_markdown(html, opts(100)),
    html_to_markdown(html, HTMLToMarkdownOptions::default())
  );
}

#[test]
fn deep_nesting_keeps_content() {
  let html = format!("{}deep text{}", "<div>".repeat(200), "</div>".repeat(200));
  let out = html_to_markdown(&html, opts(8));
  assert!(out.contains("deep text"), "got: {out:?}");
}

#[test]
fn content_after_deep_block_stays_top_level() {
  let html = format!(
    "{}<blockquote>quoted</blockquote>{}<p>after</p>",
    "<div>".repeat(200),
    "</div>".repeat(200)
  );
  let out = html_to_markdown(&html, opts(8));
  let last = out.lines().last().unwrap_or("");
  // Closes are balanced against suppressed opens, so "after" is a top-level
  // paragraph rather than nested inside the (flattened) blockquote.
  assert_eq!(last, "after", "got: {out:?}");
}

#[test]
fn unclosed_nesting_bomb_does_not_panic() {
  let html = format!("{}tail", "<div>".repeat(100_000));
  let out = html_to_markdown(&html, opts(16));
  assert!(out.contains("tail"), "got tail? len={}", out.len());
}

// The cases below cover markup where opens/closes beyond the cap don't balance
// 1:1 — a naive counter desyncs and swallows real (<= cap) end tags. Identity
// matching keeps the real tree intact, so the trailing paragraph stays top-level.

#[test]
fn implied_end_siblings_past_cap_do_not_desync() {
  // `<p>a<p>b` are implied-end siblings; a counter would over-count the second
  // `<p>` and later swallow a real `</div>`, nesting `after` incorrectly.
  let html = "<div><div><p>a<p>b</div></div><p>after</p>";
  assert_eq!(html_to_markdown(html, opts(2)).trim(), "a b\n\nafter");
}

#[test]
fn mismatched_close_past_cap_does_not_corrupt() {
  // The stray `</span>` has no matching open in the flattened subtree; it must
  // be ignored, not decrement suppression and pop a real element.
  let html = "<div><div><span>x</span></span><p>y</p></div></div><p>after</p>";
  assert_eq!(html_to_markdown(html, opts(2)).trim(), "xy\n\nafter");
}

#[test]
fn void_elements_past_cap_do_not_desync() {
  // Void tags await no close, so tracking them would inflate a counter. They
  // must not shift the level of the following top-level paragraph.
  let html = "<div><div><br><img><p>x</p></div></div><p>after</p>";
  assert_eq!(html_to_markdown(html, opts(2)).trim(), "x\n\nafter");
}

#[test]
fn mixed_bomb_past_cap_keeps_outer_structure() {
  // Implied-end + void past the cap combined: the two real `</div>` must close
  // the real divs so `outside` renders as a top-level paragraph.
  let html = "<div><div><p>a<br>b<p>c</div></div><p>outside</p>";
  assert_eq!(html_to_markdown(html, opts(2)).trim(), "a b c\n\noutside");
}

#[test]
fn distinct_custom_elements_past_cap_keep_outer_structure() {
  // Different custom elements beyond the cap may collapse together in the
  // flattened output, but the real (<= cap) tree — and `after` — stays intact.
  let html = "<div><div><my-foo>a</my-foo><my-bar>b</my-bar></div></div><p>after</p>";
  assert_eq!(html_to_markdown(html, opts(2)).trim(), "a b\n\nafter");
}
