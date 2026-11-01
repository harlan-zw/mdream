//! Allocation budgets exercise conversion through the public API.
#![allow(unsafe_code)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use mdream::{
  CleanConfig, FilterConfig, HtmlToMarkdownOptions, IsolateMainConfig, MarkdownStreamProcessor,
  OutputFormat, PluginConfig, TailwindConfig, html_to_format, html_to_markdown,
};

struct CountingAllocator;
thread_local! {
  static ALLOCATIONS: Cell<usize> = const { Cell::new(0) };
}

// SAFETY: allocation and layout handling are delegated unchanged to System.
unsafe impl GlobalAlloc for CountingAllocator {
  unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
    ALLOCATIONS.with(|count| count.set(count.get() + 1));
    unsafe { System.alloc(layout) }
  }

  unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
    unsafe { System.dealloc(ptr, layout) }
  }

  unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
    ALLOCATIONS.with(|count| count.set(count.get() + 1));
    unsafe { System.realloc(ptr, layout, size) }
  }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

fn assert_budget(html: &str, options: HtmlToMarkdownOptions, expected: &str, budget: usize) {
  let before = ALLOCATIONS.get();
  let result = html_to_markdown(html, options);
  let used = ALLOCATIONS.get() - before;
  assert_eq!(result, expected);
  assert!(
    used <= budget,
    "conversion used {used} allocation calls; budget {budget}"
  );
}

#[test]
fn repeated_text_and_code_reuse_storage() {
  const COUNT: usize = 1024;
  for (html, markdown) in [
    ("<p>A &#97;nd B</p>", "A and B\n\n"),
    ("<p>A & B</p>", "A & B\n\n"),
    ("<p><code>value</code></p>", "`value`\n\n"),
  ] {
    assert_budget(
      &html.repeat(COUNT),
      HtmlToMarkdownOptions::default(),
      markdown.repeat(COUNT).trim_end(),
      64,
    );
  }
}

#[test]
fn cleaned_links_do_not_allocate_intermediate_urls() {
  const COUNT: usize = 1024;
  let long_query = format!("?{}q=ok", "utm_x=1&".repeat(256));
  for query in ["?q=ok", "?utm_source=x&q=ok", long_query.as_str()] {
    let html = format!("<a href='../guide{query}'>Guide</a> ").repeat(COUNT);
    let options = HtmlToMarkdownOptions {
      origin: Some("https://example.com/docs/page".into()),
      clean: Some(CleanConfig {
        urls: true,
        redundant_links: true,
        ..Default::default()
      }),
      ..Default::default()
    };
    assert_budget(
      &html,
      options,
      "[Guide](https://example.com/guide?q=ok) "
        .repeat(COUNT)
        .trim_end(),
      // Each link owns its href and resolved destination. Leave room for
      // setup and output growth, without permitting a third allocation per link.
      COUNT * 2 + 64,
    );
  }
}

#[test]
fn excluded_links_do_not_allocate_per_link() {
  const COUNT: usize = 1024;
  // An icon link's trailing blank comes after a child but no text, which a
  // link that can take its label records.
  for link in [
    "<a href='/x'><span>Item</span> <span>more</span></a>",
    "<a href='/x'><svg></svg> </a>",
  ] {
    let links = link.repeat(COUNT);
    // The nav links are excluded; the header links are skipped until main is found.
    for (html, plugins) in [
      (
        format!("<nav>{links}</nav><main><p>body</p></main>"),
        PluginConfig {
          filter: Some(FilterConfig::exclude(&["nav"])),
          ..Default::default()
        },
      ),
      (
        format!("<header>{links}</header><main><p>body</p></main>"),
        PluginConfig {
          isolate_main: Some(IsolateMainConfig),
          ..Default::default()
        },
      ),
    ] {
      let options = HtmlToMarkdownOptions {
        plugins: Some(plugins),
        ..Default::default()
      };
      assert_budget(&html, options, "body", 64);
    }
  }
}

#[test]
fn tailwind_only_keeps_class_and_handler_attributes() {
  const COUNT: usize = 1024;
  assert_budget(
    &"<div data-unused=abc data-other=def class=ordinary>A and B</div>".repeat(COUNT),
    HtmlToMarkdownOptions {
      plugins: Some(PluginConfig {
        tailwind: Some(TailwindConfig),
        ..Default::default()
      }),
      ..Default::default()
    },
    "A and B\n\n".repeat(COUNT).trim_end(),
    COUNT + 64,
  );
}

#[test]
fn optimized_paths_preserve_output_at_every_stream_split() {
  let options = HtmlToMarkdownOptions {
    origin: Some("https://example.com/docs/page".into()),
    clean: Some(CleanConfig {
      urls: true,
      redundant_links: true,
      ..Default::default()
    }),
    plugins: Some(PluginConfig {
      tailwind: Some(TailwindConfig),
      ..Default::default()
    }),
    ..Default::default()
  };
  let html = concat!(
    "<p>&amp;copy; &bogus; &nLt; &#x80; A & B</p>",
    "<p class='font-bold' data-unused='abc'>&copy; <code>x</code> &#65;</p>",
    "<p><code>`x`</code> <code>λ</code></p>",
    "<a href='../guide?utm_source=x&amp;名=值&amp;&amp;#章' title='題'>Link</a>",
    "<img src='../photo?utm_source=x&amp;q=ok' alt='図'>",
    "<div class=hidden data-unused=abc>Hidden</div><p>After &amp; end</p>",
  );
  for format in [
    OutputFormat::Markdown,
    OutputFormat::Text,
    OutputFormat::Html,
  ] {
    let expected = html_to_format(html, options.clone(), format);
    for split in (0..=html.len()).filter(|&i| html.is_char_boundary(i)) {
      let mut stream = MarkdownStreamProcessor::new_with_format(options.clone(), format);
      let mut actual = stream.process_chunk(&html[..split]);
      actual.push_str(&stream.process_chunk(&html[split..]));
      actual.push_str(&stream.finish());
      assert_eq!(actual, expected, "format={format:?}, split={split}");
    }
  }
}
