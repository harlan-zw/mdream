import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, htmlToMarkdownStream } from '../src/index.js'

describe('htmlToMarkdown with AST', () => {
  it('converts basic HTML to Markdown', async () => {
    const html = '<h1>Hello World</h1><p>This is a paragraph</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('# Hello World\n\nThis is a paragraph')
  })

  it('handles links', async () => {
    const html = '<p>This is a <a href="https://example.com">link</a>.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is a [link](https://example.com).')
  })

  it('handles formatting', async () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** and *italic* text.')
  })

  it('handles code blocks', async () => {
    const html = '<pre><code class="language-js">const x = 1;</code></pre>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('```js\nconst x = 1;\n```')
  })

  it('handles lists', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Item 1\n- Item 2')
  })

  it('handles nested lists', async () => {
    const html = '<ul><li>Item 1<ul><li>Nested item</li></ul></li><li>Item 2</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Item 1\n  - Nested item\n- Item 2')
  })

  it('handles images', async () => {
    const html = '<p><img src="image.jpg" alt="An image"></p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('![An image](image.jpg)')
  })

  it('handles blockquotes', async () => {
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote')
  })

  it('respects chunk size option', async () => {
    const html = '<h1>Title</h1><p>Long paragraph text</p>'
    const markdown = await htmlToMarkdown(html, {
      chunkSize: 10,
    })
    expect(markdown).toBe('# Title\n\nLong paragraph text')
  })
})

describe('htmlToMarkdownStream', () => {
  it('streams HTML to Markdown conversion', async () => {
    const html = '<h1>Hello World</h1><p>This is a paragraph with <strong>bold</strong> text.</p>'
    const stream = htmlToMarkdownStream(html)

    // Collect chunks from the stream
    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    // Ensure we have at least one chunk
    expect(chunks.length).toBeGreaterThan(0)

    // Recombine and check the content
    const fullMarkdown = chunks.join('')
    expect(fullMarkdown).toBe('# Hello World\n\nThis is a paragraph with **bold** text.')
  })
})

describe('gitHub Markdown Features', () => {
  it('handles strikethrough text', async () => {
    const html = '<p>This was <del>mistaken text</del>.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This was ~~mistaken text~~.')
  })

  it('handles subscript text', async () => {
    const html = '<p>This is a <sub>subscript</sub> text.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is a <sub>subscript</sub> text.')
  })

  it('handles superscript text', async () => {
    const html = '<p>This is a <sup>superscript</sup> text.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is a <sup>superscript</sup> text.')
  })

  it('handles underlined text', async () => {
    const html = '<p>This is an <ins>underlined</ins> text.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is an <ins>underlined</ins> text.')
  })

  it('handles task lists with checkboxes', async () => {
    const html = '<ul><li><input type="checkbox" checked> Completed task</li><li><input type="checkbox"> Pending task</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- [x] Completed task\n- [ ] Pending task')
  })

  it('handles alerts with different types', async () => {
    const html = `
      <blockquote>
        <p>[!NOTE]<br>
        This is a note alert.</p>
      </blockquote>
      <blockquote>
        <p>[!WARNING]<br>
        This is a warning alert.</p>
      </blockquote>
    `
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toContain('> [!NOTE]')
    expect(markdown).toContain('> This is a note alert.')
    expect(markdown).toContain('> [!WARNING]')
    expect(markdown).toContain('> This is a warning alert.')
  })

  it('handles tables with column alignment', async () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th align="left">Left</th>
            <th align="center">Center</th>
            <th align="right">Right</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
            <td>Data 3</td>
          </tr>
        </tbody>
      </table>
    `
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toContain('| Left | Center | Right |')
    expect(markdown).toContain('| :--- | :---: | ---: |')
    expect(markdown).toContain('| Data 1 | Data 2 | Data 3 |')
  })

  it('handles inline code', async () => {
    const html = '<p>Use <code>git status</code> to list all modified files.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Use `git status` to list all modified files.')
  })

  it('handles code blocks with language', async () => {
    const html = '<pre><code class="language-javascript">const x = 1;\nconsole.log(x);</code></pre>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('```javascript\nconst x = 1;\nconsole.log(x);\n```')
  })

  it('handles blockquotes', async () => {
    const html = '<blockquote><p>This is a quoted text.</p></blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> This is a quoted text.')
  })

  it('handles nested blockquotes', async () => {
    const html = '<blockquote><p>Outer quote</p><blockquote><p>Inner quote</p></blockquote></blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toContain('> Outer quote')
    expect(markdown).toContain('> > Inner quote')
  })

  it('preserves HTML comments', async () => {
    const html = '<p>Visible content</p><!-- Hidden comment --><p>More content</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toContain('Visible content')
    expect(markdown).toContain('<!-- Hidden comment -->')
    expect(markdown).toContain('More content')
  })

  it('handles complex nested formatting', async () => {
    const html = '<p>This text is <strong>bold and <em>contains italic</em> text</strong>.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This text is **bold and *contains italic* text**.')
  })

  it('handles line breaks correctly', async () => {
    const html = '<p>First line<br>Second line</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('First line\nSecond line')
  })

  it('handles horizontal rules', async () => {
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })
})
