import type { MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
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
