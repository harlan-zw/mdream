use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

fn convert(html: &str) -> String {
    mdream::html_to_markdown(html, mdream::types::HTMLToMarkdownOptions::default())
}

fn convert_with_origin(html: &str, origin: &str) -> String {
    mdream::html_to_markdown(html, mdream::types::HTMLToMarkdownOptions {
        origin: Some(origin.to_string()),
        ..Default::default()
    })
}

#[wasm_bindgen_test]
fn basic_heading() {
    assert_eq!(convert("<h1>Hello</h1>"), "# Hello");
}

#[wasm_bindgen_test]
fn nested_elements() {
    let html = "<h1>Title</h1><p>A <strong>bold</strong> and <em>italic</em> paragraph.</p>";
    let result = convert(html);
    assert!(result.contains("# Title"));
    assert!(result.contains("**bold**"));
    assert!(result.contains("_italic_"));
}

#[wasm_bindgen_test]
fn links() {
    assert_eq!(convert(r#"<a href="https://example.com">Example</a>"#), "[Example](https://example.com)");
}

#[wasm_bindgen_test]
fn links_with_origin() {
    assert_eq!(
        convert_with_origin(r#"<a href="/about">About</a>"#, "https://example.com"),
        "[About](https://example.com/about)"
    );
}

#[wasm_bindgen_test]
fn unordered_list() {
    let result = convert("<ul><li>One</li><li>Two</li><li>Three</li></ul>");
    assert!(result.contains("- One"));
    assert!(result.contains("- Two"));
    assert!(result.contains("- Three"));
}

#[wasm_bindgen_test]
fn ordered_list() {
    let result = convert("<ol><li>First</li><li>Second</li></ol>");
    assert!(result.contains("1. First"));
    assert!(result.contains("2. Second"));
}

#[wasm_bindgen_test]
fn table() {
    let result = convert("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
    assert!(result.contains("| A | B |"));
    assert!(result.contains("| 1 | 2 |"));
}

#[wasm_bindgen_test]
fn code_block() {
    let result = convert("<pre><code>fn main() {}</code></pre>");
    assert!(result.contains("```"));
    assert!(result.contains("fn main() {}"));
}

#[wasm_bindgen_test]
fn blockquote() {
    assert!(convert("<blockquote><p>Quote text</p></blockquote>").contains("> Quote text"));
}

#[wasm_bindgen_test]
fn extraction() {
    use mdream::types::*;
    let result = mdream::html_to_markdown_result("<h1>Title</h1><p>Content</p>", HTMLToMarkdownOptions {
        plugins: Some(PluginConfig {
            extraction: Some(ExtractionConfig { selectors: vec!["h1".to_string()] }),
            ..Default::default()
        }),
        ..Default::default()
    });
    assert!(result.markdown.contains("# Title"));
    assert!(result.extracted.is_some());
    let extracted = result.extracted.unwrap();
    assert!(!extracted.is_empty());
    assert_eq!(extracted[0].tag_name, "h1");
}

#[wasm_bindgen_test]
fn streaming() {
    let mut stream = mdream::MarkdownStreamProcessor::new(mdream::types::HTMLToMarkdownOptions::default());
    let chunk1 = stream.process_chunk("<h1>He");
    let chunk2 = stream.process_chunk("llo</h1><p>World</p>");
    let final_chunk = stream.finish();
    let full = format!("{chunk1}{chunk2}{final_chunk}");
    assert!(full.contains("# Hello"));
    assert!(full.contains("World"));
}

#[wasm_bindgen_test]
fn large_document() {
    let mut html = String::with_capacity(10000);
    for i in 0..100 {
        html.push_str(&format!("<p>Paragraph {i} with some content.</p>"));
    }
    let result = convert(&html);
    assert!(result.contains("Paragraph 0"));
    assert!(result.contains("Paragraph 99"));
}

#[wasm_bindgen_test]
fn empty_input() {
    assert_eq!(convert(""), "");
}

#[wasm_bindgen_test]
fn html_entities() {
    assert!(convert("<p>&amp; &lt; &gt; &quot;</p>").contains("& < > \""));
}

#[wasm_bindgen_test]
fn splitter_in_wasm() {
    use mdream::splitter::*;
    let md = "# Title\n\nParagraph one.\n\n## Section\n\nParagraph two.";
    let chunks = split_markdown(md, &SplitterOptions {
        chunk_size: 50,
        chunk_overlap: 0,
        ..Default::default()
    });
    assert!(chunks.len() > 1);
}
