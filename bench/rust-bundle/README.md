# Rust bundle size

This harness measures how much each `mdream` output format feature costs a native Rust consumer.

Each consumer is its own package, so cargo resolves `mdream` features per binary:

- `baseline` copies stdin to stdout without `mdream`.
- `markdown`, `text`, and `safe-html` each enable one output feature with `default-features = false`.
- `runtime-format` enables every format and hides its choice from LLVM with `black_box`. The WASM and NAPI builds work this way.

The release profile uses size optimization, fat LTO, one codegen unit, symbol stripping, and aborting panics.

Run the harness from the repository root:

```bash
pnpm test:bundle-size
pnpm test:bundle-size:rust
pnpm test:bundle-size:rust-native
node bench/bundle/analyze.ts
```

Compare results only on the same target and Rust version.
