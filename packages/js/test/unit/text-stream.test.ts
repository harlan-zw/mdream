import type { ElementNode, MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, NodeEventEnter, NodeEventExit } from '../../src/index'
import { createPlugin } from '../../src/pluggable/plugin'
import { htmlToText, streamHtmlToText } from '../../src/text'

function chunkedStream(html: string, chunkSize: number): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < html.length; offset += chunkSize)
        controller.enqueue(html.slice(offset, offset + chunkSize))
      controller.close()
    },
  })
}

// Plugins receive the runtime state, so a plugin can see how much output the
// stream still holds when each text node arrives.
function bufferProbe() {
  const probe = { largest: 0 }
  const plugin = createPlugin({
    processTextNode(_node, state) {
      let size = 0
      for (const fragment of state.buffer)
        size += fragment.length
      if (size > probe.largest)
        probe.largest = size
      return undefined
    },
  })
  return { probe, plugin }
}

describe('text stream', () => {
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
