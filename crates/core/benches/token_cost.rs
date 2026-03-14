fn count_tokens_approx(text: &str) -> usize {
    let mut tokens = 0;
    let mut in_word = false;
    for b in text.bytes() {
        if b == b' ' || b == b'\n' || b == b'\t' || b == b'\r' {
            if in_word { tokens += 1; in_word = false; }
        } else if b == b'[' || b == b']' || b == b'(' || b == b')' || b == b'#'
            || b == b'*' || b == b'|' || b == b'-' || b == b'!' || b == b':'
        {
            if in_word { tokens += 1; in_word = false; }
            tokens += 1;
        } else {
            in_word = true;
        }
    }
    if in_word { tokens += 1; }
    tokens
}

fn make_clean() -> mdream::types::CleanConfig {
    mdream::types::CleanConfig {
        urls: true, fragments: true, empty_links: true, blank_lines: false,
        redundant_links: true, self_link_headings: true, empty_images: true, empty_link_text: true,
    }
}

fn make_minimal_plugins() -> mdream::types::PluginConfig {
    mdream::types::PluginConfig {
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
    }
}

fn analyze(label: &str, html: &str) {
    let html_kb = html.len() as f64 / 1024.0;
    let html_tokens = count_tokens_approx(html);

    let default_md = mdream::html_to_markdown(html, mdream::types::HTMLToMarkdownOptions::default());
    let default_tokens = count_tokens_approx(&default_md);

    let minimal_clean_md = mdream::html_to_markdown(html, mdream::types::HTMLToMarkdownOptions {
        clean: Some(make_clean()),
        plugins: Some(make_minimal_plugins()),
        ..Default::default()
    });
    let minimal_clean_tokens = count_tokens_approx(&minimal_clean_md);

    let html_reduction = ((html_tokens as f64 - minimal_clean_tokens as f64) / html_tokens as f64) * 100.0;
    let default_reduction = ((default_tokens as f64 - minimal_clean_tokens as f64) / default_tokens as f64) * 100.0;

    println!("| {:28} | {:>8.0} KB | {:>8} | {:>8} | {:>8} | {:>5.0}% | {:>5.0}% |",
        label,
        html_kb,
        html_tokens,
        default_tokens,
        minimal_clean_tokens,
        html_reduction,
        default_reduction,
    );
}

fn main() {
    println!("| {:28} | {:>10} | {:>8} | {:>8} | {:>8} | {:>6} | {:>6} |",
        "Fixture", "HTML Size", "HTML tok", "MD tok", "Clean tok", "vs HTML", "vs MD");
    println!("| {:28} | {:>10} | {:>8} | {:>8} | {:>8} | {:>6} | {:>6} |",
        "---", "---", "---", "---", "---", "---", "---");

    let fixtures: Vec<(&str, &str)> = vec![
        ("Nuxt (small)", "tests/fixtures/nuxt-example.html"),
        ("Vue.js Docs", "tests/fixtures/vuejs-docs.html"),
        ("Wikipedia", "tests/fixtures/wikipedia-small.html"),
        ("MDN Array Reference", "tests/fixtures/mdn-array.html"),
        ("React Docs", "tests/fixtures/react-learn.html"),
        ("GitHub Docs", "tests/fixtures/github-markdown-complete.html"),
    ];

    for (label, path) in &fixtures {
        if let Ok(html) = std::fs::read_to_string(path) {
            analyze(label, &html);
        }
    }

    if let Ok(html) = std::fs::read_to_string("../../packages/mdream/test/fixtures/wikipedia-largest.html") {
        analyze("Wikipedia (large)", &html);
    }
}
