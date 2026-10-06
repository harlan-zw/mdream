# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Follow this system prompt for every query, no exceptions. Don’t rush! No hurry. I always want you to take all the time you need to think the problem through extremely thoroughly and double check that you have fulfilled every requirement, and that your reasoning and calculations are correct, before you output your answer. Always follow this system prompt. Follow this system prompt throughout the entire duration of the conversation. No exceptions. Don’t rush! Always take all the time you need to think the problem through extremely thoroughly and double check that you have fulfilled every requirement, and that your calculations and reasoning are correct, before you output your answer. No hurry.

## Performance

Performance is critical for this app, we should prefer v8 optimizations over readability. Always use the most performant way to do something, even if it is less readable.

Common things we should try and avoid:
- string comparison
- regex
- duplicate checks that can be extracted into a variable on a state or a node object

## Testing

Always write unit tests for code you generate. Delete old unit tests if the logic is no longer relevant. Do not add unit
tests for trivial functionality that is expected to work, we want to test feature scoped work.

You can run a test using `vitest`.

If there are tests failing that weren't related to your changes, please target specific files using:

- Test again a single file: `vitest <path>`
- Test against a folder: `vitest <dir>`

## Git

Never add files to git or make a commit. This will be done by a human.

## Typechecking

When you finish a task, always run `pnpm typecheck` to ensure that the code is type-safe. If you see any errors, fix them before proceeding.

## Build/Lint/Test Commands
- Build all packages: `pnpm build` (root). This includes the NAPI and WASI builds in `crates/node`.
- Build the Rust bindings that `packages/mdream` needs, then the JS packages:
  - NAPI: `pnpm --dir crates/node run build:platform`
  - Edge WASM: `node scripts/build-wasm-edge.mjs --target web --out-dir packages/mdream/wasm --out-name mdream_edge`, and again with `--target bundler --out-dir packages/mdream/wasm-bundler`
  - JS packages: `pnpm -r --filter './packages/**' run build`
  - `.github/workflows/test.yml` (Node Tests job) is the reference sequence.
- Test all: `pnpm test` (root - installs playwright first)
- Test single file: `pnpm test path/to/test.ts`
- Test with pattern: `pnpm test -t "test pattern"`
- Test folder: `pnpm test packages/js/test/unit/`
- Test browser/Playwright: `pnpm exec vitest run --project browser` (root)
- Rust: `cargo test --workspace --exclude mdream-edge` and `cargo clippy --workspace --exclude mdream-edge -- -D warnings` (in crates/)
- Development build (stub): `pnpm dev:prepare` (in packages/mdream/)
- Live test with real sites: `pnpm test:github:live`, `pnpm test:wiki:file` (in packages/mdream/)
- Benchmarking: `pnpm bench` (root, see `bench/README.md`)
- Typecheck all: `pnpm typecheck` (root - runs across all packages)

## Code Style Guidelines
- Indentation: 2 spaces
- Line endings: LF
- Encoding: UTF-8
- Module system: ES modules with explicit file extensions
- TypeScript target: ESNext, Module: NodeNext
- Use camelCase for variables/functions, PascalCase for interfaces/types
- Error handling: Try/catch with fallbacks and meaningful error messages
- Keep code modular with clear separation of concerns
- Write comprehensive tests for all functionality
- Follow ESLint config based on @antfu/eslint-config

## Project Architecture

This is a pnpm monorepo with two engines and their integrations:
- `crates/core`: The Rust converter. It is also the `mdream` crate on crates.io, with a CLI in `src/bin.rs`.
- `crates/node`: NAPI binding for Node.js. `crates/edge`: WASM binding for edge runtimes and browsers.
- `packages/mdream`: The `mdream` npm package. It wraps the Rust engine (NAPI in Node, WASM elsewhere) and takes declarative options such as `{ minimal: true, frontmatter: true }`. It has no runtime dependencies.
- `packages/js`: Pure JS engine (`@mdream/js`) with hook plugins, the splitter, and llms.txt generation (`@mdream/js/llms-txt`)
- `packages/crawl`: Site-wide crawler for llms.txt generation
- `packages/vite`: Vite plugin integration
- `packages/nuxt`: Nuxt module integration
- `packages/action`: llms.txt generation for CI, run from its npm build

The two engines must produce the same output. Cross-engine parity tests live in `packages/mdream/test/unit/`.

### JS Engine Architecture (packages/js/src/)
- `index.ts`: Markdown entry with `htmlToMarkdown` and `streamHtmlToMarkdown`
- `text.ts`, `html.ts`: Plain text and allowlisted HTML entries
- `parse.ts`: Manual HTML parsing into DOM-like structure for performance
- `markdown-processor.ts`: DOM node to Markdown transformation logic with state management
- `stream.ts`: Streaming HTML processing
- `types.ts`: Core TypeScript interfaces for nodes, plugins, and state management
- `tags.ts`: HTML tag handlers for Markdown conversion
- `const.ts`: TAG_* constant IDs for fast tag lookups (avoids string comparison)
- `option-shape.ts`: Option validation shared by every entry
- `clean.ts`: Cleanup rules for the `clean` option
- `splitter.ts`: Single-pass Markdown text splitter (LangChain compatible)
- `preset/minimal.ts`: Preset combining frontmatter, isolate-main, tailwind, and filter plugins

### Plugin System

Hook plugins exist only in the JS engine (`@mdream/js`). The Rust engine (`mdream`) takes declarative options instead.
The plugin system allows you to customize HTML to Markdown conversion by hooking into the processing pipeline. Plugins can filter content, extract data, transform nodes, or add custom behavior. Pass them in order as `htmlToMarkdown(html, { plugins: [myPlugin()] })`.

#### Plugin Hooks

- `beforeNodeProcess`: Called before any node processing, can skip nodes
- `onNodeEnter`: Called when entering an element node
- `onNodeExit`: Called when exiting an element node
- `processTextNode`: Called for each text node
- `processAttributes`: Called to process element attributes

#### Creating a Plugin

Use `createPlugin()` to create a plugin with type safety:

```typescript
import { createPlugin } from '@mdream/js/plugins'

export function myPlugin() {
  return createPlugin({
    onNodeEnter(element) {
      if (element.name === 'custom-tag') {
        return '**Custom content:** '
      }
    },

    processTextNode(textNode) {
      // Transform text content
      if (textNode.value.includes('TODO')) {
        return { content: textNode.value.toUpperCase(), skip: false }
      }
    }
  })
}
```

#### Example: Header Extraction Plugin

```typescript
import { createPlugin } from '@mdream/js/plugins'

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

export function headerExtractPlugin(headers: string[]) {
  return createPlugin({
    processTextNode(textNode, state) {
      const parent = textNode.parent
      if (parent && HEADINGS.has(parent.name)) {
        headers.push(textNode.value.trim())
        // state.depth is the nesting depth; state.options holds the conversion options
      }
      return undefined
    }
  })
}
```

#### Example: Extraction Plugin

The `extractionPlugin` provides a specialized way to extract elements using CSS selectors. All callbacks receive both the element and runtime state:

```typescript
import { extractionPlugin } from '@mdream/js/plugins'

const plugin = extractionPlugin({
  'h2': (element, state) => {
    console.log('Heading:', element.textContent)
    console.log('Depth:', state.depth) // Current nesting depth
  },
  'img[alt]': (element, state) => {
    console.log('Image:', element.attributes.src, element.attributes.alt)
    console.log('Has options:', !!state.options) // Access to conversion options
  }
})
```

#### Example: Content Filter Plugin

```typescript
import type { ElementNode } from '@mdream/js'
import { createPlugin, ELEMENT_NODE } from '@mdream/js'

export function adBlockPlugin() {
  return createPlugin({
    beforeNodeProcess(event) {
      const { node } = event

      if (node.type === ELEMENT_NODE) {
        const element = node as ElementNode

        // Skip ads and promotional content
        if (element.attributes?.class?.includes('ad')
          || element.attributes?.id?.includes('promo')) {
          return { skip: true }
        }
      }
    }
  })
}
```

### Built-in Plugins
Import these from `@mdream/js/plugins`. The Rust engine has the same features as declarative options.
- `frontmatterPlugin()`: Extracts metadata from HTML `<head>` into YAML frontmatter
- `isolateMainPlugin()`: Isolates main content area using semantic HTML
- `tailwindPlugin()`: Converts Tailwind utility classes to semantic Markdown
- `filterPlugin({ exclude: [...] })`: Filters out unwanted HTML elements by tag name or CSS selector
- `extractionPlugin({ 'selector': callback })`: Extracts elements using CSS selectors during conversion

### Key Concepts
- **Node Types**: ElementNode (HTML elements) and TextNode (text content) with parent/child relationships
- **TAG_* Constants**: Integer IDs in `const.ts` for fast tag lookups without string comparison. Rust uses the same values in `crates/core/src/consts.rs`.
- **Streaming Architecture**: Processes HTML incrementally. A stream joins to the same output as one-shot conversion.
- **Plugin Pipeline**: Each plugin can intercept and transform content at different processing stages
- **Memory Efficiency**: Immediate processing and callback patterns to avoid collecting large data structures
- **CSS Query Selector**: Custom CSS selector implementation in `libs/query-selector.ts` for element matching
- **depthMap**: Uint16Array tracking nesting depth for each tag type (performance optimization)

## Technical Details
- Parser: Manual HTML parsing for performance, doesn't use browser DOM
- Node traversal: Stack-based, non-recursive approach to handle large documents
- Streaming: Chunks content using optimal breakpoints (paragraphs, lines)
- HTML entities: Custom decoder with performance optimizations
- Markdown generation: Tag handlers for each HTML element type accessed via TAG_* constants
- State management: A runtime state object tracks context during conversion
- Tables: Special handling for alignment, colspan, and header formatting
- Lists: Support for nested ordered/unordered lists with proper indentation
- Blockquotes: Handles proper nesting and continuations

## Module Exports & Entry Points

Read the `exports` field of each `package.json` for the current entry points. It is the source of truth.

- `mdream`: `htmlToMarkdown` and `streamHtmlToMarkdown`. Export conditions pick NAPI in Node and WASM in edge runtimes (`workerd`, `edge-light`).
- `@mdream/js`: `.` (Markdown), `/text`, `/html`, `/clean`, `/plugins`, `/preset/minimal`, `/splitter`, `/parse`, `/negotiate`, `/llms-txt`

## CLI and Testing

### CLI Usage (packages/mdream/)
- Entry: `node ./bin/mdream.mjs` (also via `mdream` when installed globally)
- Processes HTML from stdin, outputs Markdown to stdout
- Test with live sites: `curl -s https://example.com | node ./bin/mdream.mjs --origin https://example.com`
- Options: run `node ./bin/mdream.mjs --help`. `@mdream/js` has the same CLI as `mdream-js`.

### Testing Strategy
- `packages/js/test/unit/`: JS engine tests (parser, streaming, splitter, options, `libs/` query selector)
- `packages/mdream/test/unit/`: Rust engine and cross-engine parity tests, organized by feature:
  - `nodes/` - HTML element conversion tests
  - `plugins/` - plugin functionality tests
  - `templates/` - real-world site template tests (NASA, HackerNews, Wikipedia, etc.)
  - `preset/` - preset configuration tests
  - `streaming/` - stream and one-shot equivalence
- `packages/mdream/test/integration/`: end-to-end and browser tests
- `packages/mdream/test/fixtures/`: real HTML from GitHub and Wikipedia
- `crates/core/tests/`: Rust conversion tests
- Add tests for a new plugin in `packages/mdream/test/unit/plugins/`
- Run specific test categories: `pnpm test packages/mdream/test/unit/plugins/`

## Important Instruction Reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

<!-- skilld -->
Before modifying code, evaluate each installed skill against the current task.
For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.
<!-- /skilld -->
