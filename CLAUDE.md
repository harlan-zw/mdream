# CLAUDE.md

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
- `src/index.ts`: Main entry point with `syncHtmlToMarkdown` and `streamHtmlToMarkdown` APIs
- `src/parser.ts`: Manual HTML parsing into DOM-like structure for performance
- `src/markdown.ts`: DOM node to Markdown transformation logic
- `src/stream.ts`: Streaming HTML processing with content-based buffering
- `src/types.ts`: Core TypeScript interfaces for nodes, plugins, and state management

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
import { createPlugin } from './pluggable/plugin.ts'

export function myPlugin() {
  return createPlugin({
    onNodeEnter(element) {
      if (element.tagName === 'custom-tag') {
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
    onNodeEnter(element) {
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tagName)) {
        // Will collect text in processTextNode
      }
    },
    
    processTextNode(textNode) {
      const parent = textNode.parent
      if (parent && parent.tagName?.match(/^h[1-6]$/)) {
        headers.push(textNode.value.trim())
      }
    }
  })
}
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
        if (element.attributes?.class?.includes('ad') || 
            element.attributes?.id?.includes('promo')) {
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
- Comprehensive test coverage in `test/unit/` and `test/integration/`
- Plugin tests in `test/unit/plugins/` - always add tests for new plugins
- Real-world test fixtures in `test/fixtures/` (GitHub, Wikipedia HTML)
- Template tests for complex HTML structures (navigation, tables, etc.)
- Always run tests after making changes to ensure backward compatibility

