use mdream::html_to_markdown;
use mdream::types::HTMLToMarkdownOptions;

fn convert(html: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions::default())
}

// ── Wikipedia ──

mod wikipedia {
    use super::*;

    const HTML: &str = include_str!("fixtures/wikipedia-small.html");

    #[test]
    fn produces_nonempty_output() {
        let md = convert(HTML);
        assert!(!md.trim().is_empty(), "wikipedia output should not be empty");
    }

    #[test]
    fn contains_headings() {
        let md = convert(HTML);
        assert!(md.contains("## ") || md.contains("### "),
            "wikipedia output should contain markdown headings");
    }

    #[test]
    fn contains_links() {
        let md = convert(HTML);
        assert!(md.contains("]("), "wikipedia output should contain markdown links");
    }

    #[test]
    fn contains_tables() {
        let md = convert(HTML);
        assert!(md.contains('|'), "wikipedia output should contain table pipes");
    }

    #[test]
    fn no_html_leakage() {
        let md = convert(HTML);
        assert!(!md.contains("<script"), "should not contain <script tags");
        assert!(!md.contains("<style"), "should not contain <style tags");
        assert!(!md.contains("<div"), "should not contain <div tags");
    }
}

// ── GitHub ──

mod github {
    use super::*;

    const HTML: &str = include_str!("fixtures/github-markdown-complete.html");

    #[test]
    fn produces_nonempty_output() {
        let md = convert(HTML);
        assert!(!md.trim().is_empty(), "github output should not be empty");
    }

    #[test]
    fn contains_code_blocks() {
        let md = convert(HTML);
        assert!(md.contains("```"), "github output should contain code blocks");
    }

    #[test]
    fn contains_headings() {
        let md = convert(HTML);
        assert!(md.contains("## ") || md.contains("# "),
            "github output should contain headings");
    }

    #[test]
    fn contains_formatting() {
        let md = convert(HTML);
        assert!(md.contains("**") || md.contains('_'),
            "github output should contain bold/italic formatting");
    }

    #[test]
    fn contains_lists() {
        let md = convert(HTML);
        assert!(md.contains("- ") || md.contains("* "),
            "github output should contain unordered lists");
    }

    #[test]
    fn no_html_leakage() {
        let md = convert(HTML);
        assert!(!md.contains("<script"), "should not contain <script tags");
        assert!(!md.contains("<style"), "should not contain <style tags");
    }
}

// ── Nuxt ──

mod nuxt {
    use super::*;

    const HTML: &str = include_str!("fixtures/nuxt-example.html");

    #[test]
    fn produces_nonempty_output() {
        let md = convert(HTML);
        assert!(!md.trim().is_empty(), "nuxt output should not be empty");
    }

    #[test]
    fn contains_headings_or_links() {
        let md = convert(HTML);
        assert!(md.contains('#') || md.contains("]("),
            "nuxt output should contain headings or links");
    }
}

// ── Inline edge cases ──

mod edge_cases {
    use super::*;

    #[test]
    fn noscript_content_not_rendered() {
        let html = "<p>Visible</p><noscript><iframe src=\"analytics\"></iframe></noscript><p>Also visible</p>";
        let md = convert(html);
        assert!(md.contains("Visible"));
        assert!(md.contains("Also visible"));
        assert!(!md.contains("analytics"));
    }

    #[test]
    fn script_content_not_rendered() {
        let html = "<p>Text</p><script>var x = 1;</script><p>More</p>";
        let md = convert(html);
        assert!(md.contains("Text"));
        assert!(md.contains("More"));
        assert!(!md.contains("var x"));
    }

    #[test]
    fn style_content_not_rendered() {
        let html = "<p>Text</p><style>.foo { color: red; }</style><p>More</p>";
        let md = convert(html);
        assert!(md.contains("Text"));
        assert!(!md.contains("color: red"));
    }

    #[test]
    fn table_conversion() {
        let html = r#"<table>
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody><tr><td>A</td><td>1</td></tr><tr><td>B</td><td>2</td></tr></tbody>
        </table>"#;
        let md = convert(html);
        assert!(md.contains('|'));
        assert!(md.contains("Name"));
        assert!(md.contains("Value"));
    }

    #[test]
    fn nested_lists() {
        let html = "<ul><li>A<ul><li>A1</li><li>A2</li></ul></li><li>B</li></ul>";
        let md = convert(html);
        assert!(md.contains("A1"));
        assert!(md.contains("A2"));
        assert!(md.contains('B'));
    }

    #[test]
    fn images_produce_markdown() {
        let html = r#"<img src="test.png" alt="Test image">"#;
        let md = convert(html);
        assert!(md.contains("!["));
        assert!(md.contains("test.png"));
    }

    #[test]
    fn blockquote_conversion() {
        let html = "<blockquote><p>Quoted text</p></blockquote>";
        let md = convert(html);
        assert!(md.contains("> "));
        assert!(md.contains("Quoted text"));
    }
}
