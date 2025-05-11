import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown, withContentAnalysisPreset } from '../src'

describe('content-analysis preset', () => {
  it('includes frontmatter by default', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Page Description">
        </head>
        <body>
          <nav>Navigation Menu</nav>
          <h1>Main Heading</h1>
          <p>Content paragraph</p>
          <footer>Footer content</footer>
        </body>
      </html>
    `

    const markdown = syncHtmlToMarkdown(html, withContentAnalysisPreset())

    // Verify frontmatter is present
    expect(markdown).toContain('---')
    expect(markdown).toContain('title: "Test Page"')
    expect(markdown).toContain('description: "Page Description"')

    // Verify excluded elements are not present
    expect(markdown).not.toContain('Navigation Menu')
    expect(markdown).not.toContain('Footer content')

    // Verify content is present
    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('Content paragraph')
  })

  it('can disable frontmatter', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Page Description">
        </head>
        <body>
          <h1>Main Heading</h1>
          <p>Content paragraph</p>
        </body>
      </html>
    `

    const markdown = syncHtmlToMarkdown(html, withContentAnalysisPreset({
      frontmatter: false,
    }))

    // Verify frontmatter is not present
    expect(markdown).not.toContain('---')
    expect(markdown).not.toContain('title: "Test Page"')

    // Verify content is present
    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('Content paragraph')
  })

  it('supports fromFirstTag option', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <div>Initial content</div>
          <h1>Main Heading</h1>
          <p>Content after heading</p>
        </body>
      </html>
    `

    const markdown = syncHtmlToMarkdown(html, withContentAnalysisPreset({
      fromFirstTag: 'h1',
    }))

    // Verify frontmatter is present (default behavior)
    expect(markdown).toContain('---')
    expect(markdown).toContain('title: "Test Page"')

    // Verify content before h1 is filtered out
    expect(markdown).not.toContain('Initial content')

    // Verify content from h1 onwards is present
    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('Content after heading')
  })

  it('supports additional frontmatter fields', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <h1>Main Heading</h1>
        </body>
      </html>
    `

    const markdown = syncHtmlToMarkdown(html, withContentAnalysisPreset({
      additionalFields: {
        author: 'Test Author',
        date: '2025-05-10',
      },
    }))

    // Verify additional frontmatter fields are present
    expect(markdown).toContain('author: Test Author')
    expect(markdown).toContain('date: 2025-05-10')
  })

  it('supports custom meta fields', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="custom-field" content="Custom Value">
        </head>
        <body>
          <h1>Main Heading</h1>
        </body>
      </html>
    `

    const markdown = syncHtmlToMarkdown(html, withContentAnalysisPreset({
      metaFields: ['custom-field'],
    }))

    // Verify custom meta field is included in frontmatter
    expect(markdown).toContain('custom-field: "Custom Value"')
  })
})
