# Mdream v1 to v2 migration prompt

Migrate this project from Mdream v1 to v2. Make the changes and verify them.
Follow this project's repository instructions. Preserve unrelated work and avoid unrelated dependency upgrades.
Keep the application's intended behavior. Ask only when a migration requires a product decision.

## Inspect the project

Identify installed Mdream packages, resolved versions, package manager, workspace catalogs, lockfiles, and supported runtimes.
Find imports, wrappers, options, custom plugins, CLI commands, build integrations, CI workflows, and tests that use Mdream.
Include browser bundles, Web Workers, CDN scripts, Docker images, and Rust crates when present.
Run the relevant existing checks before editing. Record existing failures separately.
Save representative conversion output before upgrading, using the application's options.

Read the migration guides for the packages this project uses:

- Rust engine, Node, browser, and edge: https://github.com/harlan-zw/mdream/blob/main/packages/mdream/README.md#migrating-from-v1
- JavaScript engine: https://github.com/harlan-zw/mdream/blob/main/packages/js/README.md#migrating-from-v1
- Crawler: https://github.com/harlan-zw/mdream/blob/main/packages/crawl/README.md#migrating-from-v1
- Vite: https://github.com/harlan-zw/mdream/blob/main/packages/vite/README.md#migrating-from-v1
- Nuxt: https://github.com/harlan-zw/mdream/blob/main/packages/nuxt/README.md#migrating-from-v1
- GitHub Actions: https://github.com/harlan-zw/mdream/blob/main/packages/action/README.md#migrating-from-v1
- Rust crate: https://github.com/harlan-zw/mdream/blob/main/crates/core/README.md#migrating-from-v1

Use the target release's exports, types, and documentation to resolve differences from the current guides.
If documentation cannot be read, inspect the installed package. Report gaps instead of guessing APIs.

## Upgrade dependencies

Upgrade the project's Mdream packages together using its existing package manager and dependency conventions.
Use the default stable channel in install examples.
Verify the resolved versions are stable v2 before migrating code.
If the stable channel does not resolve to v2, report the version mismatch before proceeding.
Preserve workspace and catalog references. Regenerate lockfiles through the package manager.
Leave unrelated package versions and the application's own version unchanged.

## Migrate the packages this project uses

### `mdream`

This package uses the Rust engine. Keep its declarative options separate from the JavaScript engine's plugin API.
Retain `format`, boolean or object `clean`, and top-level `frontmatter`, `isolateMain`, `tailwind`, `filter`, and `extraction` options.
Replace `preset: 'minimal'` with `minimal: true`, and `cleanUrls: true` with `clean: { urls: true }`.
Move declarative options out of a `plugins` object. Remove `clean.blankLines`.
For custom hook plugins, use `@mdream/js` and apply its migration rules.

Node and edge conversion remain synchronous and return strings.
Browser code imports `mdream/browser`, awaits conversion, and uses the returned string without `.markdown`.
CDN calls also return promises of strings.
Replace `mdream/worker` with a module worker importing `mdream/browser`.
Keep callbacks inside the worker because functions cannot cross `postMessage`.
Retain native binding externalization in server bundles.

With `minimal: true`, custom filter exclusions now add to the preset's exclusions.
Use `filter: false` to disable preset filtering, or compose options without `minimal` for a custom filter.
Replace private native binding access with public exports documented in the migration guide.

### `@mdream/js`

Import each output format separately: Markdown from `@mdream/js`, text from `/text`, and safe HTML from `/html`.
Use each entry's corresponding streaming function. Remove the converter's `format` option; retain the CLI's `--format` flag.
Replace declarative `plugins` objects and `hooks` with a single array of plugin instances from `@mdream/js/plugins`.
Preserve the old order: frontmatter, isolateMain, tailwind, filter, extraction, then custom hooks.
Keep `tagOverrides` at the top level.

Import `clean()` from `@mdream/js/clean` and pass its result as the `clean` option.
Import `withMinimalPreset` from `@mdream/js/preset/minimal`.
Do not pass Rust-only top-level options such as `minimal` or `frontmatter` to this engine.
Use the guide's removed-exports table to update other imports and types.

Extraction callbacks receive parsed elements and `PluginState` when each matching element closes.
Use `element.name` instead of `tagName`; keep selector identity in the callback or its closure.
Use `node.context` or plugin setup state instead of internal converter state.
Check callback timing, frontmatter escaping, and plugin reuse against the guide.

Use heading levels `1` through `6` for `headersToSplitOn`, and tag names for filter selectors.
Check splitter overlap, code fences, line ranges, and stripped headings.
The splitter stream converts the whole document before yielding chunks. It does not stream conversion output incrementally.
Plan to rebuild stored chunks and embeddings from original HTML, replacing chunk text and metadata together.
Prepare the rebuild procedure without overwriting production indexes.

### Integrations, CLI, and Rust

For `@mdream/crawl`, migrate option names and callbacks using its guide.
Set `depth`, `artifacts`, and output paths explicitly to preserve the application's intended crawl scope.
The library now defaults to depth 3 and all three artifacts, including `llms-full.txt`.
Do not map `followLinks: false` to depth 0 blindly: depth 0 also disables sitemap discovery.
Use `mdream-crawl` after global installation, or the `@mdream/crawl` package name with a package runner.

For `@mdream/vite`, import converter functions from `mdream` and migrate `mdreamOptions` using the Rust engine's rules.
The Vite plugin sets `enforce: 'post'` itself.
For `@mdream/nuxt`, replace `mdreamOptions.preset` with `minimal` and remove the unused `cache` option.
Its default minimal preset now applies. Review removed content and frontmatter; use `minimal: false` when appropriate.

For GitHub Actions, replace `uses: harlan-zw/mdream@...` with the documented `@mdream/action` npm step.
Use Node.js 24, keep the step ID, convert inputs to `INPUT_` environment variables, and remove `chunk-size`.
For Docker and CDN references, use the stable channels documented by Mdream.
Review CLI flags: unknown flags, missing values, and unsupported presets now fail.

For the Rust crate, follow its guide for `HtmlToMarkdownOptions`, private parser APIs, cleanup, and splitter heading levels.
Respect enabled output-format features and non-exhaustive public types.

## Verify the migration

Add or adapt focused tests for the project's actual Mdream usage.
Compare representative HTML before and after migration, using the application's options.
Review title removal, whitespace, filtering, cleanup, metadata, and callback behavior.
Compare joined streaming output with one-shot output. Do not depend on individual chunk boundaries.
Explain expected output differences before updating snapshots. Do not weaken assertions merely to pass tests.

Run relevant tests, typechecks, lint, and builds. Exercise each runtime and integration the project actually uses.
For a crawler smoke test, use local fixtures or a bounded crawl with explicit limits and a separate output directory.
For generated `.md` files and `llms.txt` artifacts, inspect their contents as well as their existence.
Keep deployment and production data replacement separate from local migration verification.

Finish with the changed packages and resolved versions, important behavior changes, checks run, and any unresolved steps.
Name any runtime, integration, or data rebuild that could not be verified.
