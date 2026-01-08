#!/bin/bash
#
# Cross-Language CLI Benchmark
#
# Compares mdream against Go and Rust alternatives using hyperfine.
# This measures end-to-end CLI performance including process startup.
#
# Prerequisites:
#   - hyperfine: https://github.com/sharkdp/hyperfine
#   - Go html-to-markdown: go install github.com/JohannesKaufmann/html-to-markdown/v2/cmd/html2md@latest
#   - Rust html-to-markdown: cargo install html-to-markdown-cli
#
# Usage: ./bench/cli-compare.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES_DIR="$ROOT_DIR/packages/mdream/test/fixtures"
MDREAM_CLI="$ROOT_DIR/packages/mdream/bin/mdream.mjs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "  Cross-Language CLI Benchmark"
echo "============================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v hyperfine &> /dev/null; then
    echo -e "${RED}✗ hyperfine not found${NC}"
    echo "  Install: https://github.com/sharkdp/hyperfine#installation"
    exit 1
fi
echo -e "${GREEN}✓ hyperfine${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ node not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ node $(node --version)${NC}"

if command -v bun &> /dev/null; then
    echo -e "${GREEN}✓ bun $(bun --version)${NC}"
else
    echo -e "${YELLOW}○ bun not found (optional, faster startup)${NC}"
fi

# Check optional tools
HAS_GO_HTML2MD=false
HAS_HTMD=false

if command -v html2md &> /dev/null; then
    HAS_GO_HTML2MD=true
    echo -e "${GREEN}✓ html2md (Go)${NC}"
else
    echo -e "${YELLOW}○ html2md (Go) not found${NC}"
    echo "  Install: go install github.com/JohannesKaufmann/html-to-markdown/v2/cmd/html2md@latest"
fi

if command -v html-to-markdown &> /dev/null; then
    HAS_HTMD=true
    echo -e "${GREEN}✓ html-to-markdown (Rust)${NC}"
else
    echo -e "${YELLOW}○ html-to-markdown (Rust) not found${NC}"
    echo "  Install: cargo install html-to-markdown-cli"
fi

echo ""

# Build commands array
declare -a COMMANDS
declare -a NAMES

# mdream (Node.js) - always included
COMMANDS+=("cat {file} | node $MDREAM_CLI")
NAMES+=("mdream (Node.js)")

# mdream (Bun) - if available
if command -v bun &> /dev/null; then
    COMMANDS+=("cat {file} | bun $MDREAM_CLI")
    NAMES+=("mdream (Bun)")
fi

# Go html2md
if [ "$HAS_GO_HTML2MD" = true ]; then
    COMMANDS+=("cat {file} | html2md")
    NAMES+=("html2md (Go)")
fi

# Rust html-to-markdown
if [ "$HAS_HTMD" = true ]; then
    COMMANDS+=("cat {file} | html-to-markdown")
    NAMES+=("html-to-markdown (Rust)")
fi

if [ ${#COMMANDS[@]} -lt 2 ]; then
    echo -e "${RED}Need at least one alternative tool installed for comparison${NC}"
    echo ""
    echo "Install options:"
    echo "  Go:   go install github.com/JohannesKaufmann/html-to-markdown/v2/cmd/html2md@latest"
    echo "  Rust: cargo install html-to-markdown-cli"
    exit 1
fi

# Run benchmarks for each fixture
run_benchmark() {
    local file=$1
    local name=$2
    local size=$3

    echo "============================================"
    echo "  $name ($size)"
    echo "============================================"
    echo ""

    # Build hyperfine command
    local cmd="hyperfine --warmup 3 --runs 20"

    for i in "${!COMMANDS[@]}"; do
        local command="${COMMANDS[$i]//\{file\}/$file}"
        cmd="$cmd --command-name '${NAMES[$i]}' '$command'"
    done

    eval $cmd
    echo ""
}

# Small file
run_benchmark "$FIXTURES_DIR/wikipedia-small.html" "Small HTML" "166 KB"

# Medium file
run_benchmark "$FIXTURES_DIR/github-markdown-complete.html" "Medium HTML" "420 KB"

# Large file
run_benchmark "$FIXTURES_DIR/wikipedia-largest.html" "Large HTML" "1.8 MB"

echo "============================================"
echo "  Benchmark Complete"
echo "============================================"
echo ""
echo "Note: CLI benchmarks include process startup overhead."
echo "For pure conversion speed, see: pnpm bench"
