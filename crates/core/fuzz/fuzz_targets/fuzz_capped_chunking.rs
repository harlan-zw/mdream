#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::types::*;
use mdream::{MarkdownStreamProcessor, html_to_markdown_result};

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
// retained-byte budget to the raw-length guard.

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

#[derive(Arbitrary, Debug)]
struct Elem {
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
}

fn render(input: &Input) -> String {
  let mut html = String::new();
  for elem in &input.elems {
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
  html
}

fn options(input: &Input) -> HTMLToMarkdownOptions {
  HTMLToMarkdownOptions {
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
        selectors: vec!["a".into()],
      }),
      tag_overrides: None,
    }),
    max_node_bytes: input.cap as usize,
    ..Default::default()
  }
}

fuzz_target!(|input: Input| {
  let html = render(&input);
  if html.is_empty() {
    return;
  }
  let one_shot = html_to_markdown_result(&html, options(&input));

  let width = (input.chunk_width as usize).max(1);
  let mut processor = MarkdownStreamProcessor::new(options(&input));
  let mut streamed = String::new();
  let mut start = 0;
  while start < html.len() {
    let end = (start + width).min(html.len());
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
});
