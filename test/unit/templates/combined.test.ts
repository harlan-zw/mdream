import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

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
    const markdown = syncHtmlToMarkdown(html)
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
