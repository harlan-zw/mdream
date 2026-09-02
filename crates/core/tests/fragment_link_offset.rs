// `clean.fragments` rewrites recorded `[text](#frag)` links in `get_markdown`
// by slicing the buffer at stored offsets. The stored start can drift off the
// `[` when other output (headings, lists, blockquotes) shifts the buffer after
// an anchor is recorded, so a stale offset pointed at a `]` instead and the
// slice panicked with `begin > end`.
//
// Found by `fuzz_options`: unclosed `<a href="#frag">` anchors inside `<h4>`
// headings, with every clean flag on except `empty_link_text`.

use mdream::types::{
  CleanConfig, FilterConfig, FrontmatterConfig, HTMLToMarkdownOptions, IsolateMainConfig,
  PluginConfig, TailwindConfig,
};

fn convert_fragments(html: &str) -> String {
  mdream::html_to_markdown(
    html,
    HTMLToMarkdownOptions {
      clean: Some(CleanConfig {
        fragments: true,
        ..Default::default()
      }),
      ..Default::default()
    },
  )
}

#[test]
fn multibyte_fragment_offset_never_panics() {
  let html = "<a href=\"#a\"><blockquote>é<a href=\"#b\">x</a></blockquote></a>";
  let _ = convert_fragments(html);
}

#[test]
fn drifted_fragment_offset_keeps_balanced_link_markers() {
  let html = "<a href=\"#a\"><blockquote>e<a href=\"#b\">x</a></blockquote></a>";
  let markdown = convert_fragments(html);
  assert_eq!(markdown.matches('[').count(), markdown.matches(']').count());
}

#[test]
fn valid_heading_fragment_survives_a_drifted_offset() {
  let html = "<h2 id=\"b\">b</h2><a href=\"#a\"><blockquote>e<a href=\"#b\">x</a></blockquote></a>";
  let clean = convert_fragments(html);
  let unchanged = mdream::html_to_markdown(html, HTMLToMarkdownOptions::default());
  assert_eq!(clean, unchanged);
}

#[test]
fn fragment_rewrite_survives_drifted_link_offset() {
  let clean = CleanConfig {
    urls: true,
    fragments: true,
    empty_links: true,
    blank_lines: true,
    redundant_links: true,
    self_link_headings: true,
    empty_images: true,
    empty_link_text: false,
  };
  let options = HTMLToMarkdownOptions {
    origin: Some("https://example.com/".to_string()),
    clean_urls: true,
    clean: Some(clean),
    ..Default::default()
  };
  let html = ">\0r></+<><:i>\0<hr>\u{8}<a href=\"#frag\">\0r></+<><:i>\u{11}\0\0\0>6>{{{\0\0<>lg\u{11}i\u{8}lih<h4>{{{<il>\u{11}nsubex\0&<2r><0++<><:i>\u{11}\0\0\0<hr>\u{8}<a href=\"#frag\">\0r></+<><:i\0>\u{11}\0\0\0>4>{{{<li>\u{11}ex\0&<hr></+<><:i>\u{11}\0e><oh4>><\u{8}<a href=\"#frag\">";
  let _ = mdream::html_to_markdown(html, options);
}

// A drifted entry whose range no longer starts at `[` must be left untouched.
// The rewrite path used to advance the cursor past `[adj_start..adj_end)`
// without pushing those bytes, silently deleting the whole span from the
// output instead of leaving it as-is for the normal cursor copy.
#[test]
fn drifted_invalid_fragment_link_is_left_as_is() {
  let clean = CleanConfig {
    urls: true,
    fragments: true,
    empty_links: true,
    blank_lines: true,
    redundant_links: true,
    self_link_headings: true,
    empty_images: true,
    empty_link_text: false,
  };
  let options = HTMLToMarkdownOptions {
    origin: Some("https://example.com/".to_string()),
    clean_urls: true,
    clean: Some(clean),
    ..Default::default()
  };
  // The anchor opens before the blockquote, so the `> ` quote prefix inserted
  // at blockquote close shifts the recorded bracket start off the `[`. The
  // recorded range then holds `> []()](#p)`: not a `[text](#frag)` shape, so
  // every byte of it has to survive into the markdown.
  let html = "<a href=#p><blockquote><a href>";
  let markdown = mdream::html_to_markdown(html, options);
  assert_eq!(markdown, "[> []()](#p)");
}

// Two fragment_links entries can share a bracket_start when an `<a>` nested
// across a block boundary never gets its own `[`. Neither may be rewritten.
//
// Real tailwindcss.com docs markup (a footer link followed by an "on this
// page" sidebar), kept byte-for-byte: trimming the class attributes or the
// stray `</span>` stops it from reproducing.
#[test]
fn aliased_bracket_from_unclosed_nested_anchor_is_not_rewritten() {
  let html = "\n<h3 id=\"responsive-design\"></h3><a class=\"group flex items-center gap-2 hover:text-gray-900 dark:hover:text-white\" href=\"/docs/text-decoration-thickness\">text-decoration-thickness</span><div class=\"sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-x-hidden px-6 pt-10 pb-24\"><a class=\"inline-block border-l border-transparent text-base/8 text-gray-600 hover:border-gray-950/25 hover:text-gray-950 sm:text-sm/6 dark:text-gray-300 dark:hover:border-white/25 dark:hover:text-white aria-[current]:border-gray-950 aria-[current]:font-semibold aria-[current]:text-gray-950 dark:aria-[current]:border-white dark:aria-[current]:text-white pl-5 sm:pl-4\" type=\"button\" data-headlessui-state=\"\" href=\"#examples\"><a class=\"inline-block border-l border-transparent text-base/8 text-gray-600 hover:border-gray-950/25 hover:text-gray-950 sm:text-sm/6 dark:text-gray-300 dark:hover:border-white/25 dark:hover:text-white aria-[current]:border-gray-950 aria-[current]:font-semibold aria-[current]:text-gray-950 dark:aria-[current]:border-white dark:aria-[current]:text-white pl-8 sm:pl-7.5\" type=\"button\" data-headlessui-state=\"\" href=\"#basic-example\">";
  let clean = CleanConfig {
    urls: true,
    fragments: true,
    empty_links: true,
    blank_lines: false,
    redundant_links: true,
    self_link_headings: true,
    empty_images: true,
    empty_link_text: true,
  };
  let plugins = PluginConfig {
    filter: Some(FilterConfig {
      include: None,
      exclude: Some(
        [
          "form", "fieldset", "object", "embed", "footer", "aside", "iframe", "input", "textarea",
          "select", "button", "nav",
        ]
        .into_iter()
        .map(String::from)
        .collect(),
      ),
      process_children: None,
    }),
    isolate_main: Some(IsolateMainConfig),
    frontmatter: Some(FrontmatterConfig::default()),
    tailwind: Some(TailwindConfig),
    extraction: None,
    tag_overrides: None,
  };
  let options = HTMLToMarkdownOptions {
    clean_urls: true,
    clean: Some(clean),
    plugins: Some(plugins),
    ..Default::default()
  };
  let markdown = mdream::html_to_markdown(html, options);
  // Neither fragment resolves to a heading, so leaving them unstripped is
  // correct here; giving each nested anchor its own bracket is a separate fix.
  assert_eq!(
    markdown,
    "###\n\n[text-decoration-thickness](#examples)](#basic-example)](/docs/text-decoration-thickness)"
  );
}
