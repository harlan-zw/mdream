import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../utils/engines'

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of stream)
    output += chunk
  return output
}

describe.each(engines)('plain text output $name', (engineConfig) => {
  it('omits markdown markup from common document structure', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>Hello <em>World</em></h1><p>Visit <a href="https://example.com">Example</a> and <strong>read</strong>.</p><ul><li>One</li><li>Two</li></ul>'
    const text = htmlToMarkdown(html, { engine, format: 'text' })

    expect(text).toBe('Hello World\n\nVisit Example and read.\n\nOne\nTwo')
  })

  it('preserves readable separators without markdown tables or image syntax', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Line<br>Break</p><table><tr><th>Name</th><th>Role</th></tr><tr><td>Ada</td><td>Admin</td></tr></table><p><img src="/x.png" alt="Diagram"></p>'
    const text = htmlToMarkdown(html, { engine, format: 'text' })

    expect(text).toBe('Line\nBreak\n\nName\tRole\nAda\tAdmin\n\nDiagram')
  })

  it('falls back from image alt text to title and src', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<img src="image.png" alt="Alt" title="Title">', { engine, format: 'text' }))
      .toBe('Alt')
    expect(htmlToMarkdown('<img src="image.png" title="Title">', { engine, format: 'text' }))
      .toBe('Title')
    expect(htmlToMarkdown('<img src="image.png">', { engine, format: 'text' }))
      .toBe('image.png')
    expect(htmlToMarkdown('<img src="/image.png">', { engine, format: 'text', origin: 'https://example.com' }))
      .toBe('https://example.com/image.png')
    expect(htmlToMarkdown('<img src="./image.png">', { engine, format: 'text', origin: 'https://example.com/' }))
      .toBe('https://example.com/image.png')
    expect(htmlToMarkdown('<img src="/image.png?utm_source=test&width=10">', {
      clean: { urls: true },
      engine,
      format: 'text',
      origin: 'https://example.com',
    })).toBe('https://example.com/image.png?width=10')
    expect(htmlToMarkdown('<img src="image.png" alt="" title="Title">', { engine, format: 'text' }))
      .toBe('')
    expect(htmlToMarkdown('<img>', { engine, format: 'text' }))
      .toBe('')
  })

  it('matches streaming output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h2>Title</h2><p>A <code>code</code> sample with <a href="/docs">docs</a>.</p>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html.slice(0, 20))
        controller.enqueue(html.slice(20))
        controller.close()
      },
    })

    const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text' }))

    expect(streamed.trimEnd()).toBe('Title\n\nA code sample with docs.')
  })

  it('preserves preformatted whitespace and skips prose wrapping', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre>  alpha beta\n    gamma<!-- split -->delta</pre>'

    expect(htmlToMarkdown(html, { engine, format: 'text', wrapWidth: 5 }))
      .toBe('  alpha beta\n    gammadelta')

    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<pre>  alpha beta\n    gamma<!-- split -->')
        controller.enqueue('delta</pre>')
        controller.close()
      },
    })
    const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text', wrapWidth: 5 }))
    expect(streamed.trimEnd()).toBe('  alpha beta\n    gammadelta')
  })

  it('separates preformatted blocks nested in list items', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li>before<pre>  literal</pre>after</li></ul>', { engine, format: 'text' }))
      .toBe('before\n  literal\nafter')
  })

  it('does not wrap headings in text mode', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<h1>Alpha beta gamma delta</h1>', { engine, format: 'text', wrapWidth: 10 }))
      .toBe('Alpha beta gamma delta')
  })

  it('does not apply Markdown cleanup to literal text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>[literal](#missing) and [](https://example.com)</p>'
    expect(htmlToMarkdown(html, { engine, format: 'text', clean: true }))
      .toBe('[literal](#missing) and [](https://example.com)')
  })

  it('honors tag aliases and explicit overrides', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const plugins = {
      tagOverrides: {
        'x-image': 'img',
        'x-break': 'br',
        'x-paragraph': 'p',
        'x-pre': 'pre',
        'x-note': { enter: '(', exit: ')', spacing: [0, 0] as [number, number], isInline: true },
      },
    }
    expect(htmlToMarkdown('<x-image alt="Diagram">', { engine, format: 'text', plugins }))
      .toBe('Diagram')
    expect(htmlToMarkdown('<p>A<x-break>B</p>', { engine, format: 'text', plugins }))
      .toBe('A\nB')
    expect(htmlToMarkdown('<x-note>note</x-note>', { engine, format: 'text', plugins }))
      .toBe('(note)')
    expect(htmlToMarkdown('<x-paragraph>one</x-paragraph><x-paragraph>two</x-paragraph>', { engine, format: 'text', plugins }))
      .toBe('one\n\ntwo')
    expect(htmlToMarkdown('<x-pre>  literal\n next</x-pre>', { engine, format: 'text', plugins }))
      .toBe('  literal\n next')
  })

  it('matches batch output at every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>alpha <span>beta</span> gamma <em>delta</em> epsilon</p>'
    const expected = htmlToMarkdown(html, { engine, format: 'text' })

    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text' }))
      expect(streamed.trimEnd(), `split=${split}`).toBe(expected)
    }
  })

  it('preserves separators across repeated whitespace-only chunks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const stream = new ReadableStream<string>({
      start(controller) {
        for (const chunk of ['<p>a <span>b</span>', ' ', 'c ', ' ', 'd</p>'])
          controller.enqueue(chunk)
        controller.close()
      },
    })

    const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text' }))
    expect(streamed.trimEnd()).toBe('a b c d')
  })

  it('decodes UTF-8 split at every byte boundary', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const bytes = new TextEncoder().encode('<p>café 😀 東京</p>')

    for (let split = 0; split <= bytes.length; split++) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, split))
          controller.enqueue(bytes.slice(split))
          controller.close()
        },
      })
      const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text' }))
      expect(streamed.trimEnd(), `byte split=${split}`).toBe('café 😀 東京')
    }
  })

  it('flushes an incomplete UTF-8 sequence before a string chunk', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const prefix = new TextEncoder().encode('<p>caf')
    const incomplete = new Uint8Array(prefix.length + 1)
    incomplete.set(prefix)
    incomplete[prefix.length] = 0xC3
    const stream = new ReadableStream<Uint8Array | string>({
      start(controller) {
        controller.enqueue(incomplete)
        controller.enqueue('!</p>')
        controller.close()
      },
    })

    const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text' }))
    expect(streamed.trimEnd()).toBe('caf�!')
  })
})
