import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

const RE_CODE_BLOCK_WITH_FUNCTION = /```[\s\S]*function example.*if \(true\).*```/s
const RE_IF_TRUE_BLOCK = /^if \(true\) \{$/
const RE_CODE_BLOCK_WITH_LINES = /```.*Line 1.*Line 2.*Line 3.*```/s

describe.each(engines)('code blocks $name', (engineConfig) => {
  it('escapes triple backticks within code blocks', async () => {
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

    const markdown = htmlToMarkdown(html, { engine }).markdown

    // The triple backticks should be escaped
    expect(markdown).toContain('\\`\\`\\`js')
    expect(markdown).toContain('\\`\\`\\`')
    // Triple backticks should not appear unescaped
    expect(markdown).not.toContain('```js')
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

    const markdown = htmlToMarkdown(html, { engine }).markdown

    // Check formatting
    expect(markdown).toContain('Here\'s a code block:')
    // Check for language annotation
    expect(markdown).toContain('```javascript')
    // Check for escaped backticks
    expect(markdown).toContain('\\`\\`\\`python')
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

    const markdown = htmlToMarkdown(html, { engine }).markdown

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

    const markdown = htmlToMarkdown(html, { engine }).markdown

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
    const markdown = htmlToMarkdown(html, { engine }).markdown

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
    const markdown = htmlToMarkdown(html, { engine }).markdown

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
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('Use the `print()` function')
  })

  it('converts code blocks without language', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code>function example() {\n  return true;\n}</code></pre>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('```\nfunction example() {\n  return true;\n}\n```')
  })

  it('converts code blocks with language', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code class="language-javascript">const x = 1;</code></pre>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('```javascript\nconst x = 1;\n```')
  })
})
