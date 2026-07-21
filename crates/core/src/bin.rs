use mdream::MarkdownStreamProcessor;
use mdream::types::{HTMLToMarkdownOptions, OutputFormat};
use std::io::{self, Read, Write};

fn main() -> io::Result<()> {
  let args: Vec<String> = std::env::args().collect();
  let mut origin: Option<String> = None;
  let mut verbose = false;
  let mut clean_urls = false;
  let mut format = OutputFormat::Markdown;

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
      "--format" => {
        i += 1;
        if i < args.len() {
          format = match args[i].as_str() {
            "markdown" => OutputFormat::Markdown,
            "text" => OutputFormat::Text,
            other => {
              eprintln!("Unknown format: {other}");
              std::process::exit(1);
            }
          };
        } else {
          eprintln!("--format requires a value: markdown or text");
          std::process::exit(1);
        }
      }
      "--text" => format = OutputFormat::Text,
      "--help" | "-h" => {
        eprintln!("Usage: mdream [OPTIONS]");
        eprintln!("  Reads HTML from stdin, outputs Markdown or plain text to stdout");
        eprintln!();
        eprintln!("Options:");
        eprintln!("  -o, --origin <URL>  Base URL for resolving relative links");
        eprintln!("  -v, --verbose       Print conversion stats to stderr");
        eprintln!("  --clean-urls        Strip tracking query params (utm_*, fbclid, etc.)");
        eprintln!("  --format <format>   Output format: markdown, text");
        eprintln!("  --text              Alias for --format text");
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

  let mut processor = MarkdownStreamProcessor::new_with_format(options, format);
  let stdin = io::stdin();
  let stdout = io::stdout();
  let mut out = stdout.lock();
  let mut buf = [0u8; 8192];
  // A codepoint can straddle a read boundary; carry the incomplete tail over.
  let mut carry: Vec<u8> = Vec::new();
  let mut total_in: usize = 0;
  let mut total_out: usize = 0;

  loop {
    let n = stdin.lock().read(&mut buf)?;
    if n == 0 {
      break;
    }
    total_in += n;
    carry.extend_from_slice(&buf[..n]);

    let valid_up_to = match std::str::from_utf8(&carry) {
      Ok(s) => s.len(),
      Err(e) if e.error_len().is_none() => e.valid_up_to(),
      Err(e) => return Err(io::Error::new(io::ErrorKind::InvalidData, e)),
    };
    if valid_up_to > 0 {
      let chunk = std::str::from_utf8(&carry[..valid_up_to]).unwrap();
      let md = processor.process_chunk(chunk);
      if !md.is_empty() {
        total_out += md.len();
        out.write_all(md.as_bytes())?;
        out.flush()?;
      }
      carry.drain(..valid_up_to);
    }
  }

  if !carry.is_empty() {
    return Err(io::Error::new(
      io::ErrorKind::InvalidData,
      "stream ended with an incomplete UTF-8 codepoint",
    ));
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
