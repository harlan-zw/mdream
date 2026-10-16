//! Tailwind utility-class to Markdown-emphasis mapping.

#[inline]
fn extract_base_class(class: &str) -> (&str, u8) {
  match class.as_bytes() {
    [b's', b'm', b':', ..] => (&class[3..], 1),
    [b'm', b'd', b':', ..] => (&class[3..], 2),
    [b'l', b'g', b':', ..] => (&class[3..], 3),
    [b'x', b'l', b':', ..] => (&class[3..], 4),
    [b'2', b'x', b'l', b':', ..] => (&class[4..], 5),
    _ => (class, 0),
  }
}

/// Substring test for the keyword probes; a window scan beats the searcher's setup.
#[inline]
fn has_infix(haystack: &str, needle: &[u8]) -> bool {
  haystack
    .as_bytes()
    .windows(needle.len())
    .any(|window| window == needle)
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
    // Exact names first; the infix probes below would match them too.
    let (slot, value) = match base {
      "italic" => (&mut emphasis, true),
      "not-italic" => (&mut emphasis, false),
      "font-bold" | "font-semibold" | "font-black" | "font-extrabold" | "font-medium" | "bold" => {
        (&mut weight, true)
      }
      "line-through" => (&mut decoration, true),
      "no-underline" | "underline" => (&mut decoration, false),
      "hidden" => (&mut display_hidden, true),
      "block" | "flex" | "inline" => (&mut display_hidden, false),
      "absolute" | "fixed" | "sticky" => (&mut position_hidden, true),
      "static" | "relative" => (&mut position_hidden, false),
      _ if has_infix(base, b"font-") => (&mut weight, false),
      _ if has_infix(base, b"invisible") => (&mut display_hidden, true),
      _ => continue,
    };
    if supersedes(*slot) {
      *slot = Some((breakpoint, value));
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
  fn line_through_maps_to_strikethrough() {
    let (p, _, _) = process_tailwind_classes("line-through");
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

  /// Reference if-chain: the behaviour `process_tailwind_classes` must match.
  fn reference(classes_attr: &str) -> (Option<String>, Option<String>, bool) {
    fn base_of(class: &str) -> (&str, u8) {
      for (bp, priority) in [("sm:", 1), ("md:", 2), ("lg:", 3), ("xl:", 4), ("2xl:", 5)] {
        if let Some(rest) = class.strip_prefix(bp) {
          return (rest, priority);
        }
      }
      (class, 0)
    }
    let (mut w, mut e, mut d, mut dh, mut ph) = (None::<(u8, bool)>, None, None, None, None);
    for cls in classes_attr.split_whitespace() {
      let (base, bp) = base_of(cls);
      let sup = |c: Option<(u8, bool)>| c.is_none_or(|(cb, _)| bp >= cb);
      if base == "italic" {
        if sup(e) {
          e = Some((bp, true));
        }
      } else if base == "not-italic" {
        if sup(e) {
          e = Some((bp, false));
        }
      } else if [
        "font-bold",
        "font-semibold",
        "font-black",
        "font-extrabold",
        "font-medium",
        "bold",
      ]
      .contains(&base)
      {
        if sup(w) {
          w = Some((bp, true));
        }
      } else if base.contains("font-") {
        if sup(w) {
          w = Some((bp, false));
        }
      } else if base == "line-through" {
        if sup(d) {
          d = Some((bp, true));
        }
      } else if base == "no-underline" || base == "underline" {
        if sup(d) {
          d = Some((bp, false));
        }
      } else if base == "hidden" || base.contains("invisible") {
        if sup(dh) {
          dh = Some((bp, true));
        }
      } else if base == "block" || base == "flex" || base == "inline" {
        if sup(dh) {
          dh = Some((bp, false));
        }
      } else if base == "absolute" || base == "fixed" || base == "sticky" {
        if sup(ph) {
          ph = Some((bp, true));
        }
      } else if (base == "static" || base == "relative") && sup(ph) {
        ph = Some((bp, false));
      }
    }
    let (mut p, mut s) = (String::new(), String::new());
    if w.is_some_and(|(_, v)| v) {
      p.push_str("**");
      s.push_str("**");
    }
    if e.is_some_and(|(_, v)| v) {
      p.push('*');
      s.insert(0, '*');
    }
    if d.is_some_and(|(_, v)| v) {
      p.push_str("~~");
      s.insert_str(0, "~~");
    }
    (
      (!p.is_empty()).then_some(p),
      (!s.is_empty()).then_some(s),
      dh.is_some_and(|(_, h)| h) || ph.is_some_and(|(_, h)| h),
    )
  }

  #[test]
  fn table_dispatch_matches_reference() {
    let words = [
      "italic",
      "not-italic",
      "font-bold",
      "font-semibold",
      "font-black",
      "font-extrabold",
      "font-medium",
      "bold",
      "font-light",
      "xfont-y",
      "line-through",
      "underline",
      "no-underline",
      "hidden",
      "invisible",
      "md:invisible-x",
      "block",
      "flex",
      "inline",
      "absolute",
      "fixed",
      "sticky",
      "static",
      "relative",
      "headerlink",
      "",
      "sm:",
      "2xl:bold",
      "xl:hidden",
    ];
    let prefixes = ["", "sm:", "md:", "lg:", "xl:", "2xl:", "3xl:", "s:"];
    let mut classes = Vec::new();
    for p in prefixes {
      for w in words {
        classes.push(format!("{p}{w}"));
      }
    }
    for a in &classes {
      assert_eq!(process_tailwind_classes(a), reference(a), "{a:?}");
      for b in classes.iter().step_by(7) {
        let pair = format!("{a} {b}");
        assert_eq!(
          process_tailwind_classes(&pair),
          reference(&pair),
          "{pair:?}"
        );
      }
    }
  }
}
