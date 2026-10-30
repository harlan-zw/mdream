import { ReadableStream } from 'node:stream/web'
import { describe, expect, it, vi } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

const RE_BOLD_TEXT = /\*\*bold text\*\*/
const RE_LINK_WITH_URL = /\[Link text\]\(https:\/\/example\.com\)/

const LINK_SPACE_CASES: [string, string][] = [
  [
    '<a href="x"><ul><li></li></ul></a>',
    '[-](x)',
  ],
  [
    '<ul><li><a href="x"><ul><li></li></ul></a><ul><li># h</li></ul></li></ul>',
    '- [  -](x)\n  - \\# h',
  ],
  [
    '<a href="x"><ul><li></li><li></li></ul></a>',
    '[- -](x)',
  ],
  [
    '<a href="x"><ol start="10"><li></li></ol></a>',
    '[10.](x)',
  ],
  [
    '<a href="x"><ul><li><ul><li></li></ul></li></ul></a>',
    '[-   -](x)',
  ],
  [
    '<a href="x"><ul><li>one</li><li>two</li></ul></a>',
    '[- one - two](x)',
  ],
  [
    '<a href="x">before<ul><li></li></ul>after</a>',
    '[before - after](x)',
  ],
  [
    '<a href="x">text <span></span></a>tail',
    '[text](x) tail',
  ],
  [
    '<a href="x" title="Title"><ul><li></li></ul></a>tail',
    '[- Title](x)tail',
  ],
  [
    '<a href="x"><ul><li></li></ul></a><em>tail</em>',
    '[-](x) *tail*',
  ],
  [
    '<a href="x"><img src="i" alt="A"> <span></span></a>tail',
    '[![A](i)](x) tail',
  ],
  [
    '<a href="x" title="text">text <span></span></a>',
    '[text](x)',
  ],
  [
    '<a href="x" title="Title">text <span></span></a>',
    '[text](x "Title")',
  ],
  [
    '<a href="x"> </a>tail',
    '[](x)tail',
  ],
  [
    '<code><a href="x"><ul><li></li></ul></a></code>',
    '`[- ](x)`',
  ],
  [
    '<a href="x"><ul><li><code>a </code></li></ul></a>',
    '[- `a`](x)',
  ],
  [
    '<details><a href="x"><ul><li></li></ul></a></details>',
    '<details><a href="x">- </a></details>',
  ],
]

const BYTE_PARITY_CASES: Array<string | { html: string, options: { plugins: { tagOverrides: Record<string, string> } } }> = [
  ...LINK_SPACE_CASES.map(([html]) => html),
  '<ul><li>a</li><script>hidden</script><li>b</li></ul>',
  '<ul><li>a</li><style>hidden</style><li>b</li></ul>',
  '<ul><li>a</li><noscript>hidden</noscript><li>b</li></ul>',
  '<ul><li>a</li><template>hidden</template><li>b</li></ul>',
  ...[
    '<blockquote>x</blockquote><p>tail</p>',
    '<BLOCKQUOTE>x</BLOCKQUOTE><p>tail</p>',
    '<blockquote>x</div>tail</blockquote><p>end</p>',
    '<div>x</blockquote>tail</div><p>end</p>',
    '<blockquote><p>a</p><p>b</p></blockquote>',
    '<blockquote><div>x</div>tail</blockquote>',
    '<ul><li><blockquote>x</blockquote></li></ul>',
  ].map(html => ({ html, options: { plugins: { tagOverrides: { blockquote: 'div' } } } })),
  ...([
    ['<blockquote>x</blockquote><p>tail</p>', 'blockquote', 'script'],
    ['<blockquote>x</blockquote><p>tail</p>', 'blockquote', 'style'],
    ['<blockquote>x</blockquote><p>tail</p>', 'blockquote', 'textarea'],
    ['<script><b>x</b></script><p>tail</p>', 'script', 'div'],
  ] as const).map(([html, source, target]) => ({ html, options: { plugins: { tagOverrides: { [source]: target } } } })),
  '<p>aaaaaaaaaa --</p>',
  '<p>aaaaaaaaaa ==</p>',
  '<p>aaaaaaaaaa -</p>',
  '<p>aaaaaaaaaa ---</p>',
  '<p>aaaaaaaaaa =</p>',
  '<p>aaaaaaaaaa --word</p>',
  '<p>aaaaaaaaaa ==word</p>',
  '<div>Alpha</div>',
  '<div>Alpha</div><div>Beta</div>',
  '<div>Alpha</div><em></em>',
  '<div>Alpha</div><em></em><div>Beta</div>',
  '<pre><code>alpha\n\n</code></pre>',
  '<p>use <code>a`b</code> here</p>',
  '<a href="https://example.com">https://example.com</a>',
  '<p>answered on <span>03 Apr 2013,&nbsp;</span><span>09:53 AM</span></p>',
  // `<` before a non-letter is text, so a chunk can split between the `<` and
  // the byte that decides it is not a tag.
  '<p>I <3 Rust</p>',
  '<p>5 <10 and 10> 5</p>',
  '<p>< </p>',
  '<p>a <?b>c</p>',
  '<3',
  '<3<div',
  '<>',
  // String chunks split the UTF-16 surrogate pair at width 1.
  '<p>🎉</p>',
]

const BYTE_PARITY_OVERRIDE_CASES = [
  ['<p>a<sup><span> <span>2</span></span></sup>z</p>', 'sup', '**', 'a**2**z'],
  ['<p>a<sup><span><span> <span>2</span></span></span></sup>z</p>', 'sup', '**', 'a**2**z'],
  ['<p>a<sup><span></span><span> <span>2</span></span></sup>z</p>', 'sup', '**', 'a**2**z'],
  ['<p>a<sup><svg></svg><span> <span>2</span></span></sup>z</p>', 'sup', '**', 'a**2**z'],
  ['<p>a<sup><em> <span>2</span></em></sup>z</p>', 'sup', '**', 'a***2***z'],
  ['<p>a<em>x </em><br>b</p>', 'br', '', 'a*x* b'],
] as const

it.each(BYTE_PARITY_OVERRIDE_CASES)('preserves override bytes at every split: %s', async (html, tag, marker, expected) => {
  const options = { plugins: { tagOverrides: { [tag]: { enter: marker, exit: marker } } } }
  for (const { engine } of engines) {
    expect(htmlToMarkdown(html, { ...options, engine })).toBe(expected)
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of streamHtmlToMarkdown(input, { ...options, engine }))
        actual += chunk
      expect(actual, `split=${split}`).toBe(expected)
    }
  }
})

describe('cross-engine streaming byte parity', () => {
  it.each(LINK_SPACE_CASES)('trims link label spaces at every split: %s', async (html, expected) => {
    for (const { engine, name } of engines) {
      for (let split = 0; split <= html.length; split++) {
        const htmlStream = new ReadableStream<string>({
          start(controller) {
            controller.enqueue(html.slice(0, split))
            controller.enqueue(html.slice(split))
            controller.close()
          },
        })
        let streamed = ''
        for await (const chunk of engine.streamHtmlToMarkdown(htmlStream))
          streamed += chunk
        expect(streamed, `engine=${name} split=${split}`).toBe(expected)
      }
    }
  })

  it.each(BYTE_PARITY_CASES)('matches one-shot output at every chunk width: %s', async (testCase) => {
    const { html, options } = typeof testCase === 'string' ? { html: testCase, options: undefined } : testCase
    const engineOutputs: string[] = []

    for (const { engine, name } of engines) {
      const expected = engine.htmlToMarkdown(html, options)
      engineOutputs.push(expected)

      for (let chunkSize = 1; chunkSize <= html.length; chunkSize++) {
        const htmlStream = new ReadableStream<string>({
          start(controller) {
            for (let offset = 0; offset < html.length; offset += chunkSize)
              controller.enqueue(html.slice(offset, offset + chunkSize))
            controller.close()
          },
        })
        let streamed = ''
        for await (const chunk of engine.streamHtmlToMarkdown(htmlStream, options))
          streamed += chunk
        expect(streamed, `engine=${name} chunkSize=${chunkSize}`).toBe(expected)
      }
      for (let split = 1; split < html.length; split++) {
        const input = new ReadableStream<string>({
          start(controller) {
            controller.enqueue(html.slice(0, split))
            controller.enqueue(html.slice(split))
            controller.close()
          },
        })
        let streamed = ''
        for await (const chunk of engine.streamHtmlToMarkdown(input, options))
          streamed += chunk
        expect(streamed, `engine=${name} split=${split}`).toBe(expected)
      }
    }

    expect(engineOutputs[1]).toBe(engineOutputs[0])
  })
})

describe.each(engines)('hTML to Markdown Streaming $name', (engineConfig) => {
  describe('basic Stream Functionality', () => {
    it('converts a valid HTML stream to markdown chunks', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<h1>Title</h1>')
          controller.enqueue('<p>Paragraph</p>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      // Check for expected content
      const combinedResult = result.join('')
      expect(combinedResult).toContain('# Title')
      expect(combinedResult).toContain('Paragraph')

      // Verify the heading is before the paragraph
      const titleIndex = combinedResult.indexOf('# Title')
      const paragraphIndex = combinedResult.indexOf('Paragraph')
      expect(titleIndex).toBeLessThan(paragraphIndex)
    })

    it('throws an error when null is passed as the HTML stream', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      await expect(async () => {
        for await (const _ of streamHtmlToMarkdown(null, { engine })) {
          // no-op
        }
      }).rejects.toThrow('Invalid HTML stream provided')
    })

    it('handles an empty HTML stream gracefully', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      expect(result).toEqual([])
    })

    it('releases the reader lock after processing', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: null }),
        releaseLock: vi.fn(),
      }
      const htmlStream = { getReader: () => mockReader } as any

      for await (const _ of streamHtmlToMarkdown(htmlStream, { engine })) {
        // no-op
      }

      expect(mockReader.releaseLock).toHaveBeenCalled()
    })

    it('correctly handles binary content', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      // Create an HTML stream with binary data
      const encoder = new TextEncoder()
      const part1 = encoder.encode('<h1>Encoded')
      const part2 = encoder.encode(' title</h1>')

      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue(part1)
          controller.enqueue(part2)
          controller.close()
        },
      })

      // Collect results
      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      // Check that the binary content was correctly decoded and processed
      const combined = result.join('')
      expect(combined).toContain('# Encoded title')
    })

    it('preserves multibyte rewrites one input byte at a time', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<blockquote>”<br>\n</><p>🎉'
      const bytes = new TextEncoder().encode(html)
      const htmlStream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let index = 0; index < bytes.length; index++)
            controller.enqueue(bytes.subarray(index, index + 1))
          controller.close()
        },
      })

      let streamed = ''
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine }))
        streamed += chunk

      expect(streamed).toContain('”')
      expect(streamed).toContain('🎉')
    })
  })

  describe('partial Chunks and Streaming', () => {
    it('processes partial HTML chunks correctly', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<h1>Title')
          controller.enqueue('</h1><p>Par')
          controller.enqueue('agraph</p>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('# Title')
      expect(combinedResult).toContain('Paragraph')

      // Count lines - our output should have at least 2 non-empty lines
      const lines = combinedResult.trim().split('\n').filter(Boolean)
      expect(lines.length).toBeGreaterThanOrEqual(2)
    })

    it('handles HTML tags split across multiple chunks', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<h1>Title')
          controller.enqueue(' with split')
          controller.enqueue('</h1>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('# Title')
      expect(combinedResult).toContain('with split')
    })

    it('processes nested HTML elements split across chunks correctly', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<div><p>First ')
          controller.enqueue('paragraph with <strong>')
          controller.enqueue('bold text</strong></p>')
          controller.enqueue('<p>Second paragraph</p></div>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('First paragraph with')
      expect(combinedResult).toContain('bold text')
      expect(combinedResult).toContain('Second paragraph')
      expect(combinedResult).toMatch(RE_BOLD_TEXT)
    })

    it('handles HTML with attributes split across chunks', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<a href="https://')
          controller.enqueue('example.com">')
          controller.enqueue('Link text</a>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('Link text')
      expect(combinedResult).toMatch(RE_LINK_WITH_URL)
    })

    it('processes complex HTML structures with multiple levels', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<div><h2>Section')
          controller.enqueue('</h2><ul><li>Item')
          controller.enqueue(' 1</li><li>Item 2')
          controller.enqueue('</li></ul><p>Final ')
          controller.enqueue('text</p></div>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('## ')
      expect(combinedResult).toContain('Section')
      expect(combinedResult).toContain('- Item')
      expect(combinedResult).toContain('Item 2')
      expect(combinedResult).toContain('Final')

      const lines = combinedResult.split('\n').filter(line => line.trim().length > 0)
      expect(lines.some(line => line.trim().startsWith('##'))).toBe(true)
      expect(lines.some(line => line.trim().startsWith('-'))).toBe(true)
      expect(lines.some(line => line.includes('Final text'))).toBe(true)
    })

    it('handles unclosed span tags in nested structures', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<div><h3>Section with <span>unclosed span')
          controller.enqueue('</h3><p>Paragraph with <em>emphasis</em> and <span>')
          controller.enqueue('another unclosed span</p><ul><li>List item <span>with')
          controller.enqueue(' unclosed span</li><li>Another item</li></ul></div>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('###')
      expect(combinedResult).toContain('Section with')
      expect(combinedResult).toContain('unclosed span')
      expect(combinedResult).toContain('Paragraph with')
      expect(combinedResult).toContain('*emphasis*')
      expect(combinedResult).toContain('List item')
      expect(combinedResult).toContain('Another item')

      const hasHeader = combinedResult.includes('###')
      const hasEmphasis = combinedResult.includes('*emphasis*')
      const hasList = combinedResult.includes('- List')
      expect(hasHeader && hasEmphasis && hasList).toBe(true)
    })
  })

  describe('buffer Control', () => {
    it('handles buffering and release of content', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<header><nav><ul><li><a href="#">Home</a></li></ul></nav></header>')
          controller.enqueue('<main><h1>Main Content</h1><p>This is the main content.</p></main>')
          controller.enqueue('<footer><p>Footer</p></footer>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream, { engine })) {
        result.push(chunk)
      }

      const markdown = result.join('')
      expect(markdown).toContain('# Main Content')
      expect(markdown).toContain('This is the main content.')
    })
  })
})

describe('scout9_wrap_setext_boundary streaming', () => {
  it.each([
    [
      '<p>aaaaaaaaaa --</p>',
      'aaaaaaaaaa --',
    ],
    [
      '<p>aaaaaaaaaa ==</p>',
      'aaaaaaaaaa ==',
    ],
    [
      '<p>aaaaaaaaaa -</p>',
      'aaaaaaaaaa -',
    ],
    [
      '<p>aaaaaaaaaa ---</p>',
      'aaaaaaaaaa ---',
    ],
    [
      '<p>aaaaaaaaaa =</p>',
      'aaaaaaaaaa =',
    ],
    [
      '<p>aaaaaaaaaa --word</p>',
      'aaaaaaaaaa\n--word',
    ],
    [
      '<p>aaaaaaaaaa ==word</p>',
      'aaaaaaaaaa\n==word',
    ],
  ])('matches every split and chunk width: %s', async (html, expected) => {
    for (const { engine, name } of engines) {
      const options = { wrapWidth: 10 }
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      const chunks: string[][] = []
      for (let width = 1; width <= html.length; width++) {
        const parts: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          parts.push(html.slice(offset, offset + width))
        chunks.push(parts)
      }
      for (let split = 1; split < html.length; split++)
        chunks.push([html.slice(0, split), html.slice(split)])
      for (const parts of chunks) {
        const stream = new ReadableStream<string>({ start(controller) {
          for (const part of parts)
            controller.enqueue(part)
          controller.close()
        } })
        let actual = ''
        for await (const part of engine.streamHtmlToMarkdown(stream, options))
          actual += part
        expect(actual, name).toBe(expected)
      }
    }
  })
})

describe('scout9_excluded_list_spacing streaming', () => {
  it.each([
    [
      '<ul><li>a</li><script>hidden</script><li>b</li></ul>',
      '- a\n- b',
    ],
    [
      '<ul><li>a</li><style>hidden</style><li>b</li></ul>',
      '- a\n- b',
    ],
    [
      '<ul><li>a</li><noscript>hidden</noscript><li>b</li></ul>',
      '- a\n- b',
    ],
    [
      '<ul><li>a</li><template>hidden</template><li>b</li></ul>',
      '- a\n- b',
    ],
  ])('matches every split and chunk width: %s', async (html, expected) => {
    for (const { engine, name } of engines) {
      const options = {}
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      const chunks: string[][] = []
      for (let width = 1; width <= html.length; width++) {
        const parts: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          parts.push(html.slice(offset, offset + width))
        chunks.push(parts)
      }
      for (let split = 1; split < html.length; split++)
        chunks.push([html.slice(0, split), html.slice(split)])
      for (const parts of chunks) {
        const stream = new ReadableStream<string>({ start(controller) {
          for (const part of parts)
            controller.enqueue(part)
          controller.close()
        } })
        let actual = ''
        for await (const part of engine.streamHtmlToMarkdown(stream, options))
          actual += part
        expect(actual, name).toBe(expected)
      }
    }
  })
})

describe('scout9_excluded_list_spacing option streaming', () => {
  it.each(['alias', 'filter', 'spacing'])('preserves %s controls at every split and chunk width', async (kind) => {
    for (const { engine, name } of engines) {
      const html = kind === 'alias'
        ? '<ul><li>a</li><x-text>visible</x-text><li>b</li></ul>'
        : kind === 'filter'
          ? '<ul><li>a</li><div class=hide>hidden</div><li>b</li></ul>'
          : '<ul><li>a</li><script>visible</script><li>b</li></ul>'
      const options: Parameters<typeof engine.htmlToMarkdown>[1] = kind === 'alias'
        ? { plugins: { tagOverrides: { 'x-text': 'em' } } }
        : kind === 'filter'
          ? { plugins: { filter: { exclude: ['.hide'] } } }
          : { plugins: { tagOverrides: { script: { spacing: [2, 2] } } } }
      const expected = kind === 'alias' ? '- a*visible*\n- b' : kind === 'filter' ? '- a\n- b' : '- a\n\n- b'
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      const chunks: string[][] = []
      for (let width = 1; width <= html.length; width++) {
        const parts: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          parts.push(html.slice(offset, offset + width))
        chunks.push(parts)
      }
      for (let split = 1; split < html.length; split++)
        chunks.push([html.slice(0, split), html.slice(split)])
      for (const parts of chunks) {
        const stream = new ReadableStream<string>({ start(controller) {
          for (const part of parts)
            controller.enqueue(part)
          controller.close()
        } })
        let actual = ''
        for await (const part of engine.streamHtmlToMarkdown(stream, options))
          actual += part
        expect(actual, name).toBe(expected)
      }
    }
  })
})
describe('paragraph after empty nested quote', () => {
  it.each(engines)('stays in the parent item for $name at every split and chunk width', async ({ engine }) => {
    const html = '<ul><li>x<ul><li><blockquote><br></blockquote></li></ul><p>y</p></li></ul>'
    const expected = '- x\n\n  - \n  \n\n  y'
    expect(engine.htmlToMarkdown(html)).toBe(expected)
    const chunks: string[][] = []
    for (let width = 1; width <= html.length; width++) {
      const parts: string[] = []
      for (let offset = 0; offset < html.length; offset += width)
        parts.push(html.slice(offset, offset + width))
      chunks.push(parts)
    }
    for (let split = 1; split < html.length; split++)
      chunks.push([html.slice(0, split), html.slice(split)])
    for (const parts of chunks) {
      const stream = new ReadableStream<string>({ start(controller) {
        for (const part of parts)
          controller.enqueue(part)
        controller.close()
      } })
      let actual = ''
      for await (const part of engine.streamHtmlToMarkdown(stream))
        actual += part
      expect(actual, JSON.stringify(parts)).toBe(expected)
    }
  })
})
