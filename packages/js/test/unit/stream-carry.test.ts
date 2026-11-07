import type { MdreamOptions } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'

// Every stream feeds the parser the bytes it held back plus the new chunk, so
// the total it feeds measures how much of a long run it scans again.
const fed = vi.hoisted(() => ({ length: 0 }))
vi.mock('../../src/parse', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/parse')>()
  return {
    ...actual,
    parseHtmlStream: (html: string, ...rest: [any, any]) => {
      fed.length += html.length
      return actual.parseHtmlStream(html, ...rest)
    },
  }
})

const { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } = await import('../../src/index')
const { htmlToText, streamHtmlToText } = await import('../../src/text')
const { htmlToSafeHtml, streamHtmlToSafeHtml } = await import('../../src/html')

const outputs = [
  ['markdown', htmlToMarkdown, streamHtmlToMarkdown],
  ['text', htmlToText, streamHtmlToText],
  ['html', htmlToSafeHtml, streamHtmlToSafeHtml],
] as const

async function streamed(convert: typeof streamHtmlToMarkdown, chunks: string[], options: Partial<MdreamOptions>): Promise<string> {
  const source = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of convert(source, options))
    output += chunk
  return output
}

function cut(html: string, size: number): string[] {
  const chunks: string[] = []
  for (let offset = 0; offset < html.length; offset += size)
    chunks.push(html.slice(offset, offset + size))
  return chunks
}

const plugins = () => ({ plugins: [createPlugin({ name: 'observer', onNodeEnter() {} })] })
const cdata = () => ({ tagOverrides: { '#cdata-section': { enter: '<', exit: '>' } } })

describe('stream carry', () => {
  // A run that reaches a chunk's end is kept parsed, so the next chunk does not
  // scan it again from its start: raw text a closing tag ends, an open CDATA
  // section or comment, and the text and HTML outputs too.
  it.each([
    ['spaces in a paragraph', '<p>x', ' ', 'y</p>', () => ({})],
    ['words in a textarea', '<textarea>', 'a ', '</textarea>', () => ({})],
    ['words in a title', '<title>', 'a ', '</title><p>x</p>', () => ({})],
    ['words in a style read by a plugin', '<style>', 'a ', '</style><p>x</p>', plugins],
    ['an open CDATA section', '<p><![CDATA[', 'a ', ']]></p>', cdata],
    ['an open CDATA section read by a plugin', '<p><![CDATA[', 'a ', ']]></p>', plugins],
    ['an open comment read by a plugin', '<p><!--', 'a ', '--></p>', plugins],
  ])('does not rescan %s on every chunk', async (_, open, unit, close, options) => {
    const html = `${open}${unit.repeat(16 * 1024)}${close}`
    for (const [name, convert, stream] of outputs) {
      const expected = convert(html, options())
      fed.length = 0
      expect(await streamed(stream, cut(html, 64), options()), name).toBe(expected)
      expect(fed.length, name).toBeLessThan(2 * html.length)
    }
  })

  // A closing sequence split across chunks still closes the construct, and one
  // that never completes leaves the same output as one-shot conversion.
  it.each([
    ['<textarea>a ]] </text</textarea >z', () => ({})],
    ['<textarea>a <b> &amp; é😀</TEXTAREA>z', () => ({})],
    ['<textarea>a b</textarea', () => ({})],
    ['<textarea>a b</textareax>c</textarea>z', () => ({})],
    ['<title>a </ti</title><p>b</p>', () => ({})],
    ['<style>a </styl</style><p>b</p>', plugins],
    ['<p>x<![CDATA[a]]b]]]>y</p>', cdata],
    ['<p>x<![CDATA[a ]] b', cdata],
    ['<p>x<![CDATA[a]]>y<![CDATA[]]>z</p>', plugins],
    ['<p>x<!--a--!>y<!-- b --->z</p>', plugins],
    ['<p>x<!--a -- b', plugins],
  ])('closes a construct split across chunks: %j', async (html, options) => {
    for (const [name, convert, stream] of outputs) {
      const expected = convert(html, options())
      for (let size = 1; size <= html.length; size++)
        expect(await streamed(stream, cut(html, size), options()), `${name} chunk size ${size}`).toBe(expected)
    }
  })
})
