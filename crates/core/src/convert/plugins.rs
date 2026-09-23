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

/// Format `val` as a YAML scalar that reads back as `val`.
///
/// A plain scalar takes every byte literally, including a backslash, so it is
/// kept when YAML reads it as written. An empty value reads as null, and an
/// indicator first byte starts other syntax. A space, `:`, `#`, `"` or line break
/// also forces quotes. Inside double quotes a backslash starts an escape, so
/// backslashes, quotes and line breaks are escaped there, and only there.
fn yaml_scalar(val: &str) -> String {
  let bytes = val.as_bytes();
  let quote = match bytes.first() {
    None => true,
    Some(&first) => {
      matches!(
        first,
        b'-'
          | b'?'
          | b','
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
      ) || bytes
        .iter()
        .any(|&b| matches!(b, b'\n' | b'\r' | b':' | b'#' | b' ' | b'"'))
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

    let format_val = yaml_scalar;

    let mut yaml_out = Vec::new();
    if let Some(t) = &self.frontmatter_title {
      yaml_out.push(format!("title: {}", format_val(t)));
    }

    if let Some(f) = f_opts
      && let Some(add) = &f.additional_fields
    {
      let mut sorted: Vec<_> = add.iter().collect();
      sort_fields_by_key(&mut sorted, |(key, _)| key);
      for (key, val) in sorted {
        if key != "title" && key != "description" {
          yaml_out.push(format!("{}: {}", key, format_val(val)));
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
        yaml_out.push(format!("  {}: {}", k_fmt, format_val(val)));
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
