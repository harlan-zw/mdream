import { createMarkdownStream, htmlToMarkdown, streamHtmlToMarkdown } from 'mdream/browser'
import { expect, it } from 'vitest'

const options = { origin: 'https://example.com', format: 'markdown' } as const
const html = '<h1>Hello</h1><p><a href="/guide">café 🎉</a></p>'
const markdown = '# Hello\n\n[café 🎉](https://example.com/guide)'

it('converts Markdown with the browser import and resolves relative links', async () => {
  expect(await htmlToMarkdown(html, options)).toBe(markdown)
})

it('streams Markdown across split UTF-8 bytes', async () => {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of new TextEncoder().encode(html))
        controller.enqueue(Uint8Array.of(byte))
      controller.close()
    },
  })
  let result = ''
  for await (const chunk of streamHtmlToMarkdown(source, options))
    result += chunk
  expect(result).toBe(markdown)
})

it('emits Markdown before the source closes', async () => {
  let controller!: ReadableStreamDefaultController<string>
  const source = new ReadableStream<string>({
    start(stream) {
      controller = stream
    },
  })
  controller.enqueue('<h1>First</h1><p>Second</p><p>Third')
  const stream = streamHtmlToMarkdown(source)[Symbol.asyncIterator]()
  try {
    expect((await stream.next()).value).toContain('# First')
  }
  finally {
    controller.close()
    await stream.return?.()
  }
})

it('preserves UTF-16 surrogate pairs split across manually fed chunks', async () => {
  const stream = await createMarkdownStream()
  const result = stream.processChunk('<p>\uD83C') + stream.processChunk('\uDF89</p>') + stream.finish()
  expect(result).toBe('🎉')
})

it('rejects unavailable features for both one-shot and streaming conversions', async () => {
  await expect(htmlToMarkdown(html, { format: 'text' })).rejects.toThrow('does not support the `format` option')
  await expect(createMarkdownStream({ clean: true })).rejects.toThrow('does not support the `clean` option')
  const source = new ReadableStream<string>()
  const stream = streamHtmlToMarkdown(source, { frontmatter: true })
  await expect(stream[Symbol.asyncIterator]().next()).rejects.toThrow('does not support the `frontmatter` option')
})

it('rejects an unsupported format supplied by a class getter', async () => {
  class Options {
    origin = 'https://example.com'
    get format() {
      return 'text' as const
    }
  }

  const conversion = htmlToMarkdown(html, new Options() as unknown as typeof options)
  await expect(conversion).rejects.toThrow('does not support the `format` option')
})

it('rejects a non-enumerable cleanup option before starting a stream', async () => {
  const hiddenOptions = Object.defineProperty({ origin: options.origin }, 'clean', { value: true })
  await expect(createMarkdownStream(hiddenOptions)).rejects.toThrow('does not support the `clean` option')
})

it('rejects unsupported options hidden on the options object', async () => {
  const hiddenOptions = Object.defineProperty({ origin: options.origin }, 'plugins', {
    value: { tailwind: true },
  })
  await expect(htmlToMarkdown(html, hiddenOptions)).rejects.toThrow('does not support the `plugins` option')
})
