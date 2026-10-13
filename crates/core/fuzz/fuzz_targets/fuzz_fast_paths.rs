#![no_main]
//! Differential oracle: the fast paths are the general paths with their context
//! pinned, so turning them off must not change a byte, one-shot or streamed.
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use mdream::fuzz_bridge::{convert_with_fast_paths, stream_with_fast_paths};
use mdream::types::*;

/// Base for relative links when the input enables an origin.
const ORIGIN: &str = "https://example.com/docs/";
/// Narrow enough that ordinary prose wraps several times.
const WRAP_WIDTH: usize = 24;
/// Largest streamed chunk; small chunks split tags and entities mid-token.
const MAX_CHUNK: usize = 64;

/// `html` is last so it takes the rest of the input: a seed is a few option
/// bytes followed by real HTML, which random strings almost never reach.
#[derive(Arbitrary, Debug)]
struct FuzzInput {
  format: u8,
  clean: bool,
  minimal_plugins: bool,
  origin: bool,
  wrap: bool,
  cap: Option<u16>,
  chunk: u8,
  html: String,
}

fuzz_target!(|input: FuzzInput| {
  let options = HtmlToMarkdownOptions {
    origin: input.origin.then(|| ORIGIN.to_string()),
    clean: input.clean.then(CleanConfig::all),
    plugins: input.minimal_plugins.then(|| PluginConfig {
      frontmatter: Some(FrontmatterConfig::default()),
      isolate_main: Some(IsolateMainConfig),
      tailwind: Some(TailwindConfig),
      filter: Some(FilterConfig {
        exclude: Some(vec!["nav".into(), "footer".into()]),
        ..Default::default()
      }),
      ..Default::default()
    }),
    wrap_width: if input.wrap { WRAP_WIDTH } else { 0 },
    max_node_bytes: input.cap.map_or(0, |cap| usize::from(cap) + 1),
    ..Default::default()
  };
  let format = match input.format % 3 {
    0 => OutputFormat::Markdown,
    1 => OutputFormat::Text,
    _ => OutputFormat::Html,
  };
  let html = input.html.as_str();
  assert_eq!(
    convert_with_fast_paths(html, options.clone(), format, false),
    convert_with_fast_paths(html, options.clone(), format, true),
    "one-shot"
  );
  let size = usize::from(input.chunk) % MAX_CHUNK + 1;
  let mut chunks = Vec::new();
  let mut start = 0;
  while start < html.len() {
    let mut end = (start + size).min(html.len());
    while !html.is_char_boundary(end) {
      end += 1;
    }
    chunks.push(&html[start..end]);
    start = end;
  }
  assert_eq!(
    stream_with_fast_paths(&chunks, options.clone(), format, false),
    stream_with_fast_paths(&chunks, options, format, true),
    "streamed"
  );
});
