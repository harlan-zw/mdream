import type { MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createPlugin, extractionPlugin, frontmatterPlugin } from '../../src/plugins'

async function convertStream(html: string, chunkSize: number, options: MdreamOptions = {}) {
  let offset = 0
  const input = new ReadableStream<string>({
    pull(controller) {
      if (offset < html.length) {
        controller.enqueue(html.slice(offset, offset + chunkSize))
        offset += chunkSize
      }
      else {
        controller.close()
      }
    },
  }, { highWaterMark: 0 })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(input, options))
    output += chunk
  return output
}

describe('incremental quote streams', () => {
  it.each([1, 4])('emits settled lines before a depth %i quote closes', async (depth) => {
    const open = '<blockquote>'.repeat(depth)
    const close = '</blockquote>'.repeat(depth)
    const body = '<p>A streamed paragraph.</p>'.repeat(512)
    const expected = htmlToMarkdown(open + body.repeat(4) + close)
    let pulled = 0
    let quoteClosed = false
    let emittedBeforeClose = ''
    const input = new ReadableStream<string>({
      pull(controller) {
        if (pulled === 0) {
          controller.enqueue(open)
        }
        else if (pulled <= 4) {
          controller.enqueue(body)
        }
        else {
          quoteClosed = true
          controller.enqueue(close)
          controller.close()
        }
        pulled++
      },
    }, { highWaterMark: 0 })
    let output = ''
    for await (const chunk of streamHtmlToMarkdown(input)) {
      output += chunk
      if (!quoteClosed)
        emittedBeforeClose += chunk
    }
    expect(output).toBe(expected)
    expect(emittedBeforeClose).toContain('A streamed paragraph.')
  })

  it.each([1, 4])('preserves metadata and bounded output chunks at quote depth %i', async (depth) => {
    const open = '<blockquote>'.repeat(depth)
    const close = '</blockquote>'.repeat(depth)
    const body = '<p>A streamed paragraph.</p>'.repeat(512)
    const html = `<head><title>Page</title></head>${open}${body.repeat(8)}${close}`
    for (const wrapWidth of [0, 12, 40]) {
      let paragraphs = 0
      const quoteTexts: string[] = []
      const metadata: Record<string, string>[] = []
      const options = {
        wrapWidth,
        plugins: [
          frontmatterPlugin({ onExtract: result => metadata.push(result) }),
          extractionPlugin({
            p: () => paragraphs++,
            blockquote: node => quoteTexts.push(node.textContent),
          }),
        ],
      }
      let offset = 0
      const input = new ReadableStream<string>({
        pull(controller) {
          if (offset < html.length) {
            controller.enqueue(html.slice(offset, offset + body.length))
            offset += body.length
          }
          else {
            controller.close()
          }
        },
      }, { highWaterMark: 0 })
      let output = ''
      let maximumChunk = 0
      for await (const chunk of streamHtmlToMarkdown(input, options)) {
        output += chunk
        maximumChunk = Math.max(maximumChunk, chunk.length)
      }
      expect(output).toBe(htmlToMarkdown(html, { wrapWidth, plugins: [frontmatterPlugin()] }))
      expect(maximumChunk).toBeLessThan(64 * 1024)
      expect(paragraphs).toBe(4096)
      expect(quoteTexts).toEqual(Array.from({ length: depth }, () => 'A streamed paragraph.'.repeat(4096)))
      expect(metadata).toEqual([{ title: 'Page' }])
    }
  })

  it('preserves mutable owners and distinct nested quote starts after flushing', async () => {
    const paragraphs = '<p>prefix paragraph</p>'.repeat(512)
    const bodies = [
      `${paragraphs}<blockquote>${paragraphs}</blockquote><p>tail</p>`,
      `${paragraphs}<ul><li>item<blockquote>${paragraphs}</blockquote>tail</li></ul>`,
      `<ul><li>item${paragraphs}<blockquote>${paragraphs}</blockquote>tail</li></ul>`,
      `${paragraphs}<pre><code>one\n\n\`\`\`\nfour</code></pre><p>tail</p>`,
      `${paragraphs}<p><a href='/x'>link <em>text</em></a><code>a\`b</code></p><p>tail</p>`,
      `${paragraphs}<figure><figcaption><p>caption</p></figcaption></figure><p>tail</p>`,
      `${paragraphs}<table><tr><th>a</th><th>b</th></tr><tr><td>x</td><td>y</td></tr></table><p>tail</p>`,
      `${paragraphs}<details><summary>title</summary><p>body</p></details><p>tail</p>`,
      `${paragraphs}<blockquote><p></p></blockquote><p>tail</p>`,
    ]
    for (const body of bodies) {
      const html = `<blockquote>${body}</blockquote><head><title>Late</title></head><p>after</p>`
      for (const options of [{}, { wrapWidth: 12 }, { clean: clean({ emptyLinks: true, redundantLinks: true }) }, { clean: clean({ fragments: true }) }]) {
        const expected = htmlToMarkdown(html, options)
        for (const chunkSize of [31, 4096, 8192])
          expect(await convertStream(html, chunkSize, options), `chunk=${chunkSize}, body=${bodies.indexOf(body)}`).toBe(expected)
      }
    }
  })

  it('preserves repeated flushes across mixed content and chunk boundaries', async () => {
    const paragraph = '<p>Words with &amp; entities, [brackets], and café.</p>'
    const sections = [
      `<blockquote>${paragraph.repeat(512)}</blockquote>`,
      `<ul><li>item${paragraph.repeat(256)}<blockquote>${paragraph.repeat(256)}</blockquote>tail</li></ul>`,
      `<pre><code>first\n\n\`\`\`\nlast</code></pre>${paragraph.repeat(256)}`,
      `<figure><figcaption>caption <em>text</em></figcaption></figure>${paragraph.repeat(256)}`,
      `<table><tr><th>one</th><th>two</th></tr><tr><td>a</td><td>b</td></tr></table>${paragraph.repeat(256)}`,
      `<p><a href='/a'><strong>linked</strong> text</a> <code>a\`b</code></p>${paragraph.repeat(256)}`,
    ]
    let seed = 1234567
    const next = () => {
      seed = Math.imul(seed, 1664525) + 1013904223 | 0
      return seed >>> 0
    }
    for (let run = 0; run < 12; run++) {
      let html = '<head><title>Page</title></head><blockquote><blockquote>'
      for (let index = 0; index < 6; index++)
        html += sections[next() % sections.length]
      html += '</blockquote></blockquote><p>after</p>'
      const options = {
        wrapWidth: run % 2 ? 40 : 0,
        plugins: [createPlugin({
          processTextNode: node => ({ content: node.value, skip: false }),
        })],
      }
      const expected = htmlToMarkdown(html, options)
      let offset = 0
      const input = new ReadableStream<string>({
        pull(controller) {
          if (offset >= html.length) {
            controller.close()
            return
          }
          const size = [1, 17, 31, 97, 4096, 8192][next() % 6]!
          controller.enqueue(html.slice(offset, offset + size))
          offset += size
        },
      }, { highWaterMark: 0 })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `run=${run}`).toBe(expected)
    }
  })

  it('retains removable quote tails and raw HTML context after settled lines', async () => {
    const prefix = '<p>settled paragraph</p>'.repeat(512)
    const cases = [
      `<blockquote>${prefix}<br> \n\t</blockquote>`,
      `<blockquote><ul><li>${prefix}<br> </li></ul></blockquote>`,
      `<blockquote>${prefix}<blockquote><p></p></blockquote></blockquote>`,
      `<blockquote><blockquote>${prefix}<br> </blockquote></blockquote>`,
      `<figure><figcaption><blockquote>${prefix}</blockquote><br><a href='/x'></a></figcaption></figure>`,
      `<blockquote>${prefix}<figcaption><br> <a href='/x'></a> </figcaption></blockquote>`,
      `<blockquote>${prefix}<details><summary>title</summary><p>* 1. [text]</p><p>&lt;x&gt;</p></details><p>* after</p></blockquote>`,
      `<blockquote>${prefix}<details><p>raw</p><blockquote><p>* nested</p></blockquote></details><p>1. after</p></blockquote>`,
      `<blockquote>${prefix}<h2>title #<em></em></h2><a href='/x'></a><strong></strong><p>after</p></blockquote>`,
      `<blockquote>${prefix}<pre><code>first\n\`\`\`\nlast</code></pre></blockquote>`,
      `<blockquote>${prefix}<div><blockquote><p>inner</p></blockquote></div></blockquote>`,
      `<blockquote>${prefix}<figcaption><span>caption</span><blockquote><p>nested</p></blockquote></figcaption></blockquote>`,
    ]
    for (const html of cases) {
      for (const options of [{}, { wrapWidth: 12 }, { clean: clean({ emptyLinkText: true, emptyLinks: true }) }]) {
        const expected = htmlToMarkdown(html, options)
        for (const chunkSize of [17, 97, 4096])
          expect(await convertStream(html, chunkSize, options), `case=${cases.indexOf(html)}, chunk=${chunkSize}`).toBe(expected)
      }
    }
  })

  it('preserves a long line while later completed lines become streamable', async () => {
    const longLine = `<span>${'x'.repeat(1024)}</span>`.repeat(512)
    const html = `<blockquote>${longLine}<p>after</p><p>settled</p></blockquote>`
    expect(await convertStream(html, 4096)).toBe(htmlToMarkdown(html))
  })

  it('preserves late head metadata after quote output has streamed', async () => {
    const html = `<blockquote>${'<p>settled paragraph</p>'.repeat(2048)}</blockquote><head><title>Late</title><meta name='description' content='Later metadata'></head><p>after</p>`
    const metadata: Record<string, string>[] = []
    let paragraphs = 0
    const output = await convertStream(html, 4096, {
      plugins: [
        frontmatterPlugin({ onExtract: result => metadata.push(result) }),
        extractionPlugin({ p: () => paragraphs++ }),
      ],
    })
    expect(output).toBe(htmlToMarkdown(html, { plugins: [frontmatterPlugin()] }))
    expect(metadata).toEqual([{ title: 'Late', description: 'Later metadata' }])
    expect(paragraphs).toBe(2049)
  })
})
