/**
 * mdream Benchmark Suite
 *
 * Compares raw HTML-to-Markdown conversion performance across libraries.
 * All tests use default/minimal settings for fair comparison:
 * - mdream: base htmlToMarkdown() with no plugins
 * - turndown: default settings with GFM tables/strikethrough
 * - node-html-markdown: default settings
 * - html-to-markdown-node: Rust with native Node bindings (napi-rs)
 *
 * Run: pnpm bench
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { convert as rustConvert } from '@kreuzberg/html-to-markdown-node'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { bench, describe } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../packages/mdream/src'
import { withMinimalPreset } from '../packages/mdream/src/preset/minimal'

function stringToStream(str: string): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      // simulate realistic chunking (~16KB chunks)
      const chunkSize = 16384
      for (let i = 0; i < str.length; i += chunkSize) {
        controller.enqueue(str.slice(i, i + chunkSize))
      }
      controller.close()
    },
  })
}

async function consumeStream(html: string) {
  const stream = streamHtmlToMarkdown(stringToStream(html))
  for await (const _ of stream) {
    // Consume stream without doing anything with the output
  }
}

// Load test fixtures
const wikiLarge = readFileSync(resolve(import.meta.dirname, '../packages/mdream/test/fixtures/wikipedia-largest.html'), 'utf-8')
const wikiSmall = readFileSync(resolve(import.meta.dirname, '../packages/mdream/test/fixtures/wikipedia-small.html'), 'utf-8')
const github = readFileSync(resolve(import.meta.dirname, '../packages/mdream/test/fixtures/github-markdown-complete.html'), 'utf-8')

// Setup competitors with equivalent features
// Turndown with GFM for tables/strikethrough (mdream supports these by default)
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.use(gfm)

// node-html-markdown default instance
const nhm = new NodeHtmlMarkdown()

// Pre-compute minimal preset options (reused across calls)
const minimalOptions = withMinimalPreset()

// Print fixture sizes
// eslint-disable-next-line no-console
console.log('\n📊 Fixture sizes:')
// eslint-disable-next-line no-console
console.log(`  wikipedia-largest.html: ${(wikiLarge.length / 1024).toFixed(0)} KB`)
// eslint-disable-next-line no-console
console.log(`  wikipedia-small.html: ${(wikiSmall.length / 1024).toFixed(0)} KB`)
// eslint-disable-next-line no-console
console.log(`  github-markdown-complete.html: ${(github.length / 1024).toFixed(0)} KB\n`)

describe('small HTML (166 KB - Wikipedia)', () => {
  bench('mdream', () => {
    htmlToMarkdown(wikiSmall)
  })

  bench('html-to-markdown (Rust)', () => {
    rustConvert(wikiSmall)
  })

  bench('turndown (gfm)', () => {
    turndown.turndown(wikiSmall)
  })

  bench('node-html-markdown', () => {
    nhm.translate(wikiSmall)
  })
})

describe('medium HTML (420 KB - GitHub Docs)', () => {
  bench('mdream', () => {
    htmlToMarkdown(github)
  })

  bench('html-to-markdown (Rust)', () => {
    rustConvert(github)
  })

  bench('turndown (gfm)', () => {
    turndown.turndown(github)
  })

  bench('node-html-markdown', () => {
    nhm.translate(github)
  })
})

describe('large HTML (1.8 MB - Wikipedia)', () => {
  bench('mdream', () => {
    htmlToMarkdown(wikiLarge)
  })

  bench('html-to-markdown (Rust)', () => {
    rustConvert(wikiLarge)
  })

  bench('turndown (gfm)', () => {
    turndown.turndown(wikiLarge)
  })

  bench('node-html-markdown', () => {
    nhm.translate(wikiLarge)
  })
})

describe('streaming vs string - small HTML (166 KB)', () => {
  bench('mdream (string)', () => {
    htmlToMarkdown(wikiSmall)
  })

  bench('mdream (stream)', async () => {
    await consumeStream(wikiSmall)
  })
})

describe('streaming vs string - large HTML (1.8 MB)', () => {
  bench('mdream (string)', () => {
    htmlToMarkdown(wikiLarge)
  })

  bench('mdream (stream)', async () => {
    await consumeStream(wikiLarge)
  })
})

describe('with LLM Preset - Large HTML (1.8 MB)', () => {
  bench('mdream (minimal preset)', () => {
    htmlToMarkdown(wikiLarge, minimalOptions)
  })

  bench('mdream (no plugins)', () => {
    htmlToMarkdown(wikiLarge)
  })
})
