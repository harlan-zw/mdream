import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../src/index.js'
import {parseHTML} from "../src/parser.js";

describe('headings', () => {
  it('converts h1', async () => {
    const html = '<h1>Heading 1</h1>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', async () => {
    const html = '<h2>Heading 2</h2>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', async () => {
    const html = '<h3>Heading 3</h3>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', async () => {
    const html = '<h4>Heading 4</h4>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', async () => {
    const html = '<h5>Heading 5</h5>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', async () => {
    const html = '<h6>Heading 6</h6>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('###### Heading 6')
  })
})

describe('paragraphs and Line Breaks', () => {
  it('converts paragraphs', async () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('First paragraph\n\nSecond paragraph')
  })

  it('converts line breaks', async () => {
    const html = '<p>Line 1<br>Line 2</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Line 1\nLine 2')
  })
})

describe('text Formatting', () => {
  it('converts bold text with <strong>', async () => {
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', async () => {
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', async () => {
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is *italic* text')
  })

  it('converts italic text with <i>', async () => {
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is *italic* text')
  })

  it('handles nested formatting', async () => {
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is ***bold and italic*** text')
  })
})

describe('links', () => {
  it('converts simple links', async () => {
    const html = '<a href="https://example.com">Example</a>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links with titles', async () => {
    const html = '<a href="https://example.com" title="Example Site">Example</a>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links in paragraphs', async () => {
    const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Visit [Example](https://example.com) for more info.')
  })
})

describe('images', () => {
  it('converts simple images', async () => {
    const html = '<img src="image.jpg" alt="Description">'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('![Description](image.jpg)')
  })

  it('handles images without alt text', async () => {
    const html = '<img src="image.jpg">'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('![](image.jpg)')
  })

  it('handles images in paragraphs', async () => {
    const html = '<p>An image: <img src="image.jpg" alt="Description"></p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('An image: ![Description](image.jpg)')
  })
})

describe('lists', () => {
  it('converts unordered lists', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Item 1\n- Item 2')
  })

  it('converts ordered lists', async () => {
    const html = '<ol><li>First</li><li>Second</li></ol>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('1. First\n2. Second')
  })

  it('handles nested unordered lists', async () => {
    const html = '<ul><li>Level 1<ul><li>Level 2</li></ul></li><li>Another Level 1</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Level 1\n  - Level 2\n- Another Level 1')
  })

  it('handles nested ordered lists', async () => {
    const html = '<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('1. Level 1\n  1. Level 1.1\n2. Level 2')
  })

  it('handles mixed nested lists', async () => {
    const html = '<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Unordered\n  1. Ordered')
  })
})

describe('code', () => {
  it('converts inline code', async () => {
    const html = '<p>Use the <code>print()</code> function</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Use the `print()` function')
  })

  it('converts code blocks without language', async () => {
    const html = '<pre><code>function example() {\n  return true;\n}</code></pre>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('```\nfunction example() {\n  return true;\n}\n```')
  })

  it('converts code blocks with language', async () => {
    const html = '<pre><code class="language-javascript">const x = 1;</code></pre>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('```javascript\nconst x = 1;\n```')
  })
})



describe('html Entities', () => {
  it('decodes common HTML entities', async () => {
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', async () => {
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('© — 😀')
  })
})

describe('combined Elements', () => {
  it('handles complex content with multiple element types', async () => {
    const html = `
      <h1>Document Title</h1>
      <p>This is a <strong>bold</strong> and <em>important</em> paragraph with a <a href="https://example.com">link</a>.</p>
      <ul>
        <li>Item with <code>inline code</code></li>
        <li>Item with <a href="https://example.org">another link</a></li>
      </ul>
      <blockquote>
        <p>A quote with an <img src="image.jpg" alt="image"> inside.</p>
      </blockquote>
      <pre><code class="language-js">console.log("Hello world!");</code></pre>
    `
    const doc = parseHTML(html)
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '# Document Title\n\n'
      + 'This is a **bold** and *important* paragraph with a [link](https://example.com).\n\n'
      + '- Item with `inline code`\n'
      + '- Item with [another link](https://example.org)\n\n'
      + '> A quote with an ![image](image.jpg) inside.\n\n'
      + '```js\nconsole.log("Hello world!");\n```',
    )
  })
})

