---
name: shiki-skilld
description: "ALWAYS use when writing code importing \"shiki\". Consult for debugging, best practices, or modifying shiki."
metadata:
  version: 4.0.2
  generated_by: Claude Code · Haiku 4.5
  generated_at: 2026-03-10
---

# shikijs/shiki `shiki`

**Version:** 4.0.2 (Mar 2026)
**Deps:** @shikijs/vscode-textmate@^10.0.2, @types/hast@^3.0.4, @shikijs/core@4.0.2, @shikijs/themes@4.0.2, @shikijs/engine-oniguruma@4.0.2, @shikijs/langs@4.0.2, @shikijs/engine-javascript@4.0.2, @shikijs/types@4.0.2
**Tags:** next: 0.9.4 (May 2021), latest: 4.0.2 (Mar 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p shiki
skilld search "issues:error handling" -p shiki
skilld search "releases:deprecated" -p shiki
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

<!-- skilld:api-changes -->
## API Changes

This section documents version-specific API changes — prioritize recent major/minor releases.

- BREAKING: Node.js ≥ 20 required — Shiki v4 drops Node.js 18 support which reached EOL in April 2025 [source](./.skilld/docs/blog/v4.md#nodejs-18-dropped)

- BREAKING: `CreatedBundledHighlighterOptions` type removed — renamed to `CreateBundledHighlighterOptions` (typo fix) [source](./.skilld/docs/blog/v4.md#createdbundledhighlighteroptions-removed)

- BREAKING: `createdBundledHighlighter` function removed — renamed to `createBundledHighlighter` (typo fix) [source](./.skilld/docs/blog/v4.md#createdbundledhighlighter-removed)

- BREAKING: `theme` option removed in `TwoslashFloatingVue` — use `themes` object instead [source](./.skilld/docs/blog/v4.md#theme-option-removed-in-twoslashfloatingvue)

- NEW: `@shikijs/markdown-exit` package — modern markdown parser with native async support, replaces `markdown-it` approach [source](./.skilld/releases/v4.0.0.md)

- NEW: `@shikijs/primitive` package — leaner primitive package for core functionality [source](./.skilld/releases/v4.0.0.md)

**Also changed:** CSS class `twoslash-query-presisted` renamed to `twoslash-query-persisted` · `rootStyle: false` option added · `transformerRemoveComments` transformer added · `classActiveCode` option for notation transformers · `zeroIndexed` option for `transformerMetaHighlight` · `leading` position support in `transformerRenderWhitespace`
<!-- /skilld:api-changes -->

<!-- skilld:best-practices -->
## Best Practices

- Cache the highlighter instance using singleton pattern to avoid recreating it for each call, as initialization is expensive. Reuse across requests and call `dispose()` when no longer needed to free memory [source](./.skilld/docs/guide/best-performance.md#cache-the-highlighter-instance)

- Avoid importing full bundles like `shiki` or `shiki/bundle/full` in production applications. Instead use fine-grained modules such as `shiki/core`, `@shikijs/langs/typescript`, and `@shikijs/themes/nord` to reduce bundle size and memory usage [source](./.skilld/docs/guide/best-performance.md#fine-grained-bundle)

- Use shorthand functions like `codeToHtml()` for on-demand loading when highlighting can be asynchronous, as they maintain an internal highlighter and load only necessary themes and languages without upfront overhead [source](./.skilld/docs/guide/best-performance.md#use-shorthands)

- Use the JavaScript regex engine instead of Oniguruma for web applications to avoid large WebAssembly files, faster startup, and better native performance — ensure language compatibility via the reference table [source](./.skilld/docs/guide/regex-engines.md#javascript-regexp-engine)

- Apply custom transformers with `enforce: 'pre'` or `enforce: 'post'` modifiers to control execution order relative to default transformers, ensuring dependencies are resolved correctly [source](./.skilld/docs/guide/transformers.md#enforcing-transformer-ordering)

- Use dual themes by passing `themes` object with `light` and `dark` keys, which generates CSS variables on each token for automatic theme switching via media queries or class selectors [source](./.skilld/docs/guide/dual-themes.md#lightdark-dual-themes)

- Load languages and themes dynamically after highlighter creation using `loadLanguage()` and `loadTheme()` methods to support runtime addition without recreating the highlighter instance [source](./.skilld/docs/guide/load-lang.md) [source](./.skilld/docs/guide/load-theme.md)

- Use `grammarState` and `getLastGrammarState()` when highlighting code snippets to provide the correct parsing context, making inline type annotations and partial code blocks highlight correctly [source](./.skilld/docs/guide/grammar-state.md#grammar-state)

- Pass highlighted `hast` nodes to `getLastGrammarState()` instead of code strings to retrieve cached grammar state, avoiding redundant highlighting execution in pausable or streaming scenarios [source](./.skilld/docs/guide/grammar-state.md#get-grammar-state-from-hast)

- Use `createHighlighterCoreSync` with explicit `engine` and resolved themes/languages for completely synchronous highlighting when necessary, requiring the JavaScript engine or pre-loaded Oniguruma [source](./.skilld/docs/guide/sync-usage.md#synchronous-usage)
<!-- /skilld:best-practices -->
