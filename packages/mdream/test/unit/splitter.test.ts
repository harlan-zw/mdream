import { describe, expect, it } from 'vitest'
import { TAG_H1, TAG_H2 } from '../../src/const'
import { withMinimalPreset } from '../../src/preset/minimal'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'

describe('htmlToMarkdownSplitChunks', () => {
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
      <p>${'Line one content. '.repeat(10)}</p>
      <p>${'Line two content. '.repeat(10)}</p>
      <p>${'Line three content. '.repeat(10)}</p>
    `

    const chunks = htmlToMarkdownSplitChunks(html, {
      chunkSize: 100,
      chunkOverlap: 30,
      headersToSplitOn: [],
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks).toMatchSnapshot()
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
    expect(chunks).toMatchSnapshot()

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
      expect(chunks[0].content).toMatchSnapshot()
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

      expect(chunks[0].content).toMatchSnapshot()
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

      expect(chunks[0].content).toMatchSnapshot()
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

      expect(chunks[0].content).toMatchSnapshot()
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

  describe('withMinimalPreset integration', () => {
    it('filters out navigation and footer content', () => {
      const html = `
        <nav>
          <a href="/home">Home</a>
          <a href="/about">About</a>
        </nav>
        <main>
          <h1>Main Content</h1>
          <p>This is the actual content</p>
        </main>
        <footer>
          <p>Copyright 2024</p>
        </footer>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toMatchSnapshot()
      expect(chunks[0].content).not.toContain('Home')
      expect(chunks[0].content).not.toContain('About')
      expect(chunks[0].content).not.toContain('Copyright')
    })

    it('isolates main content from sidebar and aside', () => {
      const html = `
        <aside>Sidebar content</aside>
        <main>
          <h1>Article Title</h1>
          <p>Article content here</p>
        </main>
        <aside>Another sidebar</aside>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Article Title')
      expect(chunks[0].content).toContain('Article content')
      expect(chunks[0].content).not.toContain('Sidebar content')
      expect(chunks[0].content).not.toContain('Another sidebar')
    })

    it('filters out forms and interactive elements', () => {
      const html = `
        <main>
          <h1>Sign Up</h1>
          <p>Join our newsletter</p>
          <form>
            <input type="email" placeholder="Email">
            <button>Submit</button>
          </form>
          <h2>More Content</h2>
          <p>Additional information</p>
        </main>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Sign Up')
      expect(chunks[0].content).toContain('Join our newsletter')
      expect(chunks[0].content).not.toContain('Email')
      expect(chunks[0].content).not.toContain('Submit')
    })

    it('generates frontmatter from head section', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page Title</title>
          <meta name="description" content="Test page description">
          <meta property="og:image" content="https://example.com/image.png">
        </head>
        <body>
          <main>
            <h1>Main Heading</h1>
            <p>Content here</p>
          </main>
        </body>
        </html>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('---')
      expect(chunks[0].content).toContain('title:')
      expect(chunks[0].content).toContain('Test Page Title')
      expect(chunks[0].content).toContain('Main Heading')
    })

    it('handles tailwind classes without breaking content', () => {
      const html = `
        <main>
          <h1 class="text-3xl font-bold">Heading with Tailwind</h1>
          <p class="text-gray-600 mb-4">Paragraph with classes</p>
          <div class="flex gap-4">
            <span class="font-semibold">Bold text</span>
          </div>
        </main>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Heading with Tailwind')
      expect(chunks[0].content).toContain('Paragraph with classes')
      expect(chunks[0].content).toContain('**Bold text**')
    })

    it('combines minimal preset with custom plugins', () => {
      const html = `
        <nav>Skip this</nav>
        <main>
          <h1>Title</h1>
          <h2>Section 1</h2>
          <p>Content 1</p>
          <h2>Section 2</h2>
          <p>Content 2</p>
        </main>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        chunkSize: 100,
        chunkOverlap: 20,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).not.toContain('Skip this')
      expect(chunks[0].metadata.headers?.h1).toBe('Title')
    })

    it('works with origin option for link resolution', () => {
      const html = `
        <main>
          <h1>Article</h1>
          <p>Check out <a href="/page">this page</a></p>
          <img src="/image.png" alt="Test">
        </main>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        origin: 'https://example.com',
        headersToSplitOn: [TAG_H2],
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('https://example.com/page')
      expect(chunks[0].content).toContain('https://example.com/image.png')
    })

    it('preserves semantic content while filtering noise', () => {
      const html = `
        <header>
          <nav>
            <a href="/">Home</a>
          </nav>
        </header>
        <main>
          <article>
            <h1>Important Article</h1>
            <p>This is important content.</p>
            <h2>Subsection</h2>
            <p>More important information.</p>
          </article>
        </main>
        <aside>Advertisement</aside>
        <footer>© 2024</footer>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        stripHeaders: false,
      }))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Important Article')
      expect(chunks[0].content).toContain('This is important content')
      expect(chunks[0].content).not.toContain('Home')
      expect(chunks[0].content).not.toContain('Advertisement')
      expect(chunks[0].content).not.toContain('©')
    })

    it('handles complex real-world HTML structure', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Blog Post - Example Site</title>
          <meta name="description" content="An example blog post">
        </head>
        <body>
          <nav class="navbar">
            <a href="/">Home</a>
            <a href="/blog">Blog</a>
          </nav>

          <main class="container mx-auto px-4">
            <article>
              <h1 class="text-4xl font-bold mb-4">My Blog Post</h1>
              <p class="text-gray-600">Published on Jan 1, 2024</p>

              <h2 class="text-2xl mt-8">Introduction</h2>
              <p>This is the introduction paragraph with some <strong>bold text</strong>.</p>

              <h2 class="text-2xl mt-8">Main Content</h2>
              <p>Here's the main content of the post.</p>
              <pre><code class="language-javascript">const example = true;</code></pre>

              <h2 class="text-2xl mt-8">Conclusion</h2>
              <p>Final thoughts here.</p>
            </article>
          </main>

          <aside class="sidebar">
            <h3>Related Posts</h3>
            <ul>
              <li><a href="/post1">Post 1</a></li>
            </ul>
          </aside>

          <footer class="bg-gray-800 text-white">
            <p>© 2024 Example Site</p>
          </footer>
        </body>
        </html>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        headersToSplitOn: [TAG_H2],
        origin: 'https://example.com',
        stripHeaders: false,
      }))

      expect(chunks.length).toBe(3) // Split on each h2
      expect(chunks).toMatchSnapshot()

      // Check headers
      expect(chunks[0].metadata.headers?.h1).toBe('My Blog Post')
      expect(chunks[0].metadata.headers?.h2).toBe('Introduction')
      expect(chunks[1].metadata.headers?.h2).toBe('Main Content')
      expect(chunks[2].metadata.headers?.h2).toBe('Conclusion')

      // Check code metadata
      expect(chunks[1].metadata.code).toBe('javascript')

      // Check content filtering
      expect(chunks.every(c => !c.content.includes('navbar'))).toBe(true)
      expect(chunks.every(c => !c.content.includes('Related Posts'))).toBe(true)
      expect(chunks.every(c => !c.content.includes('© 2024'))).toBe(true)
    })

    it('chunks large content with minimal preset filters', () => {
      const longContent = 'Lorem ipsum dolor sit amet. '.repeat(100)
      const html = `
        <nav>Navigation</nav>
        <main>
          <h1>Article</h1>
          <p>${longContent}</p>
          <aside>Sidebar</aside>
          <p>${longContent}</p>
        </main>
        <footer>Footer</footer>
      `

      const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
        chunkSize: 500,
        chunkOverlap: 50,
        headersToSplitOn: [],
      }))

      expect(chunks.length).toBeGreaterThan(1)

      // All chunks should be filtered
      for (const chunk of chunks) {
        expect(chunk.content).not.toContain('Navigation')
        expect(chunk.content).not.toContain('Sidebar')
        expect(chunk.content).not.toContain('Footer')
        expect(chunk.content).toContain('Lorem ipsum')
      }
    })
  })

  describe('overlap behavior', () => {
    it('does not apply overlap on header-based splits', () => {
      const html = `
        <h2>Section 1</h2>
        <p>Content for section 1</p>
        <h2>Section 2</h2>
        <p>Content for section 2</p>
        <h2>Section 3</h2>
        <p>Content for section 3</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        chunkOverlap: 100, // Large overlap
        stripHeaders: false,
      })

      expect(chunks.length).toBe(3)

      // Verify no content duplication between chunks from header splits
      expect(chunks[0].content).toContain('Section 1')
      expect(chunks[0].content).not.toContain('Section 2')

      expect(chunks[1].content).toContain('Section 2')
      expect(chunks[1].content).not.toContain('Section 1')
      expect(chunks[1].content).not.toContain('Section 3')

      expect(chunks[2].content).toContain('Section 3')
      expect(chunks[2].content).not.toContain('Section 2')
    })

    it('applies overlap only on size-based splits', () => {
      const content = 'word '.repeat(200) // 1000 chars

      const html = `<p>${content}</p><p>${content}</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 600,
        chunkOverlap: 100,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks).toMatchSnapshot()
    })

    it('does not apply overlap on HR splits', () => {
      const html = `
        <p>Content before first HR</p>
        <hr>
        <p>Content after first HR</p>
        <hr>
        <p>Content after second HR</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [],
        chunkOverlap: 50,
      })

      expect(chunks.length).toBe(3)

      // Verify no duplication at HR boundaries
      expect(chunks[0].content).toContain('before first HR')
      expect(chunks[0].content).not.toContain('after first HR')

      expect(chunks[1].content).toContain('after first HR')
      expect(chunks[1].content).not.toContain('before first HR')
      expect(chunks[1].content).not.toContain('after second HR')

      expect(chunks[2].content).toContain('after second HR')
      expect(chunks[2].content).not.toContain('after first HR')
    })

    it('handles mixed header and size splits correctly', () => {
      const longContent = 'x'.repeat(800)

      const html = `
        <h2>First Section</h2>
        <p>${longContent}</p>
        <p>${longContent}</p>
        <h2>Second Section</h2>
        <p>Short content</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        headersToSplitOn: [TAG_H2],
        chunkSize: 1000,
        chunkOverlap: 100,
        stripHeaders: false,
      })

      // Should have at least 3 chunks:
      // 1. First section start (header + first long para)
      // 2. Rest of first section (size split with overlap)
      // 3. Second section (header split, no overlap)
      expect(chunks.length).toBeGreaterThanOrEqual(3)

      // First chunk should have the header
      expect(chunks[0].content).toContain('First Section')

      // Find where Second Section starts
      const secondSectionIdx = chunks.findIndex(c => c.content.includes('Second Section'))
      expect(secondSectionIdx).toBeGreaterThan(0)

      // Verify Second Section chunk doesn't have content from First Section
      expect(chunks[secondSectionIdx].content).not.toContain('First Section')
    })

    it('applies correct overlap amount on size splits', () => {
      const word = 'test'
      const content = (word + ' ').repeat(300) // ~1500 chars

      const chunks = htmlToMarkdownSplitChunks(`<p>${content}</p>`, {
        chunkSize: 800,
        chunkOverlap: 200,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks).toMatchSnapshot()
    })

    it('handles zero overlap correctly', () => {
      const content = 'a'.repeat(600)

      const html = `<p>${content}</p><p>${content}</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 500,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBeGreaterThan(1)

      // With zero overlap, chunks should be completely independent
      const allContent = chunks.map(c => c.content).join('')
      const individualLength = chunks.reduce((sum, c) => sum + c.content.length, 0)

      // Total length should equal sum of chunk lengths (no overlap)
      expect(Math.abs(allContent.length - individualLength)).toBeLessThan(10)
    })

    it('prevents infinite loops with overlap >= chunk length', () => {
      const html = `<p>${'x'.repeat(1000)}</p><p>${'y'.repeat(1000)}</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 500,
        chunkOverlap: 499, // Just under chunkSize
        headersToSplitOn: [],
      })

      // Should still make forward progress
      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.length).toBeLessThan(100) // Sanity check
    })
  })
})
