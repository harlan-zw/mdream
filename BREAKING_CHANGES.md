# Breaking Changes for v1.0

Tracking all breaking changes made during the v1 migration. This file will be used to generate the migration guide.

## Done

### `@mdream/core` renamed to `@mdream/core`

The JS engine package has been renamed from `@mdream/core` to `@mdream/core`. It now serves as the shared core: types, constants, plugins, and the JS engine.

**Migration:** Replace all `@mdream/core` imports with `@mdream/core`.

### `Plugin` type renamed to `TransformPlugin`

The `Plugin` interface is now `TransformPlugin` to distinguish imperative hook-based transforms from declarative `BuiltinPlugins` config.

**Migration:** Replace `Plugin` with `TransformPlugin` in type annotations.

### `PluginConfig` type renamed to `BuiltinPlugins`

The `PluginConfig` interface is now `BuiltinPlugins` for clarity.

**Migration:** Replace `PluginConfig` with `BuiltinPlugins` in type annotations.

### `createEngine()` removed from `mdream`

The `createEngine()` helper has been removed. Engines are internal — the facade auto-selects the best available engine.

**Migration:** Remove `createEngine()` calls. Use `createJavaScriptEngine()` from `@mdream/core` or `createRustEngine()` from `mdream` internals if needed directly.

### Engines are internal implementation details

`@mdream/core` and `@mdream/engine-rust` are no longer intended as direct dependencies. Import everything from `mdream` or its subpaths (`mdream/plugins`, `mdream/splitter`, `mdream/preset/minimal`).

**Migration:** Replace direct `@mdream/core` / `@mdream/core` imports with `mdream` imports.

### `HTMLToMarkdownOptions` type removed from `@mdream/core`

The engine contract is now a single `EngineOptions` type (`{ origin?, plugins? }`). JS-engine-only concerns like imperative hooks are handled at the facade layer (`MdreamOptions`).

**Migration:** Replace `HTMLToMarkdownOptions` with `EngineOptions` (for engine-level code) or `MdreamOptions` (for facade-level code).

### `createJavaScriptEngine()` accepts transforms parameter

`createJavaScriptEngine(transforms?: TransformPlugin[])` now accepts an optional array of imperative hook-based plugins. This replaces passing `customPlugins` through the options object.

**Migration:** Pass transform plugins at engine creation time: `createJavaScriptEngine([myPlugin])`.

### `withMinimalPreset()` is now generic

`withMinimalPreset<T extends EngineOptions>(options: T): T` preserves the input type, eliminating the need for `as any` casts when passing `MdreamOptions`.

### `MarkdownProcessor` no longer exported from `@mdream/core`

Internal implementation detail removed from public API.

**Migration:** Use `createJavaScriptEngine()` or `htmlToMarkdown()` instead of accessing the processor directly.

### `mdream/plugins` no longer re-exports constants

Was `export * from '@mdream/core'` which leaked everything (TAG_*, ELEMENT_NODE, parseHtml, etc). Now only exports plugin-related symbols: `createPlugin`, `extractionPlugin`, `filterPlugin`, `frontmatterPlugin`, `isolateMainPlugin`, `tailwindPlugin`, `ExtractedElement`.

**Migration:** Import `TAG_*`, `ELEMENT_NODE`, `TEXT_NODE`, `NodeEventEnter`, `NodeEventExit` from `@mdream/core` directly.

### `mdream/splitter` no longer re-exports everything

Was `export * from '@mdream/core'`. Now only exports: `htmlToMarkdownSplitChunks`, `htmlToMarkdownSplitChunksStream`, `MarkdownChunk`, `SplitterOptions`.

**Migration:** Same as above — import non-splitter symbols from `@mdream/core`.

### `MarkdownEngine.streamHtmlToMarkdown` parameter typed

`htmlStream` parameter changed from `any` to `ReadableStream<Uint8Array | string> | null`.

**Migration:** Pass a proper `ReadableStream` instead of untyped values.

### `createPlugin` signature simplified

Changed from `createPlugin<T extends Partial<Plugin>>(plugin: T): Plugin` to `createPlugin(plugin: Plugin): Plugin`. The generic was misleading since all `Plugin` fields are already optional.

**Migration:** No code changes needed — all valid usage continues to work.

### `plugins` option is now declarative config, not a plugin array

`HTMLToMarkdownOptions.plugins` changed from `Plugin[]` (array of hook-based plugin instances) to `BuiltinPlugins` (declarative object). This config works with both JS and Rust engines without bridging.

```ts
// Before
htmlToMarkdown(html, {
  plugins: [frontmatterPlugin(), isolateMainPlugin(), tailwindPlugin(), filterPlugin({ exclude: [TAG_NAV] })]
})

// After
htmlToMarkdown(html, {
  plugins: { frontmatter: true, isolateMain: true, tailwind: true, filter: { exclude: [TAG_NAV] } }
})
```

**Migration:** Replace `plugins: [builtinPlugin()]` arrays with the equivalent `plugins: { ... }` config object. See `BuiltinPlugins` type for the full shape.

### Custom hook-based plugins moved to `hooks`

Hook-based plugins created with `createPlugin()` or `extractionPlugin()` now go in a separate `hooks` array.

```ts
// Before
htmlToMarkdown(html, { plugins: [extractionPlugin({...}), myCustomPlugin] })

// After
htmlToMarkdown(html, { hooks: [extractionPlugin({...}), myCustomPlugin] })
```

**Migration:** Move any `createPlugin({...})` or `extractionPlugin({...})` instances from `plugins` to `hooks`. Built-in plugins (`frontmatter`, `isolateMain`, `tailwind`, `filter`) use the declarative `plugins` config instead.

### `Plugin.name` and `Plugin.options` properties removed

The `Plugin` interface no longer has `name` or `options` fields. These were used for cross-engine bridging which is now handled by the declarative `BuiltinPlugins`.

**Migration:** Remove `name` and `options` from custom plugin definitions. They have no effect.

### `withMinimalPreset()` returns declarative plugin config

`withMinimalPreset()` now returns `plugins: BuiltinPlugins` instead of `plugins: Plugin[]`. Custom plugins should be passed via `hooks`.

```ts
// Before
withMinimalPreset({ plugins: [myPlugin] })

// After
withMinimalPreset({ hooks: [myPlugin] })
```

**Migration:** Move custom plugins from `plugins` to `hooks` when using presets.

### `@mdream/engine-rust` TypeScript types renamed (Js suffix removed)

NAPI-generated types no longer have the `Js` suffix:
- `HtmlToMarkdownOptionsJs` → `HtmlToMarkdownOptions`
- `PluginOptionsJs` → `PluginOptions`
- `FilterOptionsJs` → `FilterOptions`
- `FrontmatterOptionsJs` → `FrontmatterOptions`

**Migration:** Update type imports from `@mdream/engine-rust` to use the new names.

### Hooks automatically use JS engine

When `hooks` are provided in `MdreamOptions`, the facade automatically creates a JS engine with those hooks — regardless of the `engine` option. The Rust engine does not support imperative hooks.

**Migration:** No action needed — hooks work transparently. Remove explicit `engine: createJavaScriptEngine()` when using hooks, as it's now automatic.

### `resolvePlugins` accepts hooks as second parameter

`resolvePlugins(options: EngineOptions, transforms?: TransformPlugin[])` now takes transforms as a separate parameter instead of reading `customPlugins` from options.

**Migration:** `resolvePlugins({ plugins: {...} }, [myPlugin])` instead of `resolvePlugins({ plugins: {...}, customPlugins: [myPlugin] })`.

### `BuiltinPlugins` type exported from `@mdream/core` and `mdream`

New type representing the declarative plugin configuration. Exported from both packages.

**Migration:** No action needed — this is additive.

### `mdream/llms-txt` subpath removed

The `mdream/llms-txt` subpath export has been removed. Use `@mdream/llms-txt` directly instead.

```ts
// After
import { generateLlmsTxtArtifacts } from '@mdream/llms-txt'

// Before
import { generateLlmsTxtArtifacts } from 'mdream/llms-txt'
```

**Migration:** Replace `mdream/llms-txt` imports with `@mdream/llms-txt`.

## Pending

Items identified but not yet implemented:

### Package naming consistency

Main package is `mdream` (unscoped) while all others are `@mdream/*` scoped. Consider whether to align for v1.

### Engine-js subpath exports

`@mdream/core` only exports `.` — could benefit from `./plugins`, `./splitter`, `./preset/minimal` subpaths to mirror mdream's export structure.

### Streaming API return type

Both engines return `AsyncIterable<string>`. Consider whether `ReadableStream<string>` would be better for web compat. Current choice is fine for Node.js `for await` patterns.
