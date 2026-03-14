use std::io::{self, Read, Write};
use mdream::html_to_markdown;
use mdream::types::HTMLToMarkdownOptions;

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let mut origin: Option<String> = None;
    let mut verbose = false;
    let mut clean_urls = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--origin" | "-o" => {
                i += 1;
                if i < args.len() {
                    origin = Some(args[i].clone());
                }
            }
            "--verbose" | "-v" => verbose = true,
            "--clean-urls" => clean_urls = true,
            "--help" | "-h" => {
                eprintln!("Usage: mdream [OPTIONS]");
                eprintln!("  Reads HTML from stdin, outputs Markdown to stdout");
                eprintln!();
                eprintln!("Options:");
                eprintln!("  -o, --origin <URL>  Base URL for resolving relative links");
                eprintln!("  -v, --verbose       Print conversion stats to stderr");
                eprintln!("  --clean-urls        Strip tracking query params (utm_*, fbclid, etc.)");
                eprintln!("  -h, --help          Show this help");
                return Ok(());
            }
            other => {
                eprintln!("Unknown option: {}", other);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;

    if verbose {
        eprintln!("Input: {} bytes", input.len());
    }

    let options = HTMLToMarkdownOptions {
        origin,
        clean_urls,
        ..Default::default()
    };

    let markdown = html_to_markdown(&input, options);

    if verbose {
        eprintln!("Output: {} bytes", markdown.len());
    }

    io::stdout().write_all(markdown.as_bytes())?;
    Ok(())
}
