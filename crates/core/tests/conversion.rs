use mdream::types::{
  ExtractionConfig, FilterConfig, FrontmatterConfig, HTMLToMarkdownOptions, IsolateMainConfig,
  OutputFormat, PluginConfig, TagOverrideConfig,
};
use mdream::{MarkdownStreamProcessor, html_to_markdown, html_to_markdown_result, html_to_text};

fn convert(html: &str) -> String {
  html_to_markdown(html, HTMLToMarkdownOptions::default())
}

fn convert_with_origin(html: &str, origin: &str) -> String {
  html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      origin: Some(origin.to_string()),
      ..Default::default()
    },
  )
}

fn convert_text(html: &str) -> String {
  html_to_text(html, HTMLToMarkdownOptions::default())
}

fn convert_text_with_origin(html: &str, origin: &str) -> String {
  html_to_text(
    html,
    HTMLToMarkdownOptions {
      origin: Some(origin.to_string()),
      ..Default::default()
    },
  )
}

// ── Plain text output ──

#[test]
fn plain_text_output_omits_markdown_markup() {
  assert_eq!(
    convert_text(
      r#"<h1>Hello <em>World</em></h1><p>Visit <a href="https://example.com">Example</a> and <strong>read</strong>.</p><ul><li>One</li><li>Two</li></ul>"#
    ),
    "Hello World\n\nVisit Example and read.\n\nOne\nTwo"
  );
}

#[test]
fn plain_text_output_preserves_readable_separators() {
  assert_eq!(
    convert_text(
      r#"<p>Line<br>Break</p><table><tr><th>Name</th><th>Role</th></tr><tr><td>Ada</td><td>Admin</td></tr></table><p><img src="/x.png" alt="Diagram"></p>"#
    ),
    "Line\nBreak\n\nName\tRole\nAda\tAdmin\n\nDiagram"
  );
}

#[test]
fn plain_text_images_fall_back_to_title_then_src() {
  assert_eq!(
    convert_text(r#"<img src="image.png" alt="Alt" title="Title">"#),
    "Alt"
  );
  assert_eq!(
    convert_text(r#"<img src="image.png" title="Title">"#),
    "Title"
  );
  assert_eq!(convert_text(r#"<img src="image.png">"#), "image.png");
  assert_eq!(
    convert_text_with_origin(r#"<img src="/image.png">"#, "https://example.com"),
    "https://example.com/image.png"
  );
  assert_eq!(
    convert_text(r#"<img src="image.png" alt="" title="Title">"#),
    ""
  );
  assert_eq!(convert_text("<img>"), "");
}

#[test]
fn plain_text_pre_preserves_content_without_synthetic_formatting() {
  assert_eq!(
    convert_text("<pre>  first line\nsecond line</pre>"),
    "  first line\nsecond line"
  );
  assert_eq!(convert_text("  <p>ordinary text</p>"), "ordinary text");

  assert_eq!(
    convert_text(
      "<ul><li>Before<pre>  first line\nsecond line</pre>After</li></ul><blockquote>Quote<pre>code</pre>Done</blockquote>"
    ),
    "Before\n  first line\nsecond line\nAfter\n\nQuote\ncode\nDone"
  );
}

#[test]
fn plain_text_streaming_matches_every_split() {
  let html = "  <h1>A heading that must not wrap</h1><p>Alpha  beta</p><pre>  first line\nsecond line</pre><p>Omega</p>";
  let expected = html_to_text(html, HTMLToMarkdownOptions::default().with_wrap_width(8));

  for split in 0..=html.len() {
    let mut stream = MarkdownStreamProcessor::new_with_format(
      HTMLToMarkdownOptions::default().with_wrap_width(8),
      OutputFormat::Text,
    );
    let mut actual = stream.process_chunk(&html[..split]);
    actual.push_str(&stream.process_chunk(&html[split..]));
    actual.push_str(&stream.finish());
    assert_eq!(actual.trim_end(), expected, "split at byte {split}");
  }
}

// ── Case-insensitive tag names ──

#[test]
fn uppercase_tag_names() {
  assert_eq!(convert("<H1>Title</H1>"), "# Title");
  assert_eq!(convert("<DIV><P>Hello</P></DIV>"), "Hello");
  assert_eq!(convert("<STRONG>bold</STRONG>"), "**bold**");
}

#[test]
fn mixed_case_tag_names() {
  assert_eq!(convert("<Strong>bold</Strong>"), "**bold**");
  assert_eq!(convert("<eM>italic</Em>"), "_italic_");
}

#[test]
fn mismatched_case_open_close() {
  assert_eq!(convert("<p>text</P>"), "text");
  assert_eq!(convert("<H2>Heading</h2>"), "## Heading");
}

#[test]
fn non_nesting_tags_case_insensitive_close() {
  // The peek-ahead close-tag match must be case-insensitive too.
  assert_eq!(
    convert("<head><SCRIPT>var x = 1 < 2;</SCRIPT></head><body><p>ok</p></body>"),
    "ok"
  );
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
  assert_eq!(
    convert(r##"<a href="#my-anchor">Jump</a>"##),
    "[Jump](#my-anchor)"
  );
  assert_eq!(convert(r##"<a href="#">Link</a>"##), "[Link](#)");
  assert_eq!(
    convert(r##"<a href="#section-1_test">Link</a>"##),
    "[Link](#section-1_test)"
  );
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
    convert(r#"<a href="//example.com/page#section">Link</a>"#),
    "[Link](https://example.com/page#section)"
  );
}

#[test]
fn relative_path_with_origin() {
  assert_eq!(
    convert_with_origin(r#"<a href="/page#section">Link</a>"#, "https://example.com"),
    "[Link](https://example.com/page#section)"
  );
}

#[test]
fn relative_path_without_origin() {
  assert_eq!(
    convert(r#"<a href="/page#section">Link</a>"#),
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

#[test]
fn autolink_collapses_when_text_equals_href() {
  assert_eq!(
    convert(r#"<a href="https://example.com">https://example.com</a>"#),
    "<https://example.com>"
  );
}

#[test]
fn autolink_collapses_mailto() {
  assert_eq!(
    convert(r#"<a href="mailto:hi@example.com">mailto:hi@example.com</a>"#),
    "<mailto:hi@example.com>"
  );
}

#[test]
fn autolink_in_paragraph() {
  assert_eq!(
    convert(r#"<p>Visit <a href="https://example.com">https://example.com</a> now.</p>"#),
    "Visit <https://example.com> now."
  );
}

#[test]
fn autolink_collapses_ftp_urls() {
  assert_eq!(
    convert(r#"<a href="ftp://files.example.com">ftp://files.example.com</a>"#),
    "<ftp://files.example.com>"
  );
}

#[test]
fn autolink_not_collapsed_with_whitespace_in_href() {
  assert_eq!(
    convert(r#"<a href="https://example.com/a b">https://example.com/a b</a>"#),
    "[https://example.com/a b](https://example.com/a b)"
  );
}

#[test]
fn autolink_not_collapsed_when_text_differs() {
  assert_eq!(
    convert(r#"<a href="https://example.com">Example</a>"#),
    "[Example](https://example.com)"
  );
}

#[test]
fn autolink_not_collapsed_with_title() {
  assert_eq!(
    convert(r#"<a href="https://example.com" title="Site">https://example.com</a>"#),
    r#"[https://example.com](https://example.com "Site")"#
  );
}

#[test]
fn autolink_not_collapsed_for_relative_href() {
  assert_eq!(convert(r#"<a href="/page">/page</a>"#), "[/page](/page)");
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
fn trailing_whitespace_inside_inline_moves_after_delimiter() {
  let html = "<div><strong><a href='http://xxx.yyy/'>abc</a> </strong>def</div>";
  let expected = "**[abc](http://xxx.yyy/)** def";
  assert_eq!(convert(html), expected);
  assert_eq!(convert("<p><em>abc </em>def</p>"), "_abc_ def");
  assert_eq!(
    convert("<p><strong><em>abc </em></strong>def</p>"),
    "**_abc_** def"
  );
  assert_eq!(convert("<strong>abc </strong>"), "**abc**");

  for split in 0..=html.len() {
    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut actual = stream.process_chunk(&html[..split]);
    actual.push_str(&stream.process_chunk(&html[split..]));
    actual.push_str(&stream.finish());
    assert_eq!(actual.trim_end(), expected, "split at byte {split}");
  }
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

// ── Empty inline emphasis ──

#[test]
fn empty_emphasis_emits_no_markers() {
  assert_eq!(convert("<p><b></b>x</p>"), "x");
  assert_eq!(convert("<p><strong></strong>x</p>"), "x");
  assert_eq!(convert("<p><i></i>x</p>"), "x");
  assert_eq!(convert("<p><em></em>x</p>"), "x");
  assert_eq!(convert("<p><del></del>x</p>"), "x");
}

#[test]
fn whitespace_only_emphasis_emits_no_markers() {
  assert_eq!(convert("<p><strong> </strong>x</p>"), "x");
  assert_eq!(convert("<p>a <em>\n</em>b</p>"), "a b");
}

#[test]
fn empty_icon_i_before_text_is_dropped() {
  assert_eq!(
    convert("<p><i class=\"rc-scout__logo\"></i>You might also like the Recurse Center</p>"),
    "You might also like the Recurse Center"
  );
}

#[test]
fn empty_emphasis_inside_heading_and_list_item() {
  assert_eq!(convert("<h2><i class=\"icon\"></i>Title</h2>"), "## Title");
  assert_eq!(convert("<ul><li><b></b>x</li></ul>"), "- x");
}

#[test]
fn nested_empty_emphasis_fully_dropped() {
  assert_eq!(convert("<p><b><i></i></b>x</p>"), "x");
  assert_eq!(convert("<p><b><b></b></b>x</p>"), "x");
  assert_eq!(convert("<p><b><i><del></del></i></b>x</p>"), "x");
  assert_eq!(convert("<p><b><i></i><i></i></b>x</p>"), "x");
  assert_eq!(convert("<p><del><del></del></del>x</p>"), "x");
  assert_eq!(convert("<p><strong><b></b></strong>x</p>"), "x");
  assert_eq!(convert("<p><strong><em><b></b></em></strong>x</p>"), "x");
  assert_eq!(
    convert("<p><strong><x-unknown></x-unknown></strong>x</p>"),
    "x"
  );
}

#[test]
fn empty_figcaption_emits_no_markers() {
  assert_eq!(convert("<figure><figcaption></figcaption></figure>"), "");
}

#[test]
fn non_empty_emphasis_unchanged_by_empty_drop() {
  assert_eq!(convert("<p><b>hi</b></p>"), "**hi**");
  assert_eq!(convert("<p><b><em>x</em></b></p>"), "**_x_**");
  assert_eq!(convert("<p><b><img src=\"x.png\" alt=\"y\"></b></p>"), "**![y](x.png)**");
  // A nested empty pair after real content still drops, without dropping the
  // outer marker that content already made permanent.
  assert_eq!(convert("<p><b>x<i></i></b></p>"), "**x**");
  assert_eq!(convert("<p><b>x<i></i><i></i></b></p>"), "**x**");
  assert_eq!(convert("<p><del>a<b></b>b</del></p>"), "~~ab~~");
}

#[test]
fn empty_inline_code_in_list_drops_owned_separator() {
  assert_eq!(convert("<ul><li>x<code></code>y</li></ul>"), "- xy");
}

#[test]
fn literal_marker_text_at_emphasis_tail_not_mistaken_for_empty() {
  // The buffer ends with the literal text "**" when the element closes;
  // the recorded marker position must prevent a false drop.
  assert_eq!(convert("<p><b>x<span>**</span></b></p>"), "**x****");
}

#[test]
fn open_emphasis_yields_content_before_close() {
  // The <span> boundary flushes the text node while <b> is still open; once
  // content lands the marker can't be dropped, so the stream must release it.
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let first = stream.process_chunk("<p><b>hello world<span>");
  assert!(
    first.contains("hello world"),
    "content held until close: {first:?}"
  );
  let mut full = first;
  full.push_str(&stream.process_chunk("more</span></b></p>"));
  full.push_str(&stream.finish());
  assert_eq!(full.trim_end(), "**hello worldmore**");
}

#[test]
fn open_emphasis_yields_element_content_before_close() {
  // Non-text output (an image) inside open emphasis must also release the marker,
  // or streaming holds the element's content buffered until the emphasis closes.
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let first = stream.process_chunk("<p><b><img src=\"x.png\" alt=\"y\"><span>");
  assert!(
    first.contains("![y](x.png)"),
    "image held until close: {first:?}"
  );
  let mut full = first;
  full.push_str(&stream.process_chunk("more</span></b></p>"));
  full.push_str(&stream.finish());
  assert_eq!(full.trim_end(), "**![y](x.png)more**");
}

#[test]
fn tag_override_emphasis_marker_not_dropped_when_empty() {
  // A declarative override that emits an emphasis marker opts out of empty-pair
  // cleanup: the override's markers are literal and must survive an empty element.
  let overrides = vec![(
    "b".to_string(),
    TagOverrideConfig {
      enter: Some("**".to_string()),
      exit: Some("**".to_string()),
      spacing: None,
      is_inline: Some(true),
      is_self_closing: None,
      collapses_inner_white_space: None,
      alias_tag_id: None,
    },
  )];
  let md = html_to_markdown(
    "<p><b></b>x</p>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(overrides),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert_eq!(md, "****x");
}

#[test]
fn literal_exit_override_releases_open_marker() {
  let overrides = vec![(
    "b".to_string(),
    TagOverrideConfig {
      exit: Some(String::new()),
      ..Default::default()
    },
  )];
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(overrides),
      ..Default::default()
    }),
    ..Default::default()
  });
  let first = stream.process_chunk("<p><b></b><span>");
  assert!(
    first.contains("**"),
    "literal exit held in buffer: {first:?}"
  );
}

#[test]
fn block_code_fence_is_not_tracked_as_inline_marker() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let first = stream.process_chunk("<pre><code><span>");
  assert!(
    first.contains("```"),
    "code fence held in buffer: {first:?}"
  );
}

// A <pre> whose content ends in blank lines followed by an inline sibling must
// still close its fence on its own line and separate the sibling (#148).
#[test]
fn pre_with_trailing_blank_lines_closes_fence_before_inline_sibling() {
  assert_eq!(
    convert("<div><pre>a\nb\n\n</pre><a href=\"#x\">link</a></div>"),
    "```\na\nb\n\n\n```\n\n[link](#x)"
  );
}

// The xml2rfc case from the issue: closing fence must not glue to the pilcrow
// link, which would leave the fence open and swallow the rest of the document.
#[test]
fn block_pre_does_not_glue_closing_fence_to_inline_link() {
  let result = convert(
    "<div><pre>GET /hello.txt HTTP/1.1\n\n</pre><a href=\"#s\" class=\"pilcrow\">P</a></div>",
  );
  assert!(
    result.contains("```\n\n[P](#s)"),
    "fence glued to inline link: {result:?}"
  );
}

// A trailing-blank <pre> followed by plain text must also separate cleanly.
#[test]
fn pre_with_trailing_blank_lines_separates_following_text() {
  assert_eq!(
    convert("<div><pre>a\nb\n\n</pre>after</div>"),
    "```\na\nb\n\n\n```\n\nafter"
  );
}

// ── Blockquotes ──

#[test]
fn simple_blockquote() {
  assert_eq!(
    convert("<blockquote>This is a quote</blockquote>"),
    "> This is a quote"
  );
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
  assert_eq!(
    convert("<ol><li>First</li><li>Second</li></ol>"),
    "1. First\n2. Second"
  );
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
  // Nested ordered lists require 3-space continuation indent (length of
  // the outer "1. " marker) so CommonMark parses the inner list as nested
  // rather than as peer items of the outer.
  assert_eq!(
    convert("<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>"),
    "1. Level 1\n   1. Level 1.1\n2. Level 2"
  );
}

#[test]
fn mixed_nested_lists() {
  assert_eq!(
    convert("<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>"),
    "- Unordered\n  1. Ordered"
  );
}

#[test]
fn ordered_list_with_code_block_uses_marker_width_indent() {
  // Ordered list continuation must be indented by the marker width
  // (3 columns for "1. ") so the fenced code block parses as part of the
  // list item. 2-space indent would dump the code block outside the list.
  let html = "<ol><li><p>x</p><pre><code>y</code></pre><p>z</p></li></ol>";
  assert_eq!(convert(html), "1. x\n\n   ```\n   y\n   ```\n\n   z");
}

#[test]
fn ordered_list_double_digit_marker_uses_wider_indent() {
  // Once the marker reaches 2 digits ("10. " = 4 columns), continuation
  // indent must widen to match.
  let html = "<ol>\
        <li>a</li><li>b</li><li>c</li><li>d</li><li>e</li>\
        <li>f</li><li>g</li><li>h</li><li>i</li>\
        <li>j<ol><li>nested</li></ol></li></ol>";
  let md = convert(html);
  assert!(
    md.ends_with("10. j\n    1. nested"),
    "expected 4-space indent before nested item, got: {md:?}"
  );
}

#[test]
fn nested_ul_inside_ol_uses_ordered_parent_indent() {
  // <ol><li><ul><li>inner</li></ul></li></ol>: the inner "- " must be
  // indented by the outer "1. " width (3), not 2.
  let html = "<ol><li>outer<ul><li>inner</li></ul></li></ol>";
  assert_eq!(convert(html), "1. outer\n   - inner");
}

// https://github.com/harlan-zw/mdream/issues/77
#[test]
fn loose_ordered_list_with_code_block_renders_as_commonmark_loose_list() {
  // The user's reproducer from issue #77. With 3-space indent the markdown
  // renders in CommonMark as a 2-item list with nested code block; with the
  // old 2-space indent the code block fell outside the list entirely.
  let html = r#"
<ol>
<li>
<p>text</p>
<pre><code>text</code></pre>
<p>text</p>
</li>
<li>
<p>text</p>
</li>
</ol>
"#;
  assert_eq!(
    convert(html),
    "1. text\n\n   ```\n   text\n   ```\n\n   text\n2. text"
  );
}

// https://github.com/harlan-zw/mdream/issues/81
#[test]
fn multiple_paragraphs_in_list_item_separated_by_blank_lines() {
  let html = r#"
<ol>
    <li>
        <p><strong>text</strong>:</p>
        <p>text</p>
        <p>text</p>
        <pre><code>text</code></pre>
    </li>
</ol>
"#;
  assert_eq!(
    convert(html),
    "1. **text**:\n\n   text\n\n   text\n\n   ```\n   text\n   ```"
  );
}

#[test]
fn multiple_paragraphs_in_unordered_list_item_form_loose_list() {
  let html = "<ul><li><p>a</p><p>b</p></li></ul>";
  assert_eq!(convert(html), "- a\n\n  b");
}

#[test]
fn multiple_paragraphs_in_list_item_inside_table_cell_stay_inline() {
  // Lists inside table cells are preserved as raw HTML, so paragraph breaks
  // must not inject blank markdown lines that would split the table row.
  let html = "<table><tr><td><ul><li><p>a</p><p>b</p></li></ul></td></tr></table>";
  let out = convert(html);
  assert!(
    out.contains("<ul><li>"),
    "expected raw list HTML in table cell, got: {out}"
  );
  assert!(
    !out.contains("\n\n"),
    "expected no blank lines inside table cell, got: {out}"
  );
}

// https://github.com/harlan-zw/mdream/issues/147
#[test]
fn pre_code_inside_table_cell_stays_on_one_row() {
  // A GFM table row must stay on one line: <pre>/<code> in a cell emit raw
  // HTML with <br> for content newlines instead of a fenced code block.
  let html = "<table><tr><td><pre><code>a\nb</code></pre></td><td>ok</td></tr></table>";
  assert_eq!(
    convert(html),
    "| <pre><code>a<br>b</code></pre> | ok |\n| --- | --- |"
  );
}

#[test]
fn bare_pre_inside_table_cell_stays_on_one_row() {
  let html = "<table><tr><td><pre>x\ny\nz</pre></td><td>ok</td></tr></table>";
  assert_eq!(
    convert(html),
    "| <pre>x<br>y<br>z</pre> | ok |\n| --- | --- |"
  );
}

#[test]
fn details_inside_table_cell_stays_on_one_row() {
  let html = "<table><tr><td><details><summary>s</summary>d</details></td><td>ok</td></tr></table>";
  assert_eq!(
    convert(html),
    "| <details><summary>s</summary>d</details> | ok |\n| --- | --- |"
  );
}

#[test]
fn pre_code_outside_table_still_fenced() {
  // Regression: normal (non-cell) <pre><code> keeps the fenced code block.
  assert_eq!(convert("<pre><code>a\nb</code></pre>"), "```\na\nb\n```");
}

#[test]
fn pre_code_inside_table_cell_escapes_html() {
  // Raw <pre><code> emission in a cell must HTML-escape decoded `<`/`>`/`&` so
  // source like `<script>` cannot render as live HTML (XSS regression, #147).
  let html = "<table><tr><td><pre><code>&lt;script&gt;alert(1)&amp;2&lt;/script&gt;</code></pre></td><td>ok</td></tr></table>";
  assert_eq!(
    convert(html),
    "| <pre><code>&lt;script&gt;alert(1)&amp;2&lt;/script&gt;</code></pre> | ok |\n| --- | --- |"
  );
}

// https://github.com/harlan-zw/mdream/issues/76
#[test]
fn inline_code_inside_strong_inside_list_no_leading_space() {
  assert_eq!(
    convert("<ul><li><strong><code>text</code></strong></li></ul>"),
    "- **`text`**"
  );
}

#[test]
fn adjacent_inline_code_in_list_separated_to_avoid_merging() {
  // Without a separator, ` `a``b` ` parses as a single code span with
  // literal content ``a``b``. A space keeps them as two distinct spans.
  assert_eq!(
    convert("<li><code>a</code><code>b</code></li>"),
    "- `a` `b`"
  );
}

#[test]
fn inline_code_inside_span_inside_list_keeps_separator_space() {
  // <span> is a non-delimiter wrapper: the separator space must still be
  // inserted between preceding text and the backtick.
  assert_eq!(
    convert("<ul><li>prefix<span><code>x</code></span></li></ul>"),
    "- prefix `x`"
  );
}

#[test]
fn inline_code_after_whitespace_in_list_item_does_not_duplicate_separator() {
  // Trailing space in the buffer must not stack with an extra separator
  // space, otherwise we'd produce `prefix  `x``.
  assert_eq!(
    convert("<ul><li>prefix <span><code>x</code></span></li></ul>"),
    "- prefix `x`"
  );
}

#[test]
fn inline_code_inside_wrappers_inside_list_no_stray_space() {
  // No leading space should be injected when the wrapper opener is the last
  // thing emitted, otherwise pairing breaks for strikethrough and link
  // text, and the space leaks into HTML passthrough content.
  assert_eq!(
    convert("<ul><li><del><code>x</code></del></li></ul>"),
    "- ~~`x`~~"
  );
  assert_eq!(
    convert("<ul><li><a href=\"#\"><code>x</code></a></li></ul>"),
    "- [`x`](#)"
  );
  assert_eq!(
    convert("<ul><li><mark><code>x</code></mark></li></ul>"),
    "- <mark>`x`</mark>"
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
fn strips_datalist() {
  // <datalist> options are inert autocomplete data, never rendered.
  assert_eq!(
    convert(r#"<p>Before</p><datalist><option value="V">Hidden</option></datalist><p>After</p>"#),
    "Before\n\nAfter"
  );
  assert_eq!(
    convert(
      "<p>Before</p><datalist><option>One</option><option>Two</option></datalist><p>After</p>"
    ),
    "Before\n\nAfter"
  );
}

#[test]
fn strips_template_text() {
  // <template> content is inert and must never leak into output (issue #101).
  assert_eq!(
    convert("<p>Visible</p><template>Hidden keyword stuffing text</template><p>After</p>"),
    "Visible\n\nAfter"
  );
}

#[test]
fn strips_template_nested_elements() {
  assert_eq!(
    convert("<p>Visible</p><template><p>Nested hidden</p><span>more</span></template><p>After</p>"),
    "Visible\n\nAfter"
  );
}

#[test]
fn template_with_quotes_closes_correctly() {
  assert_eq!(
    convert(r#"<p>A</p><template>It's a "quoted" keyword</template><p>B</p>"#),
    "A\n\nB"
  );
  assert_eq!(
    convert(r#"<p>A</p><template><a href="x">it's</a></template><p>B</p>"#),
    "A\n\nB"
  );
}

#[test]
fn bare_pre_becomes_code_block() {
  // A <pre> without a <code> child becomes a fenced code block (issue #97).
  assert_eq!(convert("<pre>const x = 1</pre>"), "```\nconst x = 1\n```");
  assert_eq!(
    convert("<pre>line1\nline2\n  indented</pre>"),
    "```\nline1\nline2\n  indented\n```"
  );
}

#[test]
fn bare_pre_reads_language_from_class() {
  assert_eq!(
    convert(r#"<pre class="language-js">const x = 1</pre>"#),
    "```js\nconst x = 1\n```"
  );
}

#[test]
fn pre_code_block_unchanged() {
  // The existing <pre><code> path is untouched.
  assert_eq!(
    convert("<pre><code>const x = 1</code></pre>"),
    "```\nconst x = 1\n```"
  );
  assert_eq!(
    convert(r#"<pre><code class="language-js">const x = 1</code></pre>"#),
    "```js\nconst x = 1\n```"
  );
}

#[test]
fn empty_and_whitespace_pre_emit_no_fence() {
  assert_eq!(convert("<pre></pre>"), "");
  assert_eq!(convert("<pre>   \n  </pre>"), "");
  assert_eq!(convert("<p>a</p><pre></pre><p>b</p>"), "a\n\nb");
  // A whitespace-only <pre> must not leak its whitespace between blocks.
  assert_eq!(convert("<p>a</p><pre>   \n  </pre><p>b</p>"), "a\n\nb");
}

#[test]
fn pre_with_text_and_code_child_single_fence() {
  // Mixed text + <code> must not double-fence.
  assert_eq!(
    convert("<pre>text<code>codepart</code>more</pre>"),
    "```\ntextcodepartmore\n```"
  );
  // Whitespace around a sole <code> child keeps the <code> as fence owner.
  assert_eq!(
    convert("<pre> <code>spaced code</code> </pre>"),
    "```\nspaced code\n```"
  );
}

#[test]
fn bare_pre_in_list_item_is_indented() {
  assert_eq!(
    convert("<ul><li>item<pre>code\nblock</pre></li></ul>"),
    "- item\n\n  ```\n  code\n  block\n  ```"
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
    html.push_str(&format!("<th>Col{i}</th>"));
  }
  html.push_str("</tr>");
  for _ in 0..100 {
    html.push_str("<tr>");
    for i in 0..10 {
      html.push_str(&format!("<td>Val{i}</td>"));
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
  assert_eq!(
    convert("<mark>highlighted</mark>"),
    "<mark>highlighted</mark>"
  );
}

#[test]
fn kbd_tag() {
  assert_eq!(convert("<kbd>Ctrl+C</kbd>"), "`Ctrl+C`");
}

// ── Extraction ──

fn convert_with_filter(html: &str) -> String {
  // Any filter config activates the filter plugin (and its hidden-content stripping).
  html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        filter: Some(FilterConfig::exclude(&["nav"])),
        ..Default::default()
      }),
      ..Default::default()
    },
  )
}

#[test]
fn filter_strips_hidden_content_and_subtree() {
  // display:none / visibility:hidden / position:absolute and the hidden attribute
  // drop the element and its whole subtree; hidden="until-found" stays.
  assert_eq!(
    convert_with_filter("<p>a</p><div style=\"display:none\">H</div><p>b</p>"),
    "a\n\nb"
  );
  assert_eq!(
    convert_with_filter("<p>a</p><div style=\"display: none\">H</div><p>b</p>"),
    "a\n\nb"
  );
  assert_eq!(
    convert_with_filter("<p>a</p><div style=\"visibility:hidden\">H</div><p>b</p>"),
    "a\n\nb"
  );
  assert_eq!(
    convert_with_filter("<p>a</p><div hidden>H</div><p>b</p>"),
    "a\n\nb"
  );
  assert_eq!(
    convert_with_filter(
      "<p>a</p><div style=\"display:none\"><section><p>H</p></section></div><p>b</p>"
    ),
    "a\n\nb"
  );
  assert_eq!(
    convert_with_filter("<p>a</p><div style=\"position:absolute\"><p>H</p></div><p>b</p>"),
    "a\n\nb"
  );
  // Visible content and revealable hidden="until-found" are kept.
  assert_eq!(
    convert_with_filter("<p>a</p><div>V</div><p>b</p>"),
    "a\n\nV\n\nb"
  );
  assert_eq!(
    convert_with_filter("<p>a</p><div hidden=\"until-found\">K</div><p>b</p>"),
    "a\n\nK\n\nb"
  );
  // until-found is an enumerated keyword: case-insensitive, so still kept.
  assert_eq!(
    convert_with_filter("<p>a</p><div hidden=\"UNTIL-FOUND\">K</div><p>b</p>"),
    "a\n\nK\n\nb"
  );
  // Unrelated CSS keywords must not false-match (background-attachment:fixed
  // contains "fixed"; transition contains "absolute" only via other props).
  assert_eq!(
    convert_with_filter("<p>a</p><div style=\"background-attachment:fixed\">V</div><p>b</p>"),
    "a\n\nV\n\nb"
  );
  assert_eq!(
    convert_with_filter("<p>a</p><div style=\"display:flex\">V</div><p>b</p>"),
    "a\n\nV\n\nb"
  );
}

#[test]
fn extraction_by_tag() {
  let result = html_to_markdown_result(
    "<html><body><h1>Title</h1><p>Content</p><h2>Sub</h2></body></html>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        extraction: Some(ExtractionConfig {
          selectors: vec!["h1".to_string(), "h2".to_string()],
        }),
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
        extraction: Some(ExtractionConfig {
          selectors: vec![".target".to_string()],
        }),
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
        extraction: Some(ExtractionConfig {
          selectors: vec!["#x".to_string()],
        }),
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
        extraction: Some(ExtractionConfig {
          selectors: vec!["[href]".to_string()],
        }),
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
        extraction: Some(ExtractionConfig {
          selectors: vec!["h1".to_string()],
        }),
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
        filter: Some(FilterConfig {
          exclude: Some(vec![".ad".to_string()]),
          ..Default::default()
        }),
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
        filter: Some(FilterConfig {
          include: Some(vec![".content".to_string()]),
          ..Default::default()
        }),
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
        filter: Some(FilterConfig {
          exclude: Some(vec!["div.foo#bar".to_string()]),
          ..Default::default()
        }),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert!(md.contains("Keep"));
  assert!(!md.contains("Remove"));
}

#[test]
fn filter_exclude_empty_link_title_in_footer() {
  // Regression: <a title="Twitter"> inside excluded <footer> leaked "Twitter" into output
  // because empty-link title synthesis didn't check excluded_from_markdown
  let html = r#"<html><body>
<main><h1>Hello</h1><p>Content</p></main>
<footer><a href="https://x.com" title="Twitter"><div class="icon"></div></a></footer>
</body></html>"#;
  let md = html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        filter: Some(FilterConfig {
          exclude: Some(vec!["footer".to_string()]),
          ..Default::default()
        }),
        isolate_main: Some(IsolateMainConfig::default()),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert!(md.contains("Hello"));
  assert!(md.contains("Content"));
  assert!(
    !md.contains("Twitter"),
    "title attribute from excluded footer should not leak. Got:\n{md}"
  );
}

// ── Tag Overrides ──

#[test]
fn tag_override_enter_exit() {
  let overrides = vec![(
    "custom-tag".to_string(),
    TagOverrideConfig {
      enter: Some("<<".to_string()),
      exit: Some(">>".to_string()),
      spacing: Some([0, 0]),
      is_inline: Some(true),
      is_self_closing: None,
      collapses_inner_white_space: None,
      alias_tag_id: Some(mdream::consts::TAG_SPAN),
    },
  )];
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
  let overrides = vec![(
    "div".to_string(),
    TagOverrideConfig {
      enter: None,
      exit: None,
      spacing: Some([0, 0]),
      is_inline: None,
      is_self_closing: None,
      collapses_inner_white_space: None,
      alias_tag_id: None,
    },
  )];
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
  html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      clean_urls: true,
      ..Default::default()
    },
  )
}

fn convert_clean_with_origin(html: &str, origin: &str) -> String {
  html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      origin: Some(origin.to_string()),
      clean_urls: true,
      ..Default::default()
    },
  )
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
    convert_clean(
      r#"<a href="https://example.com/page?id=5&utm_source=newsletter&ref=home">Link</a>"#
    ),
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
    convert_clean_with_origin(
      r#"<a href="/page?utm_campaign=test&id=1">Link</a>"#,
      "https://example.com"
    ),
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
  html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      clean: Some(clean),
      ..Default::default()
    },
  )
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
    convert_with_clean(
      r##"<h2>My Section</h2><a href="#my-section">Link</a>"##,
      clean_all()
    ),
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
    convert_with_clean(
      r#"<a href="https://example.com/page#section">Link</a>"#,
      clean_all()
    ),
    "[Link](https://example.com/page#section)"
  );
}

#[test]
fn clean_self_referencing_heading_link() {
  assert_eq!(
    convert_with_clean(
      r##"<h2><a href="#new-project">New Project</a></h2>"##,
      clean_all()
    ),
    "## New Project"
  );
}

#[test]
fn clean_collapses_blank_lines() {
  let md = convert_with_clean(
    r"<p>First</p><br><br><br><br><br><p>Second</p>",
    clean_all(),
  );
  assert!(
    !md.contains("\n\n\n"),
    "Should not have 3+ consecutive newlines"
  );
  assert!(md.contains("First"));
  assert!(md.contains("Second"));
}

#[test]
fn clean_heading_with_formatting() {
  assert_eq!(
    convert_with_clean(
      r##"<h2><strong>Bold</strong> Heading</h2><a href="#bold-heading">Link</a>"##,
      clean_all()
    ),
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
    convert_with_clean(
      r#"<a href="https://example.com">https://example.com</a>"#,
      clean_all()
    ),
    "https://example.com"
  );
}

#[test]
fn clean_redundant_link_with_origin() {
  assert_eq!(
    convert_with_clean(
      r#"<a href="https://example.com/page">https://example.com/page</a>"#,
      clean_all()
    ),
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
    convert_with_clean(
      r##"<h2><a href="#my-section">My Section</a></h2>"##,
      clean_all()
    ),
    "## My Section"
  );
}

#[test]
fn clean_self_link_heading_keeps_external() {
  assert_eq!(
    convert_with_clean(
      r#"<h2><a href="https://example.com">My Section</a></h2>"#,
      clean_all()
    ),
    "## [My Section](https://example.com)"
  );
}

#[test]
fn clean_self_link_heading_non_heading_kept() {
  assert_eq!(
    convert_with_clean(r##"<p><a href="#section">Section</a></p>"##, clean_all()),
    "Section" // fragment stripped by clean.fragments since no matching heading
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
  assert_eq!(
    convert("<p>&alpha;&beta;&gamma;</p>"),
    "\u{03B1}\u{03B2}\u{03B3}"
  );
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
  // Consume the full digit run, saturating out-of-range values to U+FFFD.
  assert_eq!(convert("<p>&#99999999999;</p>"), "\u{FFFD}");
  assert_eq!(convert("<p>&#xFFFFFFFFF;</p>"), "\u{FFFD}");
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
  html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        isolate_main: Some(mdream::types::IsolateMainConfig {}),
        ..Default::default()
      }),
      ..Default::default()
    },
  )
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
  let html = r"<body><nav>Nav</nav><div><div><div><div><div><div><div><div><div><div><main><h1>Deep Title</h1><p>Deep content</p></main></div></div></div></div></div></div></div></div></div></div><footer>Footer</footer></body>";
  let result = convert_with_isolate_main(html);
  assert!(result.contains("# Deep Title"));
  assert!(result.contains("Deep content"));
  assert!(!result.contains("Nav"));
  assert!(!result.contains("Footer"));
}

// ── Script non-nesting: less-than operator ──

#[test]
fn script_less_than_space_does_not_break_body() {
  let result = convert("<head><script>var x = 1 < 2;</script></head><body><p>Hello</p></body>");
  assert!(result.contains("Hello"));
}

#[test]
fn script_for_loop_comparison_does_not_break_body() {
  let result = convert(
    "<head><script>for(var i=0; i < arr.length; i++){}</script></head><body><p>Content</p></body>",
  );
  assert!(result.contains("Content"));
}

#[test]
fn script_identifier_comparison_does_not_break_body() {
  let result =
    convert("<head><script>if (a < b) { c(); }</script></head><body><p>Visible</p></body>");
  assert!(result.contains("Visible"));
}

#[test]
fn script_multiple_less_than_operators() {
  let result = convert(
    "<head><script>var x = 1 < 2; var y = 3 < 4; var z = a < b;</script></head><body><p>After</p></body>",
  );
  assert!(result.contains("After"));
}

#[test]
fn script_closing_tag_inside_string_does_not_break_body() {
  let result =
    convert(r#"<head><script>document.write("</div>");</script></head><body><p>Hello</p></body>"#);
  assert!(result.contains("Hello"));
}

#[test]
fn script_shopify_for_loop_pattern() {
  let html = r#"<head><script>(function() {
  var urls = ["https:\/\/example.com\/x.js"];
  for (var i = 0; i < urls.length; i++) {
    var s = document.createElement('script');
    s.src = urls[i];
    var x = document.getElementsByTagName('script')[0];
    x.parentNode.insertBefore(s, x);
  }
})();</script></head><body><p>Shopify Content</p></body>"#;
  let result = convert(html);
  assert!(result.contains("Shopify Content"));
}

#[test]
fn script_multiple_inline_scripts_in_head() {
  let html = r"<head>
<script>var x = 1 < 2;</script>
<script>var y = a < b;</script>
<script>for(var i=0;i<10;i++){}</script>
</head><body><h1>Title</h1><p>Body text</p></body>";
  let result = convert(html);
  assert!(result.contains("Title"));
  assert!(result.contains("Body text"));
}

#[test]
fn script_in_body_with_less_than() {
  let result = convert("<body><p>Before</p><script>var x = 1 < 2;</script><p>After</p></body>");
  assert!(result.contains("Before"));
  assert!(result.contains("After"));
}

#[test]
fn style_tag_with_angle_bracket_selector() {
  let result =
    convert("<head><style>div > p { color: red; }</style></head><body><p>Styled</p></body>");
  assert!(result.contains("Styled"));
}

#[test]
fn script_with_inline_svg_containing_script_tag_reference() {
  // Script content that mentions <script> in a JS comment or string should not
  // corrupt the tag stack. The parser must only exit non-nesting mode on the
  // matching closing tag (</script>), ignoring opening tags like <script> in text.
  let html = r#"<head><script>
    // load <script> in <head> via nuxt.config.ts
    var icon = '<svg width="48" height="48"><path d="M12 9v4" stroke-width="2" stroke-linecap="round"/></svg>';
    for (var i = 0; i < buttons.length; i++) { }
    </script></head><body><main><h1>Title</h1><p>Body content here</p></main></body>"#;
  let result = convert(html);
  assert!(
    result.contains("Title"),
    "Title missing from output: {result}"
  );
  assert!(
    result.contains("Body content here"),
    "Body content missing from output: {result}"
  );
}

// ── Script non-nesting: edge cases ──

#[test]
fn script_html_comment_inside_script_does_not_eat_content() {
  // <!-- --> inside <script> should NOT trigger comment processing
  let html = r"<head><script>
    <!-- old browser hiding
    var x = 1;
    // -->
    </script></head><body><p>Visible</p></body>";
  let result = convert(html);
  assert!(
    result.contains("Visible"),
    "HTML comment inside script ate body content: {result}"
  );
}

#[test]
fn script_html_comment_like_string_does_not_eat_content() {
  // String containing <!-- should not eat subsequent content
  let html =
    r#"<head><script>var x = "<!--"; var y = "-->";</script></head><body><p>After</p></body>"#;
  let result = convert(html);
  assert!(
    result.contains("After"),
    "Comment-like string in script ate body content: {result}"
  );
}

#[test]
fn script_nested_template_literal() {
  // Nested template literals break simple toggle tracking
  let html =
    r"<head><script>var x = `outer ${`inner`} end`;</script></head><body><p>Content</p></body>";
  let result = convert(html);
  assert!(
    result.contains("Content"),
    "Nested template literal broke parsing: {result}"
  );
}

#[test]
fn script_escaped_closing_tag_in_string() {
  // Properly escaped </script> in JS (as web developers should write it)
  let html = r"<head><script>var x = '<\/script>';</script></head><body><p>Escaped</p></body>";
  let result = convert(html);
  assert!(
    result.contains("Escaped"),
    "Escaped closing tag broke parsing: {result}"
  );
}

#[test]
fn script_with_cdata_like_content() {
  let html = r"<head><script>//<![CDATA[
    var x = 1 < 2;
    //]]></script></head><body><p>CDATA</p></body>";
  let result = convert(html);
  assert!(
    result.contains("CDATA"),
    "CDATA-like content in script broke parsing: {result}"
  );
}

#[test]
fn cdata_dropped_by_default() {
  // CDATA sections are discarded unless opted into via tagOverrides.
  let md = convert("before <![CDATA[secret payload]]> after");
  assert!(
    !md.contains("secret payload"),
    "CDATA leaked into output: {md}"
  );
}

#[test]
fn cdata_emitted_via_tag_override() {
  let overrides = vec![(
    "#cdata-section".to_string(),
    TagOverrideConfig {
      enter: None,
      exit: None,
      spacing: None,
      is_inline: None,
      is_self_closing: None,
      collapses_inner_white_space: None,
      alias_tag_id: Some(mdream::consts::TAG_PRE),
    },
  )];
  let md = html_to_markdown(
    "<body>before <pre><code><![CDATA[\none two\nthree four\n]]></code></pre> after</body>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(overrides),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert!(md.contains("one two"), "CDATA content missing: {md}");
  assert!(md.contains("three four"), "CDATA content missing: {md}");
}

#[test]
fn cdata_emitted_via_enter_exit_override() {
  let overrides = vec![(
    "#cdata-section".to_string(),
    TagOverrideConfig {
      enter: Some("[".to_string()),
      exit: Some("]".to_string()),
      spacing: Some([0, 0]),
      is_inline: Some(true),
      is_self_closing: None,
      collapses_inner_white_space: None,
      alias_tag_id: None,
    },
  )];
  let md = html_to_markdown(
    "<body>a<![CDATA[hidden]]>b</body>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(overrides),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert_eq!(md, "a[hidden]b");
}

#[test]
fn multiple_scripts_interleaved_with_content() {
  let html = r#"<body>
    <p>Before</p>
    <script>var a = 1 < 2;</script>
    <p>Middle</p>
    <script>var b = "<!-- not a comment -->";</script>
    <p>After</p>
    </body>"#;
  let result = convert(html);
  assert!(result.contains("Before"), "Missing Before: {result}");
  assert!(result.contains("Middle"), "Missing Middle: {result}");
  assert!(result.contains("After"), "Missing After: {result}");
}

#[test]
fn script_with_less_than_followed_by_exclamation() {
  // <! inside script should not trigger comment/doctype processing
  let html = r"<head><script>if (x <! y) { z(); }</script></head><body><p>Bang</p></body>";
  let result = convert(html);
  assert!(
    result.contains("Bang"),
    "<! operator in script broke parsing: {result}"
  );
}

// Issue #84: tag matching was previously dispatched on (first byte, length) only,
// so unknown tags like `<ex>` collided with built-ins (TAG_EM) and got rendered
// as emphasis. These tests pin the behaviour: unknown tags pass through as plain
// text content, leaving users to opt them into rendering via `tagOverrides`.

#[test]
fn unknown_two_letter_tag_does_not_collide_with_em() {
  assert_eq!(convert("<ex>foo</ex>"), "foo");
}

#[test]
fn unknown_tags_do_not_collide_with_builtins() {
  // Each input shares a (first_byte, length) signature with a built-in tag.
  // Strict matching should keep the literal text only.
  assert_eq!(convert("<fxxm>foo</fxxm>"), "foo"); // would have aliased to FORM
  assert_eq!(convert("<ix>foo</ix>"), "foo"); // would have aliased to I
  assert_eq!(convert("<kxd>foo</kxd>"), "foo"); // would have aliased to KBD
  assert_eq!(convert("<hxxxxx>foo</hxxxxx>"), "foo"); // would have aliased to HEADER
  assert_eq!(convert("<ifxxxx>foo</ifxxxx>"), "foo"); // would have aliased to IFRAME
}

#[test]
fn custom_web_component_tag_is_inert_by_default() {
  // Web components and other custom elements are not built-ins. They should
  // simply emit their text content rather than picking up unrelated formatting.
  assert_eq!(convert("<my-widget>hello</my-widget>"), "hello");
}

#[test]
fn unknown_inline_tag_does_not_fragment_paragraph() {
  // Unknown tags default to inline so they don't insert block breaks around
  // their content. Regression guard: this previously emitted
  // "before\n\nfoo\n\n after" because unknown tags inherited block-default
  // spacing.
  assert_eq!(
    convert("<p>before <ex>foo</ex> after</p>"),
    "before foo after"
  );
}

#[test]
fn adjacent_buttons_stay_inline() {
  // <button> is inline but previously inherited block-default spacing, so it
  // injected a paragraph break that stranded trailing text/punctuation and
  // split adjacent buttons across lines. Regression guard for issue #133.
  assert_eq!(
    convert("<button>One</button><button>Two</button>"),
    "OneTwo"
  );
  assert_eq!(
    convert("<button>One</button> <button>Two</button>"),
    "One Two"
  );
  assert_eq!(convert("<p>Click <button>Go</button>!</p>"), "Click Go!");
}

#[test]
fn root_inline_sibling_whitespace_is_preserved() {
  assert_eq!(convert("<span>One</span> <span>Two</span>"), "One Two");
  assert_eq!(
    convert("<strong>One</strong>\n<strong>Two</strong>"),
    "**One** **Two**"
  );
  assert_eq!(
    convert("<span>One</span> </bogus> <span>Two</span>"),
    "One Two"
  );
  assert_eq!(convert("  <span>One</span>  "), "One");
  assert_eq!(convert("<div>One</div> <div>Two</div>"), "One\n\nTwo");
  assert_eq!(
    convert("<ul></li>\n<li><input /> Active</li>\n<li><input /> Future</li>"),
    "- Active\n- Future"
  );
}

#[test]
fn root_inline_sibling_whitespace_streams_consistently() {
  let html = "<button>One</button> <button>Two</button>";
  for split in 0..=html.len() {
    let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
    let mut actual = stream.process_chunk(&html[..split]);
    actual.push_str(&stream.process_chunk(&html[split..]));
    actual.push_str(&stream.finish());
    assert_eq!(actual.trim_end(), "One Two", "split at byte {split}");
  }
}

#[test]
fn tag_override_alias_preserves_trailing_siblings() {
  // A string-shorthand tagOverride (`ex` aliased to `em`) used to drop every
  // sibling emitted after `</ex>` because the closing-tag lookup did not
  // resolve the alias, so the unmatched close popped the entire stack.
  let html = "<p>before <ex>foo</ex> after</p>";
  let opts = HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "ex".to_string(),
        TagOverrideConfig {
          enter: None,
          exit: None,
          spacing: None,
          is_inline: None,
          is_self_closing: None,
          collapses_inner_white_space: None,
          alias_tag_id: mdream::consts::get_tag_id("em"),
        },
      )]),
      ..Default::default()
    }),
    ..Default::default()
  };
  assert_eq!(html_to_markdown(html, opts), "before _foo_ after");
}
// ── Regression: CodeRabbit-found pre-existing bugs (PR #95) ──

#[test]
fn closing_tag_with_trailing_whitespace_still_closes() {
  // `</strong  >` must resolve as `strong` and close the node
  assert_eq!(convert("<strong>bold</strong  >"), "**bold**");
  assert_eq!(convert("<div><p>x</p></div   >"), "x");
}

#[test]
fn frontmatter_accessor_drops_reserved_additional_fields() {
  let result = html_to_markdown_result(
    "<html><head><title>Real Title</title></head><body><p>x</p></body></html>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        frontmatter: Some(FrontmatterConfig {
          additional_fields: Some(vec![
            ("title".to_string(), "Dupe".to_string()),
            ("custom".to_string(), "kept".to_string()),
          ]),
          meta_fields: None,
        }),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  let fm = result.frontmatter.unwrap();
  // reserved `title` from additional_fields is filtered out — no duplicate,
  // and the real <title> value wins (not overwritten by additional_fields)
  assert_eq!(fm.iter().filter(|(k, _)| k == "title").count(), 1);
  assert!(fm.iter().any(|(k, v)| k == "title" && v == "Real Title"));
  assert!(fm.iter().any(|(k, v)| k == "custom" && v == "kept"));
}

#[test]
fn top_level_text_node_is_not_dropped() {
  // Top-level (root) text nodes with no element parent were dropped because
  // process_text_buffer bailed on an empty stack (issue #93). Such text is
  // flushed when the next tag opens.
  assert_eq!(convert("foo <em>bar</em>"), "foo _bar_");
  assert_eq!(convert("a<em>b</em>c<em>d</em>"), "a_b_c_d_");
}

#[test]
fn tag_override_works_for_top_level_inline_tag() {
  // sup/sub overrides must work whether the tag is nested in a block or
  // sits at the top level of the input (issue #93).
  for input in ["<p>foo <sup>bar</sup></p>", "foo <sup>bar</sup>"] {
    let opts = HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(vec![(
          "sup".to_string(),
          TagOverrideConfig {
            enter: Some("^".into()),
            exit: Some("^".into()),
            ..Default::default()
          },
        )]),
        ..Default::default()
      }),
      ..Default::default()
    };
    assert_eq!(
      html_to_markdown(input, opts),
      "foo ^bar^",
      "for input: {input:?}"
    );
  }
}

#[test]
fn script_and_style_closing_tags_are_not_quote_aware() {
  assert_eq!(convert("<style>/* it's */ a{}</style><p>BODY</p>"), "BODY");
  assert_eq!(
    convert("<script>var s=\"</script>\"<p>BODY</p>"),
    "\"\n\nBODY"
  );
  assert_eq!(
    convert("<style>.a::before{content:\"</style><p>BODY</p>"),
    "BODY"
  );
  assert_eq!(convert("<script>x</script/><p>BODY</p>"), "BODY");
}

#[test]
fn script_data_escaped_and_double_escaped_end_tags() {
  for html in [
    "<script><!--<script></script>--></script><p>BODY</p>",
    "<script><!--<ScRiPt></sCrIpT>--></script><p>BODY</p>",
    "<script><!--<script>--></script><p>BODY</p>",
    "<script><!--<script></scrip>--></script><p>BODY</p>",
    "<script><!--<script></script-->--></script><p>BODY</p>",
    "<script><!--><script></script><p>BODY</p>",
    "<script><!-- </script><p>BODY</p>",
  ] {
    assert_eq!(convert(html), "BODY", "for input: {html:?}");
  }

  for html in [
    "<script><!--<scriptx></script>--></script><p>BODY</p>",
    "<script><!--<scrip></script>--></script><p>BODY</p>",
    "<script><!--<script</script>--></script><p>BODY</p>",
    "<script><!--<script><script></script></script>--></script><p>BODY</p>",
  ] {
    assert_eq!(convert(html), "-->\n\nBODY", "for input: {html:?}");
  }
  assert_eq!(convert("<script><!--<script></script>--><p>BODY</p>"), "");
}

#[test]
fn streaming_script_data_double_escaped_matches_every_split() {
  for html in [
    "<script><!--<script></script>--></script><p>BODY</p>",
    "<script><!--><script></script><p>BODY</p>",
  ] {
    for split in 1..html.len() {
      let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
      let mut out = stream.process_chunk(&html[..split]);
      out.push_str(&stream.process_chunk(&html[split..]));
      out.push_str(&stream.finish());
      assert_eq!(out.trim(), "BODY", "input {html:?}, split at byte {split}");
    }
  }
}

#[test]
fn script_data_scanner_preserves_extraction_text() {
  let script_text = "<!--<script>const payload = \"value\";</script>-->";
  let html = format!("<script>{script_text}</script><p>BODY</p>");
  let result = html_to_markdown_result(
    &html,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        extraction: Some(ExtractionConfig {
          selectors: vec!["script".to_string()],
        }),
        ..Default::default()
      }),
      ..Default::default()
    },
  );

  assert_eq!(result.markdown, "BODY");
  let extracted = result.extracted.unwrap();
  assert_eq!(extracted[0].text_content, script_text);
}

#[test]
fn streaming_top_level_text_with_tag_override() {
  // Top-level text before an overridden inline tag must survive chunk
  // boundaries through the streaming path too (issue #93).
  let chunks = ["foo <su", "p>bar</sup>"];
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions {
    plugins: Some(PluginConfig {
      tag_overrides: Some(vec![(
        "sup".to_string(),
        TagOverrideConfig {
          enter: Some("^".into()),
          exit: Some("^".into()),
          ..Default::default()
        },
      )]),
      ..Default::default()
    }),
    ..Default::default()
  });
  let mut result = String::new();
  for chunk in &chunks {
    result.push_str(&stream.process_chunk(chunk));
  }
  result.push_str(&stream.finish());
  assert_eq!(result.trim(), "foo ^bar^");
}

#[test]
fn streaming_script_close_in_string_across_chunks() {
  let chunks = ["<script>var s = \"</scr", "ipt><p>BODY</p>"];
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let mut out = String::new();
  for c in &chunks {
    out.push_str(&stream.process_chunk(c));
  }
  out.push_str(&stream.finish());
  assert_eq!(out.trim(), "BODY");
}

#[test]
fn script_rawtext_with_multibyte_content_closes() {
  let html = "<script>var s = \"héllo – wörld\";</script><p>ok</p>";
  assert_eq!(convert(html), "ok");
}

// ── Wrap width (issue #106) ──

fn convert_wrapped(html: &str, width: usize) -> String {
  html_to_markdown(
    html,
    HTMLToMarkdownOptions::default().with_wrap_width(width),
  )
}

#[test]
fn wrap_disabled_by_default_is_byte_identical() {
  let html = "<p>The quick brown fox jumps over the lazy dog and then keeps on running well past the edge.</p>";
  assert_eq!(
    convert(html),
    html_to_markdown(html, HTMLToMarkdownOptions::default())
  );
  // A configured width of 0 is also a no-op.
  assert_eq!(convert(html), convert_wrapped(html, 0));
}

#[test]
fn wrap_breaks_prose_on_word_boundaries() {
  let out = convert_wrapped(
    "<p>The quick brown fox jumps over the lazy dog and then keeps on running well past the edge.</p>",
    40,
  );
  assert_eq!(
    out,
    "The quick brown fox jumps over the lazy\ndog and then keeps on running well past\nthe edge.",
  );
  for line in out.lines() {
    assert!(line.chars().count() <= 40, "line exceeds width: {line:?}");
  }
}

#[test]
fn wrap_preserves_inline_spacing() {
  // Boundary spaces around inline elements must survive wrapping.
  assert_eq!(
    convert_wrapped(
      "<p>see <em>this</em> word and more words after the emphasis here please now</p>",
      40
    ),
    "see _this_ word and more words after the\nemphasis here please now",
  );
}

// ── HTML hard breaks (issue #128) ──

#[test]
fn br_preserves_a_hard_break_with_and_without_wrapping() {
  let html = "<div>abc def ghi jkl mno<br/>111 222 333 444 555 666 777 888 999 000 abc</div>";

  assert_eq!(
    convert(html),
    "abc def ghi jkl mno  \n111 222 333 444 555 666 777 888 999 000 abc"
  );
  assert_eq!(
    convert_wrapped(html, 40),
    "abc def ghi jkl mno  \n111 222 333 444 555 666 777 888 999 000\nabc"
  );
  assert_eq!(convert("<p>first <br>second</p>"), "first  \nsecond");
}

#[test]
fn br_keeps_nested_block_continuation_prefixes() {
  assert_eq!(
    convert("<ul><li>first<br>second</li></ul>"),
    "- first  \n  second"
  );
  assert_eq!(
    convert("<blockquote><p>first<br>second</p></blockquote>"),
    "> first  \n> second"
  );
  assert_eq!(
    convert("<address>first<br>second</address>"),
    "<address>first<br>second</address>"
  );
  assert_eq!(convert("<h1>first<br>second</h1>"), "# first<br>second");
  assert_eq!(
    convert("<pre>first<br>second</pre>"),
    "```\nfirst\nsecond\n```"
  );
}

#[test]
fn wrap_never_splits_a_long_token() {
  let out = convert_wrapped(
    "<p>A superlongunbreakabletokenthatislongerthanthewrapwidthsoitoverflows end.</p>",
    40,
  );
  // The oversized word lands alone on its own line, intact.
  assert!(out.contains("superlongunbreakabletokenthatislongerthanthewrapwidthsoitoverflows"));
}

#[test]
fn wrap_skips_code_tables_and_headings() {
  // Fenced code is emitted verbatim.
  let code = convert_wrapped(
    "<pre><code>the quick brown fox jumps over the lazy dog and keeps going forever no wrap here</code></pre>",
    40,
  );
  assert!(
    code
      .contains("the quick brown fox jumps over the lazy dog and keeps going forever no wrap here")
  );
  // Headings are not wrapped.
  let heading = convert_wrapped(
    "<h1>The quick brown fox jumps over the lazy dog and never stops</h1>",
    40,
  );
  assert_eq!(
    heading,
    "# The quick brown fox jumps over the lazy dog and never stops"
  );
  // Table rows are not wrapped (would corrupt the row).
  let table = convert_wrapped(
    "<table><tr><th>The quick brown fox jumps over the lazy dog header</th></tr></table>",
    40,
  );
  assert_eq!(
    table.lines().next().unwrap(),
    "| The quick brown fox jumps over the lazy dog header |"
  );
}

#[test]
fn wrap_indents_blockquote_and_list_continuations() {
  let bq = convert_wrapped(
    "<blockquote><p>The quick brown fox jumps over the lazy dog and runs further still each day.</p></blockquote>",
    40,
  );
  for line in bq.lines() {
    assert!(
      line.starts_with("> "),
      "blockquote continuation lost prefix: {line:?}"
    );
  }
  let list = convert_wrapped(
    "<ul><li>The quick brown fox jumps over the lazy dog repeatedly without ever getting tired</li></ul>",
    40,
  );
  let mut lines = list.lines();
  assert!(lines.next().unwrap().starts_with("- "));
  for line in lines {
    assert!(
      line.starts_with("  "),
      "list continuation lost indent: {line:?}"
    );
  }
}

#[test]
fn wrap_works_across_streaming_chunks() {
  // A single long paragraph split mid-word across chunks must still wrap
  // identically to the one-shot conversion (no double spaces, correct breaks).
  let html = "<p>The quick brown fox jumps over the lazy dog and then keeps on running well past the edge of the field.</p>";
  let oneshot = convert_wrapped(html, 40);
  let mut stream =
    MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default().with_wrap_width(40));
  let mut out = String::new();
  let mid = html.len() / 2;
  out.push_str(&stream.process_chunk(&html[..mid]));
  out.push_str(&stream.process_chunk(&html[mid..]));
  out.push_str(&stream.finish());
  assert_eq!(out.trim_end(), oneshot);
}

#[test]
fn wrap_nested_blockquote_in_list_keeps_structure() {
  // Continuation prefix must follow the real nesting order: a blockquote
  // inside a list item indents (list) then quotes (`  > `), keeping the
  // quoted content within the list item's column.
  let out = convert_wrapped(
    "<ul><li><blockquote><p>The quick brown fox jumps over the lazy dog every day</p></blockquote></li></ul>",
    30,
  );
  for line in out.lines() {
    if line.trim().is_empty() {
      continue;
    }
    // Every quoted line stays inside the list item: indent before the `>`.
    assert!(
      line.starts_with("- ") || line.starts_with("  > "),
      "wrong nesting prefix: {line:?}"
    );
  }
}

#[test]
fn wrap_nested_list_in_blockquote_keeps_structure() {
  // A list inside a blockquote quotes first, then indents (`>   `).
  let out = convert_wrapped(
    "<blockquote><ul><li>The quick brown fox jumps over the lazy dog every day</li></ul></blockquote>",
    30,
  );
  let mut lines = out.lines();
  assert!(lines.next().unwrap().starts_with("> - "));
  for line in lines {
    assert!(
      line.starts_with(">   "),
      "list continuation left the blockquote: {line:?}"
    );
  }
}
