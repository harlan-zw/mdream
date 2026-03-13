use std::fs;
use std::panic;
use std::time::Instant;

fn bench<F: Fn(&str) -> String>(name: &str, html: &str, f: F, iterations: u32) -> Option<f64> {
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
    println!("  mdream vs fast_html2md Benchmark");
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

        let fast_ms = bench("fast_html2md", &html, |h| {
            html2md::rewrite_html(h, false)
        }, *iterations);

        println!();
        println!("  mdream vs fast_html2md:");
        if let Some(ms) = fast_ms {
            if ms > mdream_ms {
                println!("    {:.1}x faster than fast_html2md", ms / mdream_ms);
            } else {
                println!("    {:.1}x slower than fast_html2md", mdream_ms / ms);
            }
        } else {
            println!("    fast_html2md panicked on this input");
        }
        println!();
    }
}
