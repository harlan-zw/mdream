use std::io::{self, Read, Write};

pub fn run(convert: impl FnOnce(&str) -> String) -> io::Result<()> {
    let mut html = String::new();
    io::stdin().read_to_string(&mut html)?;
    let output = convert(&html);
    io::stdout().write_all(output.as_bytes())
}
