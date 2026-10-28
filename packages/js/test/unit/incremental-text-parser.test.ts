import type { ParseState } from '../../src/parse'
import type { MdreamOptions, NodeEvent } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { MAX_TAG_ID, TEXT_NODE } from '../../src/const'
import { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { commitPlainTextPrefix, parseHtmlStream } from '../../src/parse'

const body = 'ordinary words '.repeat(5000)
function input(parts: string[]) {
  return new ReadableStream<string>({
    start(controller) {
      for (const part of parts)
        controller.enqueue(part)
      controller.close()
    },
  })
}
async function convert(parts: string[], options: MdreamOptions = {}) {
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(input(parts), options))
    output += chunk
  return output
}

describe('incremental text parser prototype', () => {
  it('emits payload before closing markup arrives', async () => {
    let deliveredClosing = false
    const stream = new ReadableStream<string>({
      pull(controller) {
        if (!deliveredClosing) {
          deliveredClosing = true
          controller.enqueue(`<p>${body}`)
        }
        else {
          throw new Error('closing markup was requested before payload was emitted')
        }
      },
    }, { highWaterMark: 0 })
    const iterator = streamHtmlToMarkdown(stream)[Symbol.asyncIterator]()
    try {
      const first = await iterator.next()
      expect(first.value).toContain('ordinary words')
    }
    finally {
      await iterator.return?.()
    }
  })

  const cases: [string, string, MdreamOptions][] = [
    ['paragraph', `<p>${body}</p>`, {}],
    ['nested list tail', `<ul><li><ul><li>inner</li></ul>${body}</li></ul>`, {}],
    ['entities', `<p>${body}&amp;&#32;&#x1f600;&notit;X &incomplete</p>`, {}],
    ['inline separator', `<p><em>before</em>${body}<span>after</span> tail</p>`, {}],
    ['code', `<pre><code>${body}\n  x &amp; y\n</code></pre>`, {}],
    ['table', `<table><tr><td>${body}| [x] &amp;</td></tr></table>`, {}],
    ['wrap', `<p>${body}lastword</p>`, { wrapWidth: 37 }],
    ['drain lookahead', `<p>${body}<br>1. marker<br>===<br>www.example.com</p>`, {}],
    ['unclosed text', `<p>${body}tail`, {}],
  ]
  it.each(cases)('preserves one-shot bytes: %s', async (_name, html, options) => {
    const expected = htmlToMarkdown(html, options)
    for (const size of [4093, 65536, 70001]) {
      const parts = []
      for (let i = 0; i < html.length; i += size)
        parts.push(html.slice(i, i + size))
      expect(await convert(parts, options)).toBe(expected)
    }
  })

  it('preserves every cut around entities, inline boundaries and drain lookahead', async () => {
    for (const tail of [
      '&amp; &#32; &#x1f600; &notit; &incomplete',
      '<em>x</em> <span>y</span>z',
      '<br>1. marker<br>===<br>www.example.com',
      '  \n\t alpha &amp; beta',
      '</p><ul><li>one<ul><li>two</li></ul>tail</li></ul>',
    ]) {
      const prefix = `<p>${body}`
      const html = `${prefix}${tail}</p>`
      const expected = htmlToMarkdown(html)
      for (let cut = 0; cut <= tail.length; cut++)
        expect(await convert([prefix, tail.slice(0, cut), `${tail.slice(cut)}</p>`])).toBe(expected)
    }
  })

  it('preserves fallback contexts and custom tag output', async () => {
    for (const [open, close] of [
      ['<blockquote><p>', '</p></blockquote>'],
      ['<p><code>', '</code></p>'],
      ['<table><tr><td><p>', '</p></td></tr></table>'],
      ['<details><p>', '</p></details>'],
      ['<p>', '</p>'],
      [`${'<div>'.repeat(511)}<p><xmp>`, `</xmp></p>${'</div>'.repeat(511)}`],
    ]) {
      for (const value of [body, `${body}é漢😀`, 'a'.repeat(70000)]) {
        const html = `${open}${value}${close}`
        const options = { tagOverrides: { p: { enter: 'START', exit: 'END' } } }
        expect(await convert([open + value, close])).toBe(htmlToMarkdown(html))
        expect(await convert([open + value, close], options)).toBe(htmlToMarkdown(html, options))
      }
    }
  })

  it('keeps collapsed raw spaces and the resumed suffix in the same state', async () => {
    const raw = '  ordinary   words  '.repeat(6000)
    const html = `<p>${raw}    tail</p>`
    expect(await convert([`<p>${raw}`, '    tail</p>'])).toBe(htmlToMarkdown(html))
    expect(await convert([`<p>${raw}ta`, 'il</p>'])).toBe(htmlToMarkdown(`<p>${raw}tail</p>`))
  })

  it('keeps public parser text events whole unless the stream hook is called', () => {
    const values: string[] = []
    const state: ParseState = { depthMap: new Uint16Array(MAX_TAG_ID), depth: 0 }
    const event = (event: NodeEvent) => {
      if (event.node.type === TEXT_NODE)
        values.push(event.node.value)
    }
    const carry = parseHtmlStream(`<p>${body}`, state, event)
    expect(carry).toBe(body)
    expect(values).toEqual([])
    parseHtmlStream(`${carry}</p>`, state, event)
    expect(values).toEqual([body])
  })

  it('preserves an unsplittable word and its parser state until its suffix arrives', () => {
    const word = 'a'.repeat(70000)
    const values: string[] = []
    const state: ParseState = { depthMap: new Uint16Array(MAX_TAG_ID), depth: 0 }
    const event = (event: NodeEvent) => {
      if (event.node.type === TEXT_NODE)
        values.push(event.node.value)
    }
    const carry = parseHtmlStream(`<p>${word}`, state, event)
    const snapshot = { ...state, depthMap: state.depthMap.slice(), currentNode: { ...state.currentNode } }
    expect(commitPlainTextPrefix(carry, state, event)).toBe(carry)
    expect({ ...state, currentNode: { ...state.currentNode } }).toEqual(snapshot)
    expect(values).toEqual([])
    parseHtmlStream(`${carry}suffix</p>`, state, event)
    expect(values).toEqual([`${word}suffix`])
  })

  it('holds an unsplittable suffix after a commit and resumes when a separator arrives', () => {
    const word = 'a'.repeat(70000)
    const values: string[] = []
    const state: ParseState = { depthMap: new Uint16Array(MAX_TAG_ID), depth: 0 }
    const event = (event: NodeEvent) => {
      if (event.node.type === TEXT_NODE)
        values.push(event.node.value)
    }
    let carry = parseHtmlStream(`<p>${body}${word}`, state, event)
    carry = commitPlainTextPrefix(carry, state, event)
    expect(carry).toBe(word)
    expect(values).toEqual([body])
    carry = parseHtmlStream(`${carry}tail`, state, event)
    const snapshot = { ...state, depthMap: state.depthMap.slice(), currentNode: { ...state.currentNode } }
    expect(commitPlainTextPrefix(carry, state, event)).toBe(carry)
    expect({ ...state, currentNode: { ...state.currentNode } }).toEqual(snapshot)
    expect(values).toEqual([body])
    carry = parseHtmlStream(`${carry} next word `, state, event)
    carry = commitPlainTextPrefix(carry, state, event)
    expect(carry).toBe('')
    parseHtmlStream('</p>', state, event)
    expect(values.join('')).toBe(`${body}${word}tail next word `)
  })

  it('rejects non-ASCII raw whitespace before committing normalized text', () => {
    const values: string[] = []
    const state: ParseState = { depthMap: new Uint16Array(MAX_TAG_ID), depth: 0 }
    const event = (event: NodeEvent) => {
      if (event.node.type === TEXT_NODE)
        values.push(event.node.value)
    }
    const carry = parseHtmlStream(`<p>${body}\t`, state, event)
    const snapshot = { ...state }
    expect(commitPlainTextPrefix(carry, state, event)).toBe(carry)
    expect(state).toEqual(snapshot)
    expect(values).toEqual([])
  })

  it('preserves full text-node plugin observation', async () => {
    function options(values: string[]): MdreamOptions {
      return { plugins: [createPlugin({ processTextNode(node) {
        values.push(node.value)
      } })] }
    }
    const html = `<p>${body}tail</p>`
    const oneShot: string[] = []
    const streamed: string[] = []
    const expected = htmlToMarkdown(html, options(oneShot))
    expect(await convert([html.slice(0, 70000), html.slice(70000)], options(streamed))).toBe(expected)
    expect(streamed).toEqual(oneShot)
  })

  it('rejects unsupported maxNodeBytes without silently changing the contract', () => {
    const options = { maxNodeBytes: 1024 } as MdreamOptions
    expect(() => htmlToMarkdown('<p>x</p>', options)).toThrow('maxNodeBytes')
    expect(() => streamHtmlToMarkdown(input(['<p>x</p>']), options)).toThrow('maxNodeBytes')
  })
})
