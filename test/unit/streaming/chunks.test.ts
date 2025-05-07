import { ReadableStream } from 'node:stream/web'
import { describe, expect, it, vi } from 'vitest'
import { streamHtmlToMarkdown } from '../../../src/stream'

describe('streamHtmlToMarkdown', () => {
  it('converts a valid HTML stream to markdown chunks', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<h1>Title</h1>')
        controller.enqueue('<p>Paragraph</p>')
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result.join('')).toMatchInlineSnapshot(`
      "# Title

      Paragraph"
    `)
  })

  it('throws an error when null is passed as the HTML stream', async () => {
    await expect(async() => {
      const options = {}
      for await (const _ of streamHtmlToMarkdown(null, options)) {
        // no-op
      }
    }).rejects.toThrow('Invalid HTML stream provided')
  })

  it('handles an empty HTML stream gracefully', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result).toEqual([])
  })

  it('processes partial HTML chunks correctly', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<h1>Title')
        controller.enqueue('</h1><p>Par')
        controller.enqueue('agraph</p>')
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result.join('')).toMatchInlineSnapshot(`
      "# Title

      Paragraph"
    `)
  })

  it('releases the reader lock after processing', async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: null }),
      releaseLock: vi.fn(),
    }
    const htmlStream = { getReader: () => mockReader } as any
    const options = {}

    for await (const _ of streamHtmlToMarkdown(htmlStream, options)) {
      // no-op
    }

    expect(mockReader.releaseLock).toHaveBeenCalled()
  })

  it('handles HTML tags split across multiple chunks', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<h1>Title')
        controller.enqueue(' with split')
        controller.enqueue('</h1>')
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result.join('')).toMatchInlineSnapshot(`"# Title with split"`)
  })

  it('processes nested HTML elements split across chunks correctly', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<div><p>First ')
        controller.enqueue('paragraph with <strong>')
        controller.enqueue('bold text</strong></p>')
        controller.enqueue('<p>Second paragraph</p></div>')
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result).toMatchInlineSnapshot(`
      [
        "First paragraph with **",
        "bold text**

      ",
        "Second paragraph",
      ]
    `)
  })

  it('handles HTML with attributes split across chunks', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<a href="https://')
        controller.enqueue('example.com">')
        controller.enqueue('Link text</a>')
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result).toMatchInlineSnapshot(`
      [
        "[",
        "Link text](https://example.com)",
      ]
    `)
  })

  it('processes complex HTML structures with multiple levels', async () => {
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
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result).toMatchInlineSnapshot(`
      [
        "## ",
        "Section

      - ",
        "Item 1
      - ",
        "Item 2

      ",
        "Final text",
      ]
    `)
  })
  it('handles unclosed span tags in nested structures', async  () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<div><h3>Section with <span>unclosed span')
        controller.enqueue('</h3><p>Paragraph with <em>emphasis</em> and <span>')
        controller.enqueue('another unclosed span</p><ul><li>List item <span>with')
        controller.enqueue(' unclosed span</li><li>Another item</li></ul></div>')
        controller.close()
      },
    })
    const options = {}
    const result: string[] = []

    for await (const chunk of streamHtmlToMarkdown(htmlStream, options)) {
      result.push(chunk)
    }

    expect(result.join('')).toMatchInlineSnapshot(`
      "### Section with unclosed span

      Paragraph with *emphasis* and another unclosed span

      - List item with unclosed span
      - Another item"
    `)
    // The resulting markdown should have the content from the unclosed spans,
    // as the HTML parser should implicitly close them at appropriate boundaries
  })
})
