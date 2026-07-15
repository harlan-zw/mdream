//! Browser recovery: an unclosed <head> (no </head>/<body>) must not swallow body
//! content. Body-level start tags auto-close head so block spacing is preserved.
//! Regression for marketingexamples.com pages collapsing to a single line.
use mdream::{html_to_markdown, types::HTMLToMarkdownOptions};

fn convert(html: &str) -> String {
  html_to_markdown(html, HTMLToMarkdownOptions::default())
}

#[test]
fn unclosed_head_produces_same_output_as_well_formed() {
  // Identical body content; one page forgets </head> and <body>.
  let broken = "<html><head><title>t</title><meta charset=\"utf-8\"><div><h1>Title</h1><p>para one</p><h2>Heading</h2><p>para two</p></div></html>";
  let well_formed = "<html><head><title>t</title><meta charset=\"utf-8\"></head><body><div><h1>Title</h1><p>para one</p><h2>Heading</h2><p>para two</p></div></body></html>";
  assert_eq!(convert(broken), convert(well_formed));
  assert!(convert(broken).contains("# Title\n\npara one\n\n## Heading\n\npara two"));
}

#[test]
fn head_metadata_stays_in_head_until_flow_content() {
  // title/link/style/script are head content; the first flow tag closes head.
  let html = "<head><title>t</title><link rel=\"x\"><style>a{}</style><p>body text</p>";
  assert_eq!(convert(html), "t\n\nbody text");
}

#[test]
fn duplicated_head_does_not_keep_body_in_head_context() {
  // A second <head> closes the first (head is not head-content), so the trailing
  // <p> is body flow rather than collapsed head content.
  let html = "<head><head><title>t</title><p>body text</p>";
  assert_eq!(convert(html), "t\n\nbody text");
}
