import type { ExtractedElement } from 'mdream'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('declarative extraction (plugins.extraction) $name', (engineConfig) => {
  it('extracts elements by tag selector', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><h1>Main Title</h1><h2>Section 1</h2><h2>Section 2</h2><p>Content</p></body></html>`
    const collected: ExtractedElement[] = []

    const result = htmlToMarkdown(html, {
      plugins: {
        extraction: {
          h2: el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(2)
    expect(collected[0].selector).toBe('h2')
    expect(collected[0].tagName).toBe('h2')
    expect(collected[0].textContent).toBe('Section 1')
    expect(collected[1].textContent).toBe('Section 2')
    expect(result.extracted).toHaveLength(2)
  })

  it('extracts elements by class selector', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><div class="content">Main</div><div class="sidebar">Side</div><div class="content special">Other</div></body></html>`
    const collected: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          '.content': el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(2)
    expect(collected[0].textContent).toBe('Main')
    expect(collected[1].textContent).toBe('Other')
  })

  it('extracts elements by ID selector', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><div id="header">Header</div><div id="main">Main</div></body></html>`
    const collected: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          '#header': el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(1)
    expect(collected[0].textContent).toBe('Header')
    expect(collected[0].attributes.id).toBe('header')
  })

  it('extracts elements by attribute selector', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><img src="1.jpg" alt="First" /><img src="2.jpg" /><div data-testid="comp">Content</div></body></html>`
    const imgs: ExtractedElement[] = []
    const divs: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          'img[alt]': el => imgs.push(el),
          '[data-testid]': el => divs.push(el),
        },
      },
      engine,
    })

    expect(imgs).toHaveLength(1)
    expect(imgs[0].attributes.alt).toBe('First')
    expect(divs).toHaveLength(1)
    expect(divs[0].textContent).toBe('Content')
  })

  it('extracts attribute value selectors', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><head><meta name="description" content="Page desc" /><meta name="keywords" content="a,b" /></head><body></body></html>`
    const collected: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          'meta[name="description"]': el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(1)
    expect(collected[0].attributes.content).toBe('Page desc')
  })

  it('extracts compound selectors', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><div class="card featured">Featured</div><div class="card">Regular</div><div class="featured">Non-card</div></body></html>`
    const collected: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          'div.card.featured': el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(1)
    expect(collected[0].textContent).toBe('Featured')
  })

  it('calls handler for each match (no firstOnly)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><h2>First</h2><h2>Second</h2><h2>Third</h2></body></html>`
    const collected: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          h2: el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(3)
    expect(collected[0].textContent).toBe('First')
    expect(collected[1].textContent).toBe('Second')
    expect(collected[2].textContent).toBe('Third')
  })

  it('supports multiple selectors with separate handlers', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><head><title>Title</title><meta name="description" content="Desc" /></head><body><h1>H1</h1><h1>H1b</h1></body></html>`
    let title = ''
    let description = ''
    const headings: string[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          'title': (el) => { title = el.textContent },
          'meta[name="description"]': (el) => { description = el.attributes.content || '' },
          'h1': (el) => { headings.push(el.textContent) },
        },
      },
      engine,
    })

    expect(title).toBe('Title')
    expect(description).toBe('Desc')
    expect(headings).toEqual(['H1', 'H1b'])
  })

  it('extracts nested text content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<html><body><article><h2>Title</h2><p>Text with <strong>bold</strong> and <em>italic</em>.</p></article></body></html>`
    let articleText = ''
    let pText = ''

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          article: (el) => { articleText = el.textContent },
          p: (el) => { pText = el.textContent },
        },
      },
      engine,
    })

    expect(articleText).toContain('Title')
    expect(articleText).toContain('bold')
    expect(articleText).toContain('italic')
    expect(pText).toBe('Text with bold and italic.')
  })

  it('returns empty extracted when no matches', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const collected: ExtractedElement[] = []

    const result = htmlToMarkdown(`<html><body><p>Hello</p></body></html>`, {
      plugins: {
        extraction: {
          h1: el => collected.push(el),
        },
      },
      engine,
    })

    expect(collected).toHaveLength(0)
    // Rust engine returns undefined instead of [] when no matches
    expect(result.extracted?.length ?? 0).toBe(0)
  })

  it('does not populate extracted when no extraction config', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown(`<html><body><p>Hello</p></body></html>`, { engine })
    expect(result.extracted).toBeUndefined()
  })

  it('still produces correct markdown alongside extraction', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const collected: ExtractedElement[] = []

    const result = htmlToMarkdown(`<html><body><h1>Title</h1><p>Content</p></body></html>`, {
      plugins: {
        extraction: {
          h1: el => collected.push(el),
        },
      },
      engine,
    })

    expect(result.markdown).toContain('# Title')
    expect(result.markdown).toContain('Content')
    expect(collected).toHaveLength(1)
  })

  it('works with metadata extraction pattern (llms-txt)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <html>
        <head>
          <title>My Page</title>
          <meta name="description" content="A cool page" />
          <meta property="og:title" content="OG Title" />
        </head>
        <body><p>Content</p></body>
      </html>
    `
    let title = ''
    let description = ''
    let ogTitle = ''

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          'title': (el) => { title = el.textContent },
          'meta[name="description"]': (el) => { description = el.attributes.content || '' },
          'meta[property="og:title"]': (el) => { ogTitle = el.attributes.content || '' },
        },
      },
      engine,
    })

    expect(title).toBe('My Page')
    expect(description).toBe('A cool page')
    expect(ogTitle).toBe('OG Title')
  })

  it('works with link extraction pattern (crawl)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <html><body>
        <a href="/page1">Page 1</a>
        <a href="/page2">Page 2</a>
        <a href="https://external.com">External</a>
      </body></html>
    `
    const links: ExtractedElement[] = []

    htmlToMarkdown(html, {
      plugins: {
        extraction: {
          'a[href]': el => links.push(el),
        },
      },
      engine,
    })

    expect(links).toHaveLength(3)
    expect(links[0].attributes.href).toBe('/page1')
    expect(links[0].textContent).toBe('Page 1')
    expect(links[2].attributes.href).toBe('https://external.com')
  })

  it('extracts from nuxt-example fixture', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const fixtureHtml = fs.readFileSync(
      path.join(__dirname, '../../fixtures/nuxt-example.html'),
      'utf-8',
    )
    let title = ''
    let description = ''

    htmlToMarkdown(fixtureHtml, {
      plugins: {
        extraction: {
          'title': (el) => { title = el.textContent },
          'meta[name="description"]': (el) => { description = el.attributes.content || '' },
        },
      },
      engine,
    })

    expect(title).toBe('Features - MDream Conversion Capabilities')
    expect(description).toBe('Explore MDream\'s powerful features including streaming API, plugin system, custom tag handlers, and performance optimizations for HTML to Markdown conversion.')
  })
})
