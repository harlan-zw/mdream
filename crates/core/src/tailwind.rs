//! Tailwind utility-class to Markdown-emphasis mapping.

#[inline]
fn extract_base_class(class: &str) -> (&str, u8) {
  let breakpoints = ["sm:", "md:", "lg:", "xl:", "2xl:"];
  for (index, bp) in breakpoints.into_iter().enumerate() {
    if let Some(rest) = class.strip_prefix(bp) {
      return (rest, index as u8 + 1);
    }
  }
  (class, 0)
}

pub(crate) fn process_tailwind_classes(
  classes_attr: &str,
) -> (Option<String>, Option<String>, bool) {
  let mut prefix = String::new();
  let mut suffix = String::new();

  let mut weight = None::<(u8, bool)>;
  let mut emphasis = None::<(u8, bool)>;
  let mut decoration = false;
  let mut display_hidden = None::<(u8, bool)>;
  let mut position_hidden = None::<(u8, bool)>;

  for cls in classes_attr.split_whitespace() {
    let (base, breakpoint) = extract_base_class(cls);
    let supersedes = |current: Option<(u8, bool)>| {
      current.is_none_or(|(current_breakpoint, _)| breakpoint >= current_breakpoint)
    };
    if base == "italic" {
      if supersedes(emphasis) {
        emphasis = Some((breakpoint, true));
      }
    } else if base == "not-italic" {
      if supersedes(emphasis) {
        emphasis = Some((breakpoint, false));
      }
    } else if base == "font-bold"
      || base == "font-semibold"
      || base == "font-black"
      || base == "font-extrabold"
      || base == "font-medium"
      || base == "bold"
    {
      if supersedes(weight) {
        weight = Some((breakpoint, true));
      }
    } else if base.contains("font-") {
      if supersedes(weight) {
        weight = Some((breakpoint, false));
      }
    } else if base.contains("line-through") || base.contains("underline") {
      decoration = true;
    } else if base == "hidden" || base.contains("invisible") {
      if supersedes(display_hidden) {
        display_hidden = Some((breakpoint, true));
      }
    } else if base == "block" || base == "flex" || base == "inline" {
      if supersedes(display_hidden) {
        display_hidden = Some((breakpoint, false));
      }
    } else if base == "absolute" || base == "fixed" || base == "sticky" {
      if supersedes(position_hidden) {
        position_hidden = Some((breakpoint, true));
      }
    } else if (base == "static" || base == "relative") && supersedes(position_hidden) {
      position_hidden = Some((breakpoint, false));
    }
  }

  if weight.is_some_and(|(_, enabled)| enabled) {
    prefix.push_str("**");
    suffix.push_str("**");
  }
  if emphasis.is_some_and(|(_, enabled)| enabled) {
    prefix.push('*');
    suffix.insert(0, '*');
  }
  if decoration {
    prefix.push_str("~~");
    suffix.insert_str(0, "~~");
  }

  (
    if prefix.is_empty() {
      None
    } else {
      Some(prefix)
    },
    if suffix.is_empty() {
      None
    } else {
      Some(suffix)
    },
    display_hidden.is_some_and(|(_, hidden)| hidden)
      || position_hidden.is_some_and(|(_, hidden)| hidden),
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn font_weight_maps_to_bold() {
    let (p, s, hidden) = process_tailwind_classes("font-bold");
    assert_eq!(p.as_deref(), Some("**"));
    assert_eq!(s.as_deref(), Some("**"));
    assert!(!hidden);
  }

  #[test]
  fn italic_maps_to_emphasis() {
    let (p, s, _) = process_tailwind_classes("italic");
    assert_eq!(p.as_deref(), Some("*"));
    assert_eq!(s.as_deref(), Some("*"));
  }

  #[test]
  fn strikethrough_and_underline() {
    let (p, _, _) = process_tailwind_classes("line-through");
    assert_eq!(p.as_deref(), Some("~~"));
    let (p, _, _) = process_tailwind_classes("underline");
    assert_eq!(p.as_deref(), Some("~~"));
  }

  #[test]
  fn hidden_display_flags_hidden() {
    assert!(process_tailwind_classes("hidden").2);
    assert!(process_tailwind_classes("invisible").2);
    assert!(process_tailwind_classes("absolute").2);
    // a later display class overrides hidden
    assert!(!process_tailwind_classes("hidden block").2);
    assert!(!process_tailwind_classes("absolute relative").2);
  }

  #[test]
  fn responsive_prefix_sorting() {
    // base class (no breakpoint) wins over later breakpoint variants
    let (_, _, hidden) = process_tailwind_classes("md:block hidden");
    // "hidden" (weight 0) sorts before "md:block" (weight 2): block wins last
    assert!(!hidden);

    assert!(process_tailwind_classes("md:block md:hidden").2);
    assert!(!process_tailwind_classes("md:hidden md:block").2);
    assert!(process_tailwind_classes("md:hidden block").2);
  }

  #[test]
  fn responsive_ties_preserve_source_order() {
    let classes = (0..35)
      .map(|index| match index {
        3 => "sm:hidden",
        33 => "sm:block",
        index if index % 2 == 0 => "noop",
        _ => "sm:noop",
      })
      .collect::<Vec<_>>()
      .join(" ");
    assert!(!process_tailwind_classes(&classes).2);
  }

  #[test]
  fn combined_classes_nest_delimiters() {
    let (p, s, _) = process_tailwind_classes("font-bold italic");
    assert_eq!(p.as_deref(), Some("***"));
    assert_eq!(s.as_deref(), Some("***"));
  }

  #[test]
  fn no_recognised_classes_yields_none() {
    let (p, s, hidden) = process_tailwind_classes("text-lg p-4");
    assert!(p.is_none());
    assert!(s.is_none());
    assert!(!hidden);
  }

  #[test]
  fn not_italic_does_not_emphasise() {
    // `not-italic` must not match like `italic`
    let (p, s, _) = process_tailwind_classes("not-italic");
    assert!(p.is_none());
    assert!(s.is_none());
  }
}
