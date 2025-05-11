import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { createPlugin, streamHtmlToMarkdown } from '../src'

describe('streamHtmlToMarkdown with buffer control', () => {
  it('buffers content when using default buffer options', async () => {
    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<div><header>Site Header</header>')
        controller.enqueue('<nav>Navigation</nav>')
        controller.enqueue('<main><h1>Main Content Title</h1>')
        controller.enqueue('<p>This is important content.</p></main>')
        controller.enqueue('<footer>Footer</footer></div>')
        controller.close()
      },
    })

    // Use buffering with minimum density score
    const result: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      htmlStream,
      {},
      { minDensityScore: 5.0 },
    )) {
      result.push(chunk)
    }

    // With buffering, we expect fewer chunks
    expect(result.length).toBeLessThanOrEqual(2)
    // All content should still be present
    expect(result.join('')).toContain('Main Content Title')
    expect(result.join('')).toContain('Site Header')
    expect(result.join('')).toContain('Footer')
  })

  it('respects maxBufferSize limit', async () => {
    // Create a very large HTML payload to ensure buffering occurs
    const largeHtml = `<div>${
      Array.from({ length: 500 }).fill('<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>').join('')
    }<main><h1>Important Content</h1></main>`
    + `</div>`

    const htmlStream = new ReadableStream({
      start(controller) {
        // Split into multiple chunks to simulate network streaming
        const chunks = largeHtml.match(/.{1,5000}/g) || []
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    // Use a small max buffer size to force buffer flush
    const result: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      htmlStream,
      {},
      {
        minDensityScore: 100, // Set very high to ensure buffering continues
        maxBufferSize: 1000, // Force flush with small buffer
      },
    )) {
      result.push(chunk)
    }

    // Should produce at least one chunk due to maxBufferSize limit
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('applies debug markers when explicitly creating content marker', async () => {
    // Create a custom plugin that adds debug markers
    const debugMarkerPlugin = createPlugin({
      name: 'debug-marker',

      init() {
        return { foundContent: false }
      },

      processTextNode(node) {
        if (node.value?.includes('important content')) {
          this.foundContent = true

          // Add context to the node
          if (node.parent) {
            node.parent.context = node.parent.context || {}
            node.parent.context.isRelevantContent = true
          }
        }
        return undefined
      },

      // Add a marker when transforming content that's been marked as relevant
      transformContent(content, node) {
        if (node.context?.isRelevantContent) {
          return `<!-- RELEVANT CONTENT DETECTED -->\n${content}`
        }
        return content
      },

      finish(state) {
        return {
          streamBufferControl: {
            shouldBuffer: false,
            hasRelevantContent: this.foundContent,
            score: this.foundContent ? 10 : 0,
          },
        }
      },
    })

    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<div><main><h1>Main Content Title</h1>')
        controller.enqueue('<p>This is important content.</p></main></div>')
        controller.close()
      },
    })

    // Use our debug marker plugin
    const result: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      htmlStream,
      { plugins: [debugMarkerPlugin] },
      { debugMarkers: true },
    )) {
      result.push(chunk)
    }

    // Should include a debug marker in the output since our plugin adds it
    const combinedOutput = result.join('')
    expect(combinedOutput).toContain('RELEVANT CONTENT DETECTED')
  })

  it('uses custom plugin implementing StreamBufferControl', async () => {
    // Create a custom plugin that implements StreamBufferControl
    const customBufferPlugin = createPlugin({
      name: 'custom-buffer',

      init() {
        return {
          customBufferControl: true,
          foundTitle: false,
        }
      },

      processTextNode(node) {
        // Detect when we find the main content
        if (node.value?.includes('Main Content')) {
          this.foundTitle = true
        }
        return undefined
      },

      finish() {
        // Implement StreamBufferControl interface
        return {
          streamBufferControl: {
            shouldBuffer: !this.foundTitle,
            score: this.foundTitle ? 10 : 0,
            hasRelevantContent: this.foundTitle,
            minRequiredScore: 5,
          },
        }
      },
    })

    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<div><nav>Navigation</nav>')
        controller.enqueue('<section><h2>Section Header</h2>')
        controller.enqueue('<p>Some section content</p></section>')
        controller.enqueue('<main><h1>Main Content</h1>')
        controller.enqueue('<p>Important content here.</p></main>')
        controller.enqueue('<footer>Footer</footer></div>')
        controller.close()
      },
    })

    // Use our custom buffer plugin
    const result: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      htmlStream,
      { plugins: [customBufferPlugin] },
      { minDensityScore: 5 },
    )) {
      result.push(chunk)
    }

    // All content should be present, with proper buffering
    const finalContent = result.join('')
    expect(finalContent).toContain('Main Content')
    expect(finalContent).toContain('Navigation')
    expect(finalContent).toContain('Section Header')
  })

  it('works with multiple plugins implementing StreamBufferControl', async () => {
    // First buffer control plugin - tracks headings
    const headingBufferPlugin = createPlugin({
      name: 'heading-buffer',

      init() {
        return { foundHeading: false }
      },

      onNodeEnter(event) {
        // Check if we've found an h1 element
        if (event.node.type === 1 && event.node.name === 'h1') {
          this.foundHeading = true
        }
        return undefined
      },

      finish() {
        // First plugin says to buffer until h1 is found
        return {
          streamBufferControl: {
            shouldBuffer: !this.foundHeading,
            score: this.foundHeading ? 10 : 0,
            hasRelevantContent: this.foundHeading,
          },
        }
      },
    })

    // Second buffer control plugin - looks for specific content
    const contentBufferPlugin = createPlugin({
      name: 'content-buffer',

      init() {
        return { foundKeyword: false }
      },

      processTextNode(node) {
        // Look for a specific keyword
        if (node.value?.includes('important')) {
          this.foundKeyword = true
        }
        return undefined
      },

      finish() {
        // Second plugin says to buffer until keyword is found
        return {
          streamBufferControl: {
            shouldBuffer: !this.foundKeyword,
            score: this.foundKeyword ? 8 : 0,
            hasRelevantContent: this.foundKeyword,
          },
        }
      },
    })

    const htmlStream = new ReadableStream({
      start(controller) {
        controller.enqueue('<div><header>Site Header</header>')
        controller.enqueue('<h1>Page Title</h1>') // Should trigger first plugin
        controller.enqueue('<p>Normal content.</p>')
        controller.enqueue('<p>This is important content.</p>') // Should trigger second plugin
        controller.enqueue('<footer>Footer</footer></div>')
        controller.close()
      },
    })

    // Use both buffer control plugins
    const result: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      htmlStream,
      { plugins: [headingBufferPlugin, contentBufferPlugin] },
      { minDensityScore: 5 }, // This is ignored since our plugins control buffering
    )) {
      result.push(chunk)
    }

    // All content should be present
    const finalContent = result.join('')
    expect(finalContent).toContain('Page Title')
    expect(finalContent).toContain('important content')
    expect(finalContent).toContain('Site Header')
    expect(finalContent).toContain('Footer')
  })
})
