# HTML to Markdown Text Splitter

The `htmlToMarkdownSplitChunks` function converts HTML to Markdown and intelligently splits it into chunks in a **single pass**. This is optimized for LLM applications and is compatible with LangChain's Document structure.

## Basic Usage

```typescript
import { TAG_H2 } from 'mdream'
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const html = `
  <h1>Documentation</h1>
  <p>Introduction text</p>

  <h2>Installation</h2>
  <p>Install via npm...</p>

  <h2>Usage</h2>
  <p>Basic example...</p>
`

const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2],
})

// Result:
// [
//   {
//     content: "Introduction text\n\nInstall via npm...",
//     metadata: {
//       headers: { h1: "Documentation", h2: "Installation" },
//       loc: { lines: { from: 1, to: 5 } }
//     }
//   },
//   {
//     content: "Basic example...",
//     metadata: {
//       headers: { h1: "Documentation", h2: "Usage" },
//       loc: { lines: { from: 6, to: 8 } }
//     }
//   }
// ]
```

## Configuration Options

### `headersToSplitOn`

Type: `number[]`
Default: `[TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6]`

Array of header tag IDs to split on. Import tag constants from `mdream`:

```typescript
import { TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6 } from 'mdream'

// Split on h1 and h2 only
const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H1, TAG_H2],
})

// Don't split on headers at all
const chunksNoHeaders = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [],
})
```

### `stripHeaders`

Type: `boolean`
Default: `true`

Remove header lines from chunk content. Headers are always preserved in metadata.

```typescript
// Strip headers from content (default)
const chunksNoHeaders = htmlToMarkdownSplitChunks(html, {
  stripHeaders: true,
})
// chunks[0].content = "Content without header lines"

// Keep headers in content
const chunks = htmlToMarkdownSplitChunks(html, {
  stripHeaders: false,
})
// chunks[0].content = "## Section\n\nContent with header"
```

### `chunkSize`

Type: `number`
Default: `1000`

Maximum size of each chunk (measured by `lengthFunction`). Chunks may slightly exceed this due to element boundaries.

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 500,
  headersToSplitOn: [],
})
```

### `chunkOverlap`

Type: `number`
Default: `200`

Number of characters to overlap between chunks for context preservation. Must be less than `chunkSize`.

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 1000,
  chunkOverlap: 200,
})
// Last 200 chars of chunk[0] overlap with first 200 chars of chunk[1]
```

### `lengthFunction`

Type: `(text: string) => number`
Default: `(text) => text.length`

Custom function to measure chunk length. Useful for token-based chunking.

```typescript
// Token-based chunking
const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 512, // 512 tokens
  lengthFunction: text => encode(text).length, // Your tokenizer
})

// Word-based chunking
const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 100, // 100 words
  lengthFunction: text => text.split(/\s+/).length,
})
```

### `returnEachLine`

Type: `boolean`
Default: `false`

Return each line as a separate chunk. Useful for processing documents line by line.

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  returnEachLine: true,
})
// Each paragraph becomes a separate chunk
```

### `origin`

Type: `string`
Optional

Base URL for resolving relative links and images.

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  origin: 'https://example.com',
})
// <img src="/logo.png"> → ![](https://example.com/logo.png)
```

### `plugins`

Type: `Plugin[]`
Default: `[]`

Plugins to extend HTML to Markdown conversion. See [Plugin Documentation](./plugins.md).

```typescript
import { filterPlugin } from 'mdream/plugins'

const chunks = htmlToMarkdownSplitChunks(html, {
  plugins: [filterPlugin({ exclude: ['nav', '.sidebar'] })],
})
```

## Chunk Structure

Each chunk follows this structure:

```typescript
interface MarkdownChunk {
  content: string
  metadata: {
    // Header hierarchy at this chunk position
    headers?: {
      h1?: string
      h2?: string
      h3?: string
      h4?: string
      h5?: string
      h6?: string
    }
    // Code block language if chunk contains code
    code?: string
    // Line number range
    loc?: {
      lines: {
        from: number
        to: number
      }
    }
  }
}
```

## Use Cases

### Split Documentation by Sections

```typescript
import { TAG_H2 } from 'mdream'
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const chunks = htmlToMarkdownSplitChunks(documentationHtml, {
  headersToSplitOn: [TAG_H2],
  stripHeaders: true,
})

// Each h2 section becomes a separate chunk
// Perfect for RAG applications
```

### Token-Limited LLM Context

```typescript
import { encode } from 'gpt-tokenizer'

const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 512, // Max tokens per chunk
  chunkOverlap: 50, // Token overlap
  lengthFunction: text => encode(text).length,
  headersToSplitOn: [TAG_H2, TAG_H3],
})

// Send each chunk to LLM without exceeding token limits
```

### Preserve Context with Overlap

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 1000,
  chunkOverlap: 200,
  headersToSplitOn: [TAG_H2],
})

// Overlapping content ensures context is preserved across chunks
// Useful for semantic search and QA systems
```

### Split on Horizontal Rules

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [], // Don't split on headers
  chunkSize: Infinity, // No size limit
})

// <hr> tags automatically create splits
// Useful for documents with visual separators
```

### Extract Code Examples

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2],
})

const codeChunks = chunks.filter(chunk => chunk.metadata.code)

codeChunks.forEach((chunk) => {
  console.log(`Language: ${chunk.metadata.code}`)
  console.log(`Code: ${chunk.content}`)
})
```

## LangChain Compatibility

Chunks are compatible with LangChain's `Document` structure:

```typescript
import { Document } from '@langchain/core/documents'
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2],
})

// Convert to LangChain Documents
const documents = chunks.map(chunk => new Document({
  pageContent: chunk.content,
  metadata: chunk.metadata,
}))

// Use with vector stores
await vectorStore.addDocuments(documents)
```

## Advanced Examples

### Multi-Level Header Splitting

```typescript
import { TAG_H2, TAG_H3 } from 'mdream'

// Split on both h2 and h3
const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2, TAG_H3],
})

// Header hierarchy preserved in metadata
chunks.forEach((chunk) => {
  const breadcrumb = [
    chunk.metadata.headers?.h1,
    chunk.metadata.headers?.h2,
    chunk.metadata.headers?.h3,
  ].filter(Boolean).join(' > ')

  console.log(breadcrumb)
})
```

### Custom Chunk Processing

```typescript
const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2],
})

// Group chunks by top-level header
const grouped = chunks.reduce((acc, chunk) => {
  const h1 = chunk.metadata.headers?.h1 || 'untitled'
  acc[h1] = acc[h1] || []
  acc[h1].push(chunk)
  return acc
}, {})

// Process each group separately
Object.entries(grouped).forEach(([h1, chunks]) => {
  console.log(`Processing ${h1}: ${chunks.length} chunks`)
})
```
