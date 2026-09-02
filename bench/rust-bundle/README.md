# Rust bundle size

This harness measures Rust's equivalent of tree shaking.
The linker calls it dead code elimination.

Each binary reads HTML from stdin and writes one format to stdout.
The baseline copies stdin without linking mdream output code.

`runtime-format` hides its format from LLVM with `black_box`.
The other binaries call one static format entry.

The release profile uses size optimization, fat LTO, one codegen unit, symbol stripping, and aborting panics.
This is a best-case size build.

Run the harness from the repository root:

```bash
pnpm test:bundle-size
pnpm test:bundle-size:rust
pnpm test:bundle-size:rust-native
node bench/bundle/analyze.ts
```

Compare results only on the same target and Rust version.
