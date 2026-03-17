import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('frontmatter plugin $name', (engineConfig) => {
  it('extracts title and description from head', async () => {
    const engine = await resolveEngine(engineConfig.engine)
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
      plugins: { frontmatter: true },
      engine,
    })

    expect(markdown).toContain('---')
    expect(markdown).toContain('title: "Test Page Title"')
    expect(markdown).toContain('meta:')
    expect(markdown).toContain('  description: "This is a test page description"')
    expect(markdown).toContain('---\n\n')
    expect(markdown).toContain('# Main Content')
    expect(markdown).toContain('This is the main content of the page.')
  })

  it('includes additional frontmatter fields', async () => {
    const engine = await resolveEngine(engineConfig.engine)
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
      plugins: { frontmatter: {
        additionalFields: {
          layout: 'post',
          date: '2025-05-10',
        },
      } },
      engine,
    })

    expect(markdown).toContain('title: "Test Page"')
    expect(markdown).toContain('layout: post')
    expect(markdown).toContain('date: 2025-05-10')
  })

  it('correctly formats frontmatter values', async () => {
    const engine = await resolveEngine(engineConfig.engine)
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
      plugins: { frontmatter: true },
      engine,
    })

    expect(markdown).toContain('title: "Title with \\"quotes\\""')
    expect(markdown).toContain('keywords: "key1, key2, key3"')
    expect(markdown).toContain('author: "John Doe"')
  })

  it('extracts social media meta tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
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
      plugins: { frontmatter: true },
      engine,
    })

    expect(markdown).toContain('meta:')
    expect(markdown).toContain('"og:title": "OG Title"')
    expect(markdown).toContain('"og:description": "OG Description"')
    expect(markdown).toContain('"twitter:title": "Twitter Title"')
    expect(markdown).toContain('"twitter:description": "Twitter Description"')
  })

  it('receives structured frontmatter via callback', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <html>
        <head>
          <title>My Page</title>
          <meta name="description" content="A test page">
          <meta name="author" content="Jane">
        </head>
        <body><p>Content</p></body>
      </html>
    `

    let frontmatter: Record<string, string> | undefined
    htmlToMarkdown(html, {
      plugins: { frontmatter: (fm) => { frontmatter = fm } },
      engine,
    })

    expect(frontmatter).toBeDefined()
    expect(frontmatter!.title).toBe('My Page')
    expect(frontmatter!.description).toBe('A test page')
    expect(frontmatter!.author).toBe('Jane')
  })

  it('receives structured frontmatter via onExtract with config', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <html>
        <head><title>Page</title></head>
        <body><p>Content</p></body>
      </html>
    `

    let frontmatter: Record<string, string> | undefined
    htmlToMarkdown(html, {
      plugins: {
        frontmatter: {
          additionalFields: { layout: 'post', category: 'blog' },
          onExtract: (fm) => { frontmatter = fm },
        },
      },
      engine,
    })

    expect(frontmatter).toBeDefined()
    expect(frontmatter!.title).toBe('Page')
    expect(frontmatter!.layout).toBe('post')
    expect(frontmatter!.category).toBe('blog')
  })

  it('supports custom meta fields', async () => {
    const engine = await resolveEngine(engineConfig.engine)
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
      plugins: { frontmatter: { metaFields: ['custom-field', 'another-field'] } },
      engine,
    })

    expect(markdown).toContain('meta:')
    expect(markdown).toContain('  another-field: "Another Value"')
    expect(markdown).toContain('  custom-field: "Custom Value"')
  })
})
