import { describe, expect, it } from 'vitest'
import { TAG_H1, TAG_H2 } from '../../src/const'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'

describe('htmlToMarkdownSplitChunks', () => {
  it('splits on h2 headers by default', () => {
    const html = `
      <h1>Main Title</h1>
      <p>Introduction</p>
      <h2>Section 1</h2>
      <p>Content 1</p>
      <h2>Section 2</h2>
      <p>Content 2</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html)

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].metadata.headers).toBeDefined()
  })

  it('tracks header hierarchy in metadata', () => {
    const html = `
      <h1>Title</h1>
      <h2>Section</h2>
      <h3>Subsection</h3>
      <p>Content</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(0)
    const lastChunk = chunks[chunks.length - 1]
    expect(lastChunk.metadata.headers).toBeDefined()
    expect(lastChunk.metadata.headers?.h1).toBe('Title')
    expect(lastChunk.metadata.headers?.h2).toBe('Section')
    expect(lastChunk.metadata.headers?.h3).toBe('Subsection')
  })

  it('splits on custom headers', () => {
    const html = `
      <h1>Title</h1>
      <p>Intro</p>
      <h2>Section 1</h2>
      <p>Content 1</p>
      <h2>Section 2</h2>
      <p>Content 2</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      headersToSplitOn: [TAG_H1],
    })

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('strips headers from content when stripHeaders is true', () => {
    const html = `
      <h2>Section</h2>
      <p>Content here</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      stripHeaders: true,
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].content).not.toContain('## Section')
    expect(chunks[0].content).toContain('Content here')
  })

  it('keeps headers in content when stripHeaders is false', () => {
    const html = `
      <h2>Section</h2>
      <p>Content here</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      stripHeaders: false,
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].content).toContain('## Section')
  })

  it('extracts code block language to metadata', () => {
    const html = `
      <pre><code class="language-javascript">
        const x = 1;
      </code></pre>
    `

    const chunks = htmlToMarkdownSplitChunks(html)

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].metadata.code).toBe('javascript')
  })

  it('splits on horizontal rules', () => {
    const html = `
      <p>Section 1</p>
      <hr>
      <p>Section 2</p>
      <hr>
      <p>Section 3</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      headersToSplitOn: [], // Don't split on headers
    })

    expect(chunks.length).toBeGreaterThan(1)
  })

  it('respects chunkSize limit', () => {
    const html = `
      <p>${'a'.repeat(1500)}</p>
      <p>${'b'.repeat(1500)}</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      chunkSize: 1000,
      headersToSplitOn: [],
    })

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      // Some chunks may slightly exceed due to element boundaries (not splitting mid-element)
      expect(chunk.content.length).toBeLessThanOrEqual(1800)
    }
  })

  it('maintains chunk overlap', () => {
    const html = `
      <p>Line 1</p>
      <p>Line 2</p>
      <p>Line 3</p>
      <p>Line 4</p>
      <p>Line 5</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      chunkSize: 50,
      chunkOverlap: 20,
      headersToSplitOn: [],
    })

    if (chunks.length > 1) {
      // Check that there's some overlapping content
      const firstChunkEnd = chunks[0].content.slice(-20)
      const secondChunkStart = chunks[1].content.slice(0, 20)
      // There should be some similarity
      expect(chunks.length).toBeGreaterThan(1)
    }
  })

  it('returns each line as chunk when returnEachLine is true', () => {
    const html = `
      <p>Line 1</p>
      <p>Line 2</p>
      <p>Line 3</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      returnEachLine: true,
      headersToSplitOn: [],
    })

    expect(chunks.length).toBeGreaterThan(2)
  })

  it('uses custom length function', () => {
    const html = `
      <p>${'word '.repeat(100)}</p>
      <p>${'word '.repeat(100)}</p>
    `

    const wordCountFn = (text: string) => text.split(/\s+/).length

    const chunks = htmlToMarkdownSplitChunks(html, {
      chunkSize: 50, // 50 words
      chunkOverlap: 10,
      lengthFunction: wordCountFn,
      headersToSplitOn: [],
    })

    expect(chunks.length).toBeGreaterThan(1)
  })

  it('tracks line numbers in metadata', () => {
    const html = `
      <p>Line 1</p>
      <p>Line 2</p>
      <h2>Section</h2>
      <p>Line 4</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(0)
    for (const chunk of chunks) {
      expect(chunk.metadata.loc).toBeDefined()
      expect(chunk.metadata.loc?.lines.from).toBeGreaterThan(0)
      expect(chunk.metadata.loc?.lines.to).toBeGreaterThanOrEqual(chunk.metadata.loc?.lines.from)
    }
  })

  it('handles nested headers correctly', () => {
    const html = `
      <h1>Level 1</h1>
      <h2>Level 2A</h2>
      <p>Content A</p>
      <h3>Level 3</h3>
      <p>Content 3</p>
      <h2>Level 2B</h2>
      <p>Content B</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(1)

    // First chunk should have h1 and h2A
    const firstChunk = chunks[0]
    expect(firstChunk.metadata.headers?.h1).toBe('Level 1')
    expect(firstChunk.metadata.headers?.h2).toBe('Level 2A')

    // Last chunk should have h1 and h2B
    const lastChunk = chunks[chunks.length - 1]
    expect(lastChunk.metadata.headers?.h1).toBe('Level 1')
    expect(lastChunk.metadata.headers?.h2).toBe('Level 2B')
  })

  it('handles complex HTML with multiple features', () => {
    const html = `
      <h1>Documentation</h1>
      <p>Introduction text</p>

      <h2>Installation</h2>
      <p>Install via npm:</p>
      <pre><code class="language-bash">npm install mdream</code></pre>

      <h2>Usage</h2>
      <p>Basic example:</p>
      <pre><code class="language-javascript">
        import { htmlToMarkdown } from 'mdream'
        const md = htmlToMarkdown(html)
      </code></pre>

      <hr>

      <h2>Advanced</h2>
      <p>More advanced features</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(2)

    // Check that code blocks are detected
    const codeChunks = chunks.filter(c => c.metadata.code)
    expect(codeChunks.length).toBeGreaterThan(0)

    // Check header hierarchy
    expect(chunks.some(c => c.metadata.headers?.h2 === 'Installation')).toBe(true)
    expect(chunks.some(c => c.metadata.headers?.h2 === 'Usage')).toBe(true)
  })

  it('throws error when chunkOverlap >= chunkSize', () => {
    const html = '<p>Test</p>'

    expect(() => {
      htmlToMarkdownSplitChunks(html, {
        chunkSize: 100,
        chunkOverlap: 100,
      })
    }).toThrow('chunkOverlap must be less than chunkSize')
  })

  it('handles empty HTML', () => {
    const chunks = htmlToMarkdownSplitChunks('')
    expect(chunks).toEqual([])
  })

  it('handles HTML with only whitespace', () => {
    const chunks = htmlToMarkdownSplitChunks('   \n  \n  ')
    expect(chunks.length).toBeLessThanOrEqual(1)
  })

  it('integrates with HTMLToMarkdownOptions', () => {
    const html = `
      <h2>Section</h2>
      <p>Check out <a href="/page">this link</a></p>
      <img src="/image.png" alt="Test">
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      origin: 'https://example.com',
      headersToSplitOn: [TAG_H2],
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].content).toContain('https://example.com/page')
    expect(chunks[0].content).toContain('https://example.com/image.png')
  })

  // Edge Cases
  describe('edge cases', () => {
    it('handles consecutive headers with no content', () => {
      const html = `
        <h1>Title</h1>
        <h2>Section 1</h2>
        <h2>Section 2</h2>
        <h2>Section 3</h2>
        <p>Finally some content</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toMatchInlineSnapshot(`
        "# Title

        ## Section 1"
      `)
    })

    it('handles headers with inline formatting', () => {
      const html = `
        <h2>Section with <strong>bold</strong> and <em>italic</em></h2>
        <p>Content here</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].metadata.headers?.h2).toBe('Section with bold and italic')
    })

    it('handles headers with links', () => {
      const html = `
        <h2>Check out <a href="https://example.com">this link</a></h2>
        <p>Content</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].metadata.headers?.h2).toBe('Check out this link')
    })

    it('handles skipped header levels', () => {
      const html = `
        <h1>Level 1</h1>
        <h3>Level 3 (skipped h2)</h3>
        <p>Content</p>
        <h5>Level 5 (skipped h4)</h5>
        <p>More content</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].metadata.headers?.h1).toBe('Level 1')
      expect(chunks[0].metadata.headers?.h3).toBe('Level 3 (skipped h2)')
      expect(chunks[0].metadata.headers?.h5).toBe('Level 5 (skipped h4)')
    })

    it('handles backwards header levels', () => {
      const html = `
        <h3>Starting at h3</h3>
        <p>Content 1</p>
        <h1>Going back to h1</h1>
        <p>Content 2</p>
        <h2>Then h2</h2>
        <p>Content 3</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks.length).toBeGreaterThan(0)
      const lastChunk = chunks[chunks.length - 1]
      expect(lastChunk.metadata.headers?.h1).toBe('Going back to h1')
      expect(lastChunk.metadata.headers?.h2).toBe('Then h2')
    })

    it('handles multiple code blocks with different languages', () => {
      const html = `
        <h2>Code Examples</h2>
        <pre><code class="language-javascript">const x = 1;</code></pre>
        <pre><code class="language-python">x = 1</code></pre>
        <pre><code class="language-rust">let x = 1;</code></pre>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [],
      })

      // Should track the first code language found
      expect(chunks[0].metadata.code).toBe('javascript')
    })

    it('handles code blocks without language class', () => {
      const html = `
        <pre><code>const x = 1;</code></pre>
      `

      const chunks = htmlToMarkdownSplitChunks(html)

      expect(chunks[0].metadata.code).toBeUndefined()
    })

    it('handles very small chunk sizes', () => {
      const html = `
        <p>Short paragraph one</p>
        <p>Short paragraph two</p>
        <p>Short paragraph three</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 10,
        chunkOverlap: 2,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.content).toBeTruthy()
      }
    })

    it('handles chunk size of 1', () => {
      const html = `<p>Hi</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 1,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBeGreaterThan(0)
    })

    it('handles headers with special characters', () => {
      const html = `
        <h2>Section & Title with "quotes" and 'apostrophes'</h2>
        <p>Content</p>
        <h2>Math: 2 &lt; 3 &gt; 1</h2>
        <p>More</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBe(2)
      expect(chunks[0].metadata.headers?.h2).toBe(`Section & Title with "quotes" and 'apostrophes'`)
      expect(chunks[1].metadata.headers?.h2).toBe('Math: 2 < 3 > 1')
    })

    it('handles HTML entities in headers', () => {
      const html = `
        <h2>Section &amp; Title &lt;tag&gt;</h2>
        <p>Content</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].metadata.headers?.h2).toBe('Section & Title <tag>')
    })

    it('handles nested lists with headers', () => {
      const html = `
        <h2>Todo List</h2>
        <ul>
          <li>Item 1
            <ul>
              <li>Nested 1</li>
              <li>Nested 2</li>
            </ul>
          </li>
          <li>Item 2</li>
        </ul>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Item 1')
      expect(chunks[0].content).toContain('Nested 1')
    })

    it('handles tables in chunks', () => {
      const html = `
        <h2>Data Table</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr><td>A</td><td>1</td></tr>
            <tr><td>B</td><td>2</td></tr>
          </tbody>
        </table>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks[0].content).toContain('|')
      expect(chunks[0].content).toContain('Name')
      expect(chunks[0].content).toContain('Value')
    })

    it('handles blockquotes', () => {
      const html = `
        <h2>Quotes</h2>
        <blockquote>
          <p>This is a quote</p>
          <p>Multiple paragraphs</p>
        </blockquote>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks[0].content).toContain('>')
      expect(chunks[0].content).toContain('This is a quote')
    })

    it('handles empty paragraph elements', () => {
      const html = `
        <h2>Section</h2>
        <p></p>
        <p>Content</p>
        <p></p>
        <p>More</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Content')
    })

    it('handles only headers, no other content', () => {
      const html = `
        <h1>Title</h1>
        <h2>Section 1</h2>
        <h2>Section 2</h2>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks[0].content).toMatchInlineSnapshot(`
        "# Title

        ## Section 1"
      `)
    })

    it('handles HR between headers', () => {
      const html = `
        <h2>Section 1</h2>
        <hr>
        <h2>Section 2</h2>
        <hr>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks.length).toBeGreaterThan(1)
    })

    it('handles mixed content with all features', () => {
      const html = `
        <h1>Documentation</h1>
        <p>Introduction with <strong>bold</strong> and <em>italic</em></p>

        <h2>Section 1</h2>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>

        <h2>Section 2</h2>
        <blockquote>Important note</blockquote>
        <pre><code class="language-js">const x = 1;</code></pre>

        <hr>

        <h2>Section 3</h2>
        <table>
          <tr><td>A</td><td>1</td></tr>
        </table>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBeGreaterThan(2)

      // Check first chunk has h1 and h2
      expect(chunks[0].metadata.headers?.h1).toBe('Documentation')
      expect(chunks[0].metadata.headers?.h2).toBe('Section 1')

      // Check code language tracked
      const codeChunk = chunks.find(c => c.metadata.code)
      expect(codeChunk?.metadata.code).toBe('js')
    })

    it('handles returnEachLine with headers', () => {
      const html = `
        <h2>Section</h2>
        <p>Line 1</p>
        <p>Line 2</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        returnEachLine: true,
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      })

      expect(chunks.length).toBeGreaterThan(2)
      expect(chunks.some(c => c.content.includes('## Section'))).toBe(true)
    })

    it('handles overlap larger than content', () => {
      const html = `<p>Hi</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 100,
        chunkOverlap: 50,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBe(1)
      expect(chunks[0].content).toBe('Hi')
    })

    it('handles multiple h1 headers', () => {
      const html = `
        <h1>First Title</h1>
        <p>Content 1</p>
        <h1>Second Title</h1>
        <p>Content 2</p>
        <h1>Third Title</h1>
        <p>Content 3</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H1],
      })

      expect(chunks.length).toBe(3)
      expect(chunks[0].metadata.headers?.h1).toBe('First Title')
      expect(chunks[1].metadata.headers?.h1).toBe('Second Title')
      expect(chunks[2].metadata.headers?.h1).toBe('Third Title')
    })

    it('handles header text extraction with nested elements', () => {
      const html = `
        <h2>
          <span>Nested</span>
          <strong>Bold</strong>
          <em>Italic</em>
        </h2>
        <p>Content</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].metadata.headers?.h2).toBe('Nested Bold Italic')
    })

    it('preserves header hierarchy when splitting on h3', () => {
      const html = `
        <h1>Title</h1>
        <h2>Section</h2>
        <h3>Subsection A</h3>
        <p>Content A</p>
        <h3>Subsection B</h3>
        <p>Content B</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      // Should have h1, h2, and both h3s in metadata
      const chunk = chunks[chunks.length - 1]
      expect(chunk.metadata.headers?.h1).toBe('Title')
      expect(chunk.metadata.headers?.h2).toBe('Section')
      expect(chunk.metadata.headers?.h3).toBe('Subsection B')
    })

    it('handles images in content', () => {
      const html = `
        <h2>Images</h2>
        <p>Check this out:</p>
        <img src="/test.png" alt="Test Image">
        <p>Nice!</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        origin: 'https://example.com',
      })

      expect(chunks[0].content).toContain('![Test Image](https://example.com/test.png)')
    })

    it('handles definition lists', () => {
      const html = `
        <h2>Definitions</h2>
        <dl>
          <dt>Term 1</dt>
          <dd>Definition 1</dd>
          <dt>Term 2</dt>
          <dd>Definition 2</dd>
        </dl>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].content).toContain('Term 1')
      expect(chunks[0].content).toContain('Definition 1')
    })

    it('handles pre without code', () => {
      const html = `
        <h2>Preformatted</h2>
        <pre>This is preformatted text
with preserved   spacing</pre>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].content).toContain('This is preformatted text')
    })

    it('clears code language between chunks', () => {
      const html = `
        <h2>Section 1</h2>
        <pre><code class="language-javascript">const x = 1;</code></pre>
        <h2>Section 2</h2>
        <p>No code here</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBe(2)
      expect(chunks[0].metadata.code).toBe('javascript')
      expect(chunks[1].metadata.code).toBeUndefined()
    })

    it('handles line numbers correctly across splits', () => {
      const html = `
        <p>Line 1</p>
        <h2>Split here</h2>
        <p>Line 3</p>
        <h2>Split again</h2>
        <p>Line 5</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks.length).toBe(2)
      expect(chunks[0].metadata.loc?.lines.from).toBe(1)
      // Line numbers track markdown lines, which are cumulative
      expect(chunks[0].metadata.loc?.lines.to).toBeGreaterThanOrEqual(1)
      expect(chunks[1].metadata.loc?.lines.from).toBeGreaterThanOrEqual(chunks[0].metadata.loc?.lines.to)
    })

    it('produces consistent output for same input', () => {
      const html = `
        <h1>Title</h1>
        <h2>Section</h2>
        <p>Content</p>
      `

      const chunks1 = htmlToMarkdownSplitChunks(html, { headersToSplitOn: [TAG_H2] })
      const chunks2 = htmlToMarkdownSplitChunks(html, { headersToSplitOn: [TAG_H2] })

      expect(chunks1).toEqual(chunks2)
    })

    it('handles whitespace-only paragraphs', () => {
      const html = `
        <h2>Section</h2>
        <p>   </p>
        <p>Content</p>
        <p>
        </p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].content.trim()).toBe('Content')
    })

    it('handles deeply nested structures', () => {
      const html = `
        <h2>Section</h2>
        <div>
          <div>
            <div>
              <p>Deeply nested content</p>
            </div>
          </div>
        </div>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
      })

      expect(chunks[0].content).toContain('Deeply nested content')
    })
  })
})
