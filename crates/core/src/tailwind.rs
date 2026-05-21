//! Tailwind utility-class to Markdown-emphasis mapping.

#[inline]
fn extract_base_class(class: &str) -> (&str, &str) {
    let breakpoints = ["sm:", "md:", "lg:", "xl:", "2xl:"];
    for bp in breakpoints {
        if let Some(rest) = class.strip_prefix(bp) {
            return (rest, bp);
        }
    }
    (class, "")
}

pub(crate) fn process_tailwind_classes(classes_attr: &str) -> (Option<String>, Option<String>, bool) {
    let mut classes: Vec<&str> = classes_attr.split_whitespace().collect();
    let bp_weight = |bp| match bp {
        "" => 0,
        "sm:" => 1,
        "md:" => 2,
        "lg:" => 3,
        "xl:" => 4,
        "2xl:" => 5,
        _ => 6,
    };
    classes.sort_by_key(|c| bp_weight(extract_base_class(c).1));

    let mut prefix = String::new();
    let mut suffix = String::new();
    let mut hidden = false;

    let mut weight = None;
    let mut emphasis = None;
    let mut decoration = None;
    let mut display_hidden = false;
    let mut position_hidden = false;

    for cls in classes {
        let base = extract_base_class(cls).0;
        if base == "italic" {
            emphasis = Some(("*", "*"));
        } else if base == "not-italic" {
            emphasis = None;
        } else if base == "font-bold" || base == "font-semibold" || base == "font-black" || base == "font-extrabold" || base == "font-medium" || base == "bold" {
            weight = Some(("**", "**"));
        } else if base.contains("font-") {
            weight = None;
        } else if base.contains("line-through") || base.contains("underline") {
            decoration = Some(("~~", "~~"));
        } else if base == "hidden" || base.contains("invisible") {
            display_hidden = true;
        } else if base == "block" || base == "flex" || base == "inline" {
            display_hidden = false;
        } else if base == "absolute" || base == "fixed" || base == "sticky" {
            position_hidden = true;
        } else if base == "static" || base == "relative" {
            position_hidden = false;
        }
    }

    if display_hidden || position_hidden {
        hidden = true;
    }

    if let Some((p, s)) = weight {
        prefix.push_str(p);
        suffix.insert_str(0, s);
    }
    if let Some((p, s)) = emphasis {
        prefix.push_str(p);
        suffix.insert_str(0, s);
    }
    if let Some((p, s)) = decoration {
        prefix.push_str(p);
        suffix.insert_str(0, s);
    }

    (
        if prefix.is_empty() { None } else { Some(prefix) },
        if suffix.is_empty() { None } else { Some(suffix) },
        hidden
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
