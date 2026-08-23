use std::fmt::Write as _;

use mdream::types::{
  ExtractionConfig, FilterConfig, FrontmatterConfig, HTMLToMarkdownOptions, IsolateMainConfig,
  OutputFormat, PluginConfig, TagOverrideConfig,
};
use mdream::{
  MarkdownStreamProcessor, html_to_html, html_to_markdown, html_to_markdown_result, html_to_text,
};

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

// ── Safe HTML output ──

#[test]
fn html_output_is_semantic_and_safe() {
  let options = HTMLToMarkdownOptions {
    origin: Some("https://mdream.dev".to_string()),
    clean_urls: true,
    ..Default::default()
  };
  assert_eq!(
    html_to_html(
      r#"<script>alert(1)</script><h1>Hello <em>world</em></h1><p onclick="x">Visit <a href="/docs?utm_source=x&section=api" title="Docs">docs</a> <a href="java&#9;script:x">bad</a><a href="file:///etc/passwd">file</a><img src="/safe.png" alt="A &quot;quote&quot;"><img src="data:text/html,x"><img src="blob:https://mdream.dev/id"></p><pre><code class="language-ts">1 &lt; 2</code></pre>"#,
      options,
    ),
    r#"<h1 id="hello-world">Hello <em>world</em></h1><p>Visit <a href="https://mdream.dev/docs?section=api" title="Docs">docs</a> badfile<img src="https://mdream.dev/safe.png" alt="A &quot;quote&quot;"></p><pre tabindex="0"><code class="language-ts">1 &lt; 2</code></pre>"#,
  );
  assert_eq!(
    html_to_html(
      r#"<table><tr><th align="CENTER">Value</th></tr></table><bdo>text</bdo>"#,
      HTMLToMarkdownOptions::default(),
    ),
    r#"<table><tr><th align="center">Value</th></tr></table>text"#,
  );
  assert_eq!(
    html_to_html(
      "<pre>a<pre>b</pre>c</pre><p>d</p>",
      HTMLToMarkdownOptions::default(),
    ),
    "<pre tabindex=\"0\"><code>abc</code></pre><p>d</p>",
  );
  assert_eq!(
    html_to_html(
      "<p><a href=\"/safe\">link</a><img src=\"/safe\"></p>",
      HTMLToMarkdownOptions {
        origin: Some("javascript:alert(1)".to_string()),
        ..Default::default()
      },
    ),
    "<p>link</p>",
  );
}

#[test]
fn html_output_stream_matches_batch_at_every_split() {
  let input = "<article><h2>Streaming</h2><p>A <code>small</code> example.</p></article>";
  let expected = html_to_html(input, HTMLToMarkdownOptions::default());
  for split in 0..=input.len() {
    let mut processor = MarkdownStreamProcessor::new_with_format(
      HTMLToMarkdownOptions::default(),
      OutputFormat::Html,
    );
    let mut output = processor.process_chunk(&input[..split]);
    output.push_str(&processor.process_chunk(&input[split..]));
    output.push_str(&processor.finish());
    assert_eq!(output, expected, "split={split}");
  }
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
  assert_eq!(
    convert_text("<ul><li>text<hr>after</li></ul>"),
    "text after"
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
  assert_eq!(convert("<eM>italic</Em>"), "*italic*");
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

#[test]
fn prose_br_serializes_as_gfm_hard_break() {
  const HARD_BREAK: &str = "  \n";

  for (html, expected) in [
    ("<p>first<br>second</p>", format!("first{HARD_BREAK}second")),
    (
      r"<p>before\<br>after</p>",
      format!(r"before\\{HARD_BREAK}after"),
    ),
    (
      "<p>first<br><br>third</p>",
      format!("first{HARD_BREAK}{HARD_BREAK}third"),
    ),
    (
      "<ul><li>first<br>second</li></ul>",
      format!("- first{HARD_BREAK}  second"),
    ),
    (
      "<blockquote><p>first<br>second</p></blockquote>",
      format!("> first{HARD_BREAK}> second"),
    ),
  ] {
    assert_eq!(convert(html), expected, "html={html:?}");
  }
}

#[test]
fn br_stays_html_where_a_markdown_line_break_is_not_safe() {
  for (html, expected) in [
    (
      "<table><tr><td>first<br>second</td></tr></table>",
      "| first<br>second |\n| --- |",
    ),
    ("<h1>first<br>second</h1>", "# first<br>second"),
    (
      "<address>first<br>second</address>",
      "<address>first<br>second</address>",
    ),
  ] {
    assert_eq!(convert(html), expected, "html={html:?}");
  }
}

#[test]
fn inline_code_br_does_not_emit_a_hard_break_marker() {
  assert_eq!(convert("<code>first<br>second</code>"), "`first\nsecond`");
}

#[test]
fn gfm_syntax_in_text_is_escaped() {
  for (html, expected) in [
    ("<p># heading</p>", r"\# heading"),
    ("<p>#</p>", r"\#"),
    ("<p>- item</p>", r"\- item"),
    ("<p>-</p>", r"\-"),
    ("<p>> quote</p>", r"\> quote"),
    ("<p>1. item</p>", r"1\. item"),
    ("<p>---</p>", r"\---"),
    ("<p>[label](url)</p>", r"\[label](url)"),
    (
      "<p>foo *bar* ~~baz~~ `qux`</p>",
      r"foo \*bar\* \~\~baz\~\~ \`qux\`",
    ),
    ("<p>&#35; heading</p>", r"\# heading"),
    ("<p>&amp;copy;</p>", r"\&copy;"),
  ] {
    assert_eq!(convert(html), expected, "html={html:?}");
  }
}

#[test]
fn gfm_text_escaping_preserves_generated_markers_and_code() {
  assert_eq!(
    // The trailing `#` is escaped: unescaped it is an ATX closing sequence and
    // GFM drops it. The leading one and `#hashtag` stay literal.
    convert("<h2># Heading #</h2><p>#hashtag</p><p>Just a - dash</p>"),
    "## # Heading \\#\n\n#hashtag\n\nJust a - dash"
  );
  assert_eq!(
    convert(
      "<p><strong>bold</strong> <del>gone</del> <code>*raw*</code></p><pre><code># raw</code></pre>"
    ),
    "**bold** ~~gone~~ `*raw*`\n\n```\n# raw\n```"
  );
}

#[test]
fn gfm_text_escaping_does_not_repeat_context_escapes() {
  assert_eq!(
    convert(r#"<a href="/x">a[b] *c*</a>"#),
    r"[a\[b\] \*c\*](/x)"
  );
  assert_eq!(
    convert("<table><tr><td>a|b</td></tr></table>"),
    "| a\\|b |\n| --- |"
  );
}

/// A browser navigates to the first `href`, so reporting the last one would
/// point somewhere the reader never goes.
#[test]
fn duplicate_attribute_keeps_the_first() {
  assert_eq!(
    convert("<a href=/first href=/second>link</a>"),
    "[link](/first)"
  );
  assert_eq!(
    convert("<img src=/first.png src=/second.png alt=x>"),
    "![x](/first.png)"
  );
}

#[test]
fn decoded_text_is_serialized_for_its_output_context() {
  assert_eq!(
    convert(r#"<a href="/safe">x&#93;(/evil) [y</a>"#),
    r"[x\](/evil) \[y](/safe)"
  );
  assert_eq!(
    convert("<table><tr><td>a&#124;b</td><td>c&#10;d</td></tr></table>"),
    "| a\\|b | c&#10;d |\n| --- | --- |"
  );

  let details = convert("<details><summary>&lt;img src=x onerror=alert(1)&gt;</summary></details>");
  assert!(
    details.contains("<summary>&lt;img src=x onerror=alert(1)&gt;</summary>"),
    "decoded text became active raw HTML: {details}"
  );

  let raw_code = convert(
    "<details><summary><code>&lt;img src=x onerror=alert(1)&gt;</code></summary></details>",
  );
  assert!(
    raw_code.contains("<code>&lt;img src=x onerror=alert(1)&gt;</code>"),
    "decoded code became active raw HTML: {raw_code}"
  );
  assert!(
    convert(r#"<details><a href="/x">a[b]</a></details>"#).contains("[a&#91;b&#93;](/x)"),
    "parser-added escapes must not become visible raw-HTML text"
  );
  assert!(
    convert(r#"<details><a href="/x">&#92;&#91;</a></details>"#).contains(r"[\&#91;](/x)"),
    "decoded backslashes must remain visible raw-HTML text"
  );
  assert!(
    convert("<details><table><tr><td><pre>a|b&#124;c</pre></td><td>x</td></tr></table></details>",)
      .contains("| <pre>a&#124;b&#124;c</pre> | x |"),
    "raw pre text must not split a GFM table row"
  );
  assert_eq!(
    convert("<table><tr><td><pre>a|b&#124;c</pre></td><td>x</td></tr></table>"),
    "| <pre>a&#124;b&#124;c</pre> | x |\n| --- | --- |"
  );
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
fn gfm_links_have_reparsable_destinations_and_titles() {
  for (html, expected) in [
    (r#"<a href="">text</a>"#, r"[text]()"),
    (r#"<a href="docs/a b">text</a>"#, r"[text](<docs/a b>)"),
    (
      r#"<a href="docs/(a)\file">text</a>"#,
      r"[text](<docs/(a)\\file>)",
    ),
    (
      r#"<a href="/x" title="say &quot;hi&quot; \ path">text</a>"#,
      r#"[text](/x "say \"hi\" \\ path")"#,
    ),
  ] {
    assert_eq!(convert(html), expected, "html={html:?}");
  }
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
    "[https://example.com/a b](<https://example.com/a b>)"
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
fn gfm_images_have_literal_alt_text_and_reparsable_titles() {
  for (html, expected) in [
    (
      r#"<img src="/x.png" alt="a ] \ *bold* _em_ &#96;code&#96;">"#,
      r"![a \] \\ \*bold\* \_em\_ \`code\`](/x.png)",
    ),
    (
      r#"<img src="/x.png" alt="alt" title="say &quot;hi&quot; \ path">"#,
      r#"![alt](/x.png "say \"hi\" \\ path")"#,
    ),
  ] {
    assert_eq!(convert(html), expected, "html={html:?}");
  }
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
  assert_eq!(convert("<p><em>abc </em>def</p>"), "*abc* def");
  assert_eq!(
    convert("<p><strong><em>abc </em></strong>def</p>"),
    "***abc*** def"
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
  assert_eq!(convert("<em>italic</em>"), "*italic*");
  assert_eq!(convert("<i>italic</i>"), "*italic*");
}

#[test]
fn strikethrough() {
  assert_eq!(convert("<del>deleted</del>"), "~~deleted~~");
  assert_eq!(convert("<s>struck</s>"), "~~struck~~");
  assert_eq!(convert("<strike>old</strike>"), "~~old~~");
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
fn code_delimiters_widen_for_literal_backticks() {
  assert_eq!(convert("<code>a `b` c</code>"), "``a `b` c``");
  assert_eq!(convert("<code>`edge`</code>"), "`` `edge` ``");
  assert_eq!(
    convert("<pre><code>Contains ```triple``` inside.</code></pre>"),
    "```\nContains ```triple``` inside.\n```"
  );
  assert_eq!(
    convert("<pre><code>before\n```line-leading\n````\nafter</code></pre>"),
    "`````\nbefore\n```line-leading\n````\nafter\n`````"
  );
  assert_eq!(
    convert("<pre>before\n```\nafter</pre>"),
    "````\nbefore\n```\nafter\n````"
  );
  assert_eq!(
    convert(
      r#"<pre><code class="language-js`x">~~~
code</code></pre>"#
    ),
    "```\n~~~\ncode\n```"
  );
  assert_eq!(
    convert(
      r##"<div><pre class="language-js`x">a
b

</pre><a href="#x">link</a></div>"##
    ),
    "```\na\nb\n\n\n```\n\n[link](#x)"
  );
}

#[test]
fn code_language_metadata_is_validated() {
  for (class, language) in [
    ("language-js", "js"),
    ("language-c++", "c++"),
    ("language-C#", "C#"),
    ("language-objective-c", "objective-c"),
    ("language-.net", ".net"),
    // Underscores and slashes are inert in an info string and appear in real
    // highlighter class names (Ace `c_cpp`, CodeMirror `text/x-csrc`).
    ("language-vim_script", "vim_script"),
    ("language-c_cpp", "c_cpp"),
    ("language-text/x-csrc", "text/x-csrc"),
    ("ignored\tlanguage-js\nlanguage-rust", "js"),
    ("language-bad&#96; language-rust", "rust"),
    ("language- language-C#", "C#"),
    ("language-js&#11; language-rust", "rust"),
    // NBSP is not HTML ASCII whitespace, so it stays inside the token rather
    // than splitting it, and it cannot break the fence.
    ("language-js&#160; language-rust", "js\u{a0}"),
  ] {
    let html = format!(r#"<pre><code class="{class}">code</code></pre>"#);
    assert_eq!(
      convert(&html),
      format!("```{language}\ncode\n```"),
      "class={class:?}"
    );
  }

  for class in [
    "language-",
    "language-~~~&#96;",
    "language-js&quot;x",
    "language-js&#39;x",
    "language-js&lt;x",
    "language-js&amp;x",
    "language-js&#1;x",
    "language-js&#127;x",
    "notlanguage-js",
  ] {
    let html = format!(r#"<pre><code class="{class}">code</code></pre>"#);
    assert_eq!(convert(&html), "```\ncode\n```", "class={class:?}");
  }

  assert_eq!(
    convert(r#"<pre class="language-bad&#96; language-.net">code</pre>"#),
    "```.net\ncode\n```"
  );
  assert_eq!(
    convert(r#"<pre><code class="language-~~~&#96;">code</code></pre><p>after</p>"#),
    "```\ncode\n```\n\nafter"
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
  assert_eq!(convert("<i><i>text</i></i>"), "*text*");
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
  assert_eq!(convert("<p><b><em>x</em></b></p>"), "***x***");
  assert_eq!(
    convert("<p><b><img src=\"x.png\" alt=\"y\"></b></p>"),
    "**![y](x.png)**"
  );
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
  assert_eq!(convert("<p><b>x<span>**</span></b></p>"), r"**x\*\***");
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
fn block_code_fence_is_held_until_its_delimiter_is_known() {
  let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
  let first = stream.process_chunk("<pre><code><span>");
  assert_eq!(first, "");
  let mut rest = stream.process_chunk("x</span></code></pre>");
  rest.push_str(&stream.finish());
  assert_eq!(rest, "```\nx\n```");
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

// Text before an immediately nested blockquote leaves the outer frame anchored at the
// buffer end, which the separator collapse stranded; the outer quote then rendered one
// byte too far in, as `>>` with a doubled space.
#[test]
fn nested_blockquotes_after_text_quote_both_levels() {
  assert_eq!(
    convert("Lead<blockquote><blockquote>Inner</blockquote></blockquote>"),
    "Lead\n> > Inner"
  );
  assert_eq!(
    convert("Lead<blockquote><blockquote><blockquote>Deep</blockquote></blockquote></blockquote>"),
    "Lead\n> > > Deep"
  );
  // Strands two frames at once; rebasing only the innermost glues the outer marker
  // to the next one.
  assert_eq!(
    convert(
      "<pre><blockquote><br><blockquote><blockquote>x</blockquote></blockquote></blockquote></pre>"
    ),
    "```\n> > > x\n\n\n```"
  );
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

#[test]
fn blockquote_keeps_block_children_inside_the_quote() {
  for (name, html, expected) in [
    (
      "unordered lists",
      "<blockquote><ul><li>one</li><li>two</li></ul></blockquote>",
      "> - one\n> - two",
    ),
    (
      "ordered lists",
      "<blockquote><ol><li>one</li><li>two</li></ol></blockquote>",
      "> 1. one\n> 2. two",
    ),
    (
      "paragraph followed by list",
      "<blockquote><p>intro</p><ul><li>one</li></ul></blockquote>",
      "> intro\n>\n> - one",
    ),
    (
      "text followed by heading",
      "<blockquote>text<h2>H</h2></blockquote>",
      "> text\n>\n> ## H",
    ),
    (
      "horizontal rule",
      "<blockquote>a<hr>b</blockquote>",
      "> a\n>\n> ---\n> b",
    ),
    (
      "sibling divs",
      "<blockquote><div>a</div><div>b</div></blockquote>",
      "> a\n>\n> b",
    ),
    (
      "table surrounded by text",
      "<blockquote>lead<table><tr><td>a</td></tr></table>tail</blockquote>",
      "> lead\n>\n> | a |\n> | --- |\n>\n> tail",
    ),
    (
      "section surrounded by text",
      "<blockquote>lead<section>x</section>tail</blockquote>",
      "> lead\n>\n> x\n> tail",
    ),
    (
      "article surrounded by text",
      "<blockquote>lead<article>x</article>tail</blockquote>",
      "> lead\n>\n> x\n> tail",
    ),
    (
      "nav surrounded by text",
      "<blockquote>lead<nav>x</nav>tail</blockquote>",
      "> lead\n>\n> x\n> tail",
    ),
    (
      "figure surrounded by text",
      "<blockquote>lead<figure>x</figure>tail</blockquote>",
      "> lead\n>\n> x\n> tail",
    ),
    (
      "nested list",
      "<blockquote><ul><li>one<ul><li>sub</li></ul></li></ul></blockquote>",
      "> - one\n>   - sub",
    ),
    (
      "blockquote nested in list item",
      "<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>",
      "- \n  > - x\n  > - y",
    ),
  ] {
    assert_eq!(convert(html), expected, "{name}");
  }
}

#[test]
fn sibling_blockquotes_separated_by_blank_line() {
  for (name, html, expected) in [
    (
      "single-line siblings",
      "<blockquote>a</blockquote><blockquote>b</blockquote>",
      "> a\n\n> b",
    ),
    (
      "paragraph siblings",
      "<blockquote><p>a</p></blockquote><blockquote><p>b</p></blockquote>",
      "> a\n\n> b",
    ),
    (
      "nested quote then sibling",
      "<blockquote><p>Outer</p><blockquote><p>Nested</p></blockquote></blockquote><blockquote><p>After</p></blockquote>",
      "> Outer\n> > Nested\n\n> After",
    ),
    (
      "siblings with newline whitespace",
      "<blockquote>a</blockquote>\n<blockquote>b</blockquote>",
      "> a\n\n> b",
    ),
    (
      "bare-text quote then paragraph-child quote",
      "<blockquote>A quote.</blockquote>\n<blockquote><p>b</p></blockquote>",
      "> A quote.\n\n> b",
    ),
    (
      "bare-text quote then heading-child quote",
      "<blockquote>A quote.</blockquote>\n<blockquote><h2>H</h2></blockquote>",
      "> A quote.\n\n> ## H",
    ),
  ] {
    assert_eq!(convert(html), expected, "{name}");
  }
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
fn long_text_before_an_ordered_list_item_counts_as_one_child() {
  let text = "word ".repeat(16_384);
  let html = format!("<ol>{text}<li>item</li></ol>");
  assert_eq!(convert(&html).rsplit('\n').next(), Some("2. item"));
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
fn a_nested_list_inside_a_span_keeps_its_structure() {
  assert_eq!(
    convert("<ol><li><span>parent<ul><li>child</li><li>child 2</li></ul></span></li></ol>"),
    "1. parent\n   - child\n   - child 2"
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
  let html = r"
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
";
  assert_eq!(
    convert(html),
    "1. text\n\n   ```\n   text\n   ```\n\n   text\n2. text"
  );
}

// https://github.com/harlan-zw/mdream/issues/81
#[test]
fn multiple_paragraphs_in_list_item_separated_by_blank_lines() {
  let html = r"
<ol>
    <li>
        <p><strong>text</strong>:</p>
        <p>text</p>
        <p>text</p>
        <pre><code>text</code></pre>
    </li>
</ol>
";
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
    r#"\<div> & "quotes" 'apostrophes'"#
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

#[test]
fn an_empty_list_item_does_not_underline_the_text_above() {
  // A lone marker continuing the paragraph above is a setext underline: the
  // text becomes a heading and the item itself disappears.
  assert_eq!(
    convert("<ul><li>a<ul><li></li></ul></li></ul>"),
    "- a\n\n  -"
  );
  assert_eq!(
    convert("<p>a</p><ul><li></li><li>b</li></ul>"),
    "a\n\n-\n- b"
  );
  // A sibling marker above already opens its own block, so nothing is inserted.
  assert_eq!(
    convert("<ul><li>a</li><li></li><li>b</li></ul>"),
    "- a\n-\n- b"
  );
  assert_eq!(convert("<ul><li></li><li>a</li></ul>"), "-\n- a");
}

#[test]
fn a_rule_inside_a_list_item_keeps_its_own_block() {
  // Without the blank line `<hr>` reads as a setext underline instead.
  assert_eq!(convert("<ul><li>a<hr></li></ul>"), "- a\n\n  ---");
  assert_eq!(
    convert("<ul><li><p>a</p><hr><p>b</p></li></ul>"),
    "- a\n\n  ---\n\n  b"
  );
  // A pending marker already opened the content column, but `- ---` is dashes and
  // spaces only, so the line would be a thematic break and the item would vanish.
  assert_eq!(convert("<ul><li><hr></li></ul>"), "- ***");
  assert_eq!(convert("<ul><li><hr></li><li>b</li></ul>"), "- ***\n- b");
  // Regression: text's own trailing space (not a marker's) was mistaken for the
  // content column, so `<hr>` glued onto it with no break and vanished as `***`.
  assert_eq!(convert("<ul><li>text <hr></li></ul>"), "- text\n\n  ---");
  assert_eq!(
    convert("<ul><li>text <hr>after</li></ul>"),
    "- text\n\n  ---\n\n  after"
  );
  assert_eq!(
    convert("<ul><li><blockquote>text <hr></blockquote></li></ul>"),
    "- \n  > text\n  >\n  > ---"
  );
  assert_eq!(
    convert("<ul><li><blockquote>text<hr></blockquote>after</li></ul>"),
    "- \n  > text\n  >\n  > ---\n\n  after"
  );
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
#[allow(clippy::literal_string_with_formatting_args)]
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
    write!(html, "<th>Col{i}</th>").expect("writing to a String cannot fail");
  }
  html.push_str("</tr>");
  for _ in 0..100 {
    html.push_str("<tr>");
    for i in 0..10 {
      write!(html, "<td>Val{i}</td>").expect("writing to a String cannot fail");
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

/// Extraction output is the one place an interned `ATTR_*` bit has to turn back
/// into a name. Mixes interned names with ones that keep an owned string.
#[test]
fn extraction_reports_interned_and_custom_attribute_names() {
  let result = html_to_markdown_result(
    r#"<a href="/x" title="T" class="c" id="i" data-k="v" aria-label="L">Link</a>"#,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        extraction: Some(ExtractionConfig {
          selectors: vec!["a".to_string()],
        }),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  let extracted = result.extracted.unwrap();
  assert_eq!(extracted.len(), 1);
  let mut attrs = extracted[0].attributes.clone();
  attrs.sort();
  assert_eq!(
    attrs,
    vec![
      ("aria-label".to_string(), "L".to_string()),
      ("class".to_string(), "c".to_string()),
      ("data-k".to_string(), "v".to_string()),
      ("href".to_string(), "/x".to_string()),
      ("id".to_string(), "i".to_string()),
      ("title".to_string(), "T".to_string()),
    ]
  );
}

#[test]
fn extraction_preserves_declaration_order_for_overlapping_selectors() {
  let result = html_to_markdown_result(
    r#"<h1 class="featured">Title</h1>"#,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        extraction: Some(ExtractionConfig::new(&["h1", "h1, h2", ".featured"])),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  let extracted = result.extracted.unwrap();
  let selectors: Vec<&str> = extracted
    .iter()
    .map(|element| element.selector.as_str())
    .collect();

  assert_eq!(selectors, vec!["h1", "h1, h2", ".featured"]);
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

// ── Attribute masking (TagHandler::wanted_attrs) ──

/// A renderer only sees attributes its tag's `wanted_attrs` mask keeps, so
/// reading a new one without widening the mask fails here.
#[test]
fn every_rendered_attribute_survives_the_wanted_attrs_mask() {
  let opts = HTMLToMarkdownOptions::default;

  // TAG_A: href, title
  let md = html_to_markdown(r#"<a href="/x" title="T">link</a>"#, opts());
  assert_eq!(md, "[link](/x \"T\")", "a href/title: {md:?}");

  // TAG_A: aria-label feeds empty-link text synthesis
  let md = html_to_markdown(
    r#"<a href="/x" aria-label="Label"><span></span></a>"#,
    opts(),
  );
  assert!(md.contains("Label"), "a aria-label: {md:?}");

  // TAG_IMG: src, alt, title
  let md = html_to_markdown(r#"<img src="/i.png" alt="A" title="T">"#, opts());
  assert_eq!(md, "![A](/i.png \"T\")", "img src/alt/title: {md:?}");

  // TAG_CODE inside TAG_PRE: class → fence language
  let md = html_to_markdown(
    r#"<pre><code class="language-rust">let x = 1;</code></pre>"#,
    opts(),
  );
  assert!(md.starts_with("```rust\n"), "code class: {md:?}");

  // TAG_PRE: its own class → deferred fence language (issue #97)
  let md = html_to_markdown(r#"<pre class="language-js">let x = 1;</pre>"#, opts());
  assert!(md.starts_with("```js\n"), "pre class: {md:?}");

  // TAG_TH: align → column alignment
  let md = html_to_markdown(
    r#"<table><tr><th align="center">H</th></tr><tr><td>c</td></tr></table>"#,
    opts(),
  );
  assert!(md.contains(":---:"), "th align: {md:?}");

  // TAG_META: name/property/content, read only by the frontmatter plugin
  let md = html_to_markdown(
    r#"<html><head><title>T</title><meta name="description" content="D"><meta property="og:title" content="O"></head><body><p>x</p></body></html>"#,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig::frontmatter()),
      ..Default::default()
    },
  );
  assert!(md.contains("description: D"), "meta name: {md:?}");
  assert!(md.contains("og:title"), "meta property: {md:?}");
}

// ── Trailing-whitespace trims must not reach behind an open block frame ──

#[test]
fn blockquote_content_start_survives_a_trailing_space_trim() {
  // Regression: a trim reaching behind the blockquote's `content_start` splices
  // the quote prefix mid-token (`<d> etails>` instead of `> <details>`).
  let md = html_to_markdown(
    "> e<blockquote><details>x</details></blockquote>",
    HTMLToMarkdownOptions::default(),
  );
  assert_eq!(md, "\\> e\n\n> <details>x</details>", "got: {md:?}");
}

#[test]
fn pre_fence_opener_survives_a_trailing_space_trim() {
  // Regression: the same reach-back against a code fence eats the opener's
  // trailing newline, leaving `content_start` past the buffer end and
  // finalizing panicking.
  let md = html_to_markdown("# h<pre><td></pre>", HTMLToMarkdownOptions::default());
  assert_eq!(md, "\\# h\n\n```\n\n```", "got: {md:?}");

  // A <code> child's fence is closed by the <pre>, so the closer lands after the
  // trim and the block keeps an empty body. Both forms are an empty code block.
  let md = html_to_markdown(
    "# h<pre><code><td></code></pre>",
    HTMLToMarkdownOptions::default(),
  );
  assert_eq!(md, "\\# h\n\n```\n\n```", "got: {md:?}");

  // Every block-marker escape (`#`, `-`, `>`) can precede the fence.
  for html in [
    "- x<pre><td></pre>",
    "> q<pre><td></pre>",
    "#  hash<pre><span></pre>",
  ] {
    let md = html_to_markdown(html, HTMLToMarkdownOptions::default());
    assert!(md.contains("```"), "{html} produced {md:?}");
  }
}

#[test]
fn spacing_check_tolerates_an_empty_text_node() {
  // A `<td>` inside `<pre>` opens an implied table, and closing the row emits
  // an empty text node while the last written byte is still content, so
  // `should_add_spacing_before_text` has no first byte to index.
  for (html, expected) in [
    ("<pre><td>\n<th>6</th>\n<l>", "```\n | 6\n```"),
    // Same shape without the `<pre>`, so no fence is opened.
    ("<td>\n<th>6</th>\n<l>", "6"),
    ("<pre><td>\n<th>x</th>\n<span>", "```\n | x\n```"),
    ("<pre><td></td><th></th>\n<l>", "```\n |\n```"),
  ] {
    let md = html_to_markdown(html, HTMLToMarkdownOptions::default());
    assert_eq!(md, expected, "{html:?} produced {md:?}");
  }
}

#[test]
fn filter_exclude_is_inherited_and_released_at_the_matching_close() {
  // Exclusion reaches a deep subtree, and the matching close must clear the
  // marker so later siblings survive.
  let md = html_to_markdown(
    r#"<p>Before</p><div class="ad"><section><ul><li><span>Deep</span></li></ul></section></div><p>After</p><div class="ad">Second</div><p>Last</p>"#,
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
  assert!(md.contains("Before"), "got: {md:?}");
  assert!(md.contains("After"), "got: {md:?}");
  assert!(md.contains("Last"), "got: {md:?}");
  assert!(!md.contains("Deep"), "got: {md:?}");
  assert!(!md.contains("Second"), "got: {md:?}");
}

#[test]
fn filter_exclude_nested_match_does_not_release_the_outer_subtree() {
  // An inner match closing must not clear the outer element's exclusion.
  let md = html_to_markdown(
    r#"<div class="ad"><div class="ad">Inner</div><p>StillInside</p></div><p>Outside</p>"#,
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
  assert!(md.contains("Outside"), "got: {md:?}");
  assert!(!md.contains("Inner"), "got: {md:?}");
  assert!(!md.contains("StillInside"), "got: {md:?}");
}

#[test]
fn filter_include_is_inherited_by_descendants() {
  let md = html_to_markdown(
    r#"<div class="content"><section><p>Deep</p></section></div><div class="sidebar"><p>Nope</p></div>"#,
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
  assert!(md.contains("Deep"), "got: {md:?}");
  assert!(!md.contains("Nope"), "got: {md:?}");
}

#[test]
fn filter_include_without_process_children_drops_unmatched_descendants() {
  // process_children: false means an included ancestor does not carry inclusion
  // down; only elements matching a selector themselves are kept.
  let md = html_to_markdown(
    r#"<div class="content"><p>Child</p></div>"#,
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        filter: Some(FilterConfig {
          include: Some(vec![".content".to_string()]),
          process_children: Some(false),
          ..Default::default()
        }),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert!(!md.contains("Child"), "got: {md:?}");
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
        isolate_main: Some(IsolateMainConfig),
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

#[test]
fn blockquote_spacing_override_keeps_default_quote_frame() {
  let overrides = vec![(
    "blockquote".to_string(),
    TagOverrideConfig {
      spacing: Some([0, 0]),
      ..Default::default()
    },
  )];
  let md = html_to_markdown(
    "<blockquote>Quoted text</blockquote>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(overrides),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert_eq!(md, "> Quoted text");
}

#[test]
fn blockquote_literal_override_replaces_default_quote_frame() {
  let overrides = vec![(
    "blockquote".to_string(),
    TagOverrideConfig {
      enter: Some("[".to_string()),
      exit: Some("]".to_string()),
      spacing: Some([0, 0]),
      ..Default::default()
    },
  )];
  let md = html_to_markdown(
    "<blockquote>Quoted text</blockquote>",
    HTMLToMarkdownOptions {
      plugins: Some(PluginConfig {
        tag_overrides: Some(overrides),
        ..Default::default()
      }),
      ..Default::default()
    },
  );
  assert_eq!(md, "[Quoted text]");
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
fn clean_strips_data_and_vbscript_links() {
  for href in ["data:text/html,payload", "vbscript:msgbox(1)"] {
    assert_eq!(
      convert_with_clean(&format!(r#"<a href="{href}">Click</a>"#), clean_all()),
      "Click"
    );
  }
}

#[test]
fn clean_strips_executable_link_schemes_case_insensitively() {
  for href in [
    "JavaScript:void(0)",
    "DATA:text/html,payload",
    "VbScRiPt:msgbox(1)",
  ] {
    assert_eq!(
      convert_with_clean(&format!(r#"<a href="{href}">Click</a>"#), clean_all()),
      "Click",
      "expected clean.empty_links to strip {href}"
    );
  }
}

#[test]
fn clean_strips_link_schemes_through_url_preprocessing() {
  // `url::tests` covers the predicate exhaustively; these pin the wiring for
  // each mechanism. All are an executable scheme to a browser.
  for href in [
    " javascript:void(0)",
    "\u{1}javascript:void(0)",
    "java\tscript:void(0)",
    " data:text/html,payload",
    "\tVbScRiPt:msgbox(1)",
  ] {
    assert_eq!(
      convert_with_clean(&format!(r#"<a href="{href}">Click</a>"#), clean_all()),
      "Click",
      "expected clean.empty_links to strip {href:?}"
    );
  }
}

#[test]
fn clean_strips_entity_encoded_link_schemes() {
  // Attribute entities are decoded before the href is inspected. This is the
  // form these take in real documents.
  for href in [
    "java&#9;script:void(0)",
    "java&#10;script:void(0)",
    "java&#13;script:void(0)",
    "&#32;javascript:void(0)",
  ] {
    assert_eq!(
      convert_with_clean(&format!(r#"<a href="{href}">Click</a>"#), clean_all()),
      "Click",
      "expected clean.empty_links to strip {href}"
    );
  }
}

#[test]
fn clean_strips_bare_hash_surrounded_by_whitespace() {
  for href in [" # ", "#\t", "\t#"] {
    assert_eq!(
      convert_with_clean(&format!(r#"<a href="{href}">Link</a>"#), clean_all()),
      "Link",
      "expected clean.empty_links to strip {href:?}"
    );
  }
}

#[test]
fn clean_keeps_links_that_only_look_like_executable_schemes() {
  // An interior space is not removed, so the scheme is not `javascript:`.
  for (href, expected) in [
    ("java script:x", "[Keep](<java script:x>)"),
    ("notjavascript:x", "[Keep](notjavascript:x)"),
    ("/javascript/guide", "[Keep](/javascript/guide)"),
    ("https://x.com/a", "[Keep](https://x.com/a)"),
  ] {
    assert_eq!(
      convert_with_clean(&format!(r#"<a href="{href}">Keep</a>"#), clean_all()),
      expected,
      "expected clean.empty_links to keep {href:?}"
    );
  }
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
  assert_eq!(convert("<p>&gt;</p>"), r"\>");
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
  assert_eq!(html_to_markdown(html, opts), "before *foo* after");
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
  assert_eq!(convert("foo <em>bar</em>"), "foo *bar*");
  assert_eq!(convert("a<em>b</em>c<em>d</em>"), "a*b*c*d*");
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

/// A quote in an unquoted value is an ordinary character, so it must not hide
/// the `>` and drop everything after the tag.
#[test]
fn quote_in_an_unquoted_attribute_value_does_not_truncate() {
  assert_eq!(
    convert("<p>ok</p><img alt=Bob's src=/i.png><p>after</p>"),
    "ok\n\n![Bob's](/i.png)\n\nafter"
  );
  assert_eq!(convert("<p>a</p><div class=x'y></div><p>b</p>"), "a\n\nb");
  // An even number of them re-balanced, which masked the defect.
  assert_eq!(
    convert("<div a=1'></div><div b=2'></div><p>kept</p>"),
    "kept"
  );
  assert_eq!(
    convert("<p>a</p><span data-value=x='y>inside</span><p>b</p>"),
    "a\n\ninside\n\nb"
  );
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
    "see *this* word and more words after the\nemphasis here please now",
  );
}

// ── HTML line breaks (issue #128) ──

#[test]
fn br_preserves_a_line_break_with_and_without_wrapping() {
  const HARD_BREAK: &str = "  \n";
  let html = "<div>abc def ghi jkl mno<br/>111 222 333 444 555 666 777 888 999 000 abc</div>";

  assert_eq!(
    convert(html),
    format!("abc def ghi jkl mno{HARD_BREAK}111 222 333 444 555 666 777 888 999 000 abc")
  );
  assert_eq!(
    convert_wrapped(html, 40),
    format!("abc def ghi jkl mno{HARD_BREAK}111 222 333 444 555 666 777 888 999 000\nabc")
  );
  assert_eq!(
    convert("<p>first <br>second</p>"),
    format!("first{HARD_BREAK}second")
  );
}

#[test]
fn br_keeps_nested_block_continuation_prefixes() {
  const HARD_BREAK: &str = "  \n";
  assert_eq!(
    convert("<ul><li>first<br>second</li></ul>"),
    format!("- first{HARD_BREAK}  second")
  );
  assert_eq!(
    convert("<blockquote><p>first<br>second</p></blockquote>"),
    format!("> first{HARD_BREAK}> second")
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

#[test]
fn lt_before_a_non_letter_is_text_not_a_tag() {
  // `<3` was scanned as a tag named `3` whose attributes ran to the next `>`,
  // so the rest of the text node disappeared.
  for (html, expected) in [
    ("<p>I <3 Rust</p>", "I <3 Rust"),
    ("<p>5 <10 and 10> 5</p>", "5 <10 and 10> 5"),
    ("<p>a <1b>c</p>", "a <1b>c"),
    ("<p>a <-b>c</p>", "a <-b>c"),
    ("<p>a <<em>b</em>c</p>", "a <*b*c"),
    ("<3", "<3"),
    ("<3<div", "<3"),
    ("<>", "<>"),
    ("< 3", "< 3"),
  ] {
    assert_eq!(convert(html), expected, "{html}");
    for split in 0..=html.len() {
      let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
      let mut out = stream.process_chunk(&html[..split]);
      out.push_str(&stream.process_chunk(&html[split..]));
      out.push_str(&stream.finish());
      assert_eq!(out.trim_end(), expected, "{html} split at {split}");
    }
  }

  // `_` is still escaped for Markdown; only the tag/text decision changed.
  assert_eq!(convert("<p>x <_y>z</p>"), "x <\\_y>z");

  // `?` opens a bogus comment, which is discarded rather than emitted.
  assert_eq!(convert("<?pi?>after"), "after");
  assert_eq!(convert("<p>a <?b>c</p>"), "a c");

  // An incomplete tag at end of input is still dropped, not emitted as text.
  assert_eq!(convert("<div"), "");
  assert_eq!(convert("<p>ok</p><div"), "ok");

  // A run whose only non-whitespace byte is `<` must still count as non-empty,
  // or the text node is dropped. Table cells take a separate emit path.
  assert_eq!(convert("<p>< </p>"), "<");
  assert_eq!(convert("<p><\t</p>"), "<");
  assert_eq!(convert("<div>< </div>"), "<");
  assert_eq!(convert("<p>< <b>x</b></p>"), "< **x**");
  assert_eq!(
    convert("<table><tr><td>< </td></tr></table>"),
    "| < |\n| --- |"
  );
  assert_eq!(
    convert("<table><tr><td>< <b>x</b></td></tr></table>"),
    "| < **x** |\n| --- |"
  );
}

#[test]
fn block_markers_are_escaped_after_a_list_marker() {
  for (html, expected) in [
    ("<ul><li>- text</li></ul>", "- \\- text"),
    ("<ul><li>+ text</li></ul>", "- \\+ text"),
    ("<ul><li>1. text</li></ul>", "- 1\\. text"),
    ("<ul><li>&gt; text</li></ul>", "- \\> text"),
    ("<ul><li># text</li></ul>", "- \\# text"),
    ("<ul><li>---</li></ul>", "- \\---"),
  ] {
    assert_eq!(convert(html), expected, "html={html:?}");
  }
  // An ordered marker gives its content column the same treatment.
  assert_eq!(convert("<ol><li># text</li></ol>"), "1. \\# text");
}

#[test]
fn heading_keeps_a_trailing_hash() {
  assert_eq!(convert("<h2>Ends with #</h2>"), "## Ends with \\#");
  assert_eq!(convert("<h3>#</h3>"), "### \\#");
  assert_eq!(convert("<h2>Ends with ###</h2>"), "## Ends with \\###");
  // Not a closing sequence without whitespace before it, so nothing to escape.
  assert_eq!(convert("<h2>C#</h2>"), "## C#");
  assert_eq!(convert("<h2>plain</h2>"), "## plain");
}

#[test]
fn a_heading_without_an_atx_prefix_keeps_its_hash_unescaped() {
  // No `#` prefix is written in either case, so there is no closing sequence to
  // protect and a backslash would be literal content.
  assert_eq!(
    convert("<table><tr><th>h</th></tr><tr><td><h3>Ends with #</h3></td></tr></table>"),
    "| h |\n| --- |\n| <h3>Ends with #</h3> |"
  );
  assert_eq!(convert_text("<h2>Ends with #</h2>"), "Ends with #");
}

#[test]
fn ordered_lists_honor_the_start_attribute() {
  assert_eq!(
    convert("<ol start=\"3\"><li>a</li><li>b</li></ol>"),
    "3. a\n4. b"
  );
  assert_eq!(convert("<ol><li>a</li></ol>"), "1. a");
  // A wider marker widens the continuation column with it.
  assert_eq!(
    convert("<ol start=\"9\"><li><p>a</p><p>b</p></li></ol>"),
    "9. a\n\n   b"
  );
  // 0 is a valid CommonMark start; browsers render it too.
  assert_eq!(
    convert("<ol start=\"0\"><li>a</li><li>b</li></ol>"),
    "0. a\n1. b"
  );
  assert_eq!(convert("<ol start=\" 7 \"><li>a</li></ol>"), "7. a");
  assert_eq!(convert("<ol start=\"+7\"><li>a</li></ol>"), "7. a");
}

#[test]
fn ordered_start_wider_than_a_marker_falls_back_to_default_numbering() {
  // An ordered marker is at most nine digits, so a wider `start` is not a marker
  // at all: it must not emit a ten-digit number GFM would read as a paragraph.
  assert_eq!(
    convert("<ol start=\"999999999\"><li>a</li></ol>"),
    "999999999. a"
  );
  assert_eq!(convert("<ol start=\"1000000000\"><li>a</li></ol>"), "1. a");
  assert_eq!(convert("<ol start=\"99999999999\"><li>a</li></ol>"), "1. a");
  assert_eq!(convert("<ol start=\"-5\"><li>a</li></ol>"), "1. a");
  assert_eq!(convert("<ol start=\"\"><li>a</li></ol>"), "1. a");
  // The running number saturates at the same width rather than overflowing it.
  assert_eq!(
    convert("<ol start=\"999999998\"><li>a</li><li>b</li><li>c</li></ol>"),
    "999999998. a\n999999999. b\n999999999. c"
  );
}

#[test]
fn colspan_widens_the_delimiter_row() {
  // The spanned cell is followed by the empty cells it swallowed, so the
  // delimiter row is wide enough for `b` to survive.
  assert_eq!(
    convert("<table><tr><td colspan=\"2\">wide</td></tr><tr><td>a</td><td>b</td></tr></table>"),
    "| wide | |\n| --- | --- |\n| a | b |"
  );
  assert_eq!(
    convert(
      "<table><tr><th colspan=\"3\">h</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>"
    ),
    "| h | | |\n| --- | --- | --- |\n| a | b | c |"
  );
  assert_eq!(
    convert("<table><tr><td colspan=\"+2\">wide</td></tr></table>"),
    "| wide | |\n| --- | --- |"
  );
  assert_eq!(
    convert("<table><tr><td colspan=\"256\">wide</td></tr></table>"),
    "| wide |\n| --- |"
  );
}

#[test]
fn abrupt_and_bang_terminated_comments_do_not_swallow_the_document() {
  // `<!-->`, `<!--->` and `--!>` all end a comment. Scanning for `-->` alone
  // left them open, so the scan ran to end of chunk, reported the tag
  // incomplete and discarded every byte after it. The spacing matches an
  // ordinary `<!--x-->`, which also separates the two text runs.
  for html in [
    "before<!-->after",
    "before<!--->after",
    "before<!--x--!>after",
    "before<!----!>after",
    "before<!--x---!>after",
  ] {
    assert_eq!(convert(html), "before after", "{html}");
    for split in 0..=html.len() {
      let mut stream = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
      let mut out = stream.process_chunk(&html[..split]);
      out.push_str(&stream.process_chunk(&html[split..]));
      out.push_str(&stream.finish());
      assert_eq!(out.trim_end(), "before after", "{html} split at {split}");
    }
  }

  assert_eq!(convert("<p>a</p><!--><p>b</p>"), "a\n\nb");
  assert_eq!(convert("<!-->after"), "after");
  assert_eq!(convert("before<!-->"), "before");

  // A `>` inside the comment body still is not a terminator.
  assert_eq!(
    convert("before<!--[if IE]>hidden<![endif]-->after"),
    "before after"
  );
}

#[test]
fn cells_past_the_delimiter_row_merge_instead_of_vanishing() {
  // GFM would otherwise drop the cells past the delimiter row's width.
  assert_eq!(
    convert("<table><tr><th>h</th><th>i</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>"),
    "| h | i |\n| --- | --- |\n| a | b c |"
  );
}

#[test]
fn a_table_inside_a_list_item_stays_a_table() {
  assert_eq!(
    convert("<ul><li><table><tr><th>h</th></tr><tr><td>c</td></tr></table></li></ul>"),
    "- | h |\n  | --- |\n  | c |"
  );
  // An item that already holds text opens the table on its own line.
  assert_eq!(
    convert("<ul><li><p>intro</p><table><tr><th>h</th></tr><tr><td>c</td></tr></table></li></ul>"),
    "- intro\n\n  | h |\n  | --- |\n  | c |"
  );
}

#[test]
fn a_caption_does_not_share_a_line_with_the_header_row() {
  assert_eq!(
    convert("<table><caption>Cap</caption><tr><th>h</th></tr><tr><td>c</td></tr></table>"),
    "Cap\n\n| h |\n| --- |\n| c |"
  );
}

#[test]
fn a_short_malformed_comment_does_not_truncate_a_long_document() {
  let mut html = String::from("<p>lead</p><!-->");
  for i in 0..200 {
    html.push_str("<p>para ");
    html.push_str(&i.to_string());
    html.push_str("</p>");
  }
  let out = convert(&html);
  assert_eq!(out.matches("para ").count(), 200, "{out:.120}");
  assert!(out.starts_with("lead"));
}

#[test]
fn a_caption_in_a_list_item_keeps_the_content_column() {
  assert_eq!(
    convert(
      "<ul><li><p>Intro:</p><table><caption>Cap</caption><tr><th>h</th></tr><tr><td>c</td></tr></table></li></ul>"
    ),
    "- Intro:\n\n  Cap\n\n  | h |\n  | --- |\n  | c |"
  );
  assert_eq!(
    convert("<ul><li>x<br>y<table><caption>Cap</caption><tr><th>h</th></tr></table></li></ul>"),
    "- x  \n  y\n\n  Cap\n\n  | h |\n  | --- |"
  );
}

#[test]
fn a_heading_in_a_table_cell_stays_in_the_row() {
  assert_eq!(
    convert("<table><tr><th>h</th></tr><tr><td><h3>H</h3></td></tr></table>"),
    "| h |\n| --- |\n| <h3>H</h3> |"
  );
}

#[test]
fn pre_content_carries_no_inline_markup() {
  assert_eq!(
    convert("<pre>a <em>b</em> <strong>c</strong>\n</pre>"),
    "```\na b c\n\n```"
  );
  assert_eq!(
    convert("<pre>a <a href=\"/x\">l</a>\n</pre>"),
    "```\na l\n\n```"
  );
  // Outside a fence the same markup still renders.
  assert_eq!(
    convert("<p>a <em>b</em> <a href=\"/x\">l</a></p>"),
    "a *b* [l](/x)"
  );
}

#[test]
fn a_pipe_inside_a_table_code_span_is_escaped() {
  assert_eq!(
    convert("<table><tr><th>h</th></tr><tr><td><code>a|b</code></td></tr></table>"),
    "| h |\n| --- |\n| `a\\|b` |"
  );
  // Outside a table the pipe is ordinary code content.
  assert_eq!(convert("<p><code>a|b</code></p>"), "`a|b`");
}

#[test]
fn raw_html_regions_escape_markdown_past_a_blank_line() {
  // CommonMark ends the HTML block at the blank line, so what follows is
  // Markdown and its block markers have to be escaped.
  let md = convert("<details><summary>S</summary><p>* text</p></details>");
  assert!(md.contains("\\* text"), "got: {md:?}");

  // A line that opens a fresh HTML block suspends Markdown again, so text on it
  // must not be escaped.
  let md = convert(
    "<dl><dt><code>A_B</code></dt><dd><p>one</p></dd>\
     <dt><code>C_D</code></dt><dd><p>two</p></dd></dl>",
  );
  assert!(md.contains("<code>C_D</code>"), "got: {md:?}");
  assert!(!md.contains("C\\_D"), "got: {md:?}");
}

#[test]
fn a_row_closes_through_content_left_open_in_a_cell() {
  // `<tr>` must close an unclosed `<p>` inside the previous cell; otherwise the
  // literal tag lands in the row and every later row merges into one cell.
  assert_eq!(
    convert("<table><thead><tr><th>V<th>C<tbody><tr><td>a<td><p>x<tr><td>b<td><p>y</table>"),
    "| V | C |\n| --- | --- |\n| a | x |\n| b | y |"
  );
}

#[test]
fn pre_keeps_text_after_a_code_child_inside_the_fence() {
  // A sibling after </code> must stay inside the block: on the fence line it
  // would read as ``` <text>, an opener that never closes.
  assert_eq!(
    convert("<pre><code>compopt</code> [-o option]</pre><p>after</p>"),
    "```\ncompopt [-o option]\n```\n\nafter"
  );
  // Several <code> children share the one fence the <pre> closes.
  assert_eq!(
    convert("<pre><code>a</code><code>b</code></pre>"),
    "```\nab\n```"
  );
}

#[test]
fn a_block_after_a_bare_pre_in_a_list_item_keeps_its_line() {
  let md = convert("<ul><li><pre>code\n</pre><p>after</p></li></ul>");
  assert!(md.contains("```\n\n  after"), "got: {md:?}");
}

#[test]
fn a_fence_opening_a_list_item_shares_the_marker_line() {
  // A blank line between the marker and the fence ends the item: CommonMark allows
  // an item to begin with at most one blank line, so the block becomes a sibling of
  // the list instead of its content.
  assert_eq!(
    convert("<ul><li><pre><code>a\nb</code></pre></li></ul>"),
    "- ```\n  a\n  b\n  ```"
  );
  assert_eq!(
    convert("<ul><li>a<ul><li><pre><code>x</code></pre></li></ul></li></ul>"),
    "- a\n  - ```\n    x\n    ```"
  );
  // Content already on the line still opens the fence in its own block.
  assert_eq!(
    convert("<ul><li>text<pre><code>x</code></pre></li></ul>"),
    "- text\n\n  ```\n  x\n  ```"
  );
}

#[test]
fn clean_fragments_resolves_against_many_headings() {
  // Headings emit in DESCENDING slug order, so document order is the reverse
  // of sorted order — this catches a search over the unsorted view.
  let clean = mdream::types::CleanConfig {
    fragments: true,
    ..Default::default()
  };
  let mut html = String::new();
  for i in (0..200).rev() {
    html.push_str(&format!("<h2>Section {i:03}</h2>"));
  }
  for target in ["section-000", "section-100", "section-199"] {
    html.push_str(&format!("<a href=\"#{target}\">keep {target}</a>"));
  }
  html.push_str("<a href=\"#section-900\">drop me</a>");

  let out = convert_with_clean(&html, clean);
  for target in ["section-000", "section-100", "section-199"] {
    assert!(
      out.contains(&format!("[keep {target}](#{target})")),
      "kept link for {target} missing from:\n{out}"
    );
  }
  assert!(
    out.contains("drop me"),
    "dropped link lost its text:\n{out}"
  );
  assert!(
    !out.contains("#section-900"),
    "link with no matching heading kept its target:\n{out}"
  );
}

#[test]
fn clean_fragments_survives_a_heading_whose_content_is_all_dropped() {
  // A heading records its slug-scan start at the buffer end, just past the
  // marker's trailing space. An element that emits nothing (`<style>`) trims
  // that space on entry, leaving the recorded offset one byte past the buffer
  // end, and slicing from it at the heading's close panicked with
  // "start byte index N is out of bounds".
  let clean = mdream::types::CleanConfig {
    fragments: true,
    ..Default::default()
  };
  for html in [
    "x x<h4><style>",
    "x x<h4><style></style></h4>",
    "x x<h1><script>",
    "x x<h6><style>y</style>",
  ] {
    // Collecting slugs must not change what the heading renders to.
    assert_eq!(
      convert_with_clean(html, clean.clone()),
      convert(html),
      "{html:?}"
    );
  }
  assert_eq!(
    convert_with_clean("x x<h4><style>", clean.clone()),
    "x x\n\n####"
  );

  // The crash was found through the streaming target, and the offset it slices
  // from is rebased by the drain, so cover narrow chunk boundaries too.
  for html in [
    "x x<h4><style>",
    "x x<h4><style></style></h4>",
    "x x<h1><script>",
  ] {
    for width in [1usize, 3, 7, 64] {
      let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions {
        clean: Some(clean.clone()),
        ..Default::default()
      });
      let mut streamed = String::new();
      let mut start = 0;
      while start < html.len() {
        let end = (start + width).min(html.len());
        streamed.push_str(&processor.process_chunk(&html[start..end]));
        start = end;
      }
      streamed.push_str(&processor.finish());
      assert_eq!(
        streamed.trim_end(),
        convert(html).trim_end(),
        "{html:?} width={width}"
      );
    }
  }
}

// An empty list item owes a blank line, inserted into the buffer once the item
// closes. Cached offsets at or past that line are shifted to follow it, but a
// code span's were not: its `output_start` then pointed one byte early, and the
// slice that builds the closing delimiter panicked as soon as that byte was
// inside a multi-byte character. `html_to_markdown` itself aborted, so this is
// not a streaming-only concern -- the stream is checked here only to keep the
// two paths honest about the shift.
#[test]
fn code_span_offsets_follow_an_empty_item_blank_line() {
  for html in [
    "[<li><bR>\u{fffd}<code><TD><li>",
    "<li><br>\u{e9}<code>x</code>",
    "<ul><li><li><code>a</code></ul>",
    "<li><br><code><pre>a</pre></code>",
  ] {
    let expected = convert(html);
    for width in 1..=html.len() {
      let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
      let mut streamed = String::new();
      let mut start = 0;
      while start < html.len() {
        let mut end = (start + width).min(html.len());
        while end < html.len() && !html.is_char_boundary(end) {
          end += 1;
        }
        streamed.push_str(&processor.process_chunk(&html[start..end]));
        start = end;
      }
      streamed.push_str(&processor.finish());
      assert_eq!(streamed, expected, "{html:?} width={width}");
    }
  }
}

// Closing a blockquote rewrites its content with a `> ` prefix on every line, so
// an offset inside it moves by however many prefixes precede it. Fragment links
// were remapped; a code span and the code fence were not, leaving them pointing
// into the middle of the quoted text -- and of a character -- which aborted the
// slice that builds the closing delimiter. `html_to_markdown` panics on its own.
#[test]
fn code_offsets_follow_blockquote_prefixing() {
  for html in [
    "<pre><li><pre><li><blockquote>><br>0\n\u{fffd}<code>",
    "<blockquote>a <code>b</code> c</blockquote>",
    "<blockquote><pre><code>x</code></pre></blockquote>",
    "<blockquote>\u{e9} <code>`b`</code></blockquote>",
    "<blockquote><li><pre><code>\u{fffd}</code></pre></blockquote>",
  ] {
    let expected = convert(html);
    for width in 1..=html.len() {
      let mut processor = MarkdownStreamProcessor::new(HTMLToMarkdownOptions::default());
      let mut streamed = String::new();
      let mut start = 0;
      while start < html.len() {
        let mut end = (start + width).min(html.len());
        while end < html.len() && !html.is_char_boundary(end) {
          end += 1;
        }
        streamed.push_str(&processor.process_chunk(&html[start..end]));
        start = end;
      }
      streamed.push_str(&processor.finish());
      assert_eq!(streamed, expected, "{html:?} width={width}");
    }
  }
}

// At EOF inside rawtext the residual `<` opened nothing: only this element's own
// end tag can, so the RCDATA/RAWTEXT states emit `<`, `/` and any partial name as
// text. Dropping it as an incomplete start tag -- right for the data state, where
// EOF in a tag discards it -- silently ate trailing text. Each truncated document
// has to read exactly like the closed one that produces the same text node.
#[test]
fn rawtext_eof_residual_is_text_not_a_dropped_tag() {
  for (truncated, closed) in [
    ("<textarea>a<", "<textarea>a<</textarea>"),
    ("<textarea>a</", "<textarea>a</</textarea>"),
    ("<textarea>a</tex", "<textarea>a</tex</textarea>"),
    (
      "<textarea>a</textareax",
      "<textarea>a</textareax</textarea>",
    ),
    ("<textarea>a</foo", "<textarea>a</foo</textarea>"),
    ("<textarea>a</foo&amp;", "<textarea>a</foo&amp;</textarea>"),
    ("<textarea>a</foo[", "<textarea>a</foo[</textarea>"),
    ("<textarea>a</foo ", "<textarea>a</foo </textarea>"),
    ("<textarea>></", "<textarea>></</textarea>"),
    ("<xmp>a</", "<xmp>a</</xmp>"),
    ("<title>a</", "<title>a</</title>"),
  ] {
    assert_eq!(
      convert(truncated),
      convert(closed),
      "truncated={truncated:?}"
    );
    assert!(!convert(truncated).is_empty(), "dropped: {truncated:?}");
  }

  // A name the tokenizer already delimited left the end tag name state for a tag
  // state, and EOF there drops the tag -- so these stay dropped.
  for html in ["<textarea>a</textarea ", "<textarea>a</textarea/"] {
    assert_eq!(convert(html), "a", "html={html:?}");
  }

  // An unterminated name is still text, even where it names this element.
  assert_eq!(convert("<textarea>a</textarea"), "a</textarea");

  // Elements whose text is excluded keep emitting nothing.
  for html in ["<script>a</", "<style>a</", "<iframe>a</", "<noscript>a</"] {
    assert_eq!(convert(html), "", "html={html:?}");
  }

  // The data state is unchanged: EOF in a tag drops it.
  for html in ["<p>a</", "<p>a<", "<p>a</p", "<div>a<di"] {
    assert_eq!(convert(html), "a", "html={html:?}");
  }
}

// Quoting a closed blockquote rewrites its content in place, inserting a `> `
// and a newline per line behind the cached line start. Read stale, the "current
// line" began with the literal `<code>` text, which suspends escaping the way
// a line that opens a raw HTML block does.
#[test]
fn blockquote_quoting_keeps_escaping_a_later_line() {
  assert_eq!(
    convert("<dd><h2><li><blockquote>a<p><code><p>>aa<<a><<li>`"),
    "<dd>\n\n## - \n  > a\n  >\n  > <code></code>\n  >\n  > &gt;aa&lt;&lt; - \\`\n\n</dd>"
  );
}
