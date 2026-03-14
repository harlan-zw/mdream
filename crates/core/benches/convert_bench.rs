use std::time::Instant;

fn bench(label: &str, html: &str, opts: mdream::types::HTMLToMarkdownOptions, iterations: u32) -> f64 {
    let size_kb = html.len() as f64 / 1024.0;
    for _ in 0..50 {
        let _ = mdream::html_to_markdown(html, opts.clone());
    }
    let mut best = f64::MAX;
    for _ in 0..3 {
        let start = Instant::now();
        for _ in 0..iterations {
            let _ = mdream::html_to_markdown(html, opts.clone());
        }
        let us = start.elapsed().as_micros() as f64 / iterations as f64;
        if us < best { best = us; }
    }
    let ms = best / 1000.0;
    let throughput = (size_kb / 1024.0) / (best / 1_000_000.0);
    println!("  {label:<40} {:.2}ms  ({:.0} MB/s)", ms, throughput);
    best
}

fn clean_all() -> mdream::types::CleanConfig {
    mdream::types::CleanConfig {
        urls: true, fragments: true, empty_links: true, blank_lines: false,
        redundant_links: true, self_link_headings: true, empty_images: true, empty_link_text: true,
    }
}

fn main() {
    let iters = 200;

    let fixtures: Vec<(&str, String)> = vec![
        ("nuxt (3 KB)", std::fs::read_to_string("tests/fixtures/nuxt-example.html").unwrap()),
        ("vuejs-docs (110 KB)", std::fs::read_to_string("tests/fixtures/vuejs-docs.html").unwrap()),
        ("wikipedia (162 KB)", std::fs::read_to_string("tests/fixtures/wikipedia-small.html").unwrap()),
        ("mdn-array (230 KB)", std::fs::read_to_string("tests/fixtures/mdn-array.html").unwrap()),
        ("react-learn (259 KB)", std::fs::read_to_string("tests/fixtures/react-learn.html").unwrap()),
        ("github-docs (420 KB)", std::fs::read_to_string("tests/fixtures/github-markdown-complete.html").unwrap()),
        ("wikipedia-10x (1.6 MB)", std::fs::read_to_string("tests/fixtures/wikipedia-small.html").unwrap().repeat(10)),
    ];

    let default_opts = mdream::types::HTMLToMarkdownOptions::default();
    let clean_opts = mdream::types::HTMLToMarkdownOptions { clean: Some(clean_all()), ..Default::default() };

    println!("Best of 3 runs, {} iterations each\n", iters);
    println!("  {:40} {:>10}  {:>10}  {:>8}", "fixture", "default", "clean:true", "overhead");
    println!("  {:40} {:>10}  {:>10}  {:>8}", "-------", "-------", "----------", "--------");

    for (label, html) in &fixtures {
        let d = bench(&format!("{} default", label), html, default_opts.clone(), iters);
        let c = bench(&format!("{} clean", label), html, clean_opts.clone(), iters);
        let overhead = ((c - d) / d) * 100.0;
        // Reprint as table row
        println!("  {:40} {:>7.2}ms  {:>7.2}ms  {:>+6.1}%\n",
            label, d / 1000.0, c / 1000.0, overhead);
    }
}
