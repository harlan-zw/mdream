# Single-Pass Merge Plan

Merge `parse.rs` (parser) and `markdown_processor.rs` (output) into a unified single-pass converter. Eliminates the `NodeEvent` callback boundary for ~20-25% perf improvement.

**Benchmark baseline:** 5.3ms for 1.8MB Wikipedia HTML (target: 3.57ms)

---

## Status: COMPLETE

All phases implemented. Results:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| wikipedia-small (162KB) | ~530µs | ~400µs | ~24% |
| wikipedia-10x (1.6MB) | 5.3ms | 3.86ms | ~27% |
| throughput | ~300 MB/s | ~415 MB/s | ~38% |
| streaming (1.6MB, 8KB chunks) | N/A | 6.82ms | — |

### What was done

1. **Created `convert.rs`** — unified `ConvertState` merging `ParseState` + `MarkdownState` + `HTMLToMarkdownOptions`
2. **Replaced fn pointers with match on tag_id** — `get_enter_output`/`get_exit_output` use match on `u8` tag_id (computed goto, fully inlinable, no indirect calls)
3. **Removed `HandlerContext` struct** from `types.rs`, `TagHandler` is now metadata-only
4. **Removed ALL enter/exit fn definitions** from `tags.rs` (enter_heading, exit_heading, etc.)
5. **Eliminated TextNode allocation** — pass text data by reference to `emit_text()`
6. **Eliminated NodeEvent callback** — parser directly calls `emit_enter_element`, `emit_exit_element`, `emit_text`, `emit_frontmatter`
7. **Deleted `markdown_processor.rs`** entirely
8. **Updated `lib.rs`** — uses `ConvertState` for both sync and streaming APIs
9. **Fixed `crates/node/src/lib.rs`** — `elem.name()` method call, kept `ParseState`+`parse_html_chunk` for NAPI `parseHtml` cold path
10. **Fixed streaming remaining-text bug** — incomplete opening tags now include full `<tagname` prefix for re-parsing
11. **Fixed custom tag override lookup** — `custom_name` preserved for non-builtin tags even with `alias_tag_id`

### Files changed
- `crates/core/src/convert.rs` — NEW (~1500 lines), unified single-pass converter
- `crates/core/src/lib.rs` — simplified, uses ConvertState
- `crates/core/src/types.rs` — removed HandlerContext, TagHandler is metadata-only, fixed name() priority
- `crates/core/src/tags.rs` — metadata-only table, no fn pointers
- `crates/core/src/parse.rs` — helpers made `pub(crate)`, original ParseState kept for NAPI parseHtml
- `crates/core/src/markdown_processor.rs` — DELETED
- `crates/node/src/lib.rs` — fixed elem.name() call
- `crates/core/benches/convert_bench.rs` — NEW, benchmark harness

### All 65 conversion tests pass + 20 template tests + splitter tests
