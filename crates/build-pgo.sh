#!/usr/bin/env bash
# Profile-Guided Optimization build for mdream
# Achieves ~20-29% throughput improvement over standard release builds
#
# Requires: rustup component add llvm-tools
set -euo pipefail

LLVM_PROFDATA="$(find "$(rustc --print sysroot)" -name 'llvm-profdata*' -type f | head -1)"
if [ -z "$LLVM_PROFDATA" ]; then
  echo "Error: llvm-profdata not found. Run: rustup component add llvm-tools"
  exit 1
fi

PGO_DIR="$(mktemp -d)"
trap 'rm -rf "$PGO_DIR"' EXIT

echo "==> Phase 1: Instrumented build"
RUSTFLAGS="-Cprofile-generate=$PGO_DIR" cargo build --release --manifest-path core/Cargo.toml

echo "==> Phase 2: Generating profile data"
RUSTFLAGS="-Cprofile-generate=$PGO_DIR" cargo bench --bench convert_bench --manifest-path core/Cargo.toml >/dev/null 2>&1

echo "==> Phase 3: Merging profiles"
"$LLVM_PROFDATA" merge -o "$PGO_DIR/merged.profdata" "$PGO_DIR"

echo "==> Phase 4: PGO-optimized build"
RUSTFLAGS="-Cprofile-use=$PGO_DIR/merged.profdata" cargo build --release --manifest-path core/Cargo.toml

echo "==> Done. PGO-optimized binary at target/release/"
