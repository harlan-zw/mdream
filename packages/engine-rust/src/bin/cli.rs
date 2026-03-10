use std::io::{self, Read, Write};
use engine_rust::{
    html_to_markdown,
    HtmlToMarkdownOptions,
};

fn main() -> io::Result<()> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;

    match html_to_markdown(input, None::<HtmlToMarkdownOptions>) {
        Ok(markdown) => {
            io::stdout().write_all(markdown.as_bytes())?;
            Ok(())
        }
        Err(e) => {
            eprintln!("Error converting to markdown: {}", e);
            std::process::exit(1);
        }
    }
}
