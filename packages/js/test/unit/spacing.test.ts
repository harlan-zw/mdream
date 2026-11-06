import type { MarkdownState } from '../../src/markdown-processor'
import type { HandlerContext } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { clean } from '../../src/clean'
import { MAX_TAG_ID, TAG_DIV, TAG_LI } from '../../src/const'
import { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { tagHandlers } from '../../src/tags'

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

describe('inline whitespace', () => {
  it('restores a heading break when whitespace precedes an empty opener', async () => {
    const html = '<ul><li><h3>T</h3><strong></strong>x</li></ul>'
    const options = {
      plugins: [createPlugin({
        onNodeExit(element, state) {
          if (element.name === 'strong') {
            // Move whitespace before the opener, including its heading separator.
            const { buffer } = state as MarkdownState
            const index = buffer.length - 1
            buffer[index] = ` ${buffer[index]}`
          }
        },
      })],
    }
    const expected = '- ### T\n\n  x'
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `chunkSize=${width}`).toBe(expected)
    }
  })

  it('preserves whitespace between root-level inline siblings', () => {
    expect(htmlToMarkdown('<span>One</span> <span>Two</span>')).toBe('One Two')
    expect(htmlToMarkdown('<strong>One</strong>\n<strong>Two</strong>')).toBe('**One** **Two**')
    expect(htmlToMarkdown('<span>One</span> </bogus> <span>Two</span>')).toBe('One Two')
    expect(htmlToMarkdown('  <span>One</span>  ')).toBe('One')
    expect(htmlToMarkdown('<div>One</div> <div>Two</div>')).toBe('One\n\nTwo')
  })

  it('moves trailing whitespace outside inline delimiters', () => {
    expect(htmlToMarkdown('<div><strong><a href="http://xxx.yyy/">abc</a> </strong>def</div>'))
      .toBe('**[abc](http://xxx.yyy/)** def')
    expect(htmlToMarkdown('<p><strong><em>abc </em></strong>def</p>'))
      .toBe('***abc*** def')
  })

  it('preserves the separator when a closing tag is split across chunks', async () => {
    const html = '<div><strong><a href="http://xxx.yyy/">abc</a> </strong>def</div>'
    for (let split = 0; split <= html.length; split++) {
      const output = await streamConvert([html.slice(0, split), html.slice(split)])
      expect(output.trimEnd(), `split at byte ${split}`).toBe('**[abc](http://xxx.yyy/)** def')
    }
  })
})

describe('block element followed by inline sibling (#148)', () => {
  it.each(['```', '~~~'])('keeps normal block spacing for plugin output ending in %s', async (marker) => {
    const html = '<p>x<br></p><span>after</span>'
    const options = {
      plugins: [createPlugin({
        onNodeExit(node) {
          if (node.name === 'p')
            return marker
        },
      })],
    }
    const expected = `x  \n${marker}\nafter`
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 1; split < html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `split at ${split}`).toBe(expected)
    }
  })

  it('closes a trailing-blank <pre> fence before an inline link', () => {
    expect(htmlToMarkdown('<div><pre>a\nb\n\n</pre><a href="#x">link</a></div>'))
      .toBe('```\na\nb\n\n\n```\n\n[link](#x)')
  })

  it('does not glue the closing fence to a pilcrow link (xml2rfc case)', () => {
    const out = htmlToMarkdown('<div><pre>GET /hello.txt HTTP/1.1\n\n</pre><a href="#s" class="pilcrow">P</a></div>')
    expect(out).toContain('```\n\n[P](#s)')
  })

  it('separates a trailing-blank <pre> from following text', () => {
    expect(htmlToMarkdown('<div><pre>a\nb\n\n</pre>after</div>'))
      .toBe('```\na\nb\n\n\n```\n\nafter')
  })

  it('matches across every streaming chunk boundary', async () => {
    const html = '<div><pre>a\nb\n\n</pre><a href="#x">link</a></div>'
    const expected = htmlToMarkdown(html)
    for (let split = 0; split <= html.length; split++) {
      const output = await streamConvert([html.slice(0, split), html.slice(split)])
      expect(output.trimEnd(), `split at byte ${split}`).toBe(expected)
    }
  })
})

describe('unknown tags', () => {
  // Unknown elements are inline, as in the Rust engine: adjacent ones must not
  // gain a space between them.
  it('keeps adjacent unknown elements joined', async () => {
    const cases: [string, string][] = [
      ['<x-a>X</x-a><x-h>H</x-h><x-c>C</x-c>', 'XHC'],
      ['<p><foo>X</foo><bar>H</bar><baz>C</baz></p>', 'XHC'],
      ['<p>before <ex>foo</ex> after</p>', 'before foo after'],
      ['<p><ex>foo</ex>, bar</p>', 'foo, bar'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html), html).toBe(expected)
      expect(await streamConvert([html]), html).toBe(expected)
    }
  })
})

describe('div after a hash run in a list item', () => {
  it('reads at most seven hashes back from the end of the buffer', () => {
    // Only one to six hashes can be a bare heading marker, so a long retained
    // run must not be rescanned at every div.
    let reads = 0
    const run = {
      length: 100_000,
      charCodeAt: () => {
        reads++
        return 35
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', run], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(7)
  })

  it('reads the line before the marker once while divs leave it unchanged', () => {
    // The spaces before the marker must not be read again at every div.
    let reads = 0
    const text = `x${' '.repeat(10_000)}#`
    const entry = {
      length: text.length,
      charCodeAt: (index: number) => {
        reads++
        return text.charCodeAt(index)
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', entry], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    for (let i = 0; i < 100; i++)
      expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(3 * text.length)
  })

  it('reads a line split across entries once while divs leave it unchanged', () => {
    let reads = 0
    const spaces = {
      length: 10_000,
      charCodeAt: () => {
        reads++
        return 32
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- x', spaces, '#'], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    for (let i = 0; i < 100; i++)
      expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(3 * spaces.length)
  })

  it('reads a lead that reaches the buffer start once while divs leave it unchanged', () => {
    let reads = 0
    const text = `${'1'.repeat(10_000)}#`
    const entry = {
      length: text.length,
      charCodeAt: (index: number) => {
        reads++
        return text.charCodeAt(index)
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', entry], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    for (let i = 0; i < 100; i++)
      expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(3 * text.length)
  })

  it.each([
    ['without cleanup', undefined],
    ['with cleanup', { clean: clean() }],
  ])('keeps divs after empty inline fragments linear %s', (_, options) => {
    // Each `<span> </span>` leaves an empty fragment behind. Keying the check on
    // the buffer length would miss every div and rescan the lead each time, and
    // so would dropping the check at every element exit of the clean pass.
    const html = `<ul><li><pre>${'1'.repeat(2000)}#${'<span> </span><div></div>'.repeat(200)}</pre></li></ul>`
    const charCodeAt = vi.spyOn(String.prototype, 'charCodeAt')
    let reads = 0
    try {
      htmlToMarkdown(html, options)
      reads = charCodeAt.mock.calls.length
    }
    finally {
      charCodeAt.mockRestore()
    }
    expect(reads).toBeLessThan(4 * html.length)
  })

  it('separates a div after a list-item heading marker', () => {
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', '#'], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    expect(tagHandlers[TAG_DIV]!.enter!(context)).toBe('\n\n  ')
  })
})

describe('div heading marker after buffer rewrites', () => {
  it.each([
    [
      '<ul><li><dl><blockquote><ul><li><h1></h1><div></div></li></ul></blockquote><span>#</span><div>y</div></dl></li></ul>',
      '- <dl>\n  > - ## y</dl>',
    ],
    [
      '<ul><li><blockquote><ul><li><span>1</span><span>#</span><div></div></li></ul></blockquote><span><h1></h1><div></div><br>y</span></li></ul>',
      '- \n  > - 1#\n\n  #\n\n    \n  y',
    ],
  ])('keeps one-shot and streamed spacing correct after rewriting a line', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    expect(await streamConvert(Array.from(html))).toBe(expected)
  })
})

describe('empty captions after a heading in a list item', () => {
  it.each([
    ['<figcaption></figcaption>', ''],
    ['<figure><figcaption></figcaption></figure>', ''],
    // An empty inline splits the run across fragments.
    ['<figcaption></figcaption>', '<b></b>&#32;'],
    // A marker after the run sends the check through the spaces before it.
    ['<figcaption></figcaption>', '-&#32;'],
  ])('reads the heading line once past %s with %j after the run', (caption, tail) => {
    // Each empty caption hands the heading break back and checks the heading's
    // line again; the spaces ending that line must not be read at every exit.
    const html = `<ul><li><h3>T${'&#32;'.repeat(2000)}${tail}</h3>${caption.repeat(200)}x</li></ul>`
    const charCodeAt = vi.spyOn(String.prototype, 'charCodeAt')
    let output = ''
    let reads = 0
    try {
      output = htmlToMarkdown(html)
      reads = charCodeAt.mock.calls.length
    }
    finally {
      charCodeAt.mockRestore()
    }
    expect(output.endsWith('\n\n  x')).toBe(true)
    expect(reads).toBeLessThan(html.length * 4)
  })
})
