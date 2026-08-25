#![no_main]
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::types::*;
use mdream::{MarkdownStreamProcessor, html_to_format_result};

// The other streaming targets pin `HTMLToMarkdownOptions::default()`. This one
// drives the option-dependent rewrite paths (wrap, clean, plugins, plain text)
// through chunk boundaries, where stored buffer offsets are rebased by the
// drain and can drift relative to in-buffer rewrites.
#[derive(Arbitrary, Debug)]
struct Input {
  html: String,
  chunk_width: u8,
  wrap_width: u8,
  plain_text: bool,
  clean_all: bool,
  use_origin: bool,
  isolate_main: bool,
  tailwind: bool,
  frontmatter: bool,
  filter_exclude: Vec<String>,
  extraction: Vec<String>,
}

fuzz_target!(|input: Input| {
  let plugins = PluginConfig {
    filter: if input.filter_exclude.is_empty() {
      None
    } else {
      Some(FilterConfig {
        include: None,
        exclude: Some(input.filter_exclude.clone()),
        process_children: None,
      })
    },
    isolate_main: input.isolate_main.then_some(IsolateMainConfig),
    frontmatter: input.frontmatter.then(FrontmatterConfig::default),
    tailwind: input.tailwind.then_some(TailwindConfig),
    extraction: if input.extraction.is_empty() {
      None
    } else {
      Some(ExtractionConfig {
        selectors: input.extraction.clone(),
      })
    },
    tag_overrides: None,
  };

  let options = HTMLToMarkdownOptions {
    origin: input
      .use_origin
      .then(|| "https://example.com/base/".to_string()),
    clean_urls: input.clean_all,
    clean: input.clean_all.then(CleanConfig::all),
    plugins: Some(plugins),
    wrap_width: input.wrap_width as usize,
    max_node_bytes: 0,
  };

  let format = if input.plain_text {
    OutputFormat::Text
  } else {
    OutputFormat::Markdown
  };

  // One-shot, same options.
  let _ = html_to_format_result(&input.html, options.clone(), format);

  // Streamed at a fixed chunk width, rounded up to char boundaries.
  let width = (input.chunk_width as usize).max(1);
  let mut processor = MarkdownStreamProcessor::new_with_format(options, format);
  let mut start = 0;
  while start < input.html.len() {
    let mut end = (start + width).min(input.html.len());
    while end < input.html.len() && !input.html.is_char_boundary(end) {
      end += 1;
    }
    let _ = processor.process_chunk(&input.html[start..end]);
    start = end;
  }
  let _ = processor.finish();
});
