import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

const RE_CODE_BLOCK_WITH_FUNCTION = /```[\s\S]*function example.*if \(true\).*```/s
const RE_IF_TRUE_BLOCK = /^if \(true\) \{$/
const RE_CODE_BLOCK_WITH_LINES = /```.*Line 1.*Line 2.*Line 3.*```/s

describe.each(engines)('code blocks $name', (engineConfig) => {
  it('widens the fence past inner triple backticks instead of escaping (issue #149)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <pre><code>
function example() {
  // Look at this markdown code block:
  \`\`\`js
  const x = 42;
  \`\`\`
}
      </code></pre>
    `

    const markdown = htmlToMarkdown(html, { engine })

    // Backslash escapes are inert in GFM code — never emit them.
    expect(markdown).not.toContain('\\`')
    // Inner triple backticks are preserved literally.
    expect(markdown).toContain('```js')
    // The enclosing fence widens to four backticks so it outlives the inner run.
    expect(markdown).toContain('````')
  })

  it('handles nested code blocks properly', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <p>Here's a code block:</p>
      <pre><code class="language-javascript">
        // This shows a nested markdown block:
        \`\`\`python
        def hello():
            print("world")
        \`\`\`
      </code></pre>
    `

    const markdown = htmlToMarkdown(html, { engine })

    // Check formatting
    expect(markdown).toContain('Here\'s a code block:')
    // Fence widens to four backticks and keeps the language annotation.
    expect(markdown).toContain('````javascript')
    // Inner triple backticks are preserved literally, never backslash-escaped.
    expect(markdown).toContain('```python')
    expect(markdown).not.toContain('\\`')
  })

  it('preserves newlines within pre tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <pre><code>
function example() {
  // Has exactly these newlines
  // And this indentation

  if (true) {
    return 42;
  }
}
      </code></pre>
    `

    const markdown = htmlToMarkdown(html, { engine })

    // Check that newlines and whitespace are preserved
    expect(markdown).toMatch(RE_CODE_BLOCK_WITH_FUNCTION)

    // Verify that there's a blank line between the indentation comment and the if statement
    const lines = markdown.split('\n')
    const indentationLineIndex = lines.findIndex(line => line.includes('// And this indentation'))
    expect(lines[indentationLineIndex + 1].trim()).toEqual('')
    expect(lines[indentationLineIndex + 2].trim()).toMatch(RE_IF_TRUE_BLOCK)

    // Verify indentation is preserved
    expect(markdown).toContain('  // Has exactly')
    expect(markdown).toContain('    return 42;')
  })

  it('preserves multiple newlines within pre tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<pre><code>Line 1


Line 2 after two blank lines

Line 3 after one blank line</code></pre>`

    const markdown = htmlToMarkdown(html, { engine })

    // Check that multiple consecutive newlines are preserved
    expect(markdown).toMatch(RE_CODE_BLOCK_WITH_LINES)

    // Verify that double newlines are preserved
    expect(markdown).toContain('Line 1\n\n\nLine 2')

    // Verify that single newlines are preserved
    expect(markdown).toContain('blank lines\n\nLine 3')
  })

  it('simple code block markdown preserve new lines', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `  <pre><code class="hljs language-markdown"><span class="hljs-section"># A first-level heading</span>
<span class="hljs-section">## A second-level heading</span>
<span class="hljs-section">### A third-level heading</span>
</code></pre>`
    const markdown = htmlToMarkdown(html, { engine })

    // Check that newlines are preserved
    expect(markdown).toBe('```markdown\n# A first-level heading\n## A second-level heading\n### A third-level heading\n```')
  })

  it('preserves new lines md code block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // We need to test that newlines between headings and regular text are preserved properly
    const html = `<pre><code class="hljs language-markdown"><span class="hljs-section"># Heading with newline</span>

<span class="hljs-section">## Subheading with newline</span>

Some text with newlines around it.

<span class="hljs-section">## Another subheading</span>
Text without newline above.
</code></pre>`

    // The test is verifying that the newlines between headings are preserved exactly
    const markdown = htmlToMarkdown(html, { engine })

    // This test verifies that newlines in markdown code blocks are preserved exactly
    // The key issue here is making sure that newlines between headings in markdown are maintained

    // Extract lines from the output to test specific formatting
    const lines = markdown.split('\n')

    // Find indices of significant lines
    const headingLine = lines.find(line => line.includes('# Heading with newline'))
    const textBeforeSecondHeading = lines.find(line => line.trim() === 'Some text with newlines around it.')

    // Make assertions about the content to verify formatting is preserved
    expect(headingLine).toBeDefined()
    expect(textBeforeSecondHeading).toBeDefined()
    expect(markdown).toBe('```markdown\n# Heading with newline\n\n## Subheading with newline\n\nSome text with newlines around it.\n\n## Another subheading\nText without newline above.\n```')

    // Check for format-specific elements like newlines around headings
    expect(markdown).toContain('# Heading with newline\n\n## Subheading with newline')
  })
  it('converts inline code', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Use the <code>print()</code> function</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('Use the `print()` function')
  })

  it('converts code blocks without language', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code>function example() {\n  return true;\n}</code></pre>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('```\nfunction example() {\n  return true;\n}\n```')
  })

  it('converts code blocks with language', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code class="language-javascript">const x = 1;</code></pre>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('```javascript\nconst x = 1;\n```')
  })

  // Regression guard for issue #98: a CDATA section inside <pre><code> must be
  // dropped by default (no tagOverrides), leaving the code block intact rather
  // than leaking the content or breaking the surrounding markup.
  it('drops CDATA sections inside code blocks by default (issue #98)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code><![CDATA[\none two\nthree four\n]]></code></pre>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('```\n\n```')
  })
})
