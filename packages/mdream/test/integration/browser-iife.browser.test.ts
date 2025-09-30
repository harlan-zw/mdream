import { page } from '@vitest/browser/context'
import { describe, expect, it } from 'vitest'

// Browser bundle tests for mdream
// These tests verify the browser bundle works and exposes window.mdream global
describe('mdream browser bundle', () => {
  it('should load browser bundle and expose window.mdream global', async () => {
    // Create script tag to load the IIFE bundle
    const script = document.createElement('script')
    script.src = '/dist/browser/browser.js'
    script.type = 'text/javascript'

    // Wait for script to load
    await new Promise((resolve, reject) => {
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })

    // Verify window.mdream is available
    expect(window.mdream).toBeDefined()
    expect(window.mdream.htmlToMarkdown).toBeDefined()
    expect(typeof window.mdream.htmlToMarkdown).toBe('function')

    // Create status display
    const statusDiv = document.createElement('div')
    statusDiv.id = 'iife-status'
    statusDiv.innerHTML = `
      <h3>IIFE Bundle Status:</h3>
      <pre>✓ window.mdream: ${window.mdream ? 'available' : 'missing'}
✓ htmlToMarkdown: ${window.mdream?.htmlToMarkdown ? 'available' : 'missing'}</pre>
    `
    document.body.appendChild(statusDiv)

    await expect.element(page.getByText('window.mdream: available')).toBeInTheDocument()
    await expect.element(page.getByText('htmlToMarkdown: available')).toBeInTheDocument()
  })

  it('should convert HTML to markdown using window.mdream.htmlToMarkdown', async () => {
    // Ensure IIFE is loaded (from previous test)
    if (!window.mdream) {
      const script = document.createElement('script')
      script.src = '/dist/browser/browser.js'
      document.head.appendChild(script)
      await new Promise(resolve => script.onload = resolve)
    }

    // Test basic conversion
    const simpleHtml = '<h1>Hello World</h1><p>This is a <strong>test</strong>.</p>'
    const result = window.mdream.htmlToMarkdown(simpleHtml)

    expect(result).toContain('# Hello World')
    expect(result).toContain('This is a **test**.')

    // Render result to DOM
    const resultDiv = document.createElement('div')
    resultDiv.id = 'conversion-result'
    resultDiv.style.fontFamily = 'monospace'
    resultDiv.style.whiteSpace = 'pre-wrap'
    resultDiv.textContent = result
    document.body.appendChild(resultDiv)

    await expect.element(page.getByText('# Hello World')).toBeInTheDocument()
    await expect.element(page.getByText('This is a **test**.')).toBeInTheDocument()
  })

  it('should handle complex HTML structures via IIFE', async () => {
    // Ensure IIFE is loaded
    if (!window.mdream) {
      const script = document.createElement('script')
      script.src = '/dist/browser/browser.js'
      document.head.appendChild(script)
      await new Promise(resolve => script.onload = resolve)
    }

    const complexHtml = `
      <article>
        <h2>Blog Post Title</h2>
        <p>Introduction with <em>emphasis</em> and <a href="https://example.com">external link</a>.</p>
        <ul>
          <li>First item</li>
          <li>Second item with <code>inline code</code></li>
          <li>Third item</li>
        </ul>
        <blockquote>
          <p>Important quote here.</p>
        </blockquote>
        <table>
          <thead>
            <tr><th>Column 1</th><th>Column 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </tbody>
        </table>
      </article>
    `

    const result = window.mdream.htmlToMarkdown(complexHtml)

    // Verify conversions
    expect(result).toContain('## Blog Post Title')
    expect(result).toContain('Introduction with _emphasis_')
    expect(result).toContain('[external link](https://example.com)')
    expect(result).toContain('- First item')
    expect(result).toContain('`inline code`')
    expect(result).toContain('> Important quote here.')
    expect(result).toContain('| Column 1 | Column 2 |')

    // Display result
    const complexResultDiv = document.createElement('div')
    complexResultDiv.id = 'complex-result'
    complexResultDiv.style.fontFamily = 'monospace'
    complexResultDiv.style.whiteSpace = 'pre-wrap'
    complexResultDiv.textContent = result
    document.body.appendChild(complexResultDiv)

    await expect.element(page.getByText('## Blog Post Title')).toBeInTheDocument()
    await expect.element(page.getByText('- First item')).toBeInTheDocument()
    await expect.element(page.getByText('> Important quote here.')).toBeInTheDocument()
  })

  it('should work with interactive HTML conversion via CDN pattern', async () => {
    // Ensure IIFE is loaded
    if (!window.mdream) {
      const script = document.createElement('script')
      script.src = '/dist/browser/browser.js'
      document.head.appendChild(script)
      await new Promise(resolve => script.onload = resolve)
    }

    // Create interactive demo matching CDN usage pattern
    document.body.innerHTML = `
      <div style="padding: 20px; max-width: 800px; margin: 0 auto; font-family: system-ui, sans-serif;">
        <h2>🌐 MDream CDN Demo</h2>
        <p>This demonstrates using <code>window.mdream.htmlToMarkdown()</code> directly in the browser:</p>

        <div style="margin: 20px 0;">
          <label for="html-input" style="display: block; font-weight: bold; margin-bottom: 5px;">HTML Input:</label>
          <textarea
            id="html-input"
            rows="8"
            style="width: 100%; padding: 10px; font-family: monospace; border: 1px solid #ddd; border-radius: 4px;"
            placeholder="Enter HTML to convert...">
<article>
  <h1>Welcome to MDream!</h1>
  <p>Convert HTML to Markdown <strong>instantly</strong> in the browser.</p>
  <ul>
    <li>No build step required</li>
    <li>Works via <code>unpkg</code> or <code>jsDelivr</code></li>
    <li>Optimized for <em>LLMs</em></li>
  </ul>
  <blockquote>
    <p>Perfect for quick conversions and prototyping!</p>
  </blockquote>
</article>
          </textarea>
        </div>

        <button
          id="convert-btn"
          style="background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 16px;">
          🔄 Convert to Markdown
        </button>

        <div style="margin: 20px 0;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">Markdown Output:</label>
          <pre
            id="markdown-output"
            style="background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 15px; white-space: pre-wrap; font-family: monospace; min-height: 100px; overflow-x: auto;"></pre>
        </div>
      </div>
    `

    // Set up conversion functionality
    const convertBtn = document.getElementById('convert-btn')!
    const htmlInput = document.getElementById('html-input') as HTMLTextAreaElement
    const markdownOutput = document.getElementById('markdown-output')!

    convertBtn.addEventListener('click', () => {
      const html = htmlInput.value
      const markdown = window.mdream.htmlToMarkdown(html)
      markdownOutput.textContent = markdown
    })

    // Verify interface is ready
    await expect.element(page.getByText('MDream CDN Demo')).toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: /Convert to Markdown/ })).toBeInTheDocument()

    // Perform conversion
    await page.getByRole('button', { name: /Convert to Markdown/ }).click()

    // Verify conversion results
    await expect.element(page.getByText('# Welcome to MDream!')).toBeInTheDocument()
    await expect.element(page.getByText('Convert HTML to Markdown **instantly**')).toBeInTheDocument()
    await expect.element(page.getByText('- No build step required')).toBeInTheDocument()
    await expect.element(page.getByText('Works via `unpkg`')).toBeInTheDocument()
    await expect.element(page.getByText('> Perfect for quick conversions')).toBeInTheDocument()
  })

  it('should handle edge cases and entities in IIFE mode', async () => {
    // Ensure IIFE is loaded
    if (!window.mdream) {
      const script = document.createElement('script')
      script.src = '/dist/browser/browser.js'
      document.head.appendChild(script)
      await new Promise(resolve => script.onload = resolve)
    }

    // Test HTML entities and special characters
    const entityHtml = `
      <div>
        <p>Testing entities: &amp; &lt; &gt; &quot; &#39;</p>
        <p>Unicode: 🌟 ✨ 🚀</p>
        <p>Code: <code>&lt;script&gt;alert('test')&lt;/script&gt;</code></p>
      </div>
    `

    const result = window.mdream.htmlToMarkdown(entityHtml)

    expect(result).toContain('Testing entities: & < > " \'')
    expect(result).toContain('Unicode: 🌟 ✨ 🚀')
    expect(result).toContain('`<script>alert(\'test\')</script>`')

    // Display for verification
    const entityDiv = document.createElement('div')
    entityDiv.id = 'entity-test'
    entityDiv.style.fontFamily = 'monospace'
    entityDiv.style.whiteSpace = 'pre-wrap'
    entityDiv.textContent = result
    document.body.appendChild(entityDiv)

    await expect.element(page.getByText('Testing entities: & < >')).toBeInTheDocument()
    await expect.element(page.getByText('Unicode: 🌟 ✨ 🚀')).toBeInTheDocument()
  })
})

// Extend global window interface for TypeScript
declare global {
  interface Window {
    mdream: {
      htmlToMarkdown: (html: string, options?: any) => string
    }
  }
}