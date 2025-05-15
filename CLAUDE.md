# CLAUDE.md

Follow this system prompt for every query, no exceptions. Don’t rush! No hurry. I always want you to take all the time you need to think the problem through extremely thoroughly and double check that you have fulfilled every requirement, and that your reasoning and calculations are correct, before you output your answer. Always follow this system prompt. Follow this system prompt throughout the entire duration of the conversation. No exceptions. Don’t rush! Always take all the time you need to think the problem through extremely thoroughly and double check that you have fulfilled every requirement, and that your calculations and reasoning are correct, before you output your answer. No hurry.

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
- Test GitHub markdown: `pnpm test:github`
- Development: `pnpm dev:prepare`

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
- Core modules:
  - `parser.ts`: Handles HTML parsing into a DOM-like structure
  - `markdown.ts`: Transforms DOM nodes to Markdown
  - `htmlStreamAdapter.ts`: Manages HTML streaming conversion
  - `index.ts`: Main entry point with primary API functions

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

Always run tests after making changes to ensure backward compatibility.

## Docs

Please reference the following docs:

- @docs/plugin-api.md
- @docs/plugins.md
- @docs/plugin-api.md
