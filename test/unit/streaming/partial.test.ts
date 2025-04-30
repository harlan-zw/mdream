import { describe, expect, it } from 'vitest'
import { parseHTML } from '../../../src/parser.ts'
import { HTMLStreamAdapter } from '../../../src/stream.ts'

describe('hTML Parser - Partial Content', () => {
  it('should handle chunks ending with an opening angle bracket', () => {
    const html = '<'
    const { partialHTML } = parseHTML(html)

    expect(partialHTML).toBe('<')
  })

  it('should handle chunks ending with a tag start and partial name', () => {
    const html = '<di'
    const { partialHTML } = parseHTML(html)

    expect(partialHTML).toBe('<di')
  })

  it('should handle chunks ending with a partial comment', () => {
    const html = '<!-- Comment'
    const { partialHTML } = parseHTML(html)

    expect(partialHTML).toBe('<!-- Comment')
  })

  it('should handle chunks ending with a partial doctype', () => {
    const html = '<!DOCTYPE html'
    const { partialHTML } = parseHTML(html)

    expect(partialHTML).toBe('<!DOCTYPE html')
  })

  it('should handle chunks ending with a closing tag start', () => {
    const html = '</'
    const { partialHTML } = parseHTML(html)

    expect(partialHTML).toBe('</')
  })

  it('should handle chunks ending with a partial attribute', () => {
    const html = '<div class="'
    const { partialHTML } = parseHTML(html)

    expect(partialHTML).toBe('<div class="')
  })

  // Testing direct access to adapter methods
  it('should directly parse HTML chunks through the adapter', async () => {
    const adapter = new HTMLStreamAdapter()

    // Process a complete chunk of HTML
    await adapter.processChunk('<p>Test paragraph</p>')

    // After processing, check the result and adapter state
    expect(adapter.pendingChunk.length).toBe(0)
  })

  it('should directly handle partial HTML in buffer', async () => {
    const adapter = new HTMLStreamAdapter()

    // Add an incomplete chunk to the buffer
    adapter.pendingChunk = '<p>Test'

    // Flush should handle the incomplete chunk
    await adapter.flush()

    // Buffer should be empty after flush
    expect(adapter.pendingChunk.length).toBe(0)
  })

  it('should directly handle partial tags across chunks', async () => {
    const adapter = new HTMLStreamAdapter()

    // Add first part of HTML
    await adapter.processChunk('<p>First')

    // Add second part to complete the HTML
    await adapter.processChunk(' paragraph</p>')

    // Buffer should be empty after full processing
    expect(adapter.pendingChunk.length).toBe(0)
  })

  it('should directly handle angle bracket edge cases', async () => {
    const adapter = new HTMLStreamAdapter()

    // Process partial content ending with <
    await adapter.processChunk('<div><')

    // Complete the HTML in the next chunk
    await adapter.processChunk('p>Content</p></div>')

    // Flush any remaining content
    await adapter.flush()

    // Buffer should be empty after full processing
    expect(adapter.pendingChunk.length).toBe(0)
  })

  it('should handle complete documents with head and style tags', async () => {
    const adapter = new HTMLStreamAdapter()

    // Complete HTML document with head, style tags, and body content
    const htmlPart1 = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Document</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .content {
            color: #333;
          }
        </style>
      </head>
      <body>
    `.trim()

    const htmlPart2 = `
        <h1>Document Title</h1>
        <div class="content">
          <p>This is a paragraph with <strong>bold</strong> and <em>emphasized</em> text.</p>
          <ul>
            <li>List item 1</li>
            <li>List item 2 with <a href="https://example.com">link</a></li>
          </ul>
        </div>
      </body>
      </html>
    `.trim()

    // Process document in chunks
    await adapter.processChunk(htmlPart1)
    await adapter.processChunk(htmlPart2)

    // Flush any remaining content
    await adapter.flush()

    // Buffer should be empty after full processing
    expect(adapter.pendingChunk.length).toBe(0)
  })

  it('should handle awkward chunk boundaries in a complete document', async () => {
    const adapter = new HTMLStreamAdapter()

    // Split the document at awkward boundaries
    const chunks = [
      '<!DOCTYPE html><ht',
      'ml><he',
      'ad><title>Awkward Chunks Te',
      'st</tit',
      'le><style>body { co',
      'lor: blue; }</st',
      'yle><meta name="description" content="test"/></head><bo',
      'dy><h1>Hello Wo',
      'rld</h1><p>This is a para',
      'graph with <str',
      'ong>bold</strong> text and a <',
      'a href="https://exam',
      'ple.com">link</a>.</p>',
      '</bo',
      'dy></html>',
    ]

    let res = ''
    // Process all chunks
    for (const chunk of chunks) {
      res += await adapter.processChunk(chunk)
    }

    // Flush any remaining content
    await adapter.flush()

    // Buffer should be empty after full processing
    expect(adapter.pendingChunk.length).toBe(0)
    expect(res.trimEnd()).toMatchInlineSnapshot(`
      "---
      title: "Awkward Chunks Test"
      description: "test"
      ---

      # Hello World

      This is a paragraph with **bold** text and a [link](https://example.com)."
    `)
  })

  it('should handle HTML with special entities and script tags', async () => {
    const adapter = new HTMLStreamAdapter()

    // HTML with entities and script tag containing code that looks like HTML
    const html1 = `
      <!DOCTYPE html>
      <html>
      <head>
        <script type="text/javascript">
          // This script has HTML-like content inside
          function createTag() {
            const div = document.createElement('div');
            div.innerHTML = '<p>This is generated HTML</p>';

            // Arrow function with comparison operators that look like tags
            const compare = (a, b) => a < b || a > b;

            // String with HTML entities
            const text = "Special chars: &lt; and &gt; and &amp;";
    `.trim()

    const html2 = `
            return div;
          }
        </script>
      </head>
      <body>
        <p>Special characters: &lt;div&gt; looks like a tag, &amp; is an ampersand</p>
        <p>&copy; 2025 Example Inc. &mdash; All rights reserved</p>
        <div data-attr="<not-a-real-tag>">This has attributes with angle brackets</div>
      </body>
      </html>
    `.trim()

    // Process in chunks
    await adapter.processChunk(html1)
    await adapter.processChunk(html2)

    // Flush any remaining content
    await adapter.flush()

    // Buffer should be empty after full processing
    expect(adapter.pendingChunk.length).toBe(0)
  })
})
