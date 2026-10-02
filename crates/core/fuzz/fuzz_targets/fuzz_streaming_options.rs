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
    // In Markdown, fragment cleanup buffers until finish; test incremental drains.
    clean: input.clean_all.then(|| CleanConfig {
      fragments: false,
      ..CleanConfig::all()
    }),
    plugins: Some(plugins),
    wrap_width: input.wrap_width as usize,
    max_node_bytes: 0,
  };

  let format = if input.plain_text {
    OutputFormat::Text
  } else {
    OutputFormat::Markdown
  };

  // Full-document buffering prevents a later link rewrite from touching bytes
  // that the streaming API has already returned.
  let mut parity_options = options.clone();
  if format == OutputFormat::Markdown {
    parity_options
      .clean
      .get_or_insert_with(CleanConfig::default)
      .fragments = true;
  }
  let one_shot = html_to_format_result(&input.html, parity_options.clone(), format).markdown;

  // Streamed at a fixed chunk width, rounded up to char boundaries.
  let width = (input.chunk_width as usize).max(1);
  let mut streamed = String::new();
  let mut processor = MarkdownStreamProcessor::new_with_format(parity_options, format);
  let mut incremental = (format == OutputFormat::Markdown).then(|| {
    (
      MarkdownStreamProcessor::new_with_format(options.clone(), format),
      mdream::fuzz_bridge::new_drain_disabled(options, format),
    )
  });
  let mut drained_output = String::new();
  let mut undrained_output = String::new();
  let mut start = 0;
  while start < input.html.len() {
    let mut end = (start + width).min(input.html.len());
    while end < input.html.len() && !input.html.is_char_boundary(end) {
      end += 1;
    }
    let chunk = &input.html[start..end];
    streamed.push_str(&processor.process_chunk(chunk));
    if let Some((drained, undrained)) = &mut incremental {
      drained_output.push_str(&drained.process_chunk(chunk));
      undrained_output.push_str(&undrained.process_chunk(chunk));
    }
    start = end;
  }
  streamed.push_str(&processor.finish());
  if let Some((drained, undrained)) = &mut incremental {
    drained_output.push_str(&drained.finish());
    undrained_output.push_str(&undrained.finish());
    assert_eq!(
      drained_output, undrained_output,
      "draining changed output: input={input:?}"
    );
  }
  assert_eq!(
    streamed, one_shot,
    "streaming diverged from one-shot: input={input:?}"
  );
});
