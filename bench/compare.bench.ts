/**
 * mdream Benchmark Suite
 *
 * Compares raw HTML-to-Markdown conversion performance across libraries.
 * All tests use default/minimal settings for fair comparison:
 * - mdream: base htmlToMarkdown() with no plugins
 * - turndown: default settings with GFM tables/strikethrough
 * - node-html-markdown: default settings
 *
 * Run: pnpm bench
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { bench, describe } from 'vitest'
import { htmlToMarkdown } from '../packages/mdream/src'
import { withMinimalPreset } from '../packages/mdream/src/preset/minimal'

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
console.log('\n📊 Fixture sizes:')
console.log(`  wikipedia-largest.html: ${(wikiLarge.length / 1024).toFixed(0)} KB`)
console.log(`  wikipedia-small.html: ${(wikiSmall.length / 1024).toFixed(0)} KB`)
console.log(`  github-markdown-complete.html: ${(github.length / 1024).toFixed(0)} KB\n`)

describe('small HTML (166 KB - Wikipedia)', () => {
  bench('mdream', () => {
    htmlToMarkdown(wikiSmall)
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

  bench('turndown (gfm)', () => {
    turndown.turndown(wikiLarge)
  })

  bench('node-html-markdown', () => {
    nhm.translate(wikiLarge)
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
