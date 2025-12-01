import { page } from '@vitest/browser/context'
import { describe, expect, it } from 'vitest'

// Helper function to render markdown to DOM
function renderMarkdown(markdown: string) {
  // Clear existing content
  document.body.innerHTML = ''

  // Create a container for the markdown
  const container = document.createElement('div')
  container.id = 'markdown-output'
  container.style.fontFamily = 'monospace'
  container.style.whiteSpace = 'pre-wrap'
  container.textContent = markdown

  document.body.appendChild(container)
  return container
}

// Browser compatibility tests for mdream
// These tests run in a real browser environment and test actual DOM output
describe('mdream browser compatibility', () => {
  it('should convert HTML to markdown and display correctly in DOM', async () => {
    // Dynamically import mdream to test actual module loading in browser
    const { htmlToMarkdown } = await import('../../src/index.ts')

    // Test basic HTML to Markdown conversion
    const simpleHtml = '<p>Hello <strong>world</strong>!</p>'
    const result = htmlToMarkdown(simpleHtml)

    // Render to DOM and verify
    renderMarkdown(result)
    await expect.element(page.getByText('Hello **world**!')).toBeInTheDocument()

    // Test complex HTML structures
    const complexHtml = `
      <div>
        <h1>Main Title</h1>
        <p>This is a paragraph with <em>emphasis</em> and <a href="/test">a link</a>.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2 with <code>code</code></li>
        </ul>
        <blockquote>
          <p>This is a quote</p>
        </blockquote>
      </div>
    `

    const complexResult = htmlToMarkdown(complexHtml)
    renderMarkdown(complexResult)

    // Verify all elements are properly converted and displayed
    await expect.element(page.getByText('# Main Title')).toBeInTheDocument()
    await expect.element(page.getByText('This is a paragraph with _emphasis_')).toBeInTheDocument()
    await expect.element(page.getByText('[a link](/test)')).toBeInTheDocument()
    await expect.element(page.getByText('- Item 1')).toBeInTheDocument()
    await expect.element(page.getByText('- Item 2 with `code`')).toBeInTheDocument()
    await expect.element(page.getByText('> This is a quote')).toBeInTheDocument()
  })

  it('should not include Node.js APIs in browser environment', async () => {
    // Verify that Node.js specific functionality is not available
    const mdreamModule = await import('../../src/index.ts')

    // Create a status display in DOM
    const statusDiv = document.createElement('div')
    statusDiv.id = 'api-status'
    document.body.appendChild(statusDiv)

    // Test core functionality availability
    const coreApis = ['htmlToMarkdown', 'parseHtml', 'MarkdownProcessor', 'createPlugin']
    const coreResults = coreApis.map(api => `✓ ${api}: ${api in mdreamModule ? 'available' : 'missing'}`)

    // Test Node.js API exclusion
    const nodeApis = ['generateLlmsTxtArtifacts']
    const nodeResults = nodeApis.map(api => `✓ ${api}: ${api in mdreamModule ? 'LEAKED' : 'properly excluded'}`)

    statusDiv.innerHTML = `
      <h3>Core APIs:</h3>
      <pre>${coreResults.join('\n')}</pre>
      <h3>Node.js APIs:</h3>
      <pre>${nodeResults.join('\n')}</pre>
    `

    // Verify through DOM
    await expect.element(page.getByText('htmlToMarkdown: available')).toBeInTheDocument()
    await expect.element(page.getByText('generateLlmsTxtArtifacts: properly excluded')).toBeInTheDocument()
  })

  it('should handle browser environment edge cases in DOM', async () => {
    const { htmlToMarkdown } = await import('../../src/index.ts')

    // Test with special characters and entities
    const entityHtml = '<p>Test &amp; HTML entities like &lt;script&gt; and &quot;quotes&quot;</p>'
    const entityResult = htmlToMarkdown(entityHtml)

    renderMarkdown(entityResult)
    await expect.element(page.getByText('Test & HTML entities')).toBeInTheDocument()
    await expect.element(page.getByText('<script>')).toBeInTheDocument()
    await expect.element(page.getByText('"quotes"')).toBeInTheDocument()

    // Test with malformed HTML (browser tolerant)
    const malformedHtml = '<p>Unclosed paragraph<div>Mixed content<span>nested</span></div>'
    const malformedResult = htmlToMarkdown(malformedHtml)

    renderMarkdown(malformedResult)
    await expect.element(page.getByText('Unclosed paragraph')).toBeInTheDocument()
    await expect.element(page.getByText('Mixed content')).toBeInTheDocument()
    await expect.element(page.getByText('nested')).toBeInTheDocument()
  })

  it('should work with plugins in browser environment', async () => {
    const { htmlToMarkdown, createPlugin } = await import('../../src/index.ts')

    // Create a simple plugin that transforms certain elements
    const testPlugin = createPlugin({
      onNodeEnter(element) {
        if (element.name === 'mark') {
          return '==' // Custom highlighting syntax
        }
      },
      onNodeExit(element) {
        if (element.name === 'mark') {
          return '=='
        }
      },
    })

    const htmlWithMark = '<p>This is <mark>highlighted text</mark> in a paragraph.</p>'
    const result = htmlToMarkdown(htmlWithMark, {
      plugins: [testPlugin],
    })

    renderMarkdown(result)
    await expect.element(page.getByText('This is ==highlighted text== in a paragraph.')).toBeInTheDocument()
  })

  it('should handle interactive HTML-to-Markdown conversion', async () => {
    const { htmlToMarkdown } = await import('../../src/index.ts')

    // Create an interactive demo in the DOM
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>Interactive HTML to Markdown Converter</h2>
        <div>
          <label for="html-input">HTML Input:</label>
          <textarea id="html-input" rows="8" cols="50" placeholder="Enter HTML here...">
<article>
  <h1>Sample Blog Post</h1>
  <p>This is a <strong>sample</strong> blog post with <em>various</em> formatting.</p>
  <ul>
    <li>List item 1</li>
    <li>List item 2 with <code>code</code></li>
  </ul>
  <blockquote>
    <p>A wise quote goes here.</p>
  </blockquote>
</article>
          </textarea>
        </div>
        <button id="convert-btn">Convert to Markdown</button>
        <div>
          <label for="markdown-output">Markdown Output:</label>
          <pre id="markdown-output" style="border: 1px solid #ccc; padding: 10px; background: #f5f5f5; white-space: pre-wrap;"></pre>
        </div>
      </div>
    `

    // Set up the conversion functionality
    const convertBtn = document.getElementById('convert-btn')!
    const htmlInput = document.getElementById('html-input') as HTMLTextAreaElement
    const markdownOutput = document.getElementById('markdown-output')!

    convertBtn.addEventListener('click', () => {
      const html = htmlInput.value
      const markdown = htmlToMarkdown(html)
      markdownOutput.textContent = markdown
    })

    // Test the interactive conversion
    await expect.element(page.getByText('Interactive HTML to Markdown Converter')).toBeInTheDocument()

    // Click the convert button
    await page.getByRole('button', { name: 'Convert to Markdown' }).click()

    // Verify the conversion worked
    await expect.element(page.getByText('# Sample Blog Post')).toBeInTheDocument()
    await expect.element(page.getByText('This is a **sample** blog post')).toBeInTheDocument()
    await expect.element(page.getByText('- List item 1')).toBeInTheDocument()
    await expect.element(page.getByText('> A wise quote goes here.')).toBeInTheDocument()
  })
})
