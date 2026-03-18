use std::io::{self, Read, Write};
use mdream::MarkdownStreamProcessor;
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
                eprintln!("Unknown option: {other}");
                std::process::exit(1);
            }
        }
        i += 1;
    }

    let options = HTMLToMarkdownOptions {
        origin,
        clean_urls,
        ..Default::default()
    };

    let mut processor = MarkdownStreamProcessor::new(options);
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();
    let mut buf = [0u8; 8192];
    let mut total_in: usize = 0;
    let mut total_out: usize = 0;

    loop {
        let n = stdin.lock().read(&mut buf)?;
        if n == 0 {
            break;
        }
        total_in += n;
        let chunk = std::str::from_utf8(&buf[..n]).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        let md = processor.process_chunk(chunk);
        if !md.is_empty() {
            total_out += md.len();
            out.write_all(md.as_bytes())?;
            out.flush()?;
        }
    }

    let remaining = processor.finish();
    if !remaining.is_empty() {
        total_out += remaining.len();
        out.write_all(remaining.as_bytes())?;
    }

    if verbose {
        eprintln!("Input: {total_in} bytes");
        eprintln!("Output: {total_out} bytes");
    }

    Ok(())
}
