use mdream::MarkdownStreamProcessor;
use mdream::splitter::{SplitterOptions, split_markdown};
use mdream::types::{
  CleanConfig, ExtractionConfig, FrontmatterConfig, HtmlToMarkdownOptions, OutputFormat,
  PluginConfig, TailwindConfig,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::hint::black_box;
use std::io::{BufRead, Write};

#[cfg(feature = "alloc")]
mod allocation;
#[cfg(feature = "alloc")]
#[global_allocator]
static ALLOCATOR: allocation::Allocator = allocation::Allocator;

#[derive(Deserialize)]
#[serde(rename_all = "kebab-case")]
enum Options {
  Default,
  Clean,
  Tailwind,
  TailwindExtraction,
  TailwindCapped,
  Metadata,
  Fragments,
}
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Format {
  Markdown,
  Text,
  Html,
}
#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "lowercase")]
enum Input {
  Convert { html: String },
  Stream { chunks: Vec<String> },
  Split { markdown: String },
}
#[derive(Deserialize)]
struct Case {
  #[serde(flatten)]
  input: Input,
  options: Options,
  format: Format,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Command {
  case: usize,
  mode: String,
  iterations: usize,
}

impl Case {
  fn options(&self) -> HtmlToMarkdownOptions {
    let mut options = HtmlToMarkdownOptions::default();
    match self.options {
      Options::Default => {}
      Options::Clean => {
        options.origin = Some("https://example.com/docs/page".into());
        options.clean = Some(CleanConfig {
          urls: true,
          redundant_links: true,
          ..Default::default()
        });
      }
      Options::Fragments => {
        options.clean = Some(CleanConfig {
          fragments: true,
          ..Default::default()
        })
      }
      Options::Tailwind | Options::TailwindExtraction | Options::TailwindCapped => {
        options.plugins = Some(PluginConfig {
          tailwind: Some(TailwindConfig),
          extraction: matches!(self.options, Options::TailwindExtraction).then(|| {
            ExtractionConfig {
              selectors: vec!["h2".into()],
            }
          }),
          ..Default::default()
        });
        if matches!(self.options, Options::TailwindCapped) {
          options.max_node_bytes = 4096;
        }
      }
      Options::Metadata => {
        options.plugins = Some(PluginConfig {
          frontmatter: Some(FrontmatterConfig::default()),
          extraction: Some(ExtractionConfig {
            selectors: vec!["h2".into()],
          }),
          ..Default::default()
        })
      }
    }
    options
  }
  fn format(&self) -> OutputFormat {
    match self.format {
      Format::Markdown => OutputFormat::Markdown,
      Format::Text => OutputFormat::Text,
      Format::Html => OutputFormat::Html,
    }
  }
}

fn extracted_values(elements: &[mdream::types::ExtractedElement]) -> Vec<Value> {
  elements
    .iter()
    .map(|element| {
      json!({
        "selector": element.selector, "tag": element.tag_name,
        "text": element.text_content, "attributes": element.attributes,
      })
    })
    .collect()
}

// Verification collects output. Timed and allocation runs discard it incrementally.
fn run(case: &Case, verify: bool) -> Value {
  match &case.input {
    Input::Convert { html } => {
      let result = mdream::html_to_format_result(black_box(html), case.options(), case.format());
      black_box(&result);
      if verify {
        json!({"output":result.markdown,"truncated":result.truncated,"frontmatter":result.frontmatter,"extracted":extracted_values(result.extracted.as_deref().unwrap_or_default())})
      } else {
        Value::Null
      }
    }
    Input::Stream { chunks } => {
      let mut stream = MarkdownStreamProcessor::new_with_format(case.options(), case.format());
      let mut output = String::new();
      let mut metadata = Vec::new();
      for chunk in chunks {
        let part = stream.process_chunk(black_box(chunk));
        black_box(&part);
        if verify {
          output.push_str(&part);
        }
        if let Some(extracted) = stream.take_extracted() {
          black_box(&extracted);
          if verify {
            metadata.extend(extracted_values(&extracted));
          }
        }
      }
      let tail = stream.finish();
      black_box(&tail);
      let extracted = stream.take_extracted();
      black_box(&extracted);
      let frontmatter = stream.frontmatter();
      black_box(&frontmatter);
      if verify {
        output.push_str(&tail);
        if let Some(extracted) = extracted {
          metadata.extend(extracted_values(&extracted));
        }
        json!({"output":output,"truncated":stream.truncated(),"metadata":metadata,"frontmatter":frontmatter})
      } else {
        Value::Null
      }
    }
    Input::Split { markdown } => {
      let chunks = split_markdown(black_box(markdown), &SplitterOptions::default());
      black_box(&chunks);
      if verify {
        json!(chunks.iter().map(|chunk| json!({"content":chunk.content,"metadata":json!({"headers":chunk.metadata.headers,"code":chunk.metadata.code,"loc":chunk.metadata.loc.as_ref().map(|loc| (loc.from,loc.to))})})).collect::<Vec<_>>())
      } else {
        Value::Null
      }
    }
  }
}
#[cfg(not(feature = "alloc"))]
fn cpu_ms() -> f64 {
  let mut time = libc::timespec {
    tv_sec: 0,
    tv_nsec: 0,
  };
  // SAFETY: time is a valid writable timespec; the clock has no other preconditions.
  assert_eq!(
    unsafe { libc::clock_gettime(libc::CLOCK_THREAD_CPUTIME_ID, &mut time) },
    0
  );
  time.tv_sec as f64 * 1000.0 + time.tv_nsec as f64 / 1_000_000.0
}
fn main() {
  let manifest = std::env::args()
    .nth(1)
    .expect("Pass the fixture manifest path");
  let cases: Vec<Case> = serde_json::from_slice(&std::fs::read(manifest).unwrap()).unwrap();
  let stdin = std::io::stdin();
  let mut stdout = std::io::stdout().lock();
  for line in stdin.lock().lines() {
    let command: Command = serde_json::from_str(&line.unwrap()).unwrap();
    assert!((1..=10000).contains(&command.iterations));
    let case = &cases[command.case];
    let result = match command.mode.as_str() {
      "verify" => run(case, true),
      #[cfg(not(feature = "alloc"))]
      "cpu" => {
        let start = cpu_ms();
        for _ in 0..command.iterations {
          black_box(run(case, false));
        }
        json!({"cpu":(cpu_ms()-start)/command.iterations as f64})
      }
      #[cfg(feature = "alloc")]
      "alloc" => json!(allocation::measure(|| {
        black_box(run(case, false));
      })),
      _ => panic!("Unsupported benchmark mode"),
    };
    serde_json::to_writer(&mut stdout, &result).unwrap();
    writeln!(stdout).unwrap();
    stdout.flush().unwrap();
  }
}
