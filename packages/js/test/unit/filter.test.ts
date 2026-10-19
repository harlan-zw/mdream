import type { ElementNode, Plugin } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { NodeEventExit, TAG_A, TAG_SPAN } from '../../src/const'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createPlugin } from '../../src/pluggable/plugin'
import { extractionPlugin } from '../../src/plugins/extraction'
import { filterPlugin } from '../../src/plugins/filter'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'
import { htmlToText, streamHtmlToText } from '../../src/text'

function chunked(html: string, width: number): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (let offset = 0; offset < html.length; offset += width)
        controller.enqueue(html.slice(offset, offset + width))
      controller.close()
    },
  })
}

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of chunks)
    output += chunk
  return output
}

describe('filter plugin', () => {
  it('skips an excluded subtree without hiding following siblings', () => {
    const html = '<div><nav><p>hidden <strong>nested</strong></p></nav><p>shown</p></div>'
    expect(htmlToMarkdown(html, {
      plugins: [filterPlugin({ exclude: ['nav'] })],
    })).toBe('shown')
  })

  it('propagates hidden styles through nested elements', () => {
    const html = '<div style="display:none"><p>hidden <strong>nested</strong></p></div><p>shown</p>'
    expect(htmlToMarkdown(html, {
      plugins: [filterPlugin()],
    })).toBe('shown')
  })

  // 40 was TAG_FORM, which v1 code passed in place of the tag name.
  it.each(['include', 'exclude'] as const)('rejects a tag id in %s', (key) => {
    const create = () => filterPlugin({ [key]: ['nav', 40 as unknown as string] })
    expect(create).toThrow(TypeError)
    expect(create).toThrow(`filterPlugin takes \`${key}\` entries as strings. Pass the tag name or a CSS selector, such as 'form'.`)
  })

  // The splitter's event wrapper drops the plugin result, so the skip has to
  // reach the parser through the text node itself.
  it('uses the link label when the filter hides all link text', async () => {
    const html = '<main><p><a href="/cart" aria-label="Cart"><span hidden>🛒</span></a></p></main>'
    const options = { plugins: [filterPlugin()] }
    expect(htmlToMarkdown(html, options)).toBe('[Cart](/cart)')
    expect(htmlToMarkdownSplitChunks(html, { ...options, chunkSize: 1000 }).map(chunk => chunk.content).join('')).toBe('[Cart](/cart)')
    for (let width = 1; width <= html.length; width++)
      expect(await collect(streamHtmlToMarkdown(chunked(html, width), options)), `width=${width}`).toBe('[Cart](/cart)')
  })

  it('uses the link label when a hook plugin skips all link text', () => {
    const plugins = [createPlugin({
      processTextNode: node => node.parent?.tagId === TAG_SPAN ? { content: '', skip: true } : undefined,
    })]
    expect(htmlToMarkdown('<p><a href="/cart" aria-label="Cart"><span>🛒</span></a></p>', { plugins })).toBe('[Cart](/cart)')
    expect(htmlToMarkdown('<p><a href="/cart" aria-label="Cart"><span>🛒</span>Go</a></p>', { plugins })).toBe('[Go](/cart)')
  })

  // As in Rust, that label is output only: extraction, the splitter and other
  // hooks see the link as they did before it had one.
  it('keeps the link label out of extraction', () => {
    const extract = (html: string, plugins: Plugin[], selector: string) => {
      const found: string[] = []
      const markdown = htmlToMarkdown(html, { plugins: [...plugins, extractionPlugin({ [selector]: element => found.push(element.textContent) })] })
      return { markdown, found }
    }
    expect(extract('<p><a href="/x" aria-label="L"><span hidden>x</span></a></p>', [filterPlugin()], 'p'))
      .toEqual({ markdown: '[L](/x)', found: [''] })
    expect(extract('<div><a href="/x" aria-label="L"><span>x</span></a></div>', [filterPlugin({ include: ['a'], processChildren: false })], 'a'))
      .toEqual({ markdown: '[L](/x)', found: ['x'] })
    // A link that is itself excluded or skipped takes no label.
    expect(extract('<p>The <a href="/wiki/Cat" title="Cat">cat</a> sat.</p>', [filterPlugin({ include: ['p'], processChildren: false })], 'p'))
      .toEqual({ markdown: 'The  sat.', found: ['The cat sat.'] })
    expect(extract('<div><template><a href="/x" title="T">t</a></template> body</div>', [], 'div'))
      .toEqual({ markdown: 'body', found: ['tbody'] })
  })

  it('keeps the link label out of splitter headers', () => {
    const headers = (html: string, plugins: Plugin[]) => htmlToMarkdownSplitChunks(html, { plugins }).map(chunk => chunk.metadata.headers)
    expect(headers('<h2>Title <a href="#t" aria-label="Permalink"><span hidden>#</span></a></h2><p>body</p>', [filterPlugin()]))
      .toEqual([{ h2: 'Title #' }])
    expect(headers('<h2>Setup <a class="header-anchor" href="#setup" aria-label="Permalink to &quot;Setup&quot;">&#8203;</a></h2><p>Install it.</p>', [filterPlugin({ exclude: ['.header-anchor'] })]))
      .toEqual([{ h2: 'Setup ​' }])
  })

  it('counts no hidden text in links that are excluded or skipped', () => {
    const counts: unknown[] = []
    const plugins = [filterPlugin({ exclude: ['nav'] }), createPlugin({
      beforeNodeProcess({ type, node }) {
        if (type === NodeEventExit && (node as ElementNode).tagId === TAG_A)
          counts.push((node as ElementNode).hiddenTextNodes)
      },
    })]
    const html = '<nav><a href="/x" aria-label="L"><span>x</span></a></nav><template><a href="/y" aria-label="M"><span>y</span></a></template><p>body</p>'
    expect(htmlToMarkdown(html, { plugins })).toBe('body')
    expect(counts).toStrictEqual([undefined, undefined])
  })

  it('keeps the link label out of other hooks', () => {
    const seen: string[] = []
    const plugins = [filterPlugin(), createPlugin({
      processTextNode(node) {
        seen.push(node.value)
      },
    })]
    expect(htmlToMarkdown('<p>Go <a href="/cart" aria-label="Cart"><span hidden>🛒</span></a></p>', { plugins })).toBe('Go [Cart](/cart)')
    expect(seen).toEqual(['Go '])
  })

  it('adds no link label when a hook turns blank link text visible', async () => {
    const html = '<p><a href="/x" aria-label="Label"><span hidden>x</span> </a></p>'
    const hooks = [
      createPlugin({ processTextNode: node => node.value === ' ' ? { content: 'Visible', skip: false } : undefined }),
      createPlugin({
        processTextNode(node) {
          if (node.value === ' ')
            node.value = 'Visible'
        },
      }),
    ]
    const outputs = [
      [htmlToMarkdown, streamHtmlToMarkdown, '[Visible](/x)'],
      [htmlToText, streamHtmlToText, 'Visible'],
      [htmlToSafeHtml, streamHtmlToSafeHtml, '<p><a href="/x">Visible</a></p>'],
    ] as const
    for (const hook of hooks) {
      const options = { plugins: [filterPlugin(), hook] }
      for (const [convert, stream, expected] of outputs) {
        expect(convert(html, options)).toBe(expected)
        for (let width = 1; width <= html.length; width++)
          expect(await collect(stream(chunked(html, width), options)), `width=${width}`).toBe(expected)
      }
    }
    expect(htmlToSafeHtml('<h2><a href="/x" aria-label="Label"><span hidden>x</span> </a></h2><p>Body</p>', { plugins: [filterPlugin(), hooks[0]!] }))
      .toBe('<h2 id="visible"><a href="/x">Visible</a></h2><p>Body</p>')
  })

  // A plain empty link takes its label, so a link whose text hooks leave
  // blank takes it too, whether the hook skips, empties or blanks that text.
  it('uses the link label when hooks leave the link text blank', () => {
    const rewrite = (content: string) => createPlugin({ processTextNode: node => node.value === 'Go' ? { content, skip: false } : undefined })
    const skip = createPlugin({ processTextNode: node => node.value === 'Go' ? { content: '', skip: true } : undefined })
    const same = createPlugin({ processTextNode: node => ({ content: node.value, skip: false }) })
    expect(htmlToMarkdown('<p><a href="/x" aria-label="L"></a></p>')).toBe('[L](/x)')
    for (const html of ['<p><a href="/x" aria-label="L">Go</a></p>', '<p><a href="/x" aria-label="L"><span hidden>x</span>Go</a></p>']) {
      expect(htmlToMarkdown(html, { plugins: [filterPlugin(), skip] }), html).toBe('[L](/x)')
      expect(htmlToMarkdown(html, { plugins: [filterPlugin(), rewrite('')] }), html).toBe('[L](/x)')
      // The blank text stays ahead of the label, as after hidden content with no hook.
      expect(htmlToMarkdown(html, { plugins: [filterPlugin(), rewrite(' ')] }), html).toBe('[ L](/x)')
      expect(htmlToText(html, { plugins: [filterPlugin(), rewrite(' ')] }), html).toBe('L')
    }
    expect(htmlToMarkdown('<p><a href="/x" aria-label="L"><span hidden>x</span> </a></p>', { plugins: [filterPlugin(), same] })).toBe('[ L](/x)')
    expect(htmlToMarkdown('<p><a href="/x" aria-label="L">Go</a></p>', { plugins: [rewrite('Stop')] })).toBe('[Stop](/x)')
  })
})
