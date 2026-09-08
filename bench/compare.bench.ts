/* eslint test/consistent-test-it: "off" -- This rule misidentifies Vitest 5 bench.compare calls as test declarations. */
/**
 * mdream Benchmark Suite
 *
 * Compares raw HTML-to-Markdown conversion performance across libraries.
 * All tests use default/minimal settings for fair comparison:
 * - mdream: base htmlToMarkdown() with no plugins
 * - turndown: default settings with GFM tables/strikethrough
 * - node-html-markdown: default settings
 * - rehype-remark: unified ecosystem (rehype-parse + rehype-remark + remark-stringify)
 * - html-to-markdown-node: Rust with native Node bindings (napi-rs)
 *
 * Run: pnpm bench
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import htmlToMarkdownNode from '@kreuzberg/html-to-markdown-node'
import { htmlToMarkdown, streamHtmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import { htmlToMarkdown as mdreamRust, streamHtmlToMarkdown as mdreamRustStream_ } from 'mdream'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { unified } from 'unified'
import { it } from 'vitest'

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

async function consumeStream(
  streamFn: (stream: any, options?: any) => AsyncIterable<string>,
  html: string,
) {
  const stream = streamFn(stringToStream(html))
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

// rehype-remark (unified ecosystem) with GFM for tables/strikethrough
const rehypeRemarkProcessor = unified()
  .use(rehypeParse)
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify)

// Pre-compute minimal preset options (reused across calls)
const minimalOptions = withMinimalPreset()
const { convert: rustConvert } = htmlToMarkdownNode

// Print fixture sizes
// eslint-disable-next-line no-console
console.log('\n📊 Fixture sizes:')
// eslint-disable-next-line no-console
console.log(`  wikipedia-largest.html: ${(wikiLarge.length / 1024).toFixed(0)} KB`)
// eslint-disable-next-line no-console
console.log(`  wikipedia-small.html: ${(wikiSmall.length / 1024).toFixed(0)} KB`)
// eslint-disable-next-line no-console
console.log(`  github-markdown-complete.html: ${(github.length / 1024).toFixed(0)} KB\n`)

it('small HTML (166 KB - Wikipedia)', async ({ bench }) => {
  await bench.compare(
    bench('mdream', () => {
      htmlToMarkdown(wikiSmall)
    }),

    bench('mdream-rust', () => {
      mdreamRust(wikiSmall)
    }),

    bench('html-to-markdown (Rust)', () => {
      rustConvert(wikiSmall)
    }),

    bench('turndown (gfm)', () => {
      turndown.turndown(wikiSmall)
    }),

    bench('node-html-markdown', () => {
      nhm.translate(wikiSmall)
    }),

    bench('rehype-remark', async () => {
      await rehypeRemarkProcessor.process(wikiSmall)
    }),
  )
})

it('medium HTML (420 KB - GitHub Docs)', async ({ bench }) => {
  await bench.compare(
    bench('mdream', () => {
      htmlToMarkdown(github)
    }),

    bench('mdream-rust', () => {
      mdreamRust(github)
    }),

    bench('html-to-markdown (Rust)', () => {
      rustConvert(github)
    }),

    bench('turndown (gfm)', () => {
      turndown.turndown(github)
    }),

    bench('node-html-markdown', () => {
      nhm.translate(github)
    }),

    bench('rehype-remark', async () => {
      await rehypeRemarkProcessor.process(github)
    }),
  )
})

it('large HTML (1.8 MB - Wikipedia)', async ({ bench }) => {
  await bench.compare(
    bench('mdream', () => {
      htmlToMarkdown(wikiLarge)
    }),

    bench('mdream-rust', () => {
      mdreamRust(wikiLarge)
    }),

    bench('html-to-markdown (Rust)', () => {
      rustConvert(wikiLarge)
    }),

    bench('turndown (gfm)', () => {
      turndown.turndown(wikiLarge)
    }),

    // node-html-markdown skipped: O(n^2) blowup makes the 1.8 MB run take ~25s/op

    bench('rehype-remark', async () => {
      await rehypeRemarkProcessor.process(wikiLarge)
    }),
  )
})

it('streaming vs string - small HTML (166 KB)', async ({ bench }) => {
  await bench.compare(
    bench('mdream (string)', () => {
      htmlToMarkdown(wikiSmall)
    }),

    bench('mdream (stream)', async () => {
      await consumeStream(streamHtmlToMarkdown, wikiSmall)
    }),

    bench('mdream-rust (stream)', async () => {
      await consumeStream(mdreamRustStream_, wikiSmall)
    }),
  )
})

it('streaming vs string - large HTML (1.8 MB)', async ({ bench }) => {
  await bench.compare(
    bench('mdream (string)', () => {
      htmlToMarkdown(wikiLarge)
    }),

    bench('mdream (stream)', async () => {
      await consumeStream(streamHtmlToMarkdown, wikiLarge)
    }),

    bench('mdream-rust (stream)', async () => {
      await consumeStream(mdreamRustStream_, wikiLarge)
    }),
  )
})

it('with LLM Preset - Large HTML (1.8 MB)', async ({ bench }) => {
  await bench.compare(
    bench('mdream (minimal preset)', () => {
      htmlToMarkdown(wikiLarge, minimalOptions)
    }),

    bench('mdream (no plugins)', () => {
      htmlToMarkdown(wikiLarge)
    }),
  )
})
