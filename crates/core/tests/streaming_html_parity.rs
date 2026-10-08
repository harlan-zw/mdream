//! `format: html` streams must equal one-shot output wherever the input splits.
//! The corpus holds every input a parity sweep found diverging: whitespace after
//! a drained chunk was trimmed as if it started the document.

use mdream::MarkdownStreamProcessor;
use mdream::html_to_html;
use mdream::types::{HtmlToMarkdownOptions, OutputFormat};

/// Inputs separated by U+001E, so trailing newlines stay part of each input.
const SWEEP: &str = include_str!("fixtures/html-stream-parity.txt");

/// Each split point costs a full conversion, so larger inputs only stream
/// char by char, which still splits at every boundary at once.
const EVERY_SPLIT_MAX_LEN: usize = 2048;

fn stream_at(html: &str, splits: &[usize]) -> String {
  let mut p =
    MarkdownStreamProcessor::new_with_format(HtmlToMarkdownOptions::default(), OutputFormat::Html);
  let mut out = String::new();
  let mut start = 0;
  for &end in splits.iter().chain(std::iter::once(&html.len())) {
    out.push_str(&p.process_chunk(&html[start..end]));
    start = end;
  }
  out.push_str(&p.finish());
  out
}

fn assert_stream_matches(html: &str) {
  let expected = html_to_html(html, HtmlToMarkdownOptions::default());
  let boundaries: Vec<usize> = (1..html.len())
    .filter(|&i| html.is_char_boundary(i))
    .collect();
  assert_eq!(
    stream_at(html, &boundaries),
    expected,
    "char chunks: {html:?}"
  );
  if html.len() > EVERY_SPLIT_MAX_LEN {
    return;
  }
  for &split in &boundaries {
    assert_eq!(
      stream_at(html, &[split]),
      expected,
      "split at {split}: {html:?}"
    );
  }
}

#[test]
fn html_stream_keeps_space_after_inline_element() {
  for html in [
    "a<br> b",
    "<span>One</span> <span>Two</span>",
    "<strong>a</strong> and <em>b</em>",
    "<div>One</div> <div>Two</div>",
    "  <span>One</span>  ",
    "<span>x = 1;</span>\n",
  ] {
    assert_stream_matches(html);
  }
}

#[test]
fn html_stream_matches_one_shot_on_sweep() {
  let inputs: Vec<&str> = SWEEP.split('\u{1e}').collect();
  assert!(inputs.len() > 200, "sweep corpus failed to load");
  for html in inputs {
    assert_stream_matches(html);
  }
}

// Real pages carry indentation runs between inline elements at every depth.
#[test]
fn html_stream_matches_one_shot_on_fixtures() {
  for (name, html) in [
    ("wikipedia", include_str!("fixtures/wikipedia-small.html")),
    ("mdn", include_str!("fixtures/mdn-array.html")),
    ("nuxt", include_str!("fixtures/nuxt-example.html")),
    (
      "github",
      include_str!("fixtures/github-markdown-complete.html"),
    ),
  ] {
    let expected = html_to_html(html, HtmlToMarkdownOptions::default());
    for chunk in [1usize, 7, 64, 4096] {
      let mut splits = Vec::new();
      let mut at = chunk;
      while at < html.len() {
        while !html.is_char_boundary(at) {
          at += 1;
        }
        splits.push(at);
        at += chunk;
      }
      splits.dedup();
      splits.retain(|&s| s < html.len());
      assert!(
        stream_at(html, &splits) == expected,
        "{name} diverged at chunk={chunk}"
      );
    }
  }
}

#[test]
fn long_text_pieces_keep_output_formats_and_cut_lookahead() {
  use mdream::html_to_format_result;
  for format in [
    OutputFormat::Markdown,
    OutputFormat::Text,
    OutputFormat::Html,
  ] {
    for unit in [
      "é ~ ** __ ~~ \\ [[ text &amp;copy; ",
      "é &lt;tag &#92;&amp;copy; &#10; words ",
      "é # - + > 1. text ",
      "漢😀e\u{301}",
    ] {
      let body = unit.repeat(5000);
      for (open, close) in [
        ("", ""),
        ("<div>", "</div>"),
        ("<p><span>", "</span></p>"),
        ("<a href='/x'>", "</a>"),
        ("<table><tr><td>", "</td></tr></table>"),
      ] {
        let html = format!("{open}{body}{close}");
        let options = HtmlToMarkdownOptions {
          max_node_bytes: 1024 * 1024,
          ..Default::default()
        };
        let expected = html_to_format_result(&html, options.clone(), format);
        assert!(!expected.truncated);
        for width in [1, 2, 3, 7, 4096, 8192, 65536, usize::MAX] {
          let mut p = MarkdownStreamProcessor::new_with_format(options.clone(), format);
          let mut output = String::new();
          let mut start = 0;
          let mut seed = 17_u64;
          while start < html.len() {
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let size = if width == usize::MAX {
              (seed % 8192) as usize + 1
            } else {
              width
            };
            let end = html.ceil_char_boundary(start.saturating_add(size).min(html.len()));
            output.push_str(&p.process_chunk(&html[start..end]));
            start = end;
          }
          output.push_str(&p.finish());
          assert!(
            !p.truncated(),
            "format={format:?} open={open} width={width}"
          );
          assert_eq!(
            output, expected.markdown,
            "format={format:?} open={open} unit={unit:?} width={width}"
          );
        }
      }
    }
  }
}

#[test]
fn hazards_around_the_flush_boundary_keep_escaping_lookahead() {
  use mdream::html_to_markdown_result;
  for token in [
    "*",
    "_",
    "~",
    "`",
    "[",
    "\\",
    "&lt;a",
    "\\&amp;copy;",
    "&#92;&amp;copy;",
    "&#10;# heading ",
    "&#60;a",
    "&#38;copy;",
    "&notit;",
    "&&",
  ] {
    for offset in 0..=8 {
      let prefix = format!("{} ", "a".repeat(65530 - offset));
      let html = format!(
        "<p>{prefix}{token}{token} continued é words {}{token}</p>",
        "words ".repeat(12000)
      );
      let expected = html_to_markdown_result(&html, HtmlToMarkdownOptions::default());
      for cut in [
        prefix.len() + 3,
        prefix.len() + 4,
        prefix.len() + 5,
        65536,
        html.len(),
      ] {
        let cut = html.ceil_char_boundary(cut);
        let mut p = MarkdownStreamProcessor::new(HtmlToMarkdownOptions {
          max_node_bytes: 128 * 1024,
          ..Default::default()
        });
        let mut output = p.process_chunk(&html[..cut]);
        output.push_str(&p.process_chunk(&html[cut..]));
        output.push_str(&p.finish());
        assert!(!p.truncated());
        assert_eq!(
          output, expected.markdown,
          "token={token:?} offset={offset} cut={cut}"
        );
      }
    }
  }
}
