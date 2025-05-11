import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'
import { PreCodePlugin } from '../../../src/plugins'

describe('pre-code plugin', () => {
  it('detects language from code class', () => {
    const html = '<pre><code class="language-javascript">const x = 5;</code></pre>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [PreCodePlugin()],
    })

    expect(markdown).toBe('```javascript\nconst x = 5;\n```')
  })

  it('detects language from pre class', () => {
    const html = '<pre class="language-python"><code>def hello(): pass</code></pre>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [PreCodePlugin()],
    })

    expect(markdown).toBe('```python\ndef hello(): pass\n```')
  })

  it('detects language from common language names as classes', () => {
    const html = '<pre><code class="js">const x = 5;</code></pre>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [PreCodePlugin()],
    })

    expect(markdown).toBe('```js\nconst x = 5;\n```')
  })

  it('handles multiple classes correctly', () => {
    const html = '<pre><code class="highlight-code language-ruby">puts "Hello"</code></pre>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [PreCodePlugin()],
    })

    expect(markdown).toBe('```ruby\nputs "Hello"\n```')
  })

  it('code tag outside pre is still inline code', () => {
    const html = '<p>This is <code>inline code</code> within a paragraph.</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [PreCodePlugin()],
    })

    expect(markdown).toBe('This is `inline code` within a paragraph.')
  })

  it('falls back to blank language when no class is provided', () => {
    const html = '<pre><code>console.log("No language");</code></pre>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [PreCodePlugin()],
    })

    expect(markdown).toBe('```\nconsole.log("No language");\n```')
  })
})
