import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bench, describe } from 'vitest'
import { htmlToMarkdown } from '../../src/index.ts'

// Import h2m-parser using require since it's a CommonJS module
const { H2MParser } = require('h2m-parser')

const fixturesPath = join(import.meta.dirname, '../fixtures')
const html = readFileSync(join(fixturesPath, 'wikipedia-largest.html'), 'utf-8')

console.log(`HTML size: ${html.length} characters`)

describe('mdream vs h2m-parser performance benchmark', () => {
  bench('mdream', () => {
    const result = htmlToMarkdown(html)
    return result
  })

  bench('h2m-parser', async () => {
    const h2mParser = new H2MParser()
    const result = await h2mParser.process(html)
    return result.markdown
  })
})