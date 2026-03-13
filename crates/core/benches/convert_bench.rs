use std::time::Instant;

fn main() {
    let html = std::fs::read_to_string("tests/fixtures/wikipedia-small.html")
        .expect("fixture not found — run from crates/core/");
    let size_kb = html.len() as f64 / 1024.0;

    // Warm up
    for _ in 0..5 {
        let _ = mdream::html_to_markdown(&html, mdream::types::HTMLToMarkdownOptions::default());
    }

    // Benchmark single-file
    let iterations = 100;
    let start = Instant::now();
    for _ in 0..iterations {
        let _ = mdream::html_to_markdown(&html, mdream::types::HTMLToMarkdownOptions::default());
    }
    let elapsed = start.elapsed();
    let per_iter = elapsed / iterations;
    println!("wikipedia-small ({:.1} KB)", size_kb);
    println!("  {iterations} iterations: {:.2?} total, {:.2?}/iter", elapsed, per_iter);
    println!("  throughput: {:.1} MB/s", (size_kb / 1024.0) / per_iter.as_secs_f64());

    // Benchmark with 10x repeated content (~1.6MB)
    let big_html = html.repeat(10);
    let big_kb = big_html.len() as f64 / 1024.0;
    // Warm up
    for _ in 0..3 {
        let _ = mdream::html_to_markdown(&big_html, mdream::types::HTMLToMarkdownOptions::default());
    }
    let iterations = 20;
    let start = Instant::now();
    for _ in 0..iterations {
        let _ = mdream::html_to_markdown(&big_html, mdream::types::HTMLToMarkdownOptions::default());
    }
    let elapsed = start.elapsed();
    let per_iter = elapsed / iterations;
    println!("\nwikipedia-10x ({:.1} KB)", big_kb);
    println!("  {iterations} iterations: {:.2?} total, {:.2?}/iter", elapsed, per_iter);
    println!("  throughput: {:.1} MB/s", (big_kb / 1024.0) / per_iter.as_secs_f64());

    // Streaming benchmark
    let chunk_size = 8192;
    let chunks: Vec<&str> = big_html.as_bytes().chunks(chunk_size)
        .map(|c| std::str::from_utf8(c).unwrap_or(""))
        .collect();
    // Warm up
    for _ in 0..3 {
        let mut stream = mdream::MarkdownStreamProcessor::new(mdream::types::HTMLToMarkdownOptions::default());
        for chunk in &chunks { stream.process_chunk(chunk); }
        stream.finish();
    }
    let iterations = 20;
    let start = Instant::now();
    for _ in 0..iterations {
        let mut stream = mdream::MarkdownStreamProcessor::new(mdream::types::HTMLToMarkdownOptions::default());
        for chunk in &chunks { stream.process_chunk(chunk); }
        stream.finish();
    }
    let elapsed = start.elapsed();
    let per_iter = elapsed / iterations;
    println!("\nstreaming wikipedia-10x ({:.1} KB, {}B chunks)", big_kb, chunk_size);
    println!("  {iterations} iterations: {:.2?} total, {:.2?}/iter", elapsed, per_iter);
    println!("  throughput: {:.1} MB/s", (big_kb / 1024.0) / per_iter.as_secs_f64());
}
