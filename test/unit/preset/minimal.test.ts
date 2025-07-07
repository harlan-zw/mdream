import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { withMinimalPreset } from '../../../src/preset/minimal.ts'

describe('withMinimalPreset', () => {
  it('should convert basic HTML to markdown', () => {
    const html = '<h1>Hello World</h1><p>This is a paragraph.</p>'
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, options)
    expect(markdown).toBe('# Hello World\n\nThis is a paragraph.')
  })

  it('should filter out excluded tags', () => {
    const html = `
      <h1>Title</h1>
      <p>Content</p>
      <form>
        <input type="text" />
        <button>Submit</button>
      </form>
      <nav>Navigation</nav>
      <footer>Footer</footer>
    `
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, options)
    expect(markdown).not.toContain('Submit')
    expect(markdown).not.toContain('Navigation')
    expect(markdown).not.toContain('Footer')
    expect(markdown).toContain('Title')
    expect(markdown).toContain('Content')
  })

  it('should apply plugins correctly', () => {
    // Test filtering functionality
    const html = `<h1>Title</h1><form><button>Submit</button></form><p>Content</p>`
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, options)

    // Should filter out form elements
    expect(markdown).not.toContain('Submit')
    expect(markdown).toContain('Title')
    expect(markdown).toContain('Content')
  })

  it('should extract frontmatter', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Test description" />
        </head>
        <body>
          <h1>Main Content</h1>
        </body>
      </html>
    `
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, options)

    expect(markdown).toContain('---')
    expect(markdown).toContain('title: "Test Page"')
    expect(markdown).toContain('description: "Test description"')
    expect(markdown).toContain('Main Content')
  })

  it('should isolate main content', () => {
    const html = `<header>Header</header><h1>Main Title</h1><p>Content</p><footer>Footer</footer>`
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, options)

    expect(markdown).toContain('Main Title')
    expect(markdown).toContain('Content')
    expect(markdown).not.toContain('Header')
    expect(markdown).not.toContain('Footer')
  })

  it('should merge with existing plugins', () => {
    let customPluginCalled = false
    const customPlugin = {
      onNodeEnter: () => {
        customPluginCalled = true
        return ''
      },
    }

    const options = withMinimalPreset({ plugins: [customPlugin] })
    const markdown = htmlToMarkdown('<h1>Test</h1>', options)
    expect(customPluginCalled).toBe(true)
    expect(markdown).toContain('Test')
  })
})
