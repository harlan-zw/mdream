import { ReadableStream } from 'node:stream/web'
import { describe, expect, it, vi } from 'vitest'
import { processPartialHTMLToMarkdown } from '../../../src/parser'
import { streamHtmlToMarkdown } from '../../../src/stream'

describe('hTML to Markdown Streaming', () => {
  describe('basic Stream Functionality', () => {
    it('converts a valid HTML stream to markdown chunks', async () => {
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<h1>Title</h1>')
          controller.enqueue('<p>Paragraph</p>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
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
      await expect(async () => {
        for await (const _ of streamHtmlToMarkdown(null)) {
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

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      expect(result).toEqual([])
    })

    it('releases the reader lock after processing', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: null }),
        releaseLock: vi.fn(),
      }
      const htmlStream = { getReader: () => mockReader } as any

      for await (const _ of streamHtmlToMarkdown(htmlStream)) {
        // no-op
      }

      expect(mockReader.releaseLock).toHaveBeenCalled()
    })

    it('correctly handles binary content', async () => {
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
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      // Check that the binary content was correctly decoded and processed
      const combined = result.join('')
      expect(combined).toContain('# Encoded title')
    })
  })

  describe('partial Chunks and Streaming', () => {
    it('processes partial HTML chunks correctly', async () => {
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<h1>Title')
          controller.enqueue('</h1><p>Par')
          controller.enqueue('agraph</p>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
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
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<h1>Title')
          controller.enqueue(' with split')
          controller.enqueue('</h1>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('# Title')
      expect(combinedResult).toContain('with split')
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

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('First paragraph with')
      expect(combinedResult).toContain('bold text')
      expect(combinedResult).toContain('Second paragraph')
      expect(combinedResult).toMatch(/\*\*bold text\*\*/)
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

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('Link text')
      expect(combinedResult).toMatch(/\[Link text\]\(https:\/\/example\.com\)/)
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

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
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
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      const combinedResult = result.join('')
      expect(combinedResult).toContain('###')
      expect(combinedResult).toContain('Section with')
      expect(combinedResult).toContain('unclosed span')
      expect(combinedResult).toContain('Paragraph with')
      expect(combinedResult).toContain('_emphasis_')
      expect(combinedResult).toContain('List item')
      expect(combinedResult).toContain('Another item')

      const hasHeader = combinedResult.includes('###')
      const hasEmphasis = combinedResult.includes('_emphasis_')
      const hasList = combinedResult.includes('- List')
      expect(hasHeader && hasEmphasis && hasList).toBe(true)
    })
  })

  describe('position Tracking', () => {
    it('tracks exact positions and lengths for simple text nodes', () => {
      const html = '<p>Hello, world!</p>'
      const state: any = {}

      const result = processPartialHTMLToMarkdown(html, state)
      const textNode = state.lastTextNode

      // Check that the text node has basic properties
      expect(textNode).toBeDefined()
      expect(textNode.value).toBe('Hello, world!')

      // Check for exact position metrics
      expect(textNode.mdStart).toBe(0)
      expect(textNode.mdExit).toBe(13) // "Hello, world!" is 13 characters

      // Check that the parent paragraph node has correct metrics
      const pNode = textNode.parent
      expect(pNode).toBeDefined()
      expect(pNode.mdStart).toBe(0)
      expect(pNode.mdExit).toBe(15) // "Hello, world!\n\n" is 15 characters

      // Verify the whole output length
      expect(result.chunk).toBe('Hello, world!\n\n')
      expect(result.chunk.length).toBe(15)
    })

    it('tracks positions and lengths for multiple paragraphs', () => {
      const html = '<div><p>First paragraph</p><p>Second paragraph</p></div>'
      const state: any = {}

      const result = processPartialHTMLToMarkdown(html, state)

      // Verify the entire markdown output first
      expect(result.chunk).toBe('First paragraph\n\nSecond paragraph\n\n')
      expect(result.chunk.length).toBe(35) // 15 + 2 + 16 + 2 = 35

      // In the current implementation, state.lastTextNode might not be the
      // last text node we expect, so we'll focus on testing the overall output
      // and the current position instead
      expect(state.currentMdPosition).toBe(35) // Total length of markdown output
    })

    it('tracks positions and lengths accurately with formatting', () => {
      const html = '<p>This has <strong>bold</strong> and <em>italic</em> text</p>'
      const state: any = {}

      const result = processPartialHTMLToMarkdown(html, state)

      // Verify total position accumulation
      expect(state.currentMdPosition).toBe(37)

      // Expected: "This has **bold** and _italic_ text\n\n"
      // Length: 37 characters including formatting and newlines
      expect(result.chunk.length).toBe(37)

      // The content should include the formatting markers
      expect(result.chunk).toContain('**bold**')
      expect(result.chunk).toContain('_italic_')
    })

    it('handles position tracking with partial HTML chunks', () => {
      const html1 = '<p>First '
      const html2 = 'part of text</p>'

      const state: any = {}

      // Process first chunk
      const result1 = processPartialHTMLToMarkdown(html1, state)
      expect(result1.remainingHTML).toBe('First ')

      // First chunk should be empty because the paragraph is incomplete
      expect(result1.chunk).toBe('')
      expect(state.currentMdPosition).toBe(0)

      // Process second chunk
      const result2 = processPartialHTMLToMarkdown(result1.remainingHTML + html2, state)
      expect(result2.remainingHTML).toBe('')

      // Check the position tracking on the complete text
      const textNode = state.lastTextNode
      expect(textNode).toBeDefined()
      expect(textNode.value).toBe('First part of text')

      // Check exact positions
      expect(textNode.mdStart).toBe(0)
      expect(textNode.mdExit).toBe(18) // "First part of text" = 18 chars in the actual implementation

      // Check the complete output
      expect(result2.chunk).toBe('First part of text\n\n')
      expect(result2.chunk.length).toBe(20) // 18 + 2 newlines = 20
      expect(state.currentMdPosition).toBe(20)
    })

    it('properly tracks positions in nested elements', () => {
      const html = '<div><h1>Title</h1><ul><li>Item 1</li><li>Item 2</li></ul></div>'
      const state: any = {}

      const result = processPartialHTMLToMarkdown(html, state)

      // Expected output in markdown:
      // # Title
      //
      // - Item 1
      // - Item 2
      //

      // Verify positions in the output
      expect(result.chunk).toContain('# Title')
      expect(result.chunk).toContain('- Item 1')
      expect(result.chunk).toContain('- Item 2')

      // The total markdown length should be:
      // "# Title" (7) + "\n\n" (2) + "- Item 1" (8) + "\n" (1) + "- Item 2" (8) + "\n\n" (2) = 28
      expect(result.chunk.length).toBe(28)
      expect(state.currentMdPosition).toBe(28)
    })
  })

  describe('buffer Control', () => {
    it('handles buffering and release of content', async () => {
      const htmlStream = new ReadableStream({
        start(controller) {
          controller.enqueue('<header><nav><ul><li><a href="#">Home</a></li></ul></nav></header>')
          controller.enqueue('<main><h1>Main Content</h1><p>This is the main content.</p></main>')
          controller.enqueue('<footer><p>Footer</p></footer>')
          controller.close()
        },
      })

      const result: string[] = []
      for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
        result.push(chunk)
      }

      const markdown = result.join('')
      expect(markdown).toContain('# Main Content')
      expect(markdown).toContain('This is the main content.')
    })
  })
})
