//! Closing delimiters use a reference before an ASCII word after punctuation.
//! Opening-side cases retain their existing Markdown output.

use mdream::CleanConfig;
use mdream::MarkdownStreamProcessor;
use mdream::types::HtmlToMarkdownOptions;
use mdream::{html_to_markdown, html_to_text};

const CASES: &[(&str, &str)] = &[
  (
    r##"<p><strong><a href="/x">b</a> </strong><kbd><b>c</b></kbd></p>"##,
    "**[b](/x)** `**c**`",
  ),
  (
    r##"<p><strong><a href="/x">b</a> </strong><code><em>c</em></code></p>"##,
    "**[b](/x)** `*c*`",
  ),
  (
    r##"<li>a<strong>(b)</strong><b>c</b></li>"##,
    "- a**(b)****c**",
  ),
  (
    r##"<blockquote>a<strong>(b)</strong><b>c</b></blockquote>"##,
    "> a**(b)****c**",
  ),
  (
    r##"<h2>a<strong>(b)</strong><b>c</b></h2>"##,
    "## a**(b)****c**",
  ),
  (
    r##"<table><tr><td>a<strong>(b)</strong><b>c</b></td></tr></table>"##,
    "| a**(b)****c** |\n| --- |",
  ),
  (
    r##"<a href="/y">a<strong>(b)</strong><b>c</b></a>"##,
    "[a**(b)****c**](/y)",
  ),
  (
    r##"<ul><li><i><a href="/r">Sub (v.)</a></i></li><li><a href="/d"><strong>Domain</strong>/Super</a></li></ul>"##,
    "- *[Sub (v.)](/r)*\n- [**Domain**/Super](/d)",
  ),
  (
    r##"<p><em><a href="/x">a</a></em><kbd><b>Ctrl</b></kbd></p>"##,
    "*[a](/x)*`**Ctrl**`",
  ),
  (
    r##"<strong>b!</strong><code><em>c</em></code>"##,
    "**b!**`*c*`",
  ),
  (r##"<p>a<strong>(b)</strong><b>c</b></p>"##, "a**(b)****c**"),
  (
    r##"<p><strong><a href="/x">b</a> </strong><b>c</b></p>"##,
    "**[b](/x)** **c**",
  ),
  (r##"<strong>b! </strong><em>c</em>"##, "**b!** *c*"),
  (
    r##"<p><em><a href="/x">a</a></em><code><em>x</em></code></p>"##,
    "*[a](/x)*`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em></p><p><code><em>x</em></code></p>"##,
    "*[a](/x)*\n\n`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em><samp><em>x</em></samp></p>"##,
    "*[a](/x)*`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em></p><p><samp><em>x</em></samp></p>"##,
    "*[a](/x)*\n\n`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em><var><em>x</em></var></p>"##,
    "*[a](/x)*`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em></p><p><var><em>x</em></var></p>"##,
    "*[a](/x)*\n\n`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em><kbd><em>x</em></kbd></p>"##,
    "*[a](/x)*`*x*`",
  ),
  (
    r##"<p><em><a href="/x">a</a></em></p><p><kbd><em>x</em></kbd></p>"##,
    "*[a](/x)*\n\n`*x*`",
  ),
  (r##"<p><strong>b!</strong><br><em>c</em>"##, "**b!**  \n*c*"),
  (
    r##"<p><strong>b!</strong></p><p><em>c</em>"##,
    "**b!**\n\n*c*",
  ),
  (
    r##"<p><strong>b!</strong></p><h2><em>c</em>"##,
    "**b!**\n\n## *c*",
  ),
  // Opening-side flanking is intentionally unchanged.
  ("<p>é<strong>!b</strong></p>", "é**!b**"),
  // A dropped empty pair leaves the closer before it pending again.
  ("<p><strong>b!</strong><em></em>c</p>", "**b!**&#99;"),
  ("<p><strong>b!</strong><del></del>c</p>", "**b!**&#99;"),
  ("<p><strong>b!</strong><em> </em>c</p>", "**b!**&#99;"),
  ("<p><strong>b!</strong><em><b></b></em>c</p>", "**b!**&#99;"),
  ("<p><strong>b!</strong><code></code>c</p>", "**b!**&#99;"),
  ("<p>a<strong><em></em>(b)</strong>c</p>", "a**(b)**&#99;"),
  ("<p><strong>b!</strong> <em></em>c</p>", "**b!** c"),
  ("<p><strong>b!</strong><em><b></b>x</em>c</p>", "**b!***x*c"),
  (
    r#"<p>a<strong><span><span><a href="/x">b</a></span></span></strong><span>c</span></p>"#,
    "a**[b](/x)**&#99;",
  ),
  (
    r#"<p><strong><span><a href="/x">b</a></span></strong><span><span>c</span></span></p>"#,
    "**[b](/x)**&#99;",
  ),
  (
    r#"<p><i>a</i><b><a href="/y">x</a></b></p>"#,
    "*a***[x](/y)**",
  ),
  (
    r#"<p><b><a href="/x">a</a></b><i>c</i></p>"#,
    "**[a](/x)***c*",
  ),
  (
    r#"<p><b><i>a</i></b><b><a href="/y">x</a></b></p>"#,
    "***a*****[x](/y)**",
  ),
  (
    r#"<p><b><a href="/x">a</a></b><b><i>c</i></b></p>"#,
    "**[a](/x)*****c***",
  ),
  (
    r#"<p>a<strong><a href="/x">b</a></strong></p>"#,
    "a**[b](/x)**",
  ),
  (
    r#"<p><strong><a href="/x">b</a></strong>c</p>"#,
    "**[b](/x)**&#99;",
  ),
  (r#"<p>a<b><a href="/x">b</a></b>c</p>"#, "a**[b](/x)**&#99;"),
  (
    r#"<p>a<em><img src="/i.png" alt="i"></em>c</p>"#,
    "a*![i](/i.png)*&#99;",
  ),
  ("<p>a<i><code>x</code></i>c</p>", "a*`x`*&#99;"),
  (
    r#"<p>a<strong><em><a href="/x">b</a></em></strong>c</p>"#,
    "a***[b](/x)***&#99;",
  ),
  (
    r#"<p>a<del><a href="/x">b</a></del>c</p>"#,
    "a ~~[b](/x)~~&#99;",
  ),
  (r#"<p><s><a href="/x">b</a></s>c</p>"#, "~~[b](/x)~~&#99;"),
  ("<p>a<strong>!b</strong></p>", "a**!b**"),
  ("<p><strong>b!</strong>c</p>", "**b!**&#99;"),
  (
    r#"<p><strong><a href="/x">b</a></strong><span>c</span></p>"#,
    "**[b](/x)**&#99;",
  ),
  (
    r#"<p>a<strong>b <a href="/x">c</a></strong>d</p>"#,
    "a**b [c](/x)**&#100;",
  ),
  // A no-break space counts as whitespace next to a delimiter run.
  (
    r#"<p>a&nbsp;<strong><a href="/x">b</a></strong>c</p>"#,
    "a\u{a0}**[b](/x)**&#99;",
  ),
  (
    r#"<table><tr><th>h</th></tr><tr><td>a<strong><a href="/x">b</a></strong>c</td></tr></table>"#,
    "| h |\n| --- |\n| a**[b](/x)**&#99; |",
  ),
  (
    r#"<blockquote><p>a<strong><a href="/x">b</a></strong>c</p></blockquote>"#,
    "> a**[b](/x)**&#99;",
  ),
  // Delimiters that flank stay as they are.
  (
    r#"<p>a <strong><a href="/x">b</a></strong> c</p>"#,
    "a **[b](/x)** c",
  ),
  ("<p>a<strong>b</strong>c</p>", "a**b**c"),
  (
    r#"<p><a href="/y">a<strong>b!</strong></a>c</p>"#,
    "[a**b!**](/y)c",
  ),
  // A strikethrough opener is not followed by a separator.
  (r#"<p><del><a href="/x">b</a></del></p>"#, "~~[b](/x)~~"),
  // Blocks inside emphasis preserve the existing Markdown delimiters.
  (
    r#"<div>a<strong><a href="/x">b</a><div>c</div></strong>d</div><p>next</p>"#,
    "a**[b](/x) c**d\n\nnext",
  ),
  (
    "<div>x<em>!<p>c</p></em>d</div><p>next</p>",
    "x*! c*d\n\nnext",
  ),
  (
    "<ul><li>a<strong><code>b</code><ul><li>c</li></ul></strong>d</li></ul><p>next</p>",
    "- a**`b`  - c**d\n\nnext",
  ),
  (
    "<div>a<strong>!b<hr></strong>d</div><p>next</p>",
    "a**!b ---**&#100;\n\nnext",
  ),
  (
    "<div>a<strong>!b<figure><figcaption>c</figcaption></figure></strong>d</div><p>next</p>",
    "a**!b*c***d\n\nnext",
  ),
  (
    "<div>a<strong>b<div>c!</div></strong>d</div><p>next</p>",
    "a**b c!**&#100;\n\nnext",
  ),
];

fn stream_chunks(html: &str, chunk: usize, options: &HtmlToMarkdownOptions) -> String {
  let mut processor = MarkdownStreamProcessor::new(options.clone());
  let mut out = String::new();
  let chars: Vec<char> = html.chars().collect();
  for part in chars.chunks(chunk) {
    out.push_str(&processor.process_chunk(&part.iter().collect::<String>()));
  }
  out.push_str(&processor.finish());
  out
}

#[test]
fn writes_closer_references() {
  for &(html, expected) in CASES {
    assert_eq!(
      html_to_markdown(html, HtmlToMarkdownOptions::default()),
      expected,
      "html={html:?}"
    );
  }
}

#[test]
fn streaming_matches_one_shot_at_every_chunk_size() {
  for options in [
    HtmlToMarkdownOptions::default(),
    HtmlToMarkdownOptions::default().with_wrap_width(6),
  ] {
    for &(html, _) in CASES {
      let expected = html_to_markdown(html, options.clone());
      for chunk in 1..=html.len() {
        assert_eq!(
          stream_chunks(html, chunk, &options),
          expected,
          "chunk={chunk} html={html:?}"
        );
      }
    }
  }
}

#[test]
fn open_emphasis_still_yields_content_before_close() {
  let mut stream = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  let first = stream.process_chunk(r#"<p>a<b><a href="/x">link</a><span>"#);
  assert!(
    first.contains("a**[link](/x)"),
    "content held until close: {first:?}"
  );
  let mut full = first;
  full.push_str(&stream.process_chunk("more</span></b>c</p>"));
  full.push_str(&stream.finish());
  assert_eq!(full, "a**[link](/x)more**c");

  let mut stream = MarkdownStreamProcessor::new(HtmlToMarkdownOptions::default());
  let first = stream.process_chunk("<p><b>x!<span>");
  assert!(first.contains("x!"), "content held until close: {first:?}");
  let mut full = first;
  full.push_str(&stream.process_chunk("</span></b>c</p>"));
  full.push_str(&stream.finish());
  assert_eq!(full, "**x!**&#99;");
}

#[test]
fn immediate_link_cleanup_composes_with_fragments() {
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig {
    fragments: true,
    redundant_links: true,
    self_link_headings: true,
    ..Default::default()
  });
  for (html, expected) in [
    (
      r##"<h2><strong>b!</strong><a href="#x">c</a></h2>"##,
      "## **b!**&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="c">c</a></p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<h2><strong>b!</strong><a href="#x">c<strong>d!</strong></a>e</h2>"##,
      "## **b!**&#99;**d!**&#101;",
    ),
  ] {
    assert_eq!(html_to_markdown(html, options.clone()), expected, "{html}");
    for width in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, width, &options),
        expected,
        "width={width} {html}"
      );
    }
  }
}

#[test]
fn immediate_link_cleanup_preserves_preceding_closer() {
  for (prefix, text, suffix, expected) in [
    (
      "<strong>Visit:</strong>",
      "https://x.com",
      "",
      "**Visit:**&#104;ttps://x.com",
    ),
    ("<em>b!</em>", "c", "<strong>d</strong>", "*b!*&#99;**d**"),
    ("<strong><em>b!</em></strong>", "7", "", "***b!***&#55;"),
    ("<strong>b!</strong> ", "c", "", "**b!** c"),
    ("<strong>b!</strong>", "!c", "", "**b!**!c"),
    ("<strong>b!</strong>", "é", "", "**b!**é"),
    ("<del>b!</del>", "c", "", "~~b!~~ c"),
  ] {
    for heading in [false, true] {
      let (tag, href, lead) = if heading {
        ("h2", "#x", "## ")
      } else {
        ("p", text, "")
      };
      let html = format!(r#"<{tag}>{prefix}<a href="{href}">{text}</a>{suffix}</{tag}>"#);
      let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig {
        self_link_headings: heading,
        redundant_links: !heading,
        ..Default::default()
      });
      let expected = format!("{lead}{expected}");
      // The cap routes link entry through the general emitter.
      for cap in [0, 4096] {
        let options = options.clone().with_max_node_bytes(cap);
        assert_eq!(html_to_markdown(&html, options.clone()), expected, "{html}");
        for width in 1..=html.len() {
          assert_eq!(
            stream_chunks(&html, width, &options),
            expected,
            "width={width} cap={cap} {html}"
          );
        }
      }
    }
  }
}

#[test]
fn heading_link_cleanup_keeps_streaming_parity() {
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig {
    self_link_headings: true,
    ..Default::default()
  });
  for (html, expected) in [
    (
      r##"<h2><em>x</em><a href="#x"><strong>!b</strong></a></h2>"##,
      "## *x***!b**",
    ),
    (
      r##"<h2><strong>b!</strong><a href="#x">c</a></h2>"##,
      "## **b!**&#99;",
    ),
    (
      r##"<h2><strong>b!</strong><a href="#x">c<strong>d!</strong></a>e</h2>"##,
      "## **b!**&#99;**d!**&#101;",
    ),
    (
      r##"<h2><a href="#x">x</a><strong>!b</strong></h2>"##,
      "## x**!b**",
    ),
    (
      r##"<h2>x<a href="#x"><strong>!b</strong></a></h2>"##,
      "## x **!b**",
    ),
    (
      r##"<h2><a href="#x"><strong>b!</strong></a>c</h2>"##,
      "## **b!**&#99;",
    ),
    (
      r##"<h2><a href="#x"><strong><em>b!</em></strong></a><span>c</span></h2>"##,
      "## ***b!***&#99;",
    ),
    (
      r##"<h2><a href="/x"><strong>b!</strong></a>c</h2>"##,
      "## [**b!**](/x)c",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html}"
      );
    }
  }
}

#[test]
fn deferred_fragment_cleanup_keeps_streaming_parity() {
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig {
    fragments: true,
    ..Default::default()
  });
  for (html, expected) in [
    (
      r##"<p><em>x</em><a href="#missing"><strong>!b</strong></a></p>"##,
      "*x***!b**",
    ),
    (
      r##"<p><em>x</em><a href="#found"><strong>!b</strong></a></p><h2>found</h2>"##,
      "*x*[**!b**](#found)\n\n## found",
    ),
    (
      r##"<p><a href="#missing"><em>x</em></a><em>!b</em></p>"##,
      "*x**!b*",
    ),
    (
      r##"<p>x<a href="#missing"></a><strong>!b</strong></p>"##,
      "x **!b**",
    ),
    (
      r##"<p><em>x</em><a href="#missing"></a><em>!b</em></p>"##,
      "*x**!b*",
    ),
    (
      r##"<p><em>x</em><a href="#one"></a><a href="#two"></a><em>!b</em></p>"##,
      "*x* *!b*",
    ),
    (
      r##"<p><strong>b!</strong><a href="#missing"></a>c</p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="#missing">c</a></p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="#found">c</a></p><h2>found</h2>"##,
      "**b!**[c](#found)\n\n## found",
    ),
    (
      r##"<p><a href="#missing">x</a><strong>!b</strong></p>"##,
      "x**!b**",
    ),
    (
      r##"<p><a href="#found">x</a><strong>!b</strong></p><h2>found</h2>"##,
      "[x](#found)**!b**\n\n## found",
    ),
    (
      r##"<p>x<a href="#missing"><strong>!b</strong></a></p>"##,
      "x **!b**",
    ),
    (r##"<p><a href="#missing"><strong></strong></a>c</p>"##, "c"),
    (
      r##"<p><a href="#missing"><strong>b!</strong> tail</a>c</p>"##,
      "**b!** tailc",
    ),
    (
      r##"<p><a href="/external"><strong>b!</strong></a>c</p>"##,
      "[**b!**](/external)c",
    ),
    (
      r##"<p><a href="#missing"><strong>b!</strong></a>c</p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><a href="#found"><strong>b!</strong></a>c</p><h2>found</h2>"##,
      "[**b!**](#found)c\n\n## found",
    ),
    (
      r##"<p><a href="#missing"><strong><em>b!</em></strong></a>c</p>"##,
      "***b!***&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="#missing" title="t">c</a></p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><a href="#missing" title="t"><strong>b!</strong></a>c</p>"##,
      "**b!**&#99;",
    ),
    (
      r##"<p><strong>b!</strong><a href="#missing">!c</a></p>"##,
      "**b!**!c",
    ),
    (
      r##"<p><a href="#missing"><strong>b!</strong></a><a href="#gone">c</a></p>"##,
      "**b!** c",
    ),
    (
      r##"<p><strong>b!</strong><a href="#gone"><a href="#missing">c</a></a></p>"##,
      "**b!** c",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html}"
      );
    }
  }
}

#[test]
fn heading_slugs_still_match_fragment_links() {
  // Fragment cleaning reads a reference the converter wrote as its character,
  // so headings keep both the reference and their slug.
  for (html, expected) in [
    (
      r#"<h2><strong><a href="/x">b</a></strong>c</h2>"#,
      "## **[b](/x)**&#99;",
    ),
    (
      r#"<h2><a href="/x">a<strong>!b</strong></a></h2>"#,
      "## [a**!b**](/x)",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, HtmlToMarkdownOptions::default()),
      expected,
      "html={html:?}"
    );
  }
  let options = HtmlToMarkdownOptions::default().with_clean(CleanConfig::all());
  for (html, expected) in [
    (
      r##"<h2><strong><a href="/x">b</a></strong>c</h2><p><a href="#bc">to</a></p>"##,
      "## **[b](/x)**&#99;\n\n[to](#bc)",
    ),
    (
      r##"<h2><a href="/y"><strong><code>b</code></strong>c</a></h2><p><a href="#bc">t</a></p>"##,
      "## [**`b`**&#99;](/y)\n\n[t](#bc)",
    ),
    (
      r##"<h2><a href="/x">a<strong>!b</strong></a></h2><p><a href="#ab">t</a></p>"##,
      "## [a**!b**](/x)\n\n[t](#ab)",
    ),
    (
      r##"<h2>a<strong>!b</strong>c</h2><p><a href="#abc">t</a></p>"##,
      "## a**!b**c\n\n[t](#abc)",
    ),
  ] {
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html:?}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html:?}"
      );
    }
  }
}

#[test]
fn heading_closer_references_keep_fragment_slugs() {
  // Only the references the converter writes read back as characters: an
  // escaped `\&` and code keep the slug they always had.
  let fragments = CleanConfig {
    fragments: true,
    ..Default::default()
  };
  let self_links = CleanConfig {
    self_link_headings: true,
    ..Default::default()
  };
  let redundant = CleanConfig {
    redundant_links: true,
    ..Default::default()
  };
  let all = CleanConfig::all();
  for (html, configs, expected) in [
    (
      r##"<h2><strong>b!</strong>c</h2><p><a href="#bc">to</a></p>"##,
      vec![&fragments, &all],
      "## **b!**&#99;\n\n[to](#bc)",
    ),
    (
      r##"<h2><em>v:</em>7</h2><p><a href="#v7">to</a></p>"##,
      vec![&fragments, &all],
      "## *v:*&#55;\n\n[to](#v7)",
    ),
    (
      r##"<h2><strong>b!</strong>C</h2><p><a href="#bc">to</a></p>"##,
      vec![&fragments, &all],
      "## **b!**&#67;\n\n[to](#bc)",
    ),
    (
      r##"<h2><del>b!</del>c</h2><p><a href="#bc">to</a></p>"##,
      vec![&fragments, &all],
      "## ~~b!~~&#99;\n\n[to](#bc)",
    ),
    (
      r##"<h2>é<strong>ç!</strong>c</h2><p><a href="#c">to</a></p>"##,
      vec![&fragments, &all],
      "## é**ç!**&#99;\n\n[to](#c)",
    ),
    (
      r##"<h2><strong>b!</strong><a href="#missing">c</a></h2><p><a href="#bc">to</a></p>"##,
      vec![&fragments, &all],
      "## **b!**&#99;\n\n[to](#bc)",
    ),
    (
      r##"<h2><strong><a href="#b">b!</a></strong>c</h2><p><a href="#bc">to</a></p>"##,
      vec![&self_links, &all],
      "## **b!**&#99;\n\n[to](#bc)",
    ),
    (
      r##"<h2><strong>b!</strong><a href="#x">c</a></h2><p><a href="#bc">to</a></p>"##,
      vec![&self_links, &all],
      "## **b!**&#99;\n\n[to](#bc)",
    ),
    (
      r##"<h2><strong>b!</strong><a href="https://x.com">https://x.com</a></h2><p><a href="#bhttpsxcom">to</a></p>"##,
      vec![&redundant, &all],
      "## **b!**&#104;ttps://x.com\n\n[to](#bhttpsxcom)",
    ),
    (
      r##"<h2><strong><a href="https://x.com/">https://x.com/</a></strong>c</h2><p><a href="#httpsxcomc">to</a></p>"##,
      vec![&redundant, &all],
      "## **https://x.com/**&#99;\n\n[to](#httpsxcomc)",
    ),
    (
      r##"<h2><strong>b!</strong>&amp;#99;</h2><p><a href="#b99">x</a> <a href="#bc">y</a></p>"##,
      vec![&fragments, &all],
      "## **b!**\\&#99;\n\n[x](#b99) y",
    ),
    (
      r##"<h2><strong>b!</strong><code>*&amp;#99;</code></h2><p><a href="#b99">x</a> <a href="#bc">y</a></p>"##,
      vec![&fragments, &all],
      "## **b!**`*&#99;`\n\n[x](#b99) y",
    ),
    (
      r##"<h2><a href="/x"><code>*&amp;#99;</code></a></h2><p><a href="#99">x</a> <a href="#c">y</a></p>"##,
      vec![&fragments, &all],
      "## [`*&#99;`](/x)\n\n[x](#99) y",
    ),
    (
      r##"<h2><a href="/x">`<strong>b!</strong>c</a></h2><p><a href="#bc">to</a></p>"##,
      vec![&fragments, &all],
      "## [\\`**b!**&#99;](/x)\n\n[to](#bc)",
    ),
    (
      r##"<h2><a href="/x"><code>a\</code><strong>b!</strong>c</a></h2><p><a href="#abc">to</a></p>"##,
      vec![&fragments, &all],
      "## [`a\\`**b!**&#99;](/x)\n\n[to](#abc)",
    ),
  ] {
    for config in configs {
      let options = HtmlToMarkdownOptions::default().with_clean(config.clone());
      assert_eq!(
        html_to_markdown(html, options.clone()),
        expected,
        "config={config:?} html={html:?}"
      );
      for chunk in 1..=html.len() {
        assert_eq!(
          stream_chunks(html, chunk, &options),
          expected,
          "chunk={chunk} config={config:?} html={html:?}"
        );
      }
    }
  }
}

#[test]
fn wraps_at_the_space_moved_past_a_closer() {
  // `<b>b </b>c` writes its space after the closer; it breaks like any other
  // space between words.
  for (width, html, expected) in [
    (6, "<p>1<strong>b </strong>x</p>", "1**b**\nx"),
    (80, "<p>1<strong>b </strong>x</p>", "1**b** x"),
    (
      12,
      "<p>a<strong>!bb </strong>&nbsp;c</p>",
      "a**!bb** \u{a0}c",
    ),
    (
      12,
      "<blockquote><blockquote>1<strong><del>b </del></strong>x</blockquote></blockquote>",
      "> > 1**~~b~~** x",
    ),
  ] {
    let options = HtmlToMarkdownOptions::default().with_wrap_width(width);
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html:?}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html:?}"
      );
    }
  }
  // Plain text keeps a space-only text before the close as written, as JS does.
  assert_eq!(
    html_to_text(
      "<p>w <em>lo b Hel<span></span> </em>xx</p>",
      HtmlToMarkdownOptions::default().with_wrap_width(12)
    ),
    "w lo b Hel xx"
  );
}

#[test]
fn separator_before_the_word_keeps_it_as_written_in_every_mode() {
  // A separator before the word already lets the closer flank. Wrapped and
  // capped output decide that separator before they write a reference.
  for (html, expected) in [
    (
      "<table><tr><td><em>b.</em><div>c</div></td></tr></table>",
      "| *b.* c |\n| --- |",
    ),
    ("<p>1<strong>b. </strong>x</p>", "1**b.** x"),
    ("<p><strong>b!</strong> <em></em>c</p>", "**b!** c"),
    ("<p><strong>b!</strong>c</p>", "**b!**&#99;"),
  ] {
    for (width, cap) in [(0, 0), (20, 0), (0, 4096), (20, 4096)] {
      let options = HtmlToMarkdownOptions::default()
        .with_wrap_width(width)
        .with_max_node_bytes(cap);
      assert_eq!(
        html_to_markdown(html, options.clone()),
        expected,
        "width={width} cap={cap} html={html:?}"
      );
      for chunk in 1..=html.len() {
        assert_eq!(
          stream_chunks(html, chunk, &options),
          expected,
          "chunk={chunk} width={width} cap={cap} html={html:?}"
        );
      }
    }
  }
}

#[test]
fn keeps_the_separator_after_a_literal_tilde() {
  let html = "<p>x~<q>q</q></p>";
  assert_eq!(
    html_to_markdown(html, HtmlToMarkdownOptions::default()),
    "x\\~ \"q\""
  );
  assert_eq!(
    html_to_text(html, HtmlToMarkdownOptions::default()),
    "x~ \"q\""
  );
}

/// The separator after a strikethrough closer keeps it flanking once cleanup
/// removes the link that followed it.
#[test]
fn strikethrough_closer_keeps_its_separator_before_cleaned_links() {
  let fragments = CleanConfig {
    fragments: true,
    ..Default::default()
  };
  for (html, clean, expected) in [
    (
      r##"<p><del>b!</del><a href="#missing">c</a></p>"##,
      fragments.clone(),
      "~~b!~~ c",
    ),
    (
      r##"<p><del>b!</del><a href="#missing">c</a></p>"##,
      CleanConfig::all(),
      "~~b!~~ c",
    ),
    (
      r##"<p><s>Old price!</s><a href="#note">New</a></p>"##,
      fragments.clone(),
      "~~Old price!~~ New",
    ),
    (
      r##"<p><del>a<code>b</code></del><a href="#missing">c</a></p>"##,
      fragments.clone(),
      "~~a`b`~~ c",
    ),
    (
      r##"<p><del>b!</del><a href="c">c</a></p>"##,
      CleanConfig {
        redundant_links: true,
        ..Default::default()
      },
      "~~b!~~ c",
    ),
    (
      r##"<h2 id="x"><del>b!</del><a href="#x">c</a></h2>"##,
      CleanConfig {
        self_link_headings: true,
        ..Default::default()
      },
      "## ~~b!~~ c",
    ),
    (
      r##"<h2 id="x"><del>b!</del><a href="#x">c</a></h2>"##,
      CleanConfig::all(),
      "## ~~b!~~ c",
    ),
    (
      r##"<p><del>b</del><a href="/c">c</a></p>"##,
      fragments.clone(),
      "~~b~~ [c](/c)",
    ),
    // An open ancestor is not a pending opener.
    (
      r##"<p><em><s>b!</s><a href="#missing">c</a></em></p>"##,
      fragments.clone(),
      "*~~b!~~ c*",
    ),
    (
      r##"<p><em> <s>b!</s><a href="#missing">c</a></em></p>"##,
      fragments.clone(),
      "*~~b!~~ c*",
    ),
    (
      r##"<p><em><s><a href="#missing">b</a></s>c</em></p>"##,
      fragments.clone(),
      "*~~b~~&#99;*",
    ),
    (
      r##"<p><em><s><a href="/x">b</a></s>c</em></p>"##,
      fragments.clone(),
      "*~~[b](/x)~~&#99;*",
    ),
  ] {
    let options = HtmlToMarkdownOptions::default().with_clean(clean);
    assert_eq!(
      html_to_markdown(html, options.clone()),
      expected,
      "html={html:?}"
    );
    for chunk in 1..=html.len() {
      assert_eq!(
        stream_chunks(html, chunk, &options),
        expected,
        "chunk={chunk} html={html:?}"
      );
    }
  }
}

#[test]
fn keeps_delimiters_where_a_fix_cannot_help() {
  // An opener before whitespace cannot open.
  assert_eq!(
    html_to_markdown(
      r#"<p><strong><br><a href="/x">b</a></strong>c</p>"#,
      HtmlToMarkdownOptions::default()
    ),
    "**  \n[b](/x)**&#99;"
  );
  assert_eq!(
    html_to_markdown(
      r#"<p>a<strong>&nbsp;<a href="/x">b</a></strong>c</p>"#,
      HtmlToMarkdownOptions::default()
    ),
    "a**\u{a0} [b](/x)**&#99;"
  );
  assert_eq!(
    html_to_markdown(
      "<p><code>a<strong>[b]</strong>c</code></p>",
      HtmlToMarkdownOptions::default()
    ),
    "`a**[b]**c`"
  );
  // `<kbd>`, `<samp>` and `<var>` are code spans as well.
  for (html, expected) in [
    ("<p><kbd><strong>b!</strong>c</kbd></p>", "`**b!**c`"),
    ("<p><kbd>a<strong>!b</strong></kbd></p>", "`a**!b**`"),
    ("<p><samp><em>(b)</em>c</samp></p>", "`*(b)*c`"),
    ("<p><var>a<em>!b</em>c</var></p>", "`a*!b*c`"),
    ("<p>a<strong><kbd>b</kbd></strong>c</p>", "a**`b`**&#99;"),
  ] {
    assert_eq!(
      html_to_markdown(html, HtmlToMarkdownOptions::default()),
      expected,
      "html={html:?}"
    );
  }
}

#[test]
fn earlier_closers_do_not_change_heading_slugs() {
  for fragments_only in [false, true] {
    let options = HtmlToMarkdownOptions::default().with_clean(if fragments_only {
      CleanConfig {
        fragments: true,
        ..Default::default()
      }
    } else {
      CleanConfig::all()
    });
    for (html, expected) in [
      (
        r##"<p><em><a href="/x">a</a></em></p><h2><strong>Intro</strong></h2><p><a href="#intro">go</a></p>"##,
        "*[a](/x)*\n\n## **Intro**\n\n[go](#intro)",
      ),
      (
        r##"<strong>b!</strong><h2><em>c</em></h2><a href="#c">link</a>"##,
        "**b!**\n\n## *c*\n\n[link](#c)",
      ),
    ] {
      assert_eq!(html_to_markdown(html, options.clone()), expected);
      for chunk in 1..=html.len() {
        assert_eq!(
          stream_chunks(html, chunk, &options),
          expected,
          "chunk={chunk} html={html}"
        );
      }
    }
  }
}
