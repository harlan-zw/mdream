use std::fs;
use std::io::Cursor;
use std::panic;
use std::time::Instant;

fn bench<F: Fn(&str) -> String>(name: &str, html: &str, f: F, iterations: u32) -> Option<f64> {
    // Check if it panics
    let html_owned = html.to_string();
    let test_result = panic::catch_unwind(panic::AssertUnwindSafe(|| f(&html_owned)));
    if test_result.is_err() {
        println!("  {:<24} {:>8}     (panicked!)", name, "SKIP");
        return None;
    }

    // Warmup
    for _ in 0..3 {
        let _ = f(html);
    }

    let start = Instant::now();
    for _ in 0..iterations {
        let _ = f(html);
    }
    let elapsed = start.elapsed();
    let mean_ms = elapsed.as_secs_f64() * 1000.0 / iterations as f64;

    println!("  {:<24} {:>8.2} ms  ({} iters)", name, mean_ms, iterations);
    Some(mean_ms)
}

fn main() {
    let fixtures_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../packages/mdream/test/fixtures");

    let files = [
        ("wikipedia-small.html", "Small (166 KB)", 200),
        ("github-markdown-complete.html", "Medium (420 KB)", 100),
        ("wikipedia-largest.html", "Large (1.8 MB)", 10),
    ];

    println!();
    println!("============================================");
    println!("  Rust HTML-to-Markdown Benchmark");
    println!("============================================");
    println!();

    for (filename, label, iterations) in &files {
        let path = format!("{}/{}", fixtures_dir, filename);
        let html = fs::read_to_string(&path).unwrap_or_else(|e| {
            eprintln!("Failed to read {}: {}", path, e);
            std::process::exit(1);
        });

        println!("--- {} ({} bytes) ---", label, html.len());

        let mdream_ms = bench("mdream", &html, |h| {
            mdream::html_to_markdown(h, mdream::types::HTMLToMarkdownOptions::default())
        }, *iterations).unwrap();

        let htmd_ms = bench("htmd", &html, |h| {
            htmd::convert(h).unwrap_or_default()
        }, *iterations);

        let html2md_ms = if html.len() < 500_000 {
            bench("html2md", &html, |h| {
                html2md::parse_html(h)
            }, *iterations)
        } else {
            // html2md is extremely slow on large HTML (>30s per iteration)
            println!("  {:<24} {:>8}     (skipped, too slow)", "html2md", "SKIP");
            None
        };

        let html2md_rs_ms = bench("html2md-rs", &html, |h| {
            html2md_rs::to_md::from_html_to_md(h.to_string())
        }, *iterations);

        let mdka_ms = bench("mdka", &html, |h| {
            mdka::from_html(h)
        }, *iterations);

        let h2m_ms = bench("html-to-markdown", &html, |h| {
            let cursor = Cursor::new(h.as_bytes());
            let mut handlers: Vec<html_to_markdown::TagHandler> = Vec::new();
            html_to_markdown::convert_html_to_markdown(cursor, &mut handlers).unwrap_or_default()
        }, *iterations);

        let others: Vec<(&str, Option<f64>)> = vec![
            ("htmd", htmd_ms),
            ("html2md", html2md_ms),
            ("html2md-rs", html2md_rs_ms),
            ("mdka", mdka_ms),
            ("html-to-markdown", h2m_ms),
        ];

        println!();
        println!("  mdream vs others:");
        for (name, ms) in &others {
            if let Some(ms) = ms {
                if *ms > mdream_ms {
                    println!("    {:.1}x faster than {}", ms / mdream_ms, name);
                } else {
                    println!("    {:.1}x slower than {}", mdream_ms / ms, name);
                }
            } else {
                println!("    {} panicked on this input", name);
            }
        }
        println!();
    }
}
