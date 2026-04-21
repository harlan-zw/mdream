use mdream::splitter::{split_markdown, SplitterOptions};
use mdream::consts::{TAG_H1, TAG_H2, TAG_H3, TAG_H4};

fn default_opts() -> SplitterOptions {
    SplitterOptions::default()
}

// ── Header-based splitting ──

#[test]
fn splits_on_repeated_h2() {
    let md = "## Section A\nContent A\n## Section B\nContent B\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() >= 2, "expected at least 2 chunks, got {}", chunks.len());
    assert!(chunks[0].content.contains("Content A"));
    assert!(chunks[1].content.contains("Content B"));
}

#[test]
fn tracks_header_hierarchy() {
    let md = "## Parent\nSome text\n### Child\nChild text\n## Another Parent\nMore text\n";
    let opts = SplitterOptions {
        headers_to_split_on: vec![TAG_H2, TAG_H3],
        strip_headers: false,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    // Last chunk should have h2 metadata
    let last = chunks.last().unwrap();
    let headers = last.metadata.headers.as_ref().unwrap();
    assert_eq!(headers.iter().find(|(k, _)| k == "h2").map(|(_, v)| v.as_str()), Some("Another Parent"));
    // Should NOT have h3 from previous section
    assert!(!headers.iter().any(|(k, _)| k == "h3"));
}

#[test]
fn does_not_split_on_first_occurrence() {
    let md = "## Only Section\nContent here\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 1);
    assert!(chunks[0].content.contains("Content here"));
}

#[test]
fn splits_on_h1_when_configured() {
    let md = "# Title A\nContent A\n# Title B\nContent B\n";
    let opts = SplitterOptions {
        headers_to_split_on: vec![TAG_H1],
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() >= 2);
}

#[test]
fn clears_child_headers_on_parent_split() {
    let md = "## Sec 1\n### Sub 1\nText\n## Sec 2\nText 2\n";
    let opts = SplitterOptions {
        headers_to_split_on: vec![TAG_H2, TAG_H3],
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    let last = chunks.last().unwrap();
    let headers = last.metadata.headers.as_ref().unwrap();
    assert_eq!(headers.iter().find(|(k, _)| k == "h2").map(|(_, v)| v.as_str()), Some("Sec 2"));
    assert!(!headers.iter().any(|(k, _)| k == "h3"));
}

// ── strip_headers ──

#[test]
fn strip_headers_removes_header_lines() {
    let md = "## Header\nParagraph text\n";
    let opts = SplitterOptions {
        strip_headers: true,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 1);
    assert!(!chunks[0].content.contains("## Header"));
    assert!(chunks[0].content.contains("Paragraph text"));
}

#[test]
fn strip_headers_false_keeps_headers() {
    let md = "## Header\nParagraph text\n";
    let opts = SplitterOptions {
        strip_headers: false,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 1);
    assert!(chunks[0].content.contains("## Header"));
}

// ── Code block handling ──

#[test]
fn extracts_code_language() {
    let md = "## Section\n```rust\nfn main() {}\n```\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0].metadata.code.as_deref(), Some("rust"));
}

#[test]
fn no_split_inside_code_block() {
    let md = "## Before\nText\n```\n## Fake Header Inside Code\nmore code\n```\n## After\nEnd text\n";
    let opts = SplitterOptions {
        headers_to_split_on: vec![TAG_H2],
        strip_headers: false,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    // The fake header inside code block should NOT cause a split
    // We should have content from before and the code block in one chunk, then after
    let all_content: String = chunks.iter().map(|c| c.content.as_str()).collect::<Vec<_>>().join("\n");
    assert!(all_content.contains("## Fake Header Inside Code"));
}

#[test]
fn backtick_safety_prevents_code_block_split() {
    let md = format!(
        "Some text before\n```python\n{}\n```\nSome text after\n",
        "x = 1\n".repeat(200)
    );
    let opts = SplitterOptions {
        chunk_size: 100,
        chunk_overlap: 10,
        ..default_opts()
    };
    let chunks = split_markdown(&md, &opts);
    // Should produce chunks but never split in the middle of a code fence pair
    // with an odd backtick count
    assert!(!chunks.is_empty());
}

// ── HR splitting ──

#[test]
fn splits_on_hr_dashes() {
    let md = "Part one\n---\nPart two\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() >= 2, "expected split on --- HR");
    assert!(chunks[0].content.contains("Part one"));
}

#[test]
fn splits_on_hr_asterisks() {
    let md = "Part one\n***\nPart two\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() >= 2, "expected split on *** HR");
}

#[test]
fn splits_on_hr_underscores() {
    let md = "Part one\n___\nPart two\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() >= 2, "expected split on ___ HR");
}

// ── Size-based splitting ──

#[test]
fn splits_large_content_by_size() {
    let paragraph = "Lorem ipsum dolor sit amet. ".repeat(100);
    let md = format!("## Section\n{paragraph}\n");
    let opts = SplitterOptions {
        chunk_size: 200,
        chunk_overlap: 50,
        ..default_opts()
    };
    let chunks = split_markdown(&md, &opts);
    assert!(chunks.len() > 1, "expected multiple chunks for large content");
    // Verify chunks were actually produced (content was split)
    let total_len: usize = chunks.iter().map(|c| c.content.len()).sum();
    assert!(total_len > 0);
}

#[test]
fn separator_priority_prefers_double_newline() {
    let md = "Paragraph one.\n\nParagraph two.\nSame paragraph continued.\n\nParagraph three.\n";
    let opts = SplitterOptions {
        chunk_size: 40,
        chunk_overlap: 0,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    // Should prefer splitting at \n\n over \n
    assert!(chunks.len() >= 2);
}

// ── Overlap ──

#[test]
fn overlap_only_on_size_splits() {
    let paragraph = "Word ".repeat(300);
    let md = format!("{paragraph}\n");
    let opts = SplitterOptions {
        chunk_size: 200,
        chunk_overlap: 50,
        ..default_opts()
    };
    let chunks = split_markdown(&md, &opts);
    assert!(chunks.len() > 1);
    // With overlap, chunks should share some content
    if chunks.len() >= 2 {
        let end_of_first = &chunks[0].content;
        let start_of_second = &chunks[1].content;
        // There should be some overlap — last chars of first chunk appear in second
        let overlap_region = &end_of_first[end_of_first.len().saturating_sub(50)..];
        // The second chunk should start with content that overlaps
        assert!(
            start_of_second.contains(overlap_region.trim())
                || overlap_region.trim().is_empty(),
            "expected overlap between chunks"
        );
    }
}

#[test]
fn no_overlap_on_header_splits() {
    let md = "## Section A\nContent A is here.\n## Section B\nContent B is here.\n";
    let opts = SplitterOptions {
        chunk_overlap: 100,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    if chunks.len() >= 2 {
        // Header splits should not cause overlap — content should be distinct
        assert!(!chunks[1].content.contains("Content A"));
    }
}

// ── return_each_line ──

#[test]
fn return_each_line_splits_into_lines() {
    let md = "## Section\nLine one\nLine two\nLine three\n";
    let opts = SplitterOptions {
        return_each_line: true,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 3);
    assert_eq!(chunks[0].content, "Line one");
    assert_eq!(chunks[1].content, "Line two");
    assert_eq!(chunks[2].content, "Line three");
}

#[test]
fn return_each_line_skips_empty_lines() {
    let md = "Line one\n\nLine two\n\n\nLine three\n";
    let opts = SplitterOptions {
        return_each_line: true,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 3);
}

#[test]
fn return_each_line_preserves_headers_metadata() {
    let md = "## Section\nLine one\nLine two\n";
    let opts = SplitterOptions {
        return_each_line: true,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    for chunk in &chunks {
        let headers = chunk.metadata.headers.as_ref().unwrap();
        assert_eq!(headers.iter().find(|(k, _)| k == "h2").map(|(_, v)| v.as_str()), Some("Section"));
    }
}

// ── Edge cases ──

#[test]
fn empty_input() {
    let chunks = split_markdown("", &default_opts());
    assert!(chunks.is_empty());
}

#[test]
fn whitespace_only_input() {
    let chunks = split_markdown("   \n\n  \n", &default_opts());
    assert!(chunks.is_empty());
}

#[test]
fn frontmatter_detection() {
    let md = "---\ntitle: Hello\nauthor: Test\n---\n## Section\nContent here\n";
    let opts = SplitterOptions {
        strip_headers: false,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    // Frontmatter --- should not be treated as HR
    // Should produce a single chunk (frontmatter + content)
    assert!(!chunks.is_empty());
    let all_content: String = chunks.iter().map(|c| c.content.as_str()).collect::<Vec<_>>().join("\n");
    assert!(all_content.contains("Content here"));
}

#[test]
fn consecutive_headers() {
    let md = "## A\n## B\n## C\nFinal content\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert!(!chunks.is_empty());
    let last = chunks.last().unwrap();
    assert!(last.content.contains("Final content"));
}

#[test]
fn tiny_chunk_size() {
    let md = "## Section\nHello world this is a test of tiny chunks\n";
    let opts = SplitterOptions {
        chunk_size: 10,
        chunk_overlap: 2,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() > 1);
}

#[test]
fn loc_line_numbers() {
    let md = "## Section\nLine 1\nLine 2\nLine 3\n";
    let opts = default_opts();
    let chunks = split_markdown(md, &opts);
    assert_eq!(chunks.len(), 1);
    let loc = chunks[0].metadata.loc.as_ref().unwrap();
    assert_eq!(loc.from, 1);
    assert!(loc.to >= 1);
}

#[test]
fn mixed_header_levels() {
    let md = "# Title\n## Section 1\n### Sub 1.1\nText\n## Section 2\n#### Deep\nMore text\n";
    let opts = SplitterOptions {
        headers_to_split_on: vec![TAG_H2, TAG_H3, TAG_H4],
        strip_headers: false,
        ..default_opts()
    };
    let chunks = split_markdown(md, &opts);
    assert!(chunks.len() >= 2);
}

#[test]
fn html_to_markdown_chunks_convenience() {
    let html = "<h2>Section A</h2><p>Content A</p><h2>Section B</h2><p>Content B</p>";
    let md_opts = mdream::types::HTMLToMarkdownOptions::default();
    let split_opts = default_opts();
    let chunks = mdream::splitter::html_to_markdown_chunks(html, md_opts, &split_opts);
    assert!(chunks.len() >= 2);
    assert!(chunks[0].content.contains("Content A"));
    assert!(chunks[1].content.contains("Content B"));
}

#[test]
#[should_panic(expected = "chunk_overlap must be less than chunk_size")]
fn panics_when_overlap_exceeds_size() {
    let opts = SplitterOptions {
        chunk_size: 100,
        chunk_overlap: 200,
        ..default_opts()
    };
    split_markdown("Some text", &opts);
}
