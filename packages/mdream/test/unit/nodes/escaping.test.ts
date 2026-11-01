// <h1>1. Hello world</h1>

import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('escaping $name', (engineConfig) => {
  it('bold & Italic: Supports bold and italic—even within single words.', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<h1>1. Hello world</h1>', { engine })).toBe('# 1. Hello world')
  })

  it.each([
    ['<p>> quote</p>', '\\> quote'],
    ['<p>1. item</p>', '1\\. item'],
    ['<p>---</p>', '\\---'],
    ['<p>&amp;copy;</p>', '\\&copy;'],
  ])('preserves literal GFM text for %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<p>Line one<br>===</p>', 'Line one  \n\\==='],
    ['<p>Line one<br>--</p>', 'Line one  \n\\--'],
    ['<p>Line one<br>---</p>', 'Line one  \n\\---'],
    ['<p>Line one<br>==x</p>', 'Line one  \n==x'],
  ])('keeps the line after a hard break in %s from becoming a setext underline', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})
