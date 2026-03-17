/* eslint-disable no-console */
/**
 * Token usage comparison across HTML-to-Markdown libraries.
 * Compares raw output size and approximate token count.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { convert as rustConvert } from '@kreuzberg/html-to-markdown-node'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { htmlToMarkdown } from '../packages/js/src'
import { htmlToMarkdown as mdreamRust } from '../packages/mdream/src'

function countTokens(text: string): number {
  let tokens = 0
  let inWord = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 32 || c === 10 || c === 9 || c === 13) {
      if (inWord) {
        tokens++
        inWord = false
      }
    }
    else if (c === 91 || c === 93 || c === 40 || c === 41 || c === 35
      || c === 42 || c === 124 || c === 45 || c === 33 || c === 58) {
      if (inWord) {
        tokens++
        inWord = false
      }
      tokens++
    }
    else {
      inWord = true
    }
  }
  if (inWord)
    tokens++
  return tokens
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.use(gfm)
const nhm = new NodeHtmlMarkdown()

interface FixtureResult {
  name: string
  htmlSize: string
  htmlTokens: number
  results: Record<string, { chars: number, tokens: number }>
}

const fixtures = [
  { name: 'Wikipedia', path: resolve(import.meta.dirname, '../packages/mdream/test/fixtures/wikipedia-small.html') },
  { name: 'GitHub Docs', path: resolve(import.meta.dirname, '../packages/mdream/test/fixtures/github-markdown-complete.html') },
  { name: 'Wikipedia (large)', path: resolve(import.meta.dirname, '../packages/mdream/test/fixtures/wikipedia-largest.html') },
]

const allResults: FixtureResult[] = []

for (const fixture of fixtures) {
  const html = readFileSync(fixture.path, 'utf-8')
  const htmlTokens = countTokens(html)
  const htmlSize = `${(html.length / 1024).toFixed(0)} KB`

  const results: Record<string, { chars: number, tokens: number }> = {}

  // mdream (default)
  const mdreamDefault = htmlToMarkdown(html).markdown
  results.mdream = { chars: mdreamDefault.length, tokens: countTokens(mdreamDefault) }

  // mdream (minimal+clean) - Rust engine
  const mdreamMinimal = mdreamRust(html, { minimal: true }).markdown
  results['mdream (minimal)'] = { chars: mdreamMinimal.length, tokens: countTokens(mdreamMinimal) }

  // Turndown
  const turndownResult = turndown.turndown(html)
  results.turndown = { chars: turndownResult.length, tokens: countTokens(turndownResult) }

  // node-html-markdown
  const nhmResult = nhm.translate(html)
  results['node-html-markdown'] = { chars: nhmResult.length, tokens: countTokens(nhmResult) }

  // html-to-markdown (Rust)
  try {
    const rustResult = rustConvert(html)
    results['html-to-markdown'] = { chars: rustResult.length, tokens: countTokens(rustResult) }
  }
  catch {
    results['html-to-markdown'] = { chars: 0, tokens: 0 }
  }

  allResults.push({ name: fixture.name, htmlSize, htmlTokens, results })
}

// Print results
console.log('\n## Token Usage Comparison\n')

for (const fixture of allResults) {
  console.log(`### ${fixture.name} (${fixture.htmlSize}, ${fixture.htmlTokens.toLocaleString()} HTML tokens)\n`)
  console.log(`| Library | Output Chars | Tokens | vs HTML |`)
  console.log(`|---------|-------------|--------|---------|`)

  const entries = Object.entries(fixture.results).sort((a, b) => a[1].tokens - b[1].tokens)
  for (const [name, data] of entries) {
    const reduction = ((fixture.htmlTokens - data.tokens) / fixture.htmlTokens * 100).toFixed(0)
    const marker = name.includes('minimal') ? ' 🏆' : ''
    console.log(`| ${name}${marker} | ${data.chars.toLocaleString()} | ${data.tokens.toLocaleString()} | -${reduction}% |`)
  }
  console.log()
}
