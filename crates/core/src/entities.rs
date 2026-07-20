use std::borrow::Cow;

#[path = "entities_generated.rs"]
mod generated;

use generated::{
  MAX_ENTITY_NAME_LENGTH, MAX_LEGACY_ENTITY_NAME_LENGTH, lookup_legacy_named_entity,
  lookup_named_entity,
};

#[inline]
pub(crate) fn decode_html_entities(text: &str) -> Cow<'_, str> {
  decode_html_entities_in_context(text, false)
}

#[inline]
pub(crate) fn decode_html_attribute_entities(text: &str) -> Cow<'_, str> {
  decode_html_entities_in_context(text, true)
}

#[inline]
fn decode_html_entities_in_context(text: &str, in_attribute: bool) -> Cow<'_, str> {
  if !text.as_bytes().contains(&b'&') {
    return Cow::Borrowed(text);
  }
  Cow::Owned(decode_html_entities_alloc(text, in_attribute))
}

/// Resolve a numeric character reference value per the HTML standard.
fn decode_numeric_ref(code: u32) -> char {
  // Undefined Windows-1252 slots intentionally retain their C1 controls.
  const C1_REPLACEMENTS: [u32; 32] = [
    0x20AC, 0x0081, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039,
    0x0152, 0x008D, 0x017D, 0x008F, 0x0090, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
    0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x009D, 0x017E, 0x0178,
  ];

  let code = if (0x80..=0x9F).contains(&code) {
    C1_REPLACEMENTS[(code - 0x80) as usize]
  } else {
    code
  };
  if code == 0 || code > 0x10_FFFF || (0xD800..=0xDFFF).contains(&code) {
    return '\u{FFFD}';
  }
  char::from_u32(code).unwrap_or('\u{FFFD}')
}

#[inline]
fn is_ascii_alphanumeric(byte: u8) -> bool {
  byte.is_ascii_alphanumeric()
}

fn decode_html_entities_alloc(text: &str, in_attribute: bool) -> String {
  let bytes = text.as_bytes();
  let len = bytes.len();
  let mut result = String::with_capacity(len);
  let mut i = 0;

  while i < len {
    if bytes[i] != b'&' {
      let plain_start = i;
      while i < len && bytes[i] != b'&' {
        i += 1;
      }
      result.push_str(&text[plain_start..i]);
      continue;
    }

    // Consume numeric references through the first non-digit. The semicolon
    // is optional; overflow saturates while all remaining digits are consumed.
    if i + 2 < len && bytes[i + 1] == b'#' {
      let mut end = i + 2;
      let is_hex = bytes[end] == b'x' || bytes[end] == b'X';
      if is_hex {
        end += 1;
      }
      let digit_start = end;
      let radix = if is_hex { 16 } else { 10 };
      let mut code_point = 0u32;

      while end < len {
        let digit = match bytes[end] {
          b'0'..=b'9' => Some(u32::from(bytes[end] - b'0')),
          b'A'..=b'F' if is_hex => Some(u32::from(bytes[end] - b'A' + 10)),
          b'a'..=b'f' if is_hex => Some(u32::from(bytes[end] - b'a' + 10)),
          _ => None,
        };
        let Some(digit) = digit else {
          break;
        };
        code_point = code_point
          .saturating_mul(radix)
          .saturating_add(digit)
          .min(0x11_0000);
        end += 1;
      }

      if end > digit_start {
        result.push(decode_numeric_ref(code_point));
        if end < len && bytes[end] == b';' {
          end += 1;
        }
        i = end;
        continue;
      }
    }

    // A canonical name includes a semicolon. If that misses, find the longest
    // legacy name prefix; only those 106 names may omit their semicolon.
    let name_start = i + 1;
    let mut name_end = name_start;
    let scan_end = len.min(name_start + MAX_ENTITY_NAME_LENGTH);
    while name_end < scan_end && is_ascii_alphanumeric(bytes[name_end]) {
      name_end += 1;
    }

    if name_end > name_start
      && name_end < len
      && bytes[name_end] == b';'
      && let Some(replacement) = lookup_named_entity(&bytes[name_start..name_end])
    {
      result.push_str(replacement);
      i = name_end + 1;
      continue;
    }

    let mut legacy_end = name_end.min(name_start + MAX_LEGACY_ENTITY_NAME_LENGTH);
    let mut decoded_legacy = false;
    while legacy_end > name_start {
      let name = &bytes[name_start..legacy_end];
      if let Some(replacement) = lookup_legacy_named_entity(name) {
        let next = bytes.get(legacy_end).copied();
        let ambiguous_attribute =
          in_attribute && next.is_some_and(|byte| byte == b'=' || is_ascii_alphanumeric(byte));
        if !ambiguous_attribute {
          result.push_str(replacement);
          i = legacy_end;
          decoded_legacy = true;
        }
        break;
      }
      legacy_end -= 1;
    }
    if decoded_legacy {
      continue;
    }

    result.push('&');
    i += 1;
  }

  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn no_ampersand_borrows() {
    assert!(matches!(
      decode_html_entities("plain text"),
      Cow::Borrowed(_)
    ));
  }

  #[test]
  fn decodes_canonical_names_using_the_longest_match() {
    assert_eq!(decode_html_entities("&copy; &notin; &thetasym;"), "© ∉ ϑ");
    assert_eq!(decode_html_entities("&notit;"), "¬it;");
  }

  #[test]
  fn decodes_semicolonless_numeric_references_without_swallowing() {
    assert_eq!(
      decode_html_entities("&#65 &#x41; &#65copy; &#x41zz;"),
      "A A Acopy; Azz;"
    );
  }

  #[test]
  fn numeric_references_follow_html_replacement_rules() {
    assert_eq!(
      decode_html_entities("&#x80; &#0; &#xD800; &#x110000; &#999999999999999999999;"),
      "€ � � � �"
    );
  }

  #[test]
  fn named_references_preserve_nbsp_and_legacy_uppercase_names() {
    assert_eq!(decode_html_entities("&nbsp;"), "\u{00A0}");
    assert_eq!(decode_html_entities("&COPY;"), "©");
  }

  #[test]
  fn attribute_ambiguity_only_applies_to_legacy_names() {
    assert_eq!(
      decode_html_attribute_entities("&copycat &copy=1 &copy! &copy;cat"),
      "&copycat &copy=1 ©! ©cat"
    );
    assert_eq!(decode_html_entities("&copycat"), "©cat");
  }

  #[test]
  fn unknown_references_do_not_scan_to_a_later_semicolon() {
    assert_eq!(decode_html_entities("&bogus &#65;"), "&bogus A");
    assert_eq!(decode_html_entities("&#nope; &#xnope;"), "&#nope; &#xnope;");
  }
}
