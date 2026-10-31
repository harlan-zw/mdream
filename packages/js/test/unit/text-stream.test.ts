import type { ParseState } from '../../src/parse'
import type { ElementNode, MdreamOptions, MdreamRuntimeState } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, NodeEventEnter, NodeEventExit } from '../../src/index'
import { finalizeParse, parseHtmlStream } from '../../src/parse'
import { createPlugin } from '../../src/pluggable/plugin'
import { htmlToText, streamHtmlToText } from '../../src/text'
import { createTextOutputProcessor } from '../../src/text-output'
import { textTagHandlers } from '../../src/text-tags'

function chunkedStream(html: string, chunkSize: number): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < html.length; offset += chunkSize)
        controller.enqueue(html.slice(offset, offset + chunkSize))
      controller.close()
    },
  })
}

// At runtime, hooks get the converter's own state. Through the internal type,
// a probe can see how much output the stream still holds at each text node.
function bufferProbe() {
  const probe = { largest: 0 }
  const plugin = createPlugin({
    processTextNode(_node, state) {
      let size = 0
      for (const fragment of (state as MdreamRuntimeState).buffer)
        size += fragment.length
      if (size > probe.largest)
        probe.largest = size
      return undefined
    },
  })
  return { probe, plugin }
}

describe('text stream', () => {
  it('wraps after a plugin rewrites earlier output', () => {
    const plugin = createPlugin({
      onNodeEnter(node, state) {
        if (node.name === 'x-rewrite')
          (state as MdreamRuntimeState).buffer[0] = ''
      },
    })
    const html = '<p>aa<span>bb</span><span>dd</span><x-rewrite></x-rewrite> cc</p>'
    expect(htmlToText(html, { wrapWidth: 8, plugins: [plugin] })).toBe('bbdd cc')
  })

  it.each([
    ['<p><b>😀</b><span> abc</span><i> def</i></p>', '😀 abc\ndef'],
    ['<p>ab <q></q><b>cd</b><i> ef</i></p>', 'ab cd\nef'],
    ['<p>abcd</p><p><b>ef</b><span> gh</span></p>', 'abcd\n\nef gh'],
  ])('keeps wrap columns after inline and block boundaries: %s', async (html, expected) => {
    expect(htmlToText(html, { wrapWidth: 6 })).toBe(expected)
    let output = ''
    for await (const chunk of streamHtmlToText(chunkedStream(html, 1), { wrapWidth: 6 }))
      output += chunk
    expect(output).toBe(expected)
  })

  const pages = [
    ['paragraphs', '<p>Some <b>bold</b> text, a <q>quote</q> and a <a href="/x">link</a>.</p>'.repeat(4000)],
    ['one long line', `<p>${'alpha <b>beta</b> gamma <i>delta</i> '.repeat(4000)}</p>`],
    ['list items', '<ul><li>one <em>two</em></li><li>three</li></ul>'.repeat(4000)],
  ] as const
  const optionSets: [string, MdreamOptions][] = [['no wrap', {}], ['wrapWidth 40', { wrapWidth: 40 }]]

  for (const [pageName, html] of pages) {
    it.each(optionSets)(`holds a bounded buffer for ${pageName} (%s)`, async (_name, options) => {
      const { probe, plugin } = bufferProbe()
      let output = ''
      let yields = 0
      for await (const chunk of streamHtmlToText(chunkedStream(html, 1024), { ...options, plugins: [plugin] })) {
        output += chunk
        yields++
      }

      expect(output).toBe(htmlToText(html, options))
      expect(output.length).toBeGreaterThan(50_000)
      expect(yields).toBeGreaterThan(50)
      // A chunk's output plus a little context, however long the document is.
      expect(probe.largest).toBeLessThan(4096)
    })
  }
})

// A trailing whitespace run stays buffered until content settles it, since a
// later trim can still take it. Copying the run on every chunk would make a
// long one quadratic, so count what the drain joins.
describe('text stream long held whitespace run', () => {
  it.each([
    ['tabs before empty pairs', '<p>a', '&#9;<i></i>', 13, '</p>'],
    ['tabs in spans', '<p>a', '<span>&#9;</span>', 17, '</p>'],
    ['newlines', '<p>a', '&#10;<i></i>', 12, '</p>'],
    ['leading tabs', '', '&#9;<i></i>', 11, 'a'],
    ['leading tabs in spans', '', '<span>&#9;</span>', 17, '<p>a</p>'],
    ['leading tabs in a paragraph', '<p>', '&#9;<i></i>', 11, 'a</p>'],
    ['a list item', '<ul><li>a', '&#9;<i></i>', 11, '</li><li>b</li></ul>'],
    ['a quotation after the run', '<p>a', '&#9;<i></i>', 11, '<q></q>b</p>'],
  ])('does not rejoin a long held run on every chunk: %s', (_, open, unit, chunkSize, close) => {
    const html = `${open}${unit.repeat(16 * 1024)}${close}`
    let joinedLength = 0
    class CountingBuffer extends Array<string> {
      override join(separator?: string): string {
        const joined = super.join(separator)
        joinedLength += joined.length
        return joined
      }
    }
    const processor = createTextOutputProcessor({}, false)
    processor.state.buffer = new CountingBuffer()
    const parseState: ParseState = {
      depthMap: processor.state.depthMap,
      depth: 0,
      resolvedPlugins: [],
      tagHandlers: textTagHandlers,
      plainText: true,
    }
    let remainingHtml = ''
    let text = ''
    for (let offset = 0; offset < html.length; offset += chunkSize) {
      remainingHtml = parseHtmlStream(remainingHtml + html.slice(offset, offset + chunkSize), parseState, processor.processEvent)
      text += processor.takeOutput(false)
    }
    finalizeParse(remainingHtml, parseState, processor.processEvent)
    text += processor.takeOutput(true)

    expect(text).toBe(htmlToText(html))
    expect(joinedLength).toBeLessThan(1024 * 1024)
  })

  it('releases a long held run with the first content after it', () => {
    const processor = createTextOutputProcessor({}, false)
    const parseState: ParseState = {
      depthMap: processor.state.depthMap,
      depth: 0,
      resolvedPlugins: [],
      tagHandlers: textTagHandlers,
      plainText: true,
    }
    const feed = (html: string): string => {
      parseHtmlStream(html, parseState, processor.processEvent)
      return processor.takeOutput(false)
    }

    expect(feed('<p>a<i></i>')).toBe('a')
    for (let index = 0; index < 2048; index++)
      expect(feed('&#9;<i></i>')).toBe('')
    expect(feed('b<i></i>')).toBe(`${'\t'.repeat(2048)}b`)
  })
})

// A plugin can skip one side of a quotation, so its opener and exit no longer
// pair up. Output then keeps whatever the processor wrote.
const skipQuoteExit = createPlugin({
  beforeNodeProcess(event) {
    if (event.type === NodeEventExit && 'name' in event.node && event.node.name === 'q')
      return { skip: true }
  },
})
const spaceForQuoteExit = createPlugin({
  onNodeExit(element) {
    if (element.name === 'q')
      return ' '
  },
})
const skipMarkedQuoteEnter = createPlugin({
  beforeNodeProcess(event) {
    if (event.type === NodeEventEnter && event.node.type === ELEMENT_NODE && (event.node as ElementNode).attributes['data-skip'] !== undefined)
      return { skip: true }
  },
})

describe('text quotation without a paired exit', () => {
  it.each([
    ['an exit a plugin skips', 'a <q></q>', skipQuoteExit, 'a "'],
    ['an exit a plugin skips, with whitespace after the opener', 'a <q> </q> ', skipQuoteExit, 'a "'],
    ['an exit a plugin skips, at the end of input', 'a <q>', skipQuoteExit, 'a "'],
    ['an exit a plugin writes', 'a <q></q>', spaceForQuoteExit, 'a "'],
    ['an inner exit whose enter a plugin skips', 'a <q><q data-skip></q></q>', skipMarkedQuoteEnter, 'a """'],
  ])('keeps the opener of %s', async (_name, html, plugin, expected) => {
    const options = { plugins: [plugin] }
    expect(htmlToText(html, options)).toBe(expected)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++) {
      let output = ''
      for await (const chunk of streamHtmlToText(chunkedStream(html, chunkSize), options))
        output += chunk
      expect(output, `chunk size ${chunkSize}`).toBe(expected)
    }
  })
})
