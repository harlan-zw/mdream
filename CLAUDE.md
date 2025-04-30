# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
