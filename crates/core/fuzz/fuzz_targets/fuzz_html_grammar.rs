#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::types::*;
use mdream::{MarkdownStreamProcessor, html_to_format_result};

// The byte-oriented targets have to rediscover HTML from random bytes, so most
// of their budget is spent on inputs the parser rejects in its first branch.
// This one emits a token stream instead: every mutation lands on something the
// parser walks deep into, and because the tokens are emitted flat rather than
// as a tree, unbalanced and mismatched markup falls out on its own.
//
// Keep the byte-oriented targets. A grammar only produces what it knows about,
// so it cannot replace random bytes, only spend more time past the tokenizer.

// Tags picked for the handlers that behave differently: raw-text elements,
// void elements, table and list structure, and elements with no handler at all.
const TAGS: [&str; 40] = [
  "html", "head", "body", "main", "article", "section", "nav", "footer", "header", "aside", "div",
  "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "code", "pre", "blockquote",
  "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "th", "td", "a", "img",
  "script", "style",
];

const VOID_TAGS: [&str; 6] = ["br", "hr", "meta", "link", "input", "source"];

// Unknown and case-varied names: the tag lookup is a perfect hash on lowercase
// bytes, so these drive the fallback and the case-folding path.
const ODD_TAGS: [&str; 6] = ["my-widget", "DIV", "TaBlE", "svg", "template", "textarea"];

const ATTR_NAMES: [&str; 12] = [
  "href",
  "src",
  "class",
  "id",
  "alt",
  "title",
  "colspan",
  "rowspan",
  "style",
  "hidden",
  "aria-hidden",
  "data-x",
];

const ATTR_VALUES: [&str; 14] = [
  "",
  "/rel",
  "https://example.com/a b",
  "//cdn.example.com/x",
  "#frag",
  "javascript:alert(1)",
  "data:text/html,<b>",
  "9999",
  "-1",
  "text-red-500 font-bold line-through",
  "sr-only",
  "\"quoted\"",
  "a'b",
  "\u{1F600}",
];

// Text fragments that interact with Markdown escaping, entity decoding and
// UTF-8 boundary handling.
const TEXTS: [&str; 20] = [
  "x",
  " ",
  "\n\n",
  "\r\n",
  "hello world",
  "*emphasis* _under_ `tick`",
  "| pipe | table |",
  "# not a heading",
  "> quote",
  "[link] (paren)",
  "&amp;",
  "&#x1F600;",
  "&#xZZ;",
  "&notanentity;",
  "&",
  "\u{1F600}\u{1F1E6}\u{1F1FA}",
  "e\u{0301}\u{0301}\u{0301}",
  "\u{202E}rtl",
  "\0",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
];

#[derive(Arbitrary, Debug)]
enum Token {
  Open { tag: u8, attrs: Vec<(u8, u8, Quote)> },
  Close { tag: u8 },
  SelfClosing { tag: u8 },
  Void { tag: u8 },
  Odd { tag: u8, close: bool },
  Text { which: u8 },
  Comment { unterminated: bool },
  Doctype,
  // Deliberately broken syntax the tokenizer has to resynchronise from.
  StrayLt,
  StrayGt,
  UnclosedOpen { tag: u8 },
  AttrNoValue { tag: u8, attr: u8 },
}

#[derive(Arbitrary, Debug)]
enum Quote {
  Double,
  Single,
  None,
}

#[derive(Arbitrary, Debug)]
struct Input {
  tokens: Vec<Token>,
  chunk_width: u8,
  wrap_width: u8,
  plain_text: bool,
  clean_all: bool,
  minimal_plugins: bool,
}

fn pick<T: Copy>(table: &[T], i: u8) -> T {
  table[i as usize % table.len()]
}

fn push_attrs(out: &mut String, attrs: &[(u8, u8, Quote)]) {
  for (name, value, quote) in attrs {
    out.push(' ');
    out.push_str(pick(&ATTR_NAMES, *name));
    out.push('=');
    let value = pick(&ATTR_VALUES, *value);
    match quote {
      Quote::Double => {
        out.push('"');
        out.push_str(value);
        out.push('"');
      }
      Quote::Single => {
        out.push('\'');
        out.push_str(value);
        out.push('\'');
      }
      // Unquoted values run to the next space, so a value containing one leaks
      // into the following attribute name.
      Quote::None => out.push_str(value),
    }
  }
}

fn render(tokens: &[Token]) -> String {
  let mut out = String::new();
  for token in tokens {
    match token {
      Token::Open { tag, attrs } => {
        out.push('<');
        out.push_str(pick(&TAGS, *tag));
        push_attrs(&mut out, attrs);
        out.push('>');
      }
      Token::Close { tag } => {
        out.push_str("</");
        out.push_str(pick(&TAGS, *tag));
        out.push('>');
      }
      Token::SelfClosing { tag } => {
        out.push('<');
        out.push_str(pick(&TAGS, *tag));
        out.push_str("/>");
      }
      Token::Void { tag } => {
        out.push('<');
        out.push_str(pick(&VOID_TAGS, *tag));
        out.push('>');
      }
      Token::Odd { tag, close } => {
        out.push('<');
        if *close {
          out.push('/');
        }
        out.push_str(pick(&ODD_TAGS, *tag));
        out.push('>');
      }
      Token::Text { which } => out.push_str(pick(&TEXTS, *which)),
      Token::Comment { unterminated } => {
        out.push_str("<!-- c ");
        if !*unterminated {
          out.push_str("-->");
        }
      }
      Token::Doctype => out.push_str("<!DOCTYPE html>"),
      Token::StrayLt => out.push_str("a < b"),
      Token::StrayGt => out.push('>'),
      Token::UnclosedOpen { tag } => {
        out.push('<');
        out.push_str(pick(&TAGS, *tag));
        out.push_str(" class=\"x");
      }
      Token::AttrNoValue { tag, attr } => {
        out.push('<');
        out.push_str(pick(&TAGS, *tag));
        out.push(' ');
        out.push_str(pick(&ATTR_NAMES, *attr));
        out.push_str("=>");
      }
    }
  }
  out
}

fuzz_target!(|input: Input| {
  let html = render(&input.tokens);

  let plugins = input.minimal_plugins.then(|| PluginConfig {
    filter: Some(FilterConfig {
      include: None,
      exclude: Some(vec!["nav".to_string(), "footer".to_string()]),
      process_children: None,
    }),
    isolate_main: Some(IsolateMainConfig),
    frontmatter: Some(FrontmatterConfig::default()),
    tailwind: Some(TailwindConfig),
    extraction: Some(ExtractionConfig {
      selectors: vec!["h1".to_string(), "img[alt]".to_string()],
    }),
    tag_overrides: None,
  });

  let options = HTMLToMarkdownOptions {
    origin: Some("https://example.com/base/".to_string()),
    clean_urls: input.clean_all,
    clean: input.clean_all.then(CleanConfig::all),
    plugins,
    wrap_width: input.wrap_width as usize,
    max_node_bytes: 0,
  };

  let format = if input.plain_text {
    OutputFormat::Text
  } else {
    OutputFormat::Markdown
  };

  let _ = html_to_format_result(&html, options.clone(), format);

  let width = (input.chunk_width as usize).max(1);
  let mut processor = MarkdownStreamProcessor::new_with_format(options, format);
  let mut start = 0;
  while start < html.len() {
    let mut end = (start + width).min(html.len());
    while end < html.len() && !html.is_char_boundary(end) {
      end += 1;
    }
    let _ = processor.process_chunk(&html[start..end]);
    start = end;
  }
  let _ = processor.finish();
});
