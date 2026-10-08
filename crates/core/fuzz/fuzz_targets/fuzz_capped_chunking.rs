#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::types::*;
use mdream::{
  MarkdownStreamProcessor, html_to_markdown_result, html_to_markdown_without_text_flush,
};

// Every other target pins `max_node_bytes: 0`, leaving the capped start-tag
// path unfuzzed. The cap drops a construct on its own length, so one-shot and
// chunked conversion must agree byte for byte and on `truncated`; a scanner
// that retains or charges carried bytes differently from a whole-tag parse
// breaks exactly that.
//
// Tags are generated rather than taken as raw bytes: arbitrary input is almost
// all text, and the paths at issue are names, attribute sets, duplicates and
// quoting. Plugin toggles matter because a filter, extraction or tailwind
// config makes every attribute readable and switches the tag from the
// retained-byte budget to the raw-length guard. Declarations exercise the
// scanners that skip them, and an untruncated result must match an uncapped one.

#[derive(Arbitrary, Debug)]
enum Quote {
  Bare,
  Unquoted,
  Single,
  Double,
}

#[derive(Arbitrary, Debug)]
enum Name {
  Href,
  Title,
  Class,
  Alt,
  Src,
  Colspan,
  Data,
  Custom(u8),
}

impl Name {
  fn render(&self, out: &mut String) {
    match self {
      Self::Href => out.push_str("href"),
      Self::Title => out.push_str("title"),
      Self::Class => out.push_str("class"),
      Self::Alt => out.push_str("alt"),
      Self::Src => out.push_str("src"),
      Self::Colspan => out.push_str("colspan"),
      Self::Data => out.push_str("data-x"),
      Self::Custom(len) => {
        out.push_str("z-");
        for _ in 0..*len {
          out.push('q');
        }
      }
    }
  }
}

#[derive(Arbitrary, Debug)]
struct Attr {
  name: Name,
  value_len: u8,
  quote: Quote,
}

impl Attr {
  fn render(&self, out: &mut String) {
    out.push(' ');
    self.name.render(out);
    if matches!(self.quote, Quote::Bare) {
      return;
    }
    out.push('=');
    let delim = match self.quote {
      Quote::Single => Some('\''),
      Quote::Double => Some('"'),
      _ => None,
    };
    if let Some(delim) = delim {
      out.push(delim);
    }
    for _ in 0..self.value_len {
      out.push('v');
    }
    if let Some(delim) = delim {
      out.push(delim);
    }
  }
}

#[derive(Arbitrary, Debug)]
enum Tag {
  A,
  P,
  Em,
  Img,
  Div,
  Blockquote,
  Noscript,
  Iframe,
  Style,
  Datalist,
  Code,
  Pre,
  Custom(u8),
}

impl Tag {
  fn name(&self) -> String {
    match self {
      Self::A => "a".into(),
      Self::P => "p".into(),
      Self::Em => "em".into(),
      Self::Img => "img".into(),
      Self::Div => "div".into(),
      Self::Blockquote => "blockquote".into(),
      Self::Noscript => "noscript".into(),
      Self::Iframe => "iframe".into(),
      Self::Style => "style".into(),
      Self::Datalist => "datalist".into(),
      Self::Code => "code".into(),
      Self::Pre => "pre".into(),
      Self::Custom(len) => {
        let mut name = String::from("x-");
        for _ in 0..*len {
          name.push('n');
        }
        name
      }
    }
  }
}

// Pieces chosen to form and split the terminators the declaration scanners
// disagree on: `-->`, `--!>`, `]]>` and a bare `>`.
#[derive(Arbitrary, Debug)]
enum Piece {
  Dash,
  Bang,
  Gt,
  Bracket,
  Text(u8),
}

#[derive(Arbitrary, Debug)]
enum Opener {
  Comment,
  Doctype,
  Cdata,
}

#[derive(Arbitrary, Debug)]
struct Decl {
  opener: Opener,
  body: Vec<Piece>,
}

impl Decl {
  fn render(&self, out: &mut String) {
    out.push_str(match self.opener {
      Opener::Comment => "<!--",
      Opener::Doctype => "<!DOCTYPE ",
      Opener::Cdata => "<![CDATA[",
    });
    for piece in &self.body {
      match piece {
        Piece::Dash => out.push('-'),
        Piece::Bang => out.push('!'),
        Piece::Gt => out.push('>'),
        Piece::Bracket => out.push(']'),
        Piece::Text(len) => {
          for _ in 0..*len {
            out.push('c');
          }
        }
      }
    }
  }
}

#[derive(Arbitrary, Debug)]
struct Elem {
  decl: Option<Decl>,
  tag: Tag,
  attrs: Vec<Attr>,
  text_len: u8,
  self_closing: bool,
}

#[derive(Arbitrary, Debug)]
struct Input {
  elems: Vec<Elem>,
  chunk_width: u8,
  cap: u16,
  filter_exclude: bool,
  extraction: bool,
  tailwind: bool,
  surfaced_cdata: bool,
  prose: Option<Prose>,
}

#[derive(Arbitrary, Debug)]
struct Prose {
  kind: u8,
  length: u16,
  context: u8,
}

type ExtractedFields = Vec<(String, String, String, Vec<(String, String)>)>;

fn extracted_fields(items: Option<Vec<ExtractedElement>>) -> Option<ExtractedFields> {
  items.map(|items| {
    items
      .into_iter()
      .map(|item| {
        (
          item.selector,
          item.tag_name,
          item.text_content,
          item.attributes,
        )
      })
      .collect()
  })
}

fn render(input: &Input) -> String {
  let mut html = String::new();
  for elem in &input.elems {
    if let Some(decl) = &elem.decl {
      decl.render(&mut html);
    }
    let name = elem.tag.name();
    html.push('<');
    html.push_str(&name);
    for attr in &elem.attrs {
      attr.render(&mut html);
    }
    if elem.self_closing {
      html.push_str("/>");
      continue;
    }
    html.push('>');
    for _ in 0..elem.text_len {
      html.push('t');
    }
    html.push_str("</");
    html.push_str(&name);
    html.push('>');
  }
  if let Some(prose) = &input.prose {
    let (open, close) = match prose.context % 7 {
      0 => ("<div>", "</div>"),
      1 => ("<p><span>", "</span></p>"),
      2 => ("<a href='/x'>", "</a>"),
      3 => ("<blockquote>", "</blockquote>"),
      4 => ("<h2>", "</h2>"),
      5 => ("<pre><code>", "</code></pre>"),
      _ => ("<a href='/x' title='title'>", "</a>"),
    };
    let unit = match prose.kind % 8 {
      0 => "ordinary words ",
      1 => "привет é漢😀e\u{301} ",
      2 => "ordinary ~ prose é &amp;copy; ",
      3 => "** __ ~~ [[ \\ &#92; &#60;tag ",
      4 => "&notit; &#x80; &#65 &#x &# ",
      5 => "# - + > 1. words &#10; ",
      6 => "&#111111111111111111111111111111111111111111111111111111111111111",
      _ => "漢😀é",
    };
    html.push_str(open);
    let end = html.len() + 64 * 1024 + usize::from(prose.length);
    while html.len() < end {
      html.push_str(unit);
    }
    html.push_str(close);
  }
  html
}

fn options(input: &Input, cap: usize) -> HtmlToMarkdownOptions {
  HtmlToMarkdownOptions {
    plugins: Some(PluginConfig {
      filter: input.filter_exclude.then(|| FilterConfig {
        include: None,
        exclude: Some(vec!["nav".into()]),
        process_children: None,
      }),
      isolate_main: None,
      frontmatter: None,
      tailwind: input.tailwind.then_some(TailwindConfig),
      extraction: input.extraction.then(|| ExtractionConfig {
        selectors: vec!["a".into(), "noscript".into()],
      }),
      tag_overrides: input
        .surfaced_cdata
        .then(|| vec![("#cdata-section".into(), TagOverrideConfig::default())]),
    }),
    max_node_bytes: cap,
    ..Default::default()
  }
}

fuzz_target!(|input: Input| {
  let html = render(&input);
  if html.is_empty() {
    return;
  }
  let cap = if input.prose.is_some() {
    [0, 7, 65535, 65536, 65537, 65599, 128 * 1024, 1024 * 1024][usize::from(input.cap % 8)]
  } else {
    input.cap as usize
  };
  let one_shot = html_to_markdown_result(&html, options(&input, cap));

  let width = (input.chunk_width as usize).max(1);
  let mut processor = MarkdownStreamProcessor::new(options(&input, cap));
  let mut streamed = String::new();
  let mut start = 0;
  while start < html.len() {
    let end = html.ceil_char_boundary((start + width).min(html.len()));
    streamed.push_str(&processor.process_chunk(&html[start..end]));
    start = end;
  }
  streamed.push_str(&processor.finish());

  assert_eq!(
    one_shot.markdown, streamed,
    "cap={} width={width} html={html:?}",
    input.cap
  );
  assert_eq!(
    one_shot.truncated,
    processor.truncated(),
    "cap={} width={width} html={html:?}",
    input.cap
  );
  assert_eq!(processor.frontmatter(), one_shot.frontmatter);
  assert_eq!(
    extracted_fields(processor.take_extracted()),
    extracted_fields(one_shot.extracted)
  );
  if !one_shot.truncated {
    let uncapped = html_to_markdown_without_text_flush(&html, options(&input, 0));
    assert_eq!(
      one_shot.markdown, uncapped.markdown,
      "untruncated output differs from uncapped: cap={} html={html:?}",
      input.cap
    );
  }
});
