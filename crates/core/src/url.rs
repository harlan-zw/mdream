//! URL normalisation and heading-slug helpers.
//!
//! Pure functions extracted from the converter: tracking-param stripping,
//! relative-URL resolution, GFM autolink detection, and heading slugs.

use std::borrow::Cow;

/// Known tracking query parameter prefixes to strip when clean_urls is enabled.
const TRACKING_PREFIXES: [&str; 6] = ["utm_", "fbclid", "gclid", "mc_eid", "msclkid", "oly_"];

/// Whether `s` looks like a bare absolute URI suitable for GFM autolink
/// shorthand (`<http://…>`). Conservative: only common web/mail schemes,
/// no whitespace or angle brackets that would break the autolink syntax.
#[inline]
pub(crate) fn is_autolink_uri(s: &str) -> bool {
  // First-byte dispatch: the common no-scheme href rejects without a prefix compare.
  let bytes = s.as_bytes();
  let has_scheme = match bytes.first() {
    Some(b'h') => s.starts_with("http://") || s.starts_with("https://"),
    Some(b'f') => s.starts_with("ftp://"),
    Some(b'm') => s.starts_with("mailto:"),
    _ => false,
  };
  if !has_scheme {
    return false;
  }
  !s.bytes()
    .any(|b| b == b' ' || b == b'<' || b == b'>' || b == b'\n' || b == b'\r' || b == b'\t')
}

/// Whether the significant bytes of `rest` start with `scheme`, ignoring case.
/// Tab, LF and CR are skipped: the URL parser removes them before the scheme,
/// so `java\tscript:` is the `javascript:` scheme.
fn scheme_matches(rest: &[u8], scheme: &[u8]) -> bool {
  let mut matched = 0;
  for &byte in rest {
    if matches!(byte, b'\t' | b'\n' | b'\r') {
      continue;
    }
    if !byte.eq_ignore_ascii_case(&scheme[matched]) {
      return false;
    }
    matched += 1;
    if matched == scheme.len() {
      return true;
    }
  }
  false
}

#[inline(never)]
fn trim_url_c0(href: &str) -> &[u8] {
  let bytes = href.as_bytes();
  let start = bytes
    .iter()
    .position(|&byte| byte > b' ')
    .unwrap_or(bytes.len());
  let end = bytes
    .iter()
    .rposition(|&byte| byte > b' ')
    .map_or(start, |last| last + 1);
  &bytes[start..end]
}

/// Whether `href` cannot represent meaningful navigation: a bare `#`, or a
/// `javascript:`, `data:` or `vbscript:` URL.
///
/// Mirrors the URL parser's preprocessing, so `" javascript:"` and the decoded
/// form of `java&#9;script:` are recognised. An interior space is *not* removed
/// by the URL parser, so `java script:x` stays an ordinary relative URL.
pub(crate) fn is_empty_link_href(href: &str) -> bool {
  // Leading and trailing C0 controls and spaces are stripped. UTF-8
  // continuation bytes are all >= 0x80, so this cannot split a character.
  let rest = trim_url_c0(href);

  match rest.first().map(u8::to_ascii_lowercase) {
    Some(b'#') => rest.len() == 1,
    Some(b'j') => scheme_matches(rest, b"javascript:"),
    Some(b'd') => scheme_matches(rest, b"data:"),
    Some(b'v') => scheme_matches(rest, b"vbscript:"),
    _ => false,
  }
}

#[inline]
fn is_scheme_char(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'-' | b'.')
}

/// Whether a URL is safe to emit into an HTML href or src attribute.
pub(crate) fn is_safe_html_url(href: &str, image: bool) -> bool {
  let rest = trim_url_c0(href);
  if rest.is_empty() {
    return false;
  }
  for &byte in rest {
    if matches!(byte, b'\t' | b'\n' | b'\r') {
      continue;
    }
    if byte == b':' {
      return match rest.first().map(u8::to_ascii_lowercase) {
        Some(b'h') => scheme_matches(rest, b"http:") || scheme_matches(rest, b"https:"),
        Some(b'm') => !image && scheme_matches(rest, b"mailto:"),
        Some(b't') => !image && scheme_matches(rest, b"tel:"),
        Some(b'f') => !image && scheme_matches(rest, b"ftp:"),
        _ => false,
      };
    }
    if matches!(byte, b'/' | b'?' | b'#') {
      return true;
    }
    if !is_scheme_char(byte) {
      return true;
    }
  }
  true
}

/// Check if a query parameter key is a tracking parameter.
#[inline]
pub(crate) fn is_tracking_param(key: &str) -> bool {
  for prefix in &TRACKING_PREFIXES {
    if key.starts_with(prefix) {
      return true;
    }
  }
  false
}

/// Strip tracking query parameters from a URL string.
/// Returns Cow::Borrowed if no tracking params found, avoiding allocation.
pub(crate) fn strip_tracking_params(url: &str) -> Cow<'_, str> {
  let Some(qmark) = url.find('?') else {
    return Cow::Borrowed(url);
  };
  if url[..qmark].contains('#') {
    return Cow::Borrowed(url);
  }
  let query_start = qmark + 1;
  let query_end = url[query_start..]
    .find('#')
    .map_or(url.len(), |i| query_start + i);
  let query = &url[query_start..query_end];

  // Fast check: does any param match a tracking prefix?
  let has_tracking = query.split('&').any(|param| {
    let key = param.find('=').map_or(param, |i| &param[..i]);
    is_tracking_param(key)
  });
  if !has_tracking {
    return Cow::Borrowed(url);
  }

  Cow::Owned(strip_tracking_params_owned(url.to_string()))
}

/// Strip tracking query parameters from an already-owned URL string.
pub(crate) fn strip_tracking_params_owned(url: String) -> String {
  let Some(qmark) = url.find('?') else {
    return url;
  };
  if url.find('#').is_some_and(|hash| hash < qmark) {
    return url;
  }
  let (base, rest) = url.split_at(qmark);
  let query = &rest[1..]; // skip '?'

  // Split off fragment if present
  let (query, fragment) = match query.find('#') {
    Some(i) => (&query[..i], &query[i..]),
    None => {
      // Also check base for fragment before query (rare but possible in malformed URLs)
      (query, "")
    }
  };

  let mut kept = String::new();
  for param in query.split('&') {
    let key = match param.find('=') {
      Some(i) => &param[..i],
      None => param,
    };
    if !is_tracking_param(key) {
      if !kept.is_empty() {
        kept.push('&');
      }
      kept.push_str(param);
    }
  }

  if kept.is_empty() {
    // All params stripped — return base + fragment
    let mut result = base.to_string();
    result.push_str(fragment);
    result
  } else {
    let mut result = base.to_string();
    result.push('?');
    result.push_str(&kept);
    result.push_str(fragment);
    result
  }
}

#[inline]
fn heading_is_escaped(bytes: &[u8], mut index: usize) -> bool {
  let end = index;
  while index > 0 && bytes[index - 1] == b'\\' {
    index -= 1;
  }
  (end - index) & 1 != 0
}

#[inline]
fn heading_html_tag_end(bytes: &[u8], start: usize) -> Option<usize> {
  let len = bytes.len();
  let mut end = start + 1;
  if bytes.get(end) == Some(&b'/') {
    end += 1;
  }
  if !bytes.get(end).is_some_and(u8::is_ascii_alphabetic) {
    return None;
  }
  end += 1;
  while bytes
    .get(end)
    .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
  {
    end += 1;
  }
  if !matches!(
    bytes.get(end),
    Some(b' ' | b'\t' | b'\n' | b'\r' | b'/' | b'>')
  ) {
    return None;
  }
  let mut quote = 0;
  while end < len {
    let byte = bytes[end];
    if quote != 0 {
      if byte == quote {
        quote = 0;
      }
    } else if byte == b'\'' || byte == b'"' {
      quote = byte;
    } else if byte == b'>' {
      return Some(end + 1);
    } else if byte == b'<' {
      return None;
    }
    end += 1;
  }
  None
}

/// GFM-style slug from heading text: lowercase, collapse whitespace/- → -, strip non-alnum except -_
pub(crate) fn slugify_heading(text: &str) -> String {
  // Strip inline markdown formatting from heading text
  // Remove [text](url) → text, strip *_`~
  let mut cleaned = String::with_capacity(text.len());
  let bytes = text.as_bytes();
  let len = bytes.len();
  let last_gt = bytes.iter().rposition(|byte| *byte == b'>');
  let mut first_tick_len = 0;
  let mut first_tick_last = 0;
  let mut other_tick_lasts: Option<Vec<(usize, usize)>> = None;
  let mut scan = 0;
  while scan < len {
    if bytes[scan] == b'`' {
      let start = scan;
      scan += 1;
      while bytes.get(scan) == Some(&b'`') {
        scan += 1;
      }
      let ticks = scan - start;
      if first_tick_len == 0 {
        first_tick_len = ticks;
        first_tick_last = start;
      } else if ticks == first_tick_len {
        first_tick_last = start;
      } else {
        let positions = other_tick_lasts.get_or_insert_with(Vec::new);
        match positions.binary_search_by_key(&ticks, |entry| entry.0) {
          Ok(index) => positions[index].1 = start,
          Err(index) => positions.insert(index, (ticks, start)),
        }
      }
    } else if bytes[scan] == b'<'
      && last_gt.is_some_and(|last| scan < last)
      && !heading_is_escaped(bytes, scan)
    {
      scan = heading_html_tag_end(bytes, scan).unwrap_or(scan + 1);
    } else {
      scan += 1;
    }
  }
  let mut i = 0;
  let mut code_ticks = 0;
  while i < len {
    if bytes[i] == b'`' {
      let mut end = i + 1;
      while bytes.get(end) == Some(&b'`') {
        end += 1;
      }
      let ticks = end - i;
      if code_ticks == 0 {
        let last = if ticks == first_tick_len {
          first_tick_last
        } else {
          other_tick_lasts
            .as_ref()
            .and_then(|positions| {
              positions
                .binary_search_by_key(&ticks, |entry| entry.0)
                .ok()
                .map(|index| positions[index].1)
            })
            .unwrap_or(i)
        };
        if last > i {
          code_ticks = ticks;
        }
      } else if code_ticks == ticks {
        code_ticks = 0;
      }
      i = end;
    } else if code_ticks != 0 {
      cleaned.push(bytes[i] as char);
      i += 1;
    } else if bytes[i] == b'\\' && i + 1 < len {
      cleaned.push(bytes[i + 1] as char);
      i += 2;
    } else if bytes[i] == b'<' && last_gt.is_some_and(|last| i < last) {
      if let Some(end) = heading_html_tag_end(bytes, i) {
        i = end;
        continue;
      }
      i += 1;
    } else if bytes[i] == b'[' {
      // Look for ](url) pattern
      if let Some(close) = text[i + 1..].find(']') {
        let close_abs = i + 1 + close;
        if close_abs + 1 < len
          && bytes[close_abs + 1] == b'('
          && let Some(paren_close) = text[close_abs + 2..].find(')')
        {
          // Extract link text only
          cleaned.push_str(&text[i + 1..close_abs]);
          i = close_abs + 2 + paren_close + 1;
          continue;
        }
      }
      i += 1;
    } else if bytes[i] == b'*' || bytes[i] == b'_' || bytes[i] == b'`' || bytes[i] == b'~' {
      i += 1;
    } else {
      cleaned.push(bytes[i] as char);
      i += 1;
    }
  }

  let trimmed = cleaned.trim();
  let mut slug = String::with_capacity(trimmed.len());
  let mut last_was_dash = false;
  for c in trimmed.bytes() {
    if c.is_ascii_lowercase() {
      slug.push(c as char);
      last_was_dash = false;
    } else if c.is_ascii_uppercase() {
      slug.push((c + 32) as char);
      last_was_dash = false;
    } else if c.is_ascii_digit() {
      slug.push(c as char);
      last_was_dash = false;
    } else if c == b'_' {
      slug.push('_');
      last_was_dash = false;
    } else if (c == b' ' || c == b'\t' || c == b'-') && !last_was_dash && !slug.is_empty() {
      slug.push('-');
      last_was_dash = true;
    }
  }
  if last_was_dash {
    slug.pop();
  }
  slug
}

/// Query and fragment take no part in resolution, so the split drops them.
struct BaseUrl<'a> {
  root: &'a str,
  path: &'a str,
}

impl<'a> BaseUrl<'a> {
  fn split(origin: &'a str) -> Option<Self> {
    let bytes = origin.as_bytes();
    let mut i = origin.find("://")? + 3;
    let mut root_end = None;
    while i < bytes.len() {
      match bytes[i] {
        b'?' | b'#' => break,
        b'/' if root_end.is_none() => root_end = Some(i),
        _ => {}
      }
      i += 1;
    }
    let root_end = root_end.unwrap_or(i);
    Some(Self {
      root: origin.get(..root_end).unwrap_or(origin),
      path: origin.get(root_end..i).unwrap_or(""),
    })
  }

  fn dir(&self) -> &'a str {
    match self.path.rfind('/') {
      Some(i) => self.path.get(..=i).unwrap_or("/"),
      None => "/",
    }
  }
}

#[inline]
fn is_dot_segment(segment: &[u8]) -> bool {
  matches!(segment, [b'.'] | [b'.', b'.'])
}

/// One pass over a reference: its scheme, where its path ends (first `?` or
/// `#`, else its length), and whether that path holds a dot segment.
struct RefScan {
  scheme: bool,
  path_end: usize,
  has_dot: bool,
}

fn scan_reference(url: &str) -> RefScan {
  let bytes = url.as_bytes();
  let mut i = 0;
  let mut segment_start = 0;
  let mut dot = false;
  // A scheme opens with a letter; every byte so far could still belong to one.
  let mut scheme_chars = bytes.first().is_some_and(u8::is_ascii_alphabetic);
  while i < bytes.len() {
    let byte = bytes[i];
    match byte {
      b'?' | b'#' => break,
      b':' if scheme_chars && i > 0 => {
        return RefScan {
          scheme: true,
          path_end: i,
          has_dot: false,
        };
      }
      b'/' => {
        dot |= is_dot_segment(bytes.get(segment_start..i).unwrap_or(&[]));
        segment_start = i + 1;
        scheme_chars = false;
      }
      _ => {
        if scheme_chars && !is_scheme_char(byte) {
          scheme_chars = false;
        }
      }
    }
    i += 1;
  }
  RefScan {
    scheme: false,
    path_end: i,
    has_dot: dot || is_dot_segment(bytes.get(segment_start..i).unwrap_or(&[])),
  }
}

/// `root_len` marks where the path starts; a `..` never climbs past it.
fn pop_path_segment(out: &mut String, root_len: usize) {
  let end = out.len() - 1; // the trailing `/` is not part of the segment
  if end <= root_len {
    return;
  }
  let prev = out
    .get(root_len..end)
    .and_then(|path| path.rfind('/'))
    .map_or(root_len, |i| root_len + i);
  out.truncate(prev + 1);
}

/// `out` must end with `/`, and does so again after every segment.
fn push_path_segments(out: &mut String, path: &str, root_len: usize) {
  let mut segments = path.split('/').peekable();
  while let Some(segment) = segments.next() {
    match segment.as_bytes() {
      // Writes no segment, so `out` keeps the `/` it ends with.
      [b'.'] => {}
      [b'.', b'.'] => pop_path_segment(out, root_len),
      _ => {
        out.push_str(segment);
        if segments.peek().is_some() {
          out.push('/');
        }
      }
    }
  }
}

/// Resolves `url` against `base` the way a browser would.
fn join_base_url(base: &BaseUrl<'_>, url: &str, scan: &RefScan) -> String {
  // Only the path resolves; query and fragment carry across.
  let path = url.get(..scan.path_end).unwrap_or(url);
  let suffix = url.get(scan.path_end..).unwrap_or("");
  let mut resolved = String::with_capacity(base.root.len() + base.path.len() + url.len() + 1);
  resolved.push_str(base.root);
  if path.is_empty() {
    resolved.push_str(base.path);
    resolved.push_str(suffix);
    return resolved;
  }
  let (dir, rest) = match path.strip_prefix('/') {
    Some(absolute) => ("/", absolute),
    None => (base.dir(), path),
  };
  resolved.push_str(dir);
  if scan.has_dot {
    push_path_segments(&mut resolved, rest, base.root.len());
  } else {
    resolved.push_str(rest);
  }
  resolved.push_str(suffix);
  resolved
}

/// No `scheme://authority`, so no base path to resolve against.
fn join_origin_prefix(origin: &str, url: &str) -> String {
  let origin = origin.trim_end_matches('/');
  let suffix = url.strip_prefix("./").unwrap_or(url);
  let mut resolved = String::with_capacity(origin.len() + 1 + suffix.len());
  resolved.push_str(origin);
  if !suffix.starts_with('/') {
    resolved.push('/');
  }
  resolved.push_str(suffix);
  resolved
}

#[inline]
fn cleaned(resolved: String, needs_clean: bool) -> Cow<'static, str> {
  Cow::Owned(if needs_clean {
    strip_tracking_params_owned(resolved)
  } else {
    resolved
  })
}

#[inline]
pub(crate) fn resolve_url<'a>(url: &'a str, origin: Option<&str>, clean: bool) -> Cow<'a, str> {
  if url.is_empty() || url.starts_with('#') {
    return Cow::Borrowed(url);
  }

  // Fast path: check if cleaning needed before any allocation
  let needs_clean = clean && url.find('?').is_some();
  if url.starts_with("//") {
    // A network-path reference inherits only the base scheme.
    let scheme = origin.and_then(BaseUrl::split).map_or("https", |base| {
      &base.root[..base.root.find(':').unwrap_or(0)]
    });
    let mut resolved = String::with_capacity(scheme.len() + 1 + url.len());
    resolved.push_str(scheme);
    resolved.push(':');
    resolved.push_str(url);
    return cleaned(resolved, needs_clean);
  }
  if let Some(orig) = origin {
    // An explicit scheme (`mailto:`, `https:`, …) means absolute.
    let scan = scan_reference(url);
    if !scan.scheme {
      let resolved = match BaseUrl::split(orig) {
        Some(base) => join_base_url(&base, url, &scan),
        None => join_origin_prefix(orig, url),
      };
      return cleaned(resolved, needs_clean);
    }
  }
  if needs_clean {
    strip_tracking_params(url)
  } else {
    Cow::Borrowed(url)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn empty_link_href_applies_url_preprocessing() {
    for href in ["#", "javascript:void(0)", "data:text/html,x", "vbscript:x"] {
      assert!(is_empty_link_href(href), "{href:?}");
    }
    // Leading C0 controls and spaces are ignored by the URL parser.
    for href in [
      " javascript:void(0)",
      "\tjavascript:void(0)",
      "\njavascript:void(0)",
      "\rjavascript:void(0)",
      "\u{1}javascript:void(0)",
      "  \t javascript:void(0)",
      " data:text/html,x",
      " vbscript:x",
    ] {
      assert!(is_empty_link_href(href), "{href:?}");
    }
    // Tab, LF and CR are removed anywhere in the scheme.
    for href in [
      "java\tscript:void(0)",
      "java\nscript:void(0)",
      "java\rscript:void(0)",
      "j\ta\nv\ra\tscript:void(0)",
      "javascript\t:void(0)",
      "da\tta:x",
      "vb\tscript:x",
      " java\tscript:void(0)",
    ] {
      assert!(is_empty_link_href(href), "{href:?}");
    }
    // Case folding, with controls interleaved.
    for href in [
      "JavaScript:x",
      " JAVASCRIPT:x",
      "\tJaVa\tScRiPt:x",
      "DATA:x",
    ] {
      assert!(is_empty_link_href(href), "{href:?}");
    }
    // A bare `#` keeps its meaning through surrounding whitespace.
    for href in [" # ", "#\t", "\t#", "\n#\r"] {
      assert!(is_empty_link_href(href), "{href:?}");
    }

    // An interior space is NOT removed, so the scheme is not `javascript:`.
    for href in [
      "java script:x",
      "notjavascript:x",
      "/javascript/guide",
      "https://x.com/a",
      "javascript",
      "#section",
      " #section",
      "#a\tb",
      "",
      "   ",
      "mailto:a@b.c",
    ] {
      assert!(!is_empty_link_href(href), "{href:?}");
    }
    // Only ASCII letters case-fold: `\u{1a}` must not be read as `:`.
    assert!(!is_empty_link_href("javascript\u{1a}x"));
    // A non-breaking space is not ASCII whitespace and is not stripped.
    assert!(!is_empty_link_href("\u{a0}javascript:x"));
  }

  #[test]
  fn autolink_uri_detection() {
    assert!(is_autolink_uri("https://example.com"));
    assert!(is_autolink_uri("http://example.com/a"));
    assert!(is_autolink_uri("ftp://host/file"));
    assert!(is_autolink_uri("mailto:a@b.com"));
    assert!(!is_autolink_uri("/relative/path"));
    assert!(!is_autolink_uri("example.com"));
    // whitespace / angle brackets break autolink syntax
    assert!(!is_autolink_uri("https://example.com/a b"));
    assert!(!is_autolink_uri("https://example.com/<x>"));
  }

  #[test]
  fn tracking_param_detection() {
    assert!(is_tracking_param("utm_source"));
    assert!(is_tracking_param("fbclid"));
    assert!(is_tracking_param("gclid"));
    assert!(!is_tracking_param("id"));
    assert!(!is_tracking_param("page"));
  }

  #[test]
  fn strip_tracking_borrows_when_clean() {
    // no query — borrowed, untouched
    assert!(matches!(
      strip_tracking_params("https://x.com/a"),
      Cow::Borrowed(_)
    ));
    // query with only non-tracking params — borrowed
    assert!(matches!(
      strip_tracking_params("https://x.com/a?id=1"),
      Cow::Borrowed(_)
    ));
  }

  #[test]
  fn strip_tracking_removes_params() {
    assert_eq!(
      strip_tracking_params("https://x.com/a?utm_source=n"),
      "https://x.com/a"
    );
    assert_eq!(
      strip_tracking_params("https://x.com/a?id=1&utm_source=n&page=2"),
      "https://x.com/a?id=1&page=2",
    );
    // all params stripped, fragment preserved
    assert_eq!(
      strip_tracking_params("https://x.com/a?utm_source=n#sec"),
      "https://x.com/a#sec",
    );
    // mixed kept + tracking, fragment preserved
    assert_eq!(
      strip_tracking_params("https://x.com/a?id=1&fbclid=z#sec"),
      "https://x.com/a?id=1#sec",
    );
    // trailing tracking param takes the separator before it
    assert_eq!(
      strip_tracking_params("https://x.com/a?id=1&utm_source=n"),
      "https://x.com/a?id=1",
    );
    // adjacent tracking params
    assert_eq!(
      strip_tracking_params("https://x.com/a?utm_a=1&utm_b=2&id=3"),
      "https://x.com/a?id=3",
    );
    assert_eq!(
      strip_tracking_params("https://x.com/a?utm_a=1&fbclid=2"),
      "https://x.com/a",
    );
    // a fragment before the query makes the whole thing opaque
    assert_eq!(
      strip_tracking_params("https://x.com/a#s?utm_source=n"),
      "https://x.com/a#s?utm_source=n",
    );
  }

  #[test]
  fn resolve_url_passthrough() {
    // empty and fragment-only are borrowed unchanged
    assert_eq!(resolve_url("", None, false), "");
    assert_eq!(
      resolve_url("#anchor", Some("https://x.com"), true),
      "#anchor"
    );
    // absolute URL with no origin and no cleaning — unchanged
    assert_eq!(
      resolve_url("https://x.com/a", None, false),
      "https://x.com/a"
    );
  }

  #[test]
  fn resolve_url_protocol_relative() {
    assert_eq!(
      resolve_url("//cdn.x.com/a.js", None, false),
      "https://cdn.x.com/a.js"
    );
  }

  #[test]
  fn resolve_url_relative_against_origin() {
    assert_eq!(
      resolve_url("page", Some("https://x.com"), false),
      "https://x.com/page",
    );
    assert_eq!(
      resolve_url("./sub", Some("https://x.com"), false),
      "https://x.com/sub",
    );
    assert_eq!(
      resolve_url("./sub", Some("https://x.com/"), false),
      "https://x.com/sub",
    );
    assert_eq!(
      resolve_url("/path", Some("https://x.com/"), false),
      "https://x.com/path",
    );
  }

  #[test]
  fn resolve_url_resolves_relative_references() {
    // The dual-engine table in packages/mdream/test/unit/nodes/links.test.ts
    // covers the scenarios; this pins the mechanics for `cargo test`.
    let doc = Some("https://x.com/a/b/doc.html?q=1#frag");
    assert_eq!(
      resolve_url("c.html", doc, false),
      "https://x.com/a/b/c.html"
    );
    assert_eq!(
      resolve_url("../c.html", doc, false),
      "https://x.com/a/c.html"
    );
    assert_eq!(resolve_url("/a/../c", doc, false), "https://x.com/c");
    assert_eq!(resolve_url("../../../c", doc, false), "https://x.com/c");
    assert_eq!(resolve_url("..", doc, false), "https://x.com/a/");
    assert_eq!(resolve_url("c//d", doc, false), "https://x.com/a/b/c//d");
    assert_eq!(
      resolve_url("c.html?p=../x#f", doc, false),
      "https://x.com/a/b/c.html?p=../x#f",
    );
    assert_eq!(
      resolve_url("?p=2", doc, false),
      "https://x.com/a/b/doc.html?p=2"
    );
  }

  #[test]
  fn resolve_url_origin_without_authority_is_a_prefix() {
    // A plain prefix keeps an unsafe origin recognisable downstream.
    assert_eq!(
      resolve_url("/safe", Some("javascript:alert(1)"), false),
      "javascript:alert(1)/safe",
    );
    assert_eq!(resolve_url("b.html", Some("docs"), false), "docs/b.html");
  }

  #[test]
  fn resolve_url_cleans_when_requested() {
    assert_eq!(
      resolve_url("/p?utm_source=n", Some("https://x.com"), true),
      "https://x.com/p",
    );
    // clean disabled — tracking param kept
    assert_eq!(
      resolve_url("/p?utm_source=n", Some("https://x.com"), false),
      "https://x.com/p?utm_source=n",
    );
    // A query-like suffix inside the fragment is opaque.
    assert_eq!(
      resolve_url("https://x.com/#/route?utm_source=n&keep=1", None, true),
      "https://x.com/#/route?utm_source=n&keep=1",
    );
  }

  #[test]
  fn slugify_basic() {
    assert_eq!(slugify_heading("Hello World"), "hello-world");
    assert_eq!(slugify_heading("  Trim Me  "), "trim-me");
    // `_` is treated as a markdown emphasis marker and stripped
    assert_eq!(slugify_heading("Keep_Underscore"), "keepunderscore");
    // collapse repeated separators
    assert_eq!(slugify_heading("a -- b"), "a-b");
    // strip punctuation
    assert_eq!(slugify_heading("What's New?!"), "whats-new");
  }

  #[test]
  fn scheme_urls_never_joined_to_origin() {
    // explicit schemes must pass through untouched, not get origin-prefixed
    assert_eq!(
      resolve_url("mailto:a@b.com", Some("https://x.com"), false),
      "mailto:a@b.com"
    );
    assert_eq!(
      resolve_url("ftp://h/f", Some("https://x.com"), false),
      "ftp://h/f"
    );
    assert_eq!(
      resolve_url("tel:123", Some("https://x.com"), true),
      "tel:123"
    );
  }

  #[test]
  fn slugify_strips_inline_markdown() {
    // links reduce to their text
    assert_eq!(
      slugify_heading("See [the docs](https://x.com)"),
      "see-the-docs"
    );
    // emphasis / code markers dropped
    assert_eq!(slugify_heading("*bold* and `code`"), "bold-and-code");
    assert_eq!(
      slugify_heading("<a href=\"#section\">Section</a>"),
      "section"
    );
    assert_eq!(slugify_heading("<http://x>"), "httpx");
    assert_eq!(slugify_heading(r"\<span\>"), "span");
    assert_eq!(slugify_heading("`<span>`"), "span");
    assert_eq!(slugify_heading("`foo_bar"), "foobar");
    assert_eq!(slugify_heading("``foo_bar`"), "foobar");
    assert_eq!(slugify_heading("``foo_bar``"), "foo_bar");
    assert_eq!(slugify_heading("`` `foo_bar`"), "foo_bar");
    assert_eq!(
      slugify_heading(r#"`foo_bar<span title="`"></span>"#),
      "foobar"
    );
    assert_eq!(
      slugify_heading(r#"`foo_bar\<span title="`"></span>"#),
      "foo_barspan-title"
    );
    assert_eq!(
      slugify_heading(r#"`foo_bar\\<span title="`"></span>"#),
      "foobar"
    );
    assert_eq!(slugify_heading(r"\`foo_bar"), "foobar");
    assert_eq!(slugify_heading(r"`foo\_bar"), "foo_bar");
    assert_eq!(slugify_heading(r"`foo_bar\`"), "foo_bar");
    assert_eq!(slugify_heading(r"`foo_bar\` baz_qux`"), "foo_bar-bazqux");
  }
}
