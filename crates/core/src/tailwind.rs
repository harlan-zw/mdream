//! Tailwind utility-class to Markdown-emphasis mapping.

#[inline]
fn extract_base_class(class: &str) -> (&str, u8) {
  let breakpoints = [("sm:", 1), ("md:", 2), ("lg:", 3), ("xl:", 4), ("2xl:", 5)];
  for (bp, priority) in breakpoints {
    if let Some(rest) = class.strip_prefix(bp) {
      return (rest, priority);
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
  let mut decoration = None::<(u8, bool)>;
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
    } else if base == "line-through" || base == "underline" {
      if supersedes(decoration) {
        decoration = Some((breakpoint, true));
      }
    } else if base == "no-underline" {
      if supersedes(decoration) {
        decoration = Some((breakpoint, false));
      }
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
  if decoration.is_some_and(|(_, enabled)| enabled) {
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
  fn decoration_modifiers_do_not_enable_strikethrough() {
    for classes in ["underline-offset-4", "no-underline", "decoration-underline"] {
      let (prefix, suffix, _) = process_tailwind_classes(classes);
      assert!(prefix.is_none(), "{classes}");
      assert!(suffix.is_none(), "{classes}");
    }
  }

  #[test]
  fn decoration_resets_follow_breakpoint_priority() {
    assert!(
      process_tailwind_classes("line-through no-underline")
        .0
        .is_none()
    );
    assert!(
      process_tailwind_classes("no-underline line-through")
        .0
        .is_some()
    );
    assert!(
      process_tailwind_classes("md:line-through no-underline")
        .0
        .is_some()
    );
    assert!(
      process_tailwind_classes("line-through md:no-underline")
        .0
        .is_none()
    );
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
