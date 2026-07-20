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
  let has_scheme = s.starts_with("http://")
    || s.starts_with("https://")
    || s.starts_with("ftp://")
    || s.starts_with("mailto:");
  if !has_scheme {
    return false;
  }
  !s.bytes()
    .any(|b| b == b' ' || b == b'<' || b == b'>' || b == b'\n' || b == b'\r' || b == b'\t')
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

/// GFM-style slug from heading text: lowercase, collapse whitespace/- → -, strip non-alnum except -_
pub(crate) fn slugify_heading(text: &str) -> String {
  // Strip inline markdown formatting from heading text
  // Remove [text](url) → text, strip *_`~
  let mut cleaned = String::with_capacity(text.len());
  let bytes = text.as_bytes();
  let len = bytes.len();
  let mut i = 0;
  while i < len {
    if bytes[i] == b'[' {
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

#[inline]
pub(crate) fn resolve_url<'a>(url: &'a str, origin: Option<&str>, clean: bool) -> Cow<'a, str> {
  if url.is_empty() || url.starts_with('#') {
    return Cow::Borrowed(url);
  }

  // Fast path: check if cleaning needed before any allocation
  let needs_clean = clean && url.as_bytes().contains(&b'?');
  if url.starts_with("//") {
    let mut resolved = String::with_capacity(6 + url.len());
    resolved.push_str("https:");
    resolved.push_str(url);
    return Cow::Owned(if needs_clean {
      strip_tracking_params_owned(resolved)
    } else {
      resolved
    });
  }
  if let Some(orig) = origin {
    let orig = orig.trim_end_matches('/');
    if url.starts_with('/') {
      let mut resolved = String::with_capacity(orig.len() + url.len());
      resolved.push_str(orig);
      resolved.push_str(url);
      return Cow::Owned(if needs_clean {
        strip_tracking_params_owned(resolved)
      } else {
        resolved
      });
    }
    if let Some(suffix) = url.strip_prefix("./") {
      let mut resolved = String::with_capacity(orig.len() + 1 + suffix.len());
      resolved.push_str(orig);
      resolved.push('/');
      resolved.push_str(suffix);
      return Cow::Owned(if needs_clean {
        strip_tracking_params_owned(resolved)
      } else {
        resolved
      });
    }
    // A url with an explicit scheme (`mailto:`, `ftp:`, `https:`, …) is
    // absolute — only scheme-less urls are joined against the origin.
    // Checked here rather than up-front so the common relative/`/`-prefixed
    // paths never pay for the scan.
    let has_scheme = url.find(':').is_some_and(|ci| {
      ci > 0
        && url[..ci]
          .bytes()
          .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'-' | b'.'))
    });
    if !has_scheme {
      let suffix = url.strip_prefix('/').unwrap_or(url);
      let mut resolved = String::with_capacity(orig.len() + 1 + suffix.len());
      resolved.push_str(orig);
      resolved.push('/');
      resolved.push_str(suffix);
      return Cow::Owned(if needs_clean {
        strip_tracking_params_owned(resolved)
      } else {
        resolved
      });
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
    // root-relative
    assert_eq!(
      resolve_url("/path", Some("https://x.com/"), false),
      "https://x.com/path",
    );
    // ./ prefix
    assert_eq!(
      resolve_url("./sub", Some("https://x.com"), false),
      "https://x.com/sub",
    );
    // bare relative
    assert_eq!(
      resolve_url("page", Some("https://x.com"), false),
      "https://x.com/page",
    );
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
  fn relative_join_no_double_slash() {
    // trailing slash on origin must not produce `//`
    assert_eq!(
      resolve_url("./sub", Some("https://x.com/"), false),
      "https://x.com/sub"
    );
    assert_eq!(
      resolve_url("/p", Some("https://x.com/"), false),
      "https://x.com/p"
    );
    assert_eq!(
      resolve_url("page", Some("https://x.com/"), false),
      "https://x.com/page"
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
  }
}
