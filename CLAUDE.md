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

Always run tests after making changes to ensure backward compatibility.
