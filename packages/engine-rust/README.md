# @mdream/engine-rust

> Ultra-fast HTML to Markdown conversion engine for mdream, written in Rust. 

This is the native Rust engine for [mdream](https://github.com/harlan-zw/mdream). It provides a ~3-4x performance improvement over the JavaScript engine, processing large documents like a 1.8MB Wikipedia page in ~7ms instead of ~50ms. 

## Installation

```bash
pnpm add @mdream/engine-rust mdream
```

## Usage

You can pass the Rust engine to `htmlToMarkdown` to use it instead of the default JavaScript engine. 

```ts
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'
import { createRustEngine } from '@mdream/engine-rust'

// Use the Rust engine for maximum performance
const perfMarkdown = htmlToMarkdown('<h1>Hello World</h1>', { 
  engine: createRustEngine() 
})
```

For more documentation and examples, see the [main mdream documentation](https://github.com/harlan-zw/mdream).

## License

MIT 
