//! CSS selector parsing and element matching.

use crate::types::{ElementNode, ParsedSelector};

#[derive(Debug, Clone)]
pub(crate) enum ParsedSelectorList {
  Single(ParsedSelector),
  Multiple(Vec<ParsedSelector>),
}

pub(crate) fn parse_css_selector_list(selector: &str) -> ParsedSelectorList {
  let selector = selector.trim();
  if selector.is_empty() {
    return ParsedSelectorList::Single(parse_css_selector(selector));
  }

  let mut selectors = Vec::new();
  let mut start = 0;
  let mut in_attr = false;
  let mut quote = None;
  let mut escaped = false;

  for (index, ch) in selector.char_indices() {
    if let Some(active_quote) = quote {
      if escaped {
        escaped = false;
      } else if ch == '\\' {
        escaped = true;
      } else if ch == active_quote {
        quote = None;
      }
      continue;
    }
    if in_attr {
      if ch == '"' || ch == '\'' {
        quote = Some(ch);
      } else if ch == ']' {
        in_attr = false;
      }
      continue;
    }
    if ch == '[' {
      in_attr = true;
    } else if ch == ',' {
      let part = selector[start..index].trim();
      if part.is_empty() {
        return ParsedSelectorList::Single(ParsedSelector::Tag(selector.to_string()));
      }
      selectors.push(parse_css_selector(part));
      start = index + ch.len_utf8();
    }
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
  let mut in_attr = false;

  for ch in selector.chars() {
    if ch == '[' {
      if !current.is_empty() {
        parts.push(parse_simple_selector(&current));
        current.clear();
      }
      in_attr = true;
      current.push(ch);
      continue;
    }
    if ch == ']' {
      if in_attr {
        current.push(ch);
        in_attr = false;
        parts.push(parse_attr_selector(&current));
        current.clear();
      }
      continue;
    }
    if in_attr {
      current.push(ch);
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
  let inner = &s[1..s.len() - 1];
  let operators = ["^=", "$=", "*=", "~=", "|=", "="];
  for op in &operators {
    if let Some(pos) = inner.find(op) {
      let name = inner[..pos].trim().to_string();
      let val = inner[pos + op.len()..]
        .trim()
        .trim_matches(|c| c == '"' || c == '\'')
        .to_string();
      return ParsedSelector::Attribute {
        name,
        operator: Some((*op).to_string()),
        value: Some(val),
      };
    }
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
      .is_some_and(|c| c.split_whitespace().any(|cls| cls == class_name)),
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
        (Some("^="), Some(v)) => attr_val.starts_with(v),
        (Some("$="), Some(v)) => attr_val.ends_with(v),
        (Some("*="), Some(v)) => attr_val.contains(v),
        (Some("~="), Some(v)) => attr_val.split_whitespace().any(|w| w == v),
        (Some("|="), Some(v)) => attr_val == v || attr_val.starts_with(&format!("{v}-")),
        _ => false,
      },
    },
    ParsedSelector::Compound(parts) => parts.iter().all(|p| matches_selector(tag, p)),
  }
}

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
  fn strips_quotes_from_attribute_value() {
    match parse_css_selector("[alt=\"hello\"]") {
      ParsedSelector::Attribute { value, .. } => assert_eq!(value.as_deref(), Some("hello")),
      _ => panic!("expected attribute selector"),
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
