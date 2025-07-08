import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.js'
import { frontmatterPlugin } from '../../../src/plugins/frontmatter.js'

describe('frontmatter plugin', () => {
  it('extracts title and description from head', () => {
    const html = `
      <html>
        <head>
          <title>Test Page Title</title>
          <meta name="description" content="This is a test page description">
        </head>
        <body>
          <h1>Main Content</h1>
          <p>This is the main content of the page.</p>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [frontmatterPlugin()],
    })

    expect(markdown).toContain('---')
    expect(markdown).toContain('title: "Test Page Title"')
    expect(markdown).toContain('meta:')
    expect(markdown).toContain('  description: "This is a test page description"')
    expect(markdown).toContain('---\n\n')
    expect(markdown).toContain('# Main Content')
    expect(markdown).toContain('This is the main content of the page.')
  })

  it('includes additional frontmatter fields', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [frontmatterPlugin({
        additionalFields: {
          layout: 'post',
          date: '2025-05-10',
        },
      })],
    })

    expect(markdown).toContain('title: "Test Page"')
    expect(markdown).toContain('layout: post')
    expect(markdown).toContain('date: 2025-05-10')
  })

  it('correctly formats frontmatter values', () => {
    const html = `
      <html>
        <head>
          <title>Title with "quotes"</title>
          <meta name="keywords" content="key1, key2, key3">
          <meta name="author" content="John Doe">
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [frontmatterPlugin()],
    })

    expect(markdown).toContain('title: "Title with \\"quotes\\""')
    expect(markdown).toContain('keywords: "key1, key2, key3"')
    expect(markdown).toContain('author: "John Doe"')
  })

  it('extracts social media meta tags', () => {
    const html = `
      <html>
        <head>
          <title>Page Title</title>
          <meta property="og:title" content="OG Title">
          <meta property="og:description" content="OG Description">
          <meta name="twitter:title" content="Twitter Title">
          <meta name="twitter:description" content="Twitter Description">
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [frontmatterPlugin()],
    })

    expect(markdown).toContain('meta:')
    expect(markdown).toContain('"og:title": "OG Title"')
    expect(markdown).toContain('"og:description": "OG Description"')
    expect(markdown).toContain('"twitter:title": "Twitter Title"')
    expect(markdown).toContain('"twitter:description": "Twitter Description"')
  })

  it('supports custom field formatters', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="keywords" content="key1, key2, key3">
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [frontmatterPlugin({
        formatValue: (name, value) => {
          if (name === 'keywords') {
            // Format as an array
            return `[${value.split(',').map(k => `"${k.trim()}"`).join(', ')}]`
          }
          return `"${value}"`
        },
      })],
    })

    expect(markdown).toContain('keywords: ["key1", "key2", "key3"]')
  })

  it('supports custom meta fields', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="custom-field" content="Custom Value">
          <meta name="another-field" content="Another Value">
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [frontmatterPlugin({
        metaFields: ['custom-field', 'another-field'],
      })],
    })

    expect(markdown).toContain('meta:')
    expect(markdown).toContain('  another-field: "Another Value"')
    expect(markdown).toContain('  custom-field: "Custom Value"')
  })
})
