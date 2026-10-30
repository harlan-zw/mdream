//! CSS selector parsing and element matching.

use crate::types::{ElementNode, ParsedSelector};

#[derive(Debug, Clone)]
pub(crate) enum ParsedSelectorList {
  Single(ParsedSelector),
  Multiple(Vec<ParsedSelector>),
}

fn attribute_end(selector: &str, open: usize) -> Option<usize> {
  let bytes = selector.as_bytes();
  let mut index = open + 1;
  let mut quote = 0;
  while index < bytes.len() {
    let byte = bytes[index];
    if byte == b'\\' {
      index += 2;
      continue;
    }
    if quote != 0 {
      if byte == quote {
        quote = 0;
      }
    } else if byte == b'"' || byte == b'\'' {
      quote = byte;
    } else if byte == b']' {
      return Some(index);
    }
    index += 1;
  }
  None
}

/// Parses a comma-separated selector list while preserving attribute values.
pub(crate) fn parse_css_selector_list(selector: &str) -> ParsedSelectorList {
  let selector = selector.trim();
  if selector.is_empty() {
    return ParsedSelectorList::Single(parse_css_selector(selector));
  }

  let mut selectors = Vec::new();
  let mut start = 0;
  let mut index = 0;

  while index < selector.len() {
    let byte = selector.as_bytes()[index];
    if byte == b'[' {
      let Some(end) = attribute_end(selector, index) else {
        break;
      };
      index = end;
    } else if byte == b',' {
      let part = selector[start..index].trim();
      if part.is_empty() {
        return ParsedSelectorList::Single(ParsedSelector::Tag(selector.to_string()));
      }
      selectors.push(parse_css_selector(part));
      start = index + 1;
    }
    index += 1;
  }

  if selectors.is_empty() {
    return ParsedSelectorList::Single(parse_css_selector(selector));
  }

  let last = selector[start..].trim();
  if last.is_empty() {
    return ParsedSelectorList::Single(ParsedSelector::Tag(selector.to_string()));
  }
  selectors.push(parse_css_selector(last));
  ParsedSelectorList::Multiple(selectors)
}

pub(crate) fn parse_css_selector(selector: &str) -> ParsedSelector {
  let selector = selector.trim();
  if selector.is_empty() {
    return ParsedSelector::Tag(String::new());
  }
  let mut parts: Vec<ParsedSelector> = Vec::new();
  let mut current = String::new();
  let mut index = 0;

  while let Some(ch) = selector[index..].chars().next() {
    if ch == '[' {
      if !current.is_empty() {
        parts.push(parse_simple_selector(&current));
        current.clear();
      }
      let Some(end) = attribute_end(selector, index) else {
        current.push_str(&selector[index..]);
        break;
      };
      parts.push(parse_attr_selector(&selector[index..=end]));
      index = end + 1;
      continue;
    }
    index += ch.len_utf8();
    if ch == ']' {
      continue;
    }
    if (ch == '.' || ch == '#') && !current.is_empty() {
      parts.push(parse_simple_selector(&current));
      current.clear();
    }
    current.push(ch);
  }
  if !current.is_empty() {
    parts.push(parse_simple_selector(&current));
  }

  if parts.is_empty() {
    ParsedSelector::Tag(String::new())
  } else if parts.len() == 1 {
    parts
      .into_iter()
      .next()
      .unwrap_or(ParsedSelector::Tag(String::new()))
  } else {
    ParsedSelector::Compound(parts)
  }
}

fn parse_simple_selector(s: &str) -> ParsedSelector {
  if let Some(class) = s.strip_prefix('.') {
    ParsedSelector::Class(class.to_string())
  } else if let Some(id) = s.strip_prefix('#') {
    ParsedSelector::Id(id.to_string())
  } else {
    ParsedSelector::Tag(s.to_string())
  }
}

fn parse_attr_selector(s: &str) -> ParsedSelector {
  if s.len() < 2 {
    return ParsedSelector::Tag(s.to_string());
  }
  let inner = s[1..s.len() - 1].trim_ascii();
  if let Some(eq_index) = inner.find('=') {
    let op_start = if eq_index > 0
      && matches!(
        inner.as_bytes()[eq_index - 1],
        b'^' | b'$' | b'*' | b'~' | b'|'
      ) {
      eq_index - 1
    } else {
      eq_index
    };
    let mut val = inner[eq_index + 1..].trim_ascii();
    if val.len() >= 2
      && matches!(val.as_bytes()[0], b'"' | b'\'')
      && val.as_bytes()[0] == val.as_bytes()[val.len() - 1]
    {
      val = &val[1..val.len() - 1];
    }
    return ParsedSelector::Attribute {
      name: inner[..op_start].trim_ascii().to_string(),
      operator: Some(inner[op_start..=eq_index].to_string()),
      value: Some(val.to_string()),
    };
  }
  ParsedSelector::Attribute {
    name: inner.to_string(),
    operator: None,
    value: None,
  }
}

pub(crate) fn matches_selector(tag: &ElementNode, selector: &ParsedSelector) -> bool {
  match selector {
    ParsedSelector::Tag(name) => tag.name() == name,
    ParsedSelector::Class(class_name) => tag
      .attributes
      .get("class")
      .is_some_and(|c| c.split_ascii_whitespace().any(|cls| cls == class_name)),
    ParsedSelector::Id(id) => tag.attributes.get("id").is_some_and(|v| v == id),
    ParsedSelector::Attribute {
      name,
      operator,
      value,
    } => match tag.attributes.get(name.as_str()) {
      None => false,
      Some(attr_val) => match (operator.as_deref(), value.as_deref()) {
        (None, _) | (_, None) => true,
        (Some("="), Some(v)) => attr_val == v,
        (Some("^="), Some(v)) => !v.is_empty() && attr_val.starts_with(v),
        (Some("$="), Some(v)) => !v.is_empty() && attr_val.ends_with(v),
        (Some("*="), Some(v)) => !v.is_empty() && attr_val.contains(v),
        (Some("~="), Some(v)) => !v.is_empty() && attr_val.split_ascii_whitespace().any(|w| w == v),
        (Some("|="), Some(v)) => attr_val == v || attr_val.starts_with(&format!("{v}-")),
        _ => false,
      },
    },
    ParsedSelector::Compound(parts) => parts.iter().all(|p| matches_selector(tag, p)),
  }
}

/// Returns whether an element matches any selector in a parsed list.
pub(crate) fn matches_selector_list(tag: &ElementNode, selectors: &ParsedSelectorList) -> bool {
  match selectors {
    ParsedSelectorList::Single(selector) => matches_selector(tag, selector),
    ParsedSelectorList::Multiple(selectors) => selectors
      .iter()
      .any(|selector| matches_selector(tag, selector)),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn class_and_word_selectors_use_ascii_whitespace() {
    for (separator, expected) in [
      (' ', true),
      ('\t', true),
      ('\n', true),
      ('\r', true),
      ('\x0c', true),
      ('\u{a0}', false),
      ('\x0b', false),
    ] {
      let mut element = ElementNode::default();
      element.attributes.insert_known(
        crate::consts::ATTR_CLASS,
        Some(&format!("btn{separator}active{separator}primary")),
      );
      for selector in [".active", "[class~=\"active\"]"] {
        assert_eq!(
          matches_selector(&element, &parse_css_selector(selector)),
          expected,
          "{selector} with separator {separator:?}",
        );
      }
    }
  }

  #[test]
  fn parses_tag_class_id() {
    assert!(matches!(parse_css_selector("div"), ParsedSelector::Tag(t) if t == "div"));
    assert!(matches!(parse_css_selector(".card"), ParsedSelector::Class(c) if c == "card"));
    assert!(matches!(parse_css_selector("#main"), ParsedSelector::Id(i) if i == "main"));
  }

  #[test]
  fn parses_bare_attribute() {
    match parse_css_selector("[data-x]") {
      ParsedSelector::Attribute {
        name,
        operator,
        value,
      } => {
        assert_eq!(name, "data-x");
        assert!(operator.is_none());
        assert!(value.is_none());
      }
      _ => panic!("expected attribute selector"),
    }
  }

  #[test]
  fn parses_attribute_operators() {
    for (sel, op) in [
      ("[a=b]", "="),
      ("[a^=b]", "^="),
      ("[a$=b]", "$="),
      ("[a*=b]", "*="),
      ("[a~=b]", "~="),
      ("[a|=b]", "|="),
    ] {
      match parse_css_selector(sel) {
        ParsedSelector::Attribute {
          name,
          operator,
          value,
        } => {
          assert_eq!(name, "a");
          assert_eq!(operator.as_deref(), Some(op));
          assert_eq!(value.as_deref(), Some("b"));
        }
        _ => panic!("expected attribute selector for {sel}"),
      }
    }
  }

  #[test]
  fn empty_attribute_substring_and_word_operands_never_match() {
    for op in ["^=", "$=", "*=", "~="] {
      let selector = parse_css_selector(&format!("[data-value{op}\"\"]"));
      for value in ["", "real"] {
        let mut element = ElementNode::default();
        element
          .attributes
          .insert_custom("data-value".into(), Some(value));
        assert!(
          !matches_selector(&element, &selector),
          "{op} with {value:?}"
        );
      }
      assert!(!matches_selector(&ElementNode::default(), &selector));
    }
  }

  #[test]
  fn strips_quotes_from_attribute_value() {
    match parse_css_selector("[alt=\"hello\"]") {
      ParsedSelector::Attribute { value, .. } => assert_eq!(value.as_deref(), Some("hello")),
      _ => panic!("expected attribute selector"),
    }
  }

  #[test]
  fn preserves_single_quote_attribute_values() {
    for quote in ['"', '\''] {
      let selector = format!("[a{quote}={quote}]");
      match parse_css_selector(&selector) {
        ParsedSelector::Attribute { name, value, .. } => {
          assert_eq!(name, format!("a{quote}"));
          assert_eq!(value, Some(quote.to_string()));
        }
        _ => panic!("expected attribute selector for {selector}"),
      }
    }
  }

  #[test]
  fn preserves_unterminated_attribute_parts() {
    for attribute in ["[data=", "[data=\"a,b", "[data=ação\\"] {
      let ParsedSelector::Compound(parts) = parse_css_selector(&format!("p{attribute}")) else {
        panic!("expected compound selector for {attribute}");
      };
      assert_eq!(parts.len(), 2);
      assert!(matches!(&parts[0], ParsedSelector::Tag(tag) if tag == "p"));
      assert!(matches!(&parts[1], ParsedSelector::Tag(tag) if tag == attribute));

      let ParsedSelectorList::Multiple(selectors) =
        parse_css_selector_list(&format!("span, p{attribute}, a"))
      else {
        panic!("expected selector list for {attribute}");
      };
      assert_eq!(selectors.len(), 2);
      assert!(matches!(&selectors[0], ParsedSelector::Tag(tag) if tag == "span"));
      let ParsedSelector::Compound(parts) = &selectors[1] else {
        panic!("expected compound selector for {attribute}");
      };
      assert_eq!(parts.len(), 2);
      assert!(matches!(&parts[0], ParsedSelector::Tag(tag) if tag == "p"));
      assert!(matches!(&parts[1], ParsedSelector::Tag(tag) if tag == &format!("{attribute}, a")));
    }
  }

  #[test]
  fn trims_only_css_whitespace_around_attribute_values() {
    for separator in [' ', '\t', '\n', '\r', '\x0c', '\u{a0}', '\x0b'] {
      let value = format!("{separator}value{separator}");
      let ParsedSelector::Attribute { value: parsed, .. } =
        parse_css_selector(&format!("[data={value}]"))
      else {
        panic!("expected attribute selector");
      };
      let expected = if matches!(separator, '\u{a0}' | '\x0b') {
        value.as_str()
      } else {
        "value"
      };
      assert_eq!(parsed.as_deref(), Some(expected));
    }
  }

  #[test]
  fn parses_operator_before_attribute_value() {
    let expected = "a^=b$=c*=d~=e|=f=g";
    for op in ["=", "^=", "$=", "*=", "~=", "|="] {
      let selector = format!("[data-code{op}\"{expected}\"]");
      match parse_css_selector(&selector) {
        ParsedSelector::Attribute {
          name,
          operator,
          value,
        } => {
          assert_eq!(name, "data-code");
          assert_eq!(operator.as_deref(), Some(op));
          assert_eq!(value.as_deref(), Some(expected));
        }
        _ => panic!("expected attribute selector for {selector}"),
      }
    }
  }

  #[test]
  fn trims_attribute_presence_name() {
    match parse_css_selector("[ data-code ]") {
      ParsedSelector::Attribute {
        name,
        operator,
        value,
      } => {
        assert_eq!(name, "data-code");
        assert!(operator.is_none());
        assert!(value.is_none());
      }
      _ => panic!("expected attribute selector"),
    }
  }

  #[test]
  fn preserves_quotes_inside_attribute_values() {
    for (selector, expected) in [
      (r#"[ data-code = "'quoted'" ]"#, "'quoted'"),
      (r#"[ data-code = '"quoted"' ]"#, "\"quoted\""),
    ] {
      match parse_css_selector(selector) {
        ParsedSelector::Attribute { value, .. } => {
          assert_eq!(value.as_deref(), Some(expected));
        }
        _ => panic!("expected attribute selector for {selector}"),
      }
    }
  }

  #[test]
  fn keeps_non_css_whitespace_in_attribute_names() {
    for separator in ['\u{a0}', '\x0b'] {
      let expected = format!("{separator}data-code{separator}");
      match parse_css_selector(&format!("[{expected}]")) {
        ParsedSelector::Attribute { name, .. } => assert_eq!(name, expected),
        _ => panic!("expected attribute selector"),
      }
    }
  }

  #[test]
  fn parses_compound_selector() {
    match parse_css_selector("div.card[data-x]") {
      ParsedSelector::Compound(parts) => assert_eq!(parts.len(), 3),
      _ => panic!("expected compound selector"),
    }
  }

  #[test]
  fn preserves_quoted_and_escaped_attribute_delimiters() {
    for (selector, expected) in [
      (
        r#"a[href="/docs/[name].html#section"].active"#,
        "/docs/[name].html#section",
      ),
      (
        r"a[href='/docs/[name].html#section'].active",
        "/docs/[name].html#section",
      ),
      (r#"a[href="a\"]b.c#d"].active"#, r#"a\"]b.c#d"#),
      (r"a[href='a\']b.c#d'].active", r"a\']b.c#d"),
      (r"a[href=a\]b.c#d].active", r"a\]b.c#d"),
      (r#"a[href="a\\"].active"#, r"a\\"),
    ] {
      let ParsedSelector::Compound(parts) = parse_css_selector(selector) else {
        panic!("expected compound selector for {selector}");
      };
      assert_eq!(parts.len(), 3, "{selector}");
      assert!(matches!(&parts[0], ParsedSelector::Tag(tag) if tag == "a"));
      match &parts[1] {
        ParsedSelector::Attribute {
          name,
          operator,
          value,
        } => {
          assert_eq!(name, "href");
          assert_eq!(operator.as_deref(), Some("="));
          assert_eq!(value.as_deref(), Some(expected), "{selector}");
        }
        _ => panic!("expected attribute selector for {selector}"),
      }
      assert!(matches!(&parts[2], ParsedSelector::Class(class) if class == "active"));
    }
  }

  #[test]
  fn preserves_escapes_in_selector_lists() {
    for (selector, expected) in [
      (r#"[data="a,b"]"#, "a,b"),
      (r#"[data="a]b"]"#, "a]b"),
      (r"[data=a\]b\,c]", r"a\]b\,c"),
      (r"[data=a\]b,c]", r"a\]b,c"),
      (r#"[data=a\"b,c]"#, r#"a\"b,c"#),
      (r"[data=a\'b,c]", r"a\'b,c"),
      (r#"[data="a\"]b,c"]"#, r#"a\"]b,c"#),
      (r"[data='a\']b,c']", r"a\']b,c"),
      (r"[data=a\\]", r"a\\"),
      (r"[data=ação\\\]b,c]", r"ação\\\]b,c"),
      (r"[data=a\çb]", r"a\çb"),
      (r"[data=a\🦀b]", r"a\🦀b"),
    ] {
      let ParsedSelectorList::Single(ParsedSelector::Attribute { name, value, .. }) =
        parse_css_selector_list(selector)
      else {
        panic!("expected one attribute selector for {selector}");
      };
      assert_eq!(name, "data");
      assert_eq!(value.as_deref(), Some(expected), "{selector}");

      let ParsedSelectorList::Multiple(parts) =
        parse_css_selector_list(&format!("{selector}.active, span"))
      else {
        panic!("expected a selector list for {selector}");
      };
      assert_eq!(parts.len(), 2, "{selector}");
      let ParsedSelector::Compound(compound) = &parts[0] else {
        panic!("expected a compound selector for {selector}");
      };
      assert_eq!(compound.len(), 2, "{selector}");
      assert!(
        matches!(&compound[0], ParsedSelector::Attribute { value, .. }
        if value.as_deref() == Some(expected)),
        "{selector}"
      );
      assert!(matches!(&compound[1], ParsedSelector::Class(class) if class == "active"));
      assert!(matches!(&parts[1], ParsedSelector::Tag(tag) if tag == "span"));
    }
  }

  #[test]
  fn empty_selector_is_not_a_match_all() {
    // whitespace-only / empty selector must not become Compound([]) (matches everything)
    for sel in ["", "   "] {
      match parse_css_selector(sel) {
        ParsedSelector::Tag(t) => assert!(t.is_empty()),
        _ => panic!("empty selector should be an empty Tag, not Compound([])"),
      }
    }
  }

  #[test]
  fn attribute_selector_trims_name_and_value() {
    match parse_css_selector("[data-x = \"v\"]") {
      ParsedSelector::Attribute { name, value, .. } => {
        assert_eq!(name, "data-x");
        assert_eq!(value.as_deref(), Some("v"));
      }
      _ => panic!("expected attribute selector"),
    }
  }
}
