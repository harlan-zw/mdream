use mdream::{html_to_markdown, html_to_markdown_result, MarkdownStreamProcessor};
use mdream::types::{HTMLToMarkdownOptions, PluginConfig, ExtractionConfig, FilterConfig, TagOverrideConfig};

fn convert(html: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn convert_with_origin(html: &str, origin: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions {
        origin: Some(origin.to_string()),
        ..Default::default()
    })
}

// ── Headings ──

#[test]
fn heading_levels() {
    assert_eq!(convert("<h1>H1</h1>"), "# H1");
    assert_eq!(convert("<h2>H2</h2>"), "## H2");
    assert_eq!(convert("<h3>H3</h3>"), "### H3");
    assert_eq!(convert("<h4>H4</h4>"), "#### H4");
    assert_eq!(convert("<h5>H5</h5>"), "##### H5");
    assert_eq!(convert("<h6>H6</h6>"), "###### H6");
}

#[test]
fn heading_with_numbered_prefix() {
    assert_eq!(convert("<h1>1. Hello world</h1>"), "# 1. Hello world");
}

// ── Links ──

#[test]
fn simple_link() {
    assert_eq!(
        convert(r#"<a href="https://example.com">Example</a>"#),
        "[Example](https://example.com)"
    );
}

#[test]
fn link_with_title() {
    assert_eq!(
        convert(r#"<a href="https://example.com" title="Example Site">Example</a>"#),
        r#"[Example](https://example.com "Example Site")"#
    );
}

#[test]
fn link_in_paragraph() {
    assert_eq!(
        convert(r#"<p>Visit <a href="https://example.com">Example</a> for more info.</p>"#),
        "Visit [Example](https://example.com) for more info."
    );
}

#[test]
fn heading_with_link() {
    assert_eq!(
        convert(r##"<h2><a href="#new-project">New Project</a></h2>"##),
        "## [New Project](#new-project)"
    );
}

#[test]
fn anchor_links() {
    assert_eq!(convert(r##"<a href="#my-anchor">Jump</a>"##), "[Jump](#my-anchor)");
    assert_eq!(convert(r##"<a href="#">Link</a>"##), "[Link](#)");
    assert_eq!(convert(r##"<a href="#section-1_test">Link</a>"##), "[Link](#section-1_test)");
}

#[test]
fn anchor_link_with_origin_stays_relative() {
    assert_eq!(
        convert_with_origin(r##"<a href="#my-anchor">Jump</a>"##, "https://example.com"),
        "[Jump](#my-anchor)"
    );
}

#[test]
fn protocol_relative_url() {
    assert_eq!(
        convert(r##"<a href="//example.com/page#section">Link</a>"##),
        "[Link](https://example.com/page#section)"
    );
}

#[test]
fn relative_path_with_origin() {
    assert_eq!(
        convert_with_origin(r##"<a href="/page#section">Link</a>"##, "https://example.com"),
        "[Link](https://example.com/page#section)"
    );
}

#[test]
fn relative_path_without_origin() {
    assert_eq!(
        convert(r##"<a href="/page#section">Link</a>"##),
        "[Link](/page#section)"
    );
}

#[test]
fn multiple_links_in_paragraph() {
    assert_eq!(
        convert(r##"<p><a href="#top">Top</a> and <a href="#bottom">Bottom</a></p>"##),
        "[Top](#top) and [Bottom](#bottom)"
    );
}

// ── Images ──

#[test]
fn image() {
    assert_eq!(
        convert(r#"<img src="img.png" alt="alt text">"#),
        "![alt text](img.png)"
    );
}

#[test]
fn image_with_origin() {
    assert_eq!(
        convert_with_origin(r#"<img src="/img.png" alt="photo">"#, "https://example.com"),
        "![photo](https://example.com/img.png)"
    );
}

// ── Inline formatting ──

#[test]
fn bold() {
    assert_eq!(convert("<strong>bold</strong>"), "**bold**");
    assert_eq!(convert("<b>bold</b>"), "**bold**");
}

#[test]
fn italic() {
    assert_eq!(convert("<em>italic</em>"), "_italic_");
    assert_eq!(convert("<i>italic</i>"), "_italic_");
}

#[test]
fn strikethrough() {
    assert_eq!(convert("<del>deleted</del>"), "~~deleted~~");
}

#[test]
fn inline_code() {
    assert_eq!(convert("<code>print()</code>"), "`print()`");
    assert_eq!(
        convert("<p>Use the <code>print()</code> function</p>"),
        "Use the `print()` function"
    );
}

#[test]
fn subscript_superscript() {
    assert_eq!(convert("<sub>sub</sub>"), "<sub>sub</sub>");
    assert_eq!(convert("<sup>sup</sup>"), "<sup>sup</sup>");
}

#[test]
fn nested_bold_collapses() {
    assert_eq!(convert("<b><b>text</b></b>"), "**text**");
}

#[test]
fn nested_italic_collapses() {
    assert_eq!(convert("<i><i>text</i></i>"), "_text_");
}

// ── Blockquotes ──

#[test]
fn simple_blockquote() {
    assert_eq!(convert("<blockquote>This is a quote</blockquote>"), "> This is a quote");
}

#[test]
fn nested_blockquotes() {
    let result = convert("<blockquote>Outer<blockquote>Inner</blockquote></blockquote>");
    assert!(result.contains("> Outer"));
    assert!(result.contains("> > Inner"));
}

#[test]
fn blockquote_with_paragraphs() {
    assert_eq!(
        convert("<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>"),
        "> First paragraph\n>\n> Second paragraph"
    );
}

#[test]
fn blockquote_with_image() {
    assert_eq!(
        convert(r#"<blockquote>Quote with <img src="image.jpg" alt="image"></blockquote>"#),
        "> Quote with ![image](image.jpg)"
    );
}

// ── Lists ──

#[test]
fn unordered_list() {
    assert_eq!(convert("<ul><li>a</li><li>b</li></ul>"), "- a\n- b");
}

#[test]
fn ordered_list() {
    assert_eq!(convert("<ol><li>First</li><li>Second</li></ol>"), "1. First\n2. Second");
}

#[test]
fn nested_unordered_list() {
    assert_eq!(
        convert("<ul><li>Level 1<ul><li>Level 2</li></ul></li><li>Another</li></ul>"),
        "- Level 1\n  - Level 2\n- Another"
    );
}

#[test]
fn nested_ordered_list() {
    assert_eq!(
        convert("<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>"),
        "1. Level 1\n  1. Level 1.1\n2. Level 2"
    );
}

#[test]
fn mixed_nested_lists() {
    assert_eq!(
        convert("<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>"),
        "- Unordered\n  1. Ordered"
    );
}

// ── Tables ──

#[test]
fn basic_table() {
    let html = "<table><thead><tr><th>H1</th><th>H2</th></tr></thead>\
                <tbody><tr><td>A</td><td>B</td></tr>\
                <tr><td>C</td><td>D</td></tr></tbody></table>";
    let md = convert(html);
    assert!(md.contains("| H1 | H2 |"));
    assert!(md.contains("| --- | --- |"));
    assert!(md.contains("| A | B |"));
    assert!(md.contains("| C | D |"));
}

#[test]
fn table_without_thead() {
    let html = "<table><tr><th>H1</th><th>H2</th></tr>\
                <tr><td>A</td><td>B</td></tr></table>";
    let md = convert(html);
    assert!(md.contains("| H1 | H2 |"));
    assert!(md.contains("| --- | --- |"));
    assert!(md.contains("| A | B |"));
}

#[test]
fn table_with_alignment() {
    let html = r#"<table><tr><th align="left">L</th><th align="center">C</th><th align="right">R</th></tr>
                  <tr><td>1</td><td>2</td><td>3</td></tr></table>"#;
    let md = convert(html);
    assert!(md.contains(":---"));
    assert!(md.contains(":---:"));
    assert!(md.contains("---:"));
}

#[test]
fn table_with_formatting() {
    let html = r#"<table><tr><th>Name</th><th>Link</th></tr>
                  <tr><td><strong>bold</strong></td><td><a href="https://example.com">link</a></td></tr></table>"#;
    let md = convert(html);
    assert!(md.contains("**bold**"));
    assert!(md.contains("[link](https://example.com)"));
}

// ── Code blocks ──

#[test]
fn code_block_with_language() {
    assert_eq!(
        convert(r#"<pre><code class="language-js">const x = 1</code></pre>"#),
        "```js\nconst x = 1\n```"
    );
}

#[test]
fn code_block_without_language() {
    assert_eq!(
        convert("<pre><code>function example() {}</code></pre>"),
        "```\nfunction example() {}\n```"
    );
}

#[test]
fn code_block_preserves_newlines() {
    let html = "<pre><code>Line 1\n\n\nLine 2</code></pre>";
    let md = convert(html);
    assert!(md.contains("Line 1\n\n\nLine 2"));
}

// ── HTML entities ──

#[test]
fn common_entities() {
    assert_eq!(
        convert("<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>"),
        r#"<div> & "quotes" 'apostrophes'"#
    );
}

#[test]
fn numeric_entities() {
    assert_eq!(convert("<p>&#169; &#8212; &#x1F600;</p>"), "© — 😀");
}

// ── Horizontal rules ──

#[test]
fn horizontal_rule() {
    assert_eq!(convert("<hr>"), "---");
    assert_eq!(convert("<hr/>"), "---");
}

// ── Paragraphs and spacing ──

#[test]
fn paragraph_spacing() {
    assert_eq!(convert("<p>First</p><p>Second</p>"), "First\n\nSecond");
}

#[test]
fn comments_between_text() {
    let result = convert("<div>Last updated on<!-- --> <!-- -->March 12, 2025</div>");
    assert!(result.contains("Last updated on"));
    assert!(result.contains("March 12, 2025"));
}

#[test]
fn adjacent_links_have_space() {
    assert_eq!(
        convert(r#"<div><a href="b">a</a><a href="a">b</a></div>"#),
        "[a](b) [b](a)"
    );
}

// ── Script and style stripping ──

#[test]
fn strips_script() {
    assert_eq!(
        convert("<p>Before</p><script>alert(1)</script><p>After</p>"),
        "Before\n\nAfter"
    );
}

#[test]
fn strips_style() {
    assert_eq!(
        convert("<p>Before</p><style>.x{color:red}</style><p>After</p>"),
        "Before\n\nAfter"
    );
}

#[test]
fn escaped_backslash_in_script() {
    let html = r#"<script>var x = "a]\\\\\\\\b";</script><p>Visible content</p>"#;
    let result = convert(html);
    assert!(result.contains("Visible content"));
    assert!(!result.contains("var x"));
}

// ── Streaming ──

#[test]
fn streaming_matches_sync_basic() {
    let html = "<h1>Title</h1><p>Paragraph one.</p><p>Paragraph two.</p>";
    let sync_result = convert(html);

    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut streamed = String::new();
    for chunk in html.as_bytes().chunks(10) {
        streamed.push_str(&stream.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    streamed.push_str(&stream.finish());

    assert_eq!(streamed.trim(), sync_result.trim());
}

#[test]
fn streaming_split_tag() {
    let chunks = ["<h1>Title", " with split", "</h1>"];
    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut result = String::new();
    for chunk in &chunks {
        result.push_str(&stream.process_chunk(chunk));
    }
    result.push_str(&stream.finish());
    assert_eq!(result.trim(), "# Title with split");
}

#[test]
fn streaming_split_attributes() {
    let chunks = [r#"<a href="https://"#, r#"example.com">"#, "Link text</a>"];
    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut result = String::new();
    for chunk in &chunks {
        result.push_str(&stream.process_chunk(chunk));
    }
    result.push_str(&stream.finish());
    assert_eq!(result.trim(), "[Link text](https://example.com)");
}

#[test]
fn streaming_nested_elements() {
    let html = "<div><p>Text with <strong>bold</strong></p><ul><li>item</li></ul></div>";
    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut result = String::new();
    for chunk in html.as_bytes().chunks(8) {
        result.push_str(&stream.process_chunk(std::str::from_utf8(chunk).unwrap()));
    }
    result.push_str(&stream.finish());
    assert!(result.contains("**bold**"));
    assert!(result.contains("- item"));
}

#[test]
fn streaming_empty() {
    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let result = stream.finish();
    assert!(result.is_empty());
}

// ── Large input ──

#[test]
fn large_table() {
    let mut html = String::from("<table><tr>");
    for i in 0..10 {
        html.push_str(&format!("<th>Col{}</th>", i));
    }
    html.push_str("</tr>");
    for _ in 0..100 {
        html.push_str("<tr>");
        for i in 0..10 {
            html.push_str(&format!("<td>Val{}</td>", i));
        }
        html.push_str("</tr>");
    }
    html.push_str("</table>");

    let md = convert(&html);
    assert!(md.contains("| Col0"));
    assert!(md.contains("| --- |"));
    assert!(md.lines().count() > 100);
}

// ── Definition lists ──

#[test]
fn definition_list() {
    let result = convert("<dl><dt>Term</dt><dd>Definition</dd></dl>");
    assert!(result.contains("<dt>Term</dt>"));
}

// ── Details/summary ──

#[test]
fn details_summary() {
    let result = convert("<details><summary>Click me</summary><p>Content</p></details>");
    assert!(result.contains("<details>"));
    assert!(result.contains("<summary>Click me</summary>"));
    assert!(result.contains("Content"));
    assert!(result.contains("</details>"));
}

// ── Semantic elements pass through ──

#[test]
fn mark_tag() {
    assert_eq!(convert("<mark>highlighted</mark>"), "<mark>highlighted</mark>");
}

#[test]
fn kbd_tag() {
    assert_eq!(convert("<kbd>Ctrl+C</kbd>"), "`Ctrl+C`");
}

// ── Extraction ──

#[test]
fn extraction_by_tag() {
    let result = html_to_markdown_result(
        "<html><body><h1>Title</h1><p>Content</p><h2>Sub</h2></body></html>",
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                extraction: Some(ExtractionConfig { selectors: vec!["h1".to_string(), "h2".to_string()] }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    let extracted = result.extracted.unwrap();
    assert_eq!(extracted.len(), 2);
    assert_eq!(extracted[0].tag_name, "h1");
    assert_eq!(extracted[0].text_content, "Title");
    assert_eq!(extracted[1].tag_name, "h2");
    assert_eq!(extracted[1].text_content, "Sub");
}

#[test]
fn extraction_by_class() {
    let result = html_to_markdown_result(
        r#"<div class="target">Found</div><div class="other">Ignored</div>"#,
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                extraction: Some(ExtractionConfig { selectors: vec![".target".to_string()] }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    let extracted = result.extracted.unwrap();
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0].text_content, "Found");
}

#[test]
fn extraction_by_id() {
    let result = html_to_markdown_result(
        r#"<span id="x">Hello</span>"#,
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                extraction: Some(ExtractionConfig { selectors: vec!["#x".to_string()] }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    let extracted = result.extracted.unwrap();
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0].text_content, "Hello");
}

#[test]
fn extraction_by_attribute() {
    let result = html_to_markdown_result(
        r#"<a href="/foo">Link</a><span>Other</span>"#,
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                extraction: Some(ExtractionConfig { selectors: vec!["[href]".to_string()] }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    let extracted = result.extracted.unwrap();
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0].tag_name, "a");
}

#[test]
fn extraction_no_match_returns_none() {
    let result = html_to_markdown_result(
        "<p>Hello</p>",
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                extraction: Some(ExtractionConfig { selectors: vec!["h1".to_string()] }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    assert!(result.extracted.is_none());
}

// ── Filter with pre-parsed selectors ──

#[test]
fn filter_exclude_by_class() {
    let md = html_to_markdown(
        r#"<p>Keep</p><div class="ad">Remove</div>"#,
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                filter: Some(FilterConfig { exclude: Some(vec![".ad".to_string()]), ..Default::default() }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    assert!(md.contains("Keep"));
    assert!(!md.contains("Remove"));
}

#[test]
fn filter_include_only() {
    let md = html_to_markdown(
        r#"<div class="content">Inside</div><div class="sidebar">Outside</div>"#,
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                filter: Some(FilterConfig { include: Some(vec![".content".to_string()]), ..Default::default() }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    assert!(md.contains("Inside"));
    assert!(!md.contains("Outside"));
}

#[test]
fn filter_exclude_by_compound_selector() {
    let md = html_to_markdown(
        r#"<div class="foo" id="bar">Remove</div><p>Keep</p>"#,
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                filter: Some(FilterConfig { exclude: Some(vec!["div.foo#bar".to_string()]), ..Default::default() }),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    assert!(md.contains("Keep"));
    assert!(!md.contains("Remove"));
}

// ── Tag Overrides ──

#[test]
fn tag_override_enter_exit() {
    let overrides = vec![("custom-tag".to_string(), TagOverrideConfig {
        enter: Some("<<".to_string()),
        exit: Some(">>".to_string()),
        spacing: Some([0, 0]),
        is_inline: Some(true),
        is_self_closing: None,
        collapses_inner_white_space: None,
        alias_tag_id: Some(mdream::consts::TAG_SPAN),
    })];
    let md = html_to_markdown(
        "<custom-tag>Hello</custom-tag>",
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                tag_overrides: Some(overrides),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    assert_eq!(md, "<<Hello>>");
}

#[test]
fn tag_override_spacing() {
    let overrides = vec![("div".to_string(), TagOverrideConfig {
        enter: None,
        exit: None,
        spacing: Some([0, 0]),
        is_inline: None,
        is_self_closing: None,
        collapses_inner_white_space: None,
        alias_tag_id: None,
    })];
    let md = html_to_markdown(
        "<div>A</div><div>B</div>",
        HTMLToMarkdownOptions {
            plugins: Some(PluginConfig {
                tag_overrides: Some(overrides),
                ..Default::default()
            }),
            ..Default::default()
        },
    );
    // With spacing [0,0], divs should not add newlines
    assert!(!md.contains("\n\n"));
}

// ── Clean URLs ──

fn convert_clean(html: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions {
        clean_urls: true,
        ..Default::default()
    })
}

fn convert_clean_with_origin(html: &str, origin: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions {
        origin: Some(origin.to_string()),
        clean_urls: true,
        ..Default::default()
    })
}

#[test]
fn clean_urls_strips_utm_params() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com?utm_source=twitter&utm_medium=social">Link</a>"#),
        "[Link](https://example.com)"
    );
}

#[test]
fn clean_urls_strips_fbclid() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com/page?fbclid=abc123">Link</a>"#),
        "[Link](https://example.com/page)"
    );
}

#[test]
fn clean_urls_strips_gclid() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com/page?gclid=xyz">Link</a>"#),
        "[Link](https://example.com/page)"
    );
}

#[test]
fn clean_urls_preserves_non_tracking_params() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com/search?q=rust&page=2">Link</a>"#),
        "[Link](https://example.com/search?q=rust&page=2)"
    );
}

#[test]
fn clean_urls_mixed_params() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com/page?id=5&utm_source=newsletter&ref=home">Link</a>"#),
        "[Link](https://example.com/page?id=5&ref=home)"
    );
}

#[test]
fn clean_urls_preserves_fragment() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com/page?utm_source=x#section">Link</a>"#),
        "[Link](https://example.com/page#section)"
    );
}

#[test]
fn clean_urls_no_params_unchanged() {
    assert_eq!(
        convert_clean(r#"<a href="https://example.com/page">Link</a>"#),
        "[Link](https://example.com/page)"
    );
}

#[test]
fn clean_urls_disabled_by_default() {
    assert_eq!(
        convert(r#"<a href="https://example.com?utm_source=foo">Link</a>"#),
        "[Link](https://example.com?utm_source=foo)"
    );
}

#[test]
fn clean_urls_with_origin() {
    assert_eq!(
        convert_clean_with_origin(r#"<a href="/page?utm_campaign=test&id=1">Link</a>"#, "https://example.com"),
        "[Link](https://example.com/page?id=1)"
    );
}

#[test]
fn clean_urls_images() {
    assert_eq!(
        convert_clean(r#"<img src="https://cdn.example.com/img.png?utm_source=site" alt="Photo">"#),
        "![Photo](https://cdn.example.com/img.png)"
    );
}

// ── Clean mode ──

fn convert_with_clean(html: &str, clean: mdream::types::CleanConfig) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions {
        clean: Some(clean),
        ..Default::default()
    })
}

fn clean_all() -> mdream::types::CleanConfig {
    mdream::types::CleanConfig {
        urls: true,
        fragments: true,
        empty_links: true,
        blank_lines: false,
        redundant_links: true,
        self_link_headings: true,
        empty_images: true,
        empty_link_text: true,
    }
}

#[test]
fn clean_strips_empty_hash_link() {
    assert_eq!(
        convert_with_clean(r##"<a href="#">Link</a>"##, clean_all()),
        "Link"
    );
}

#[test]
fn clean_strips_javascript_link() {
    assert_eq!(
        convert_with_clean(r#"<a href="javascript:void(0)">Click</a>"#, clean_all()),
        "Click"
    );
}

#[test]
fn clean_strips_broken_fragment() {
    assert_eq!(
        convert_with_clean(r##"<a href="#nonexistent">Link</a>"##, clean_all()),
        "Link"
    );
}

#[test]
fn clean_keeps_valid_fragment() {
    assert_eq!(
        convert_with_clean(r##"<h2>My Section</h2><a href="#my-section">Link</a>"##, clean_all()),
        "## My Section\n\n[Link](#my-section)"
    );
}

#[test]
fn clean_keeps_valid_strips_broken() {
    assert_eq!(
        convert_with_clean(
            r##"<h2>Introduction</h2><p><a href="#introduction">Intro</a> and <a href="#missing">Missing</a></p>"##,
            clean_all()
        ),
        "## Introduction\n\n[Intro](#introduction) and Missing"
    );
}

#[test]
fn clean_preserves_absolute_url_fragments() {
    assert_eq!(
        convert_with_clean(r##"<a href="https://example.com/page#section">Link</a>"##, clean_all()),
        "[Link](https://example.com/page#section)"
    );
}

#[test]
fn clean_self_referencing_heading_link() {
    assert_eq!(
        convert_with_clean(r##"<h2><a href="#new-project">New Project</a></h2>"##, clean_all()),
        "## New Project"
    );
}

#[test]
fn clean_collapses_blank_lines() {
    let md = convert_with_clean(r#"<p>First</p><br><br><br><br><br><p>Second</p>"#, clean_all());
    assert!(!md.contains("\n\n\n"), "Should not have 3+ consecutive newlines");
    assert!(md.contains("First"));
    assert!(md.contains("Second"));
}

#[test]
fn clean_heading_with_formatting() {
    assert_eq!(
        convert_with_clean(r##"<h2><strong>Bold</strong> Heading</h2><a href="#bold-heading">Link</a>"##, clean_all()),
        "## **Bold** Heading\n\n[Link](#bold-heading)"
    );
}

#[test]
fn clean_disabled_by_default() {
    assert_eq!(
        convert(r##"<a href="#my-anchor">Jump</a>"##),
        "[Jump](#my-anchor)"
    );
}

// ── redundantLinks ──

#[test]
fn clean_redundant_link_stripped() {
    assert_eq!(
        convert_with_clean(r#"<a href="https://example.com">https://example.com</a>"#, clean_all()),
        "https://example.com"
    );
}

#[test]
fn clean_redundant_link_with_origin() {
    assert_eq!(
        convert_with_clean(r#"<a href="https://example.com/page">https://example.com/page</a>"#, clean_all()),
        "https://example.com/page"
    );
}

#[test]
fn clean_non_redundant_link_kept() {
    assert_eq!(
        convert_with_clean(r#"<a href="https://example.com">Example</a>"#, clean_all()),
        "[Example](https://example.com)"
    );
}

// ── selfLinkHeadings ──

#[test]
fn clean_self_link_heading_stripped() {
    assert_eq!(
        convert_with_clean(r##"<h2><a href="#my-section">My Section</a></h2>"##, clean_all()),
        "## My Section"
    );
}

#[test]
fn clean_self_link_heading_keeps_external() {
    assert_eq!(
        convert_with_clean(r#"<h2><a href="https://example.com">My Section</a></h2>"#, clean_all()),
        "## [My Section](https://example.com)"
    );
}

#[test]
fn clean_self_link_heading_non_heading_kept() {
    assert_eq!(
        convert_with_clean(r##"<p><a href="#section">Section</a></p>"##, clean_all()),
        "Section"  // fragment stripped by clean.fragments since no matching heading
    );
}

// ── emptyImages ──

#[test]
fn clean_empty_image_stripped() {
    assert_eq!(
        convert_with_clean(r#"<img src="icon.svg" alt="" />"#, clean_all()),
        ""
    );
}

#[test]
fn clean_image_with_alt_kept() {
    assert_eq!(
        convert_with_clean(r#"<img src="photo.jpg" alt="A photo" />"#, clean_all()),
        "![A photo](photo.jpg)"
    );
}

#[test]
fn clean_image_no_alt_attr_stripped() {
    assert_eq!(
        convert_with_clean(r#"<img src="spacer.gif" />"#, clean_all()),
        ""
    );
}

// ── emptyLinkText ──

#[test]
fn clean_empty_link_text_dropped() {
    assert_eq!(
        convert_with_clean(r#"<a href="/page"><svg></svg></a>"#, clean_all()),
        ""
    );
}

#[test]
fn clean_empty_link_text_with_content_kept() {
    assert_eq!(
        convert_with_clean(r#"<a href="/page">Click here</a>"#, clean_all()),
        "[Click here](/page)"
    );
}

#[test]
fn clean_empty_link_text_whitespace_only_dropped() {
    assert_eq!(
        convert_with_clean(r#"<a href="/page">  </a>"#, clean_all()),
        ""
    );
}

// ── HTML Entity Decoding ──

#[test]
fn named_entities_common() {
    assert_eq!(convert("<p>&mdash;</p>"), "\u{2014}");
    assert_eq!(convert("<p>&ndash;</p>"), "\u{2013}");
    assert_eq!(convert("<p>&copy;</p>"), "\u{00A9}");
    assert_eq!(convert("<p>&hellip;</p>"), "\u{2026}");
    assert_eq!(convert("<p>&laquo;</p>"), "\u{00AB}");
    assert_eq!(convert("<p>&raquo;</p>"), "\u{00BB}");
    assert_eq!(convert("<p>&trade;</p>"), "\u{2122}");
    assert_eq!(convert("<p>&euro;</p>"), "\u{20AC}");
}

#[test]
fn named_entities_accented() {
    assert_eq!(convert("<p>&eacute;</p>"), "\u{00E9}");
    assert_eq!(convert("<p>&Eacute;</p>"), "\u{00C9}");
    assert_eq!(convert("<p>&uuml;</p>"), "\u{00FC}");
    assert_eq!(convert("<p>&ntilde;</p>"), "\u{00F1}");
    assert_eq!(convert("<p>&ccedil;</p>"), "\u{00E7}");
    assert_eq!(convert("<p>&szlig;</p>"), "\u{00DF}");
}

#[test]
fn named_entities_xml_defaults() {
    assert_eq!(convert("<p>&lt;</p>"), "<");
    assert_eq!(convert("<p>&gt;</p>"), ">");
    assert_eq!(convert("<p>&amp;</p>"), "&");
    assert_eq!(convert("<p>&quot;</p>"), "\"");
    assert_eq!(convert("<p>&apos;</p>"), "'");
}

#[test]
fn named_entities_greek() {
    assert_eq!(convert("<p>&alpha;&beta;&gamma;</p>"), "\u{03B1}\u{03B2}\u{03B3}");
    assert_eq!(convert("<p>&Omega;</p>"), "\u{03A9}");
}

#[test]
fn numeric_entities_decimal_and_hex() {
    assert_eq!(convert("<p>&#169;</p>"), "\u{00A9}");
    assert_eq!(convert("<p>&#x00A9;</p>"), "\u{00A9}");
    assert_eq!(convert("<p>&#8212;</p>"), "\u{2014}");
    assert_eq!(convert("<p>&#x2014;</p>"), "\u{2014}");
}

#[test]
fn numeric_entities_digit_cap() {
    // Unbounded digit sequences should not scan forever
    assert_eq!(convert("<p>&#99999999999;</p>"), "&#99999999999;");
    assert_eq!(convert("<p>&#xFFFFFFFFF;</p>"), "&#xFFFFFFFFF;");
}

#[test]
fn unknown_entities_pass_through() {
    assert_eq!(convert("<p>&nonexistent;</p>"), "&nonexistent;");
    assert_eq!(convert("<p>&;</p>"), "&;");
}

#[test]
fn mixed_entities_in_text() {
    assert_eq!(
        convert("<p>Caf&eacute; &amp; cr&egrave;me &mdash; parfait</p>"),
        "Caf\u{00E9} & cr\u{00E8}me \u{2014} parfait"
    );
}

// ── Isolate Main ──

fn convert_with_isolate_main(html: &str) -> String {
    html_to_markdown(html, HTMLToMarkdownOptions {
        plugins: Some(PluginConfig {
            isolate_main: Some(mdream::types::IsolateMainConfig {}),
            ..Default::default()
        }),
        ..Default::default()
    })
}

#[test]
fn isolate_main_excludes_links_after_main_closes() {
    let html = r##"<body><main><h1>Title</h1><p>Content</p></main><div><a href="#">icon</a></div><footer>Footer</footer></body>"##;
    let result = convert_with_isolate_main(html);
    assert!(result.contains("# Title"));
    assert!(result.contains("Content"));
    assert!(!result.contains("](#)"));
    assert!(!result.contains("icon"));
    assert!(!result.contains("Footer"));
}

#[test]
fn isolate_main_finds_deeply_nested_main() {
    let html = r#"<body><nav>Nav</nav><div><div><div><div><div><div><div><div><div><div><main><h1>Deep Title</h1><p>Deep content</p></main></div></div></div></div></div></div></div></div></div></div><footer>Footer</footer></body>"#;
    let result = convert_with_isolate_main(html);
    assert!(result.contains("# Deep Title"));
    assert!(result.contains("Deep content"));
    assert!(!result.contains("Nav"));
    assert!(!result.contains("Footer"));
}
