use std::io::Write;
use std::process::{Command, Stdio};

#[test]
fn cli_reports_bounded_conversion_errors_without_panicking() {
  let mut child = Command::new(env!("CARGO_BIN_EXE_mdream"))
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .expect("mdream binary should start");

  child
    .stdin
    .take()
    .expect("stdin should be piped")
    .write_all("<div>".repeat(4_097).as_bytes())
    .expect("test input should be written");

  let output = child.wait_with_output().expect("mdream should exit");
  let stderr = String::from_utf8(output.stderr).expect("stderr should be UTF-8");
  assert!(!output.status.success());
  assert!(stderr.contains("element nesting depth 4097 exceeds the maximum of 4096"));
  assert!(
    !stderr.contains("panicked"),
    "unexpected panic output: {stderr}"
  );
}
