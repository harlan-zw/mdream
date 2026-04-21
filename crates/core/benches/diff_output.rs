fn make_opts(clean: bool) -> mdream::types::HTMLToMarkdownOptions {
    let mut opts = mdream::types::HTMLToMarkdownOptions {
        plugins: Some(mdream::types::PluginConfig {
            isolate_main: Some(mdream::types::IsolateMainConfig {}),
            filter: Some(mdream::types::FilterConfig {
                exclude: Some(vec!["form".into(), "fieldset".into(), "object".into(), "embed".into(),
                    "footer".into(), "aside".into(), "iframe".into(), "input".into(),
                    "textarea".into(), "select".into(), "button".into(), "nav".into()]),
                include: None, process_children: None,
            }),
            tailwind: Some(mdream::types::TailwindConfig {}),
            frontmatter: Some(mdream::types::FrontmatterConfig { additional_fields: None, meta_fields: None }),
            extraction: None, tag_overrides: None,
        }),
        ..Default::default()
    };
    if clean {
        opts.clean = Some(mdream::types::CleanConfig {
            urls: true, fragments: true, empty_links: true, blank_lines: false,
            redundant_links: true, self_link_headings: true, empty_images: true, empty_link_text: true,
        });
    }
    opts
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let fixture = args.get(1).map_or("tests/fixtures/vuejs-docs.html", std::string::String::as_str);

    let html = std::fs::read_to_string(fixture).expect("fixture not found");

    let minimal = mdream::html_to_markdown(&html, make_opts(false));
    let both = mdream::html_to_markdown(&html, make_opts(true));

    // Write to temp files for diffing
    std::fs::write("/tmp/mdream-minimal.md", &minimal).unwrap();
    std::fs::write("/tmp/mdream-clean.md", &both).unwrap();

    eprintln!("minimal: {} chars", minimal.len());
    eprintln!("minimal+clean: {} chars", both.len());
    eprintln!("diff: {} chars saved", minimal.len() as i64 - both.len() as i64);
    eprintln!("\nFiles written to /tmp/mdream-minimal.md and /tmp/mdream-clean.md");
    eprintln!("Run: diff /tmp/mdream-minimal.md /tmp/mdream-clean.md");
}
