//! Plugin output: frontmatter YAML generation and assembly.

use super::*;

/// Both collections are bounded independently of document length: extracted
/// metadata is deduplicated against the fixed defaults plus `meta_fields`,
/// while additional fields come directly from trusted plugin configuration. A
/// small stable insertion sort avoids linking Rust's general-purpose stable
/// sorter into the Edge WASM build.
fn sort_fields_by_key<T, F>(fields: &mut [T], key: F)
where
  F: for<'a> Fn(&'a T) -> &'a str,
{
  for index in 1..fields.len() {
    let mut position = index;
    while position > 0 && key(&fields[position]) < key(&fields[position - 1]) {
      fields.swap(position, position - 1);
      position -= 1;
    }
  }
}

/// Words a YAML 1.1 or 1.2 reader resolves to null or a boolean.
const YAML_IMPLICIT_WORDS: [&str; 10] = [
  "null", "true", "false", "yes", "no", "on", "off", "y", "n", "~",
];

/// Format `val` as a YAML scalar.
///
/// A plain scalar takes every byte literally, including a backslash, so it is
/// kept when YAML reads it as written. An empty value reads as null, and an
/// indicator first byte starts other syntax. A space, `:`, `#`, `"`, line break
/// or control character also forces quotes. Inside double quotes a backslash
/// starts an escape, so backslashes, quotes and non-printable characters are
/// escaped there, and only there.
///
/// Text read from the page is a string, so with `as_string` a value a reader
/// would resolve to a number, date, boolean or null is quoted too. Configured
/// fields keep that typing: `draft: true` is meant as a boolean.
fn yaml_scalar(val: &str, as_string: bool) -> String {
  let bytes = val.as_bytes();
  let quote = match bytes {
    [] => true,
    [first, rest @ ..] => {
      matches!(
        first,
        b','
          | b'['
          | b']'
          | b'{'
          | b'}'
          | b'&'
          | b'*'
          | b'!'
          | b'|'
          | b'>'
          | b'\''
          | b'%'
          | b'@'
          | b'`'
      ) || (rest.is_empty() && matches!(first, b'-' | b'?'))
        || bytes
          .iter()
          .any(|&b| matches!(b, b':' | b'#' | b' ' | b'"'))
        || val.chars().any(|c| c.is_control() && c != '\t')
        || (as_string
          // Numbers, dates, `.inf` and `.nan` start with one of these.
          && (matches!(first, b'0'..=b'9' | b'.' | b'+')
            || (*first == b'-' && matches!(rest.first(), Some(b'0'..=b'9' | b'.')))
            || YAML_IMPLICIT_WORDS
              .iter()
              .any(|word| val.eq_ignore_ascii_case(word))))
    }
  };
  if !quote {
    return val.to_string();
  }
  let mut out = String::with_capacity(val.len() + 2);
  out.push('"');
  for ch in val.chars() {
    match ch {
      '\\' => out.push_str("\\\\"),
      '"' => out.push_str("\\\""),
      // A raw break folds to a space, and under `meta:` it ends the mapping.
      '\n' => out.push_str("\\n"),
      '\r' => out.push_str("\\r"),
      '\t' => out.push('\t'),
      // YAML allows no other control character in a scalar, U+0000 included.
      _ if ch.is_control() => {
        let code = ch as u32;
        out.push_str("\\x");
        out.push(char::from_digit(code >> 4, 16).unwrap_or('0'));
        out.push(char::from_digit(code & 0xF, 16).unwrap_or('0'));
      }
      _ => out.push(ch),
    }
  }
  out.push('"');
  out
}

impl ConvertState {
  pub(crate) fn generate_frontmatter_yaml(&mut self) {
    if self.format != OutputFormat::Markdown {
      return;
    }

    let f_opts = self
      .options
      .plugins
      .as_ref()
      .and_then(|p| p.frontmatter.as_ref());

    let mut yaml_out = Vec::new();
    if let Some(t) = &self.frontmatter_title {
      yaml_out.push(format!("title: {}", yaml_scalar(t, true)));
    }

    if let Some(f) = f_opts
      && let Some(add) = &f.additional_fields
    {
      let mut sorted: Vec<_> = add.iter().collect();
      sort_fields_by_key(&mut sorted, |(key, _)| key);
      for (key, val) in sorted {
        if key != "title" && key != "description" {
          yaml_out.push(format!("{}: {}", key, yaml_scalar(val, false)));
        }
      }
    }

    if !self.frontmatter_meta.is_empty() {
      yaml_out.push("meta:".to_string());
      sort_fields_by_key(&mut self.frontmatter_meta, |(key, _)| key);
      for (key, val) in &self.frontmatter_meta {
        let k_fmt = if key.contains(':') {
          format!("\"{key}\"")
        } else {
          key.clone()
        };
        yaml_out.push(format!("  {}: {}", k_fmt, yaml_scalar(val, true)));
      }
    }

    if !yaml_out.is_empty() {
      let frontmatter_content = format!("---\n{}\n---\n\n", yaml_out.join("\n"));
      self.emit_frontmatter(&frontmatter_content);
    }
  }

  /// Assemble frontmatter entries (title, meta, plugin additional fields).
  /// Returns `Some` with collected entries when the frontmatter plugin is active.
  pub fn frontmatter(&self) -> Option<Vec<(String, String)>> {
    if !self.has_frontmatter {
      return None;
    }
    let mut entries: Vec<(String, String)> = Vec::new();
    if let Some(title) = &self.frontmatter_title {
      entries.push(("title".to_string(), title.clone()));
    }
    for (k, v) in &self.frontmatter_meta {
      entries.push((k.clone(), v.clone()));
    }
    if let Some(add) = self
      .options
      .plugins
      .as_ref()
      .and_then(|p| p.frontmatter.as_ref())
      .and_then(|f| f.additional_fields.as_ref())
    {
      for (k, v) in add {
        if k != "title" && k != "description" {
          entries.push((k.clone(), v.clone()));
        }
      }
    }
    Some(entries)
  }
}

#[cfg(test)]
mod tests {
  use super::sort_fields_by_key;

  #[test]
  fn field_sort_is_ordered_and_stable() {
    let mut fields = [("b", 0), ("a", 1), ("a", 2), ("c", 3)];
    sort_fields_by_key(&mut fields, |(key, _)| key);
    assert_eq!(fields, [("a", 1), ("a", 2), ("b", 0), ("c", 3)]);
  }
}
