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

  // A line at a list item's content column opens a block there, however many
  // spaces deep the column is.
  it.each([
    ['<ol start="10"><li><h3>T</h3># x</li></ol>', '10. ### T\n\n    \\# x'],
    ['<ol start="10"><li><h3>T</h3>1. x</li></ol>', '10. ### T\n\n    1\\. x'],
    ['<ul><li>a<ul><li><h3>T</h3>&gt; x</li></ul></li></ul>', '- a\n  - ### T\n\n    \\> x'],
    ['<ul><li>a<ul><li>T<br>- x</li></ul></li></ul>', '- a\n  - T  \n    \\- x'],
    ['<ol start="10"><li><p>a</p><p># x</p></li></ol>', '10. a\n\n    \\# x'],
    ['<ol start="10"><li><p>a</p><p>x # y</p></li></ol>', '10. a\n\n    x # y'],
  ])('escapes a block marker at a deep list content column for %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  // The output trim removes the whitespace that leads the document, so a block
  // marker behind any amount of it starts the document. The same whitespace
  // is kept anywhere else, where four spaces of it make the marker inert.
  it.each([
    ['<p>&#32;&#32;&#32;&#32;# x</p>', '\\# x'],
    ['&#32;&#32;&#32;&#32;# x', '\\# x'],
    ['<p>&#9;- x</p>', '\\- x'],
    ['<p>&nbsp;&gt; x</p>', '\\> x'],
    ['<p>&nbsp;# x</p>', '\\# x'],
    ['<p>&nbsp;1. x</p>', '1\\. x'],
    ['<p>&#10;&#32;&#32;&#32;&#32;1. x</p>', '1\\. x'],
    ['<p>&#32;&#32;&#32;&#32;<b></b># x</p>', '\\# x'],
    ['<p>&#32;&#32;&#32;&#32;1<b></b>. x</p>', '1\\. x'],
    ['<p>&#13;&#10;5<b></b>. x</p>', '5\\. x'],
    ['<p>&#32;&#32;&#32;&#32;x # y</p>', 'x # y'],
    ['<p>a</p><p>&#32;&#32;&#32;&#32;# x</p>', 'a\n\n    # x'],
    ['<blockquote>&#32;&#32;&#32;&#32;# x</blockquote>', '>     # x'],
    ['<ul><li>&#32;&#32;&#32;&#32;# x</li></ul>', '-     # x'],
  ])('escapes a block marker behind trimmed leading whitespace for %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})
