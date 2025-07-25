# CLAUDE.md

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
- Build: `pnpm build`
- Test all: `pnpm test`
- Test single file: `pnpm test path/to/test.ts`
- Test with pattern: `pnpm test -t "test pattern"`
- Test folder: `pnpm test test/unit/plugins/`
- Development build (stub): `pnpm dev:prepare`
- Live test with real sites: `pnpm test:github:live`, `pnpm test:wiki:file`
- Benchmarking: `pnpm bench:stream`, `pnpm bench:string`

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

### Core Architecture
- `src/index.ts`: Main entry point with `htmlToMarkdown` and `streamHtmlToMarkdown` APIs
- `src/parse.ts`: Manual HTML parsing into DOM-like structure for performance
- `src/markdown-processor.ts`: DOM node to Markdown transformation logic with state management
- `src/stream.ts`: Streaming HTML processing with content-based buffering
- `src/types.ts`: Core TypeScript interfaces for nodes, plugins, and state management
- `src/tags.ts`: HTML tag handlers for Markdown conversion
- `src/buffer-region.ts`: Streaming buffer management for optimal chunk boundaries

### Plugin System

The plugin system allows you to customize HTML to Markdown conversion by hooking into the processing pipeline. Plugins can filter content, extract data, transform nodes, or add custom behavior.

#### Plugin Hooks

- `beforeNodeProcess`: Called before any node processing, can skip nodes
- `onNodeEnter`: Called when entering an element node
- `onNodeExit`: Called when exiting an element node
- `processTextNode`: Called for each text node
- `processAttributes`: Called to process element attributes

#### Creating a Plugin

Use `createPlugin()` to create a plugin with type safety:

```typescript
import { createPlugin } from 'mdream/plugins'

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
export function headerExtractPlugin() {
  const headers: string[] = []

  return createPlugin({
    onNodeEnter(element, state) {
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.name)) {
        // Will collect text in processTextNode
        // Can access state.depth for nesting level information
      }
    },

    processTextNode(textNode, state) {
      const parent = textNode.parent
      if (parent && parent.name?.match(/^h[1-6]$/)) {
        headers.push(textNode.value.trim())
        // Access state.options or state.context for additional context
      }
    }
  })
}
```

#### Example: Extraction Plugin

The `extractionPlugin` provides a specialized way to extract elements using CSS selectors. All callbacks receive both the element and runtime state:

```typescript
import { extractionPlugin } from '../plugins/extraction.ts'

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

### Key Concepts
- **Node Types**: ElementNode (HTML elements) and TextNode (text content) with parent/child relationships
- **Streaming Architecture**: Processes HTML incrementally using buffer regions and optimal chunk boundaries
- **Plugin Pipeline**: Each plugin can intercept and transform content at different processing stages
- **Memory Efficiency**: Immediate processing and callback patterns to avoid collecting large data structures
- **CSS Query Selector**: Custom CSS selector implementation in `src/libs/query-selector.ts` for element matching in plugins

## Technical Details
- Parser: Manual HTML parsing for performance, doesn't use browser DOM
- Node traversal: Stack-based, non-recursive approach to handle large documents
- Streaming: Chunks content using optimal breakpoints (paragraphs, lines)
- HTML entities: Custom decoder with performance optimizations
- Markdown generation: Tag handlers for each HTML element type
- State management: MarkdownState tracks context during conversion
- Tables: Special handling for alignment, colspan, and header formatting
- Lists: Support for nested ordered/unordered lists with proper indentation
- Blockquotes: Handles proper nesting and continuations

## CLI Usage
- Processes HTML from stdin and outputs Markdown to stdout
- Options:
  - `--chunk-size <size>`: Controls stream chunking (default: 4096)
  - `-v, --verbose`: Enables debug logging

## CLI and Testing

### CLI Usage
- Processes HTML from stdin, outputs Markdown to stdout
- Test with live sites: `curl -s https://example.com | node ./bin/mdream.mjs --origin https://example.com`
- Key CLI options: `--origin <url>`, `-v/--verbose`, `--chunk-size <size>`

### Testing Strategy
- Unit tests in `test/unit/` organized by feature:
  - `nodes/` - tests for HTML element conversion
  - `plugins/` - plugin functionality tests
  - `templates/` - real-world site template tests (NASA, HackerNews, etc.)
  - `readability/` - content extraction and scoring tests
  - `libs/` - utility library tests (query selector, etc.)
- Integration tests in `test/integration/` for end-to-end streaming
- Test fixtures in `test/fixtures/` with real HTML from GitHub, Wikipedia
- Always add tests for new plugins in `test/unit/plugins/`
- Run specific test categories: `pnpm test test/unit/plugins/` for plugin tests

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
