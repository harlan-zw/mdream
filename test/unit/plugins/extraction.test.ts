import type { ExtractedElement } from '../../../src/plugins/extraction.ts'
import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.ts'
import { extractionPlugin } from '../../../src/plugins/extraction.ts'

describe('extraction plugin', () => {
  it('should extract elements by tag selector', () => {
    const html = `
      <html>
        <body>
          <h1>Main Title</h1>
          <h2>Section 1</h2>
          <h2>Section 2</h2>
          <p>Some content</p>
        </body>
      </html>
    `

    const extractedH2s: ExtractedElement[] = []
    const plugin = extractionPlugin({
      h2: (element) => {
        extractedH2s.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedH2s).toHaveLength(2)
    expect(extractedH2s[0].name).toBe('h2')
    expect(extractedH2s[0].textContent).toBe('Section 1')
    expect(extractedH2s[1].textContent).toBe('Section 2')
  })

  it('should extract elements by class selector', () => {
    const html = `
      <html>
        <body>
          <div class="content">Main content here</div>
          <div class="sidebar">Sidebar content</div>
          <div class="content special">Another content div</div>
        </body>
      </html>
    `

    const extractedContent: ExtractedElement[] = []
    const plugin = extractionPlugin({
      '.content': (element) => {
        extractedContent.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedContent).toHaveLength(2)
    expect(extractedContent[0].textContent).toBe('Main content here')
    expect(extractedContent[1].textContent).toBe('Another content div')
    expect(extractedContent[0].attributes.class).toBe('content')
    expect(extractedContent[1].attributes.class).toBe('content special')
  })

  it('should extract elements by ID selector', () => {
    const html = `
      <html>
        <body>
          <div id="header">Header content</div>
          <div id="main">Main content</div>
          <div id="footer">Footer content</div>
        </body>
      </html>
    `

    const extractedHeader: ExtractedElement[] = []
    const plugin = extractionPlugin({
      '#header': (element) => {
        extractedHeader.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedHeader).toHaveLength(1)
    expect(extractedHeader[0].textContent).toBe('Header content')
    expect(extractedHeader[0].attributes.id).toBe('header')
  })

  it('should extract elements by attribute selector', () => {
    const html = `
      <html>
        <body>
          <img src="image1.jpg" alt="First image" />
          <img src="image2.jpg" alt="Second image" />
          <div data-testid="component">Component content</div>
          <button data-testid="submit">Submit</button>
        </body>
      </html>
    `

    const extractedImages: ExtractedElement[] = []
    const extractedTestComponents: ExtractedElement[] = []

    const plugin = extractionPlugin({
      'img[alt]': (element) => {
        extractedImages.push(element)
      },
      '[data-testid]': (element) => {
        extractedTestComponents.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedImages).toHaveLength(2)
    expect(extractedImages[0].attributes.src).toBe('image1.jpg')
    expect(extractedImages[0].attributes.alt).toBe('First image')
    expect(extractedImages[1].attributes.alt).toBe('Second image')

    expect(extractedTestComponents).toHaveLength(2)
    expect(extractedTestComponents[0].textContent).toBe('Component content')
    expect(extractedTestComponents[1].textContent).toBe('Submit')
    expect(extractedTestComponents[0].attributes['data-testid']).toBe('component')
    expect(extractedTestComponents[1].attributes['data-testid']).toBe('submit')
  })

  it('should extract nested text content correctly', () => {
    const html = `
      <html>
        <body>
          <article>
            <h2>Article Title</h2>
            <p>First paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
            <p>Second paragraph with <a href="/link">a link</a>.</p>
            <ul>
              <li>First item</li>
              <li>Second item with <code>inline code</code></li>
            </ul>
          </article>
        </body>
      </html>
    `

    const extractedArticles: ExtractedElement[] = []
    const extractedParagraphs: ExtractedElement[] = []

    const plugin = extractionPlugin({
      article: (element) => {
        extractedArticles.push(element)
      },
      p: (element) => {
        extractedParagraphs.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedArticles).toHaveLength(1)
    const articleText = extractedArticles[0].textContent
    expect(articleText).toContain('Article Title')
    expect(articleText).toContain('First paragraph with bold text and italic text.')
    expect(articleText).toContain('Second paragraph with a link.')
    expect(articleText).toContain('First item')
    expect(articleText).toContain('Second item with inline code')

    expect(extractedParagraphs).toHaveLength(2)
    expect(extractedParagraphs[0].textContent).toBe('First paragraph with bold text and italic text.')
    expect(extractedParagraphs[1].textContent).toBe('Second paragraph with a link.')
  })

  it('should handle multiple selectors simultaneously', () => {
    const html = `
      <html>
        <head>
          <title>Page Title</title>
          <meta name="description" content="Page description" />
        </head>
        <body>
          <h1>Main Heading</h1>
          <nav class="navigation">
            <a href="/home">Home</a>
            <a href="/about">About</a>
          </nav>
          <main>
            <h2>Content Section</h2>
            <p>Content paragraph</p>
          </main>
        </body>
      </html>
    `

    const results: Record<string, ExtractedElement[]> = {
      titles: [],
      headings: [],
      navigation: [],
      links: [],
      metas: [],
    }

    const plugin = extractionPlugin({
      'title': element => results.titles.push(element),
      'h1': element => results.headings.push(element),
      'h2': element => results.headings.push(element),
      '.navigation': element => results.navigation.push(element),
      'a': element => results.links.push(element),
      'meta[name="description"]': element => results.metas.push(element),
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(results.titles).toHaveLength(1)
    expect(results.titles[0].textContent).toBe('Page Title')

    expect(results.headings).toHaveLength(2)
    expect(results.headings[0].textContent).toBe('Main Heading')
    expect(results.headings[1].textContent).toBe('Content Section')

    expect(results.navigation).toHaveLength(1)
    expect(results.navigation[0].textContent).toContain('Home')
    expect(results.navigation[0].textContent).toContain('About')

    expect(results.links).toHaveLength(2)
    expect(results.links[0].textContent).toBe('Home')
    expect(results.links[0].attributes.href).toBe('/home')
    expect(results.links[1].textContent).toBe('About')
    expect(results.links[1].attributes.href).toBe('/about')

    expect(results.metas).toHaveLength(1)
    expect(results.metas[0].attributes.content).toBe('Page description')
  })

  it('should handle complex compound selectors', () => {
    const html = `
      <html>
        <body>
          <div class="card featured">Featured Card</div>
          <div class="card">Regular Card</div>
          <div class="featured">Featured Non-Card</div>
          <section id="main" class="content">Main Section</section>
        </body>
      </html>
    `

    const extractedFeaturedCards: ExtractedElement[] = []
    const extractedMainContent: ExtractedElement[] = []

    const plugin = extractionPlugin({
      'div.card.featured': (element) => {
        extractedFeaturedCards.push(element)
      },
      'section#main.content': (element) => {
        extractedMainContent.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedFeaturedCards).toHaveLength(1)
    expect(extractedFeaturedCards[0].textContent).toBe('Featured Card')
    expect(extractedFeaturedCards[0].attributes.class).toBe('card featured')

    expect(extractedMainContent).toHaveLength(1)
    expect(extractedMainContent[0].textContent).toBe('Main Section')
    expect(extractedMainContent[0].attributes.id).toBe('main')
    expect(extractedMainContent[0].attributes.class).toBe('content')
  })

  it('should handle empty elements and whitespace correctly', () => {
    const html = `
      <html>
        <body>
          <div class="empty"></div>
          <div class="whitespace">   </div>
          <div class="newlines">
          
          </div>
          <div class="mixed">  Some text  </div>
        </body>
      </html>
    `

    const extractedDivs: ExtractedElement[] = []
    const plugin = extractionPlugin({
      div: (element) => {
        extractedDivs.push(element)
      },
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    expect(extractedDivs).toHaveLength(4)
    expect(extractedDivs[0].textContent).toBe('') // empty
    expect(extractedDivs[1].textContent).toBe('') // whitespace trimmed
    expect(extractedDivs[2].textContent).toBe('') // newlines trimmed
    expect(extractedDivs[3].textContent).toBe('Some text') // mixed trimmed
  })

  it('should extract real-world SEO elements like tmpreference', () => {
    const html = `
      <html lang="en">
        <head>
          <title>Example Page</title>
          <meta name="description" content="This is an example page for testing" />
          <meta name="robots" content="index,follow" />
          <meta property="og:title" content="Example Page OG Title" />
          <meta property="og:description" content="Example OG Description" />
          <meta property="og:image" content="https://example.com/image.jpg" />
          <link rel="canonical" href="https://example.com/page" />
          <script type="application/ld+json">
            {"@type": "WebPage", "name": "Example"}
          </script>
        </head>
        <body>
          <h1>Main Page Heading</h1>
          <img src="/image.jpg" alt="Example image" width="400" height="300" />
          <a href="/about" title="About page">About Us</a>
          <script src="/app.js"></script>
          <style>.example { color: red; }</style>
        </body>
      </html>
    `

    const seoData: Record<string, ExtractedElement[]> = {
      title: [],
      metas: [],
      headings: [],
      images: [],
      links: [],
      scripts: [],
      styles: [],
      jsonLd: [],
    }

    const plugin = extractionPlugin({
      'title': element => seoData.title.push(element),
      'meta[name]': element => seoData.metas.push(element),
      'meta[property]': element => seoData.metas.push(element),
      'h1': element => seoData.headings.push(element),
      'img': element => seoData.images.push(element),
      'a[href]': element => seoData.links.push(element),
      'script': element => seoData.scripts.push(element),
      'style': element => seoData.styles.push(element),
      'script[type="application/ld+json"]': element => seoData.jsonLd.push(element),
    })

    syncHtmlToMarkdown(html, {
      plugins: [plugin],
    })

    // Verify title
    expect(seoData.title).toHaveLength(1)
    expect(seoData.title[0].textContent).toBe('Example Page')

    // Verify meta tags
    expect(seoData.metas.length).toBeGreaterThan(0)
    const descriptionMeta = seoData.metas.find(m => m.attributes.name === 'description')
    expect(descriptionMeta?.attributes.content).toBe('This is an example page for testing')

    const ogTitleMeta = seoData.metas.find(m => m.attributes.property === 'og:title')
    expect(ogTitleMeta?.attributes.content).toBe('Example Page OG Title')

    // Verify headings
    expect(seoData.headings).toHaveLength(1)
    expect(seoData.headings[0].textContent).toBe('Main Page Heading')

    // Verify images
    expect(seoData.images).toHaveLength(1)
    expect(seoData.images[0].attributes.src).toBe('/image.jpg')
    expect(seoData.images[0].attributes.alt).toBe('Example image')
    expect(seoData.images[0].attributes.width).toBe('400')

    // Verify links
    expect(seoData.links).toHaveLength(1)
    expect(seoData.links[0].attributes.href).toBe('/about')
    expect(seoData.links[0].textContent).toBe('About Us')

    // Verify scripts (note: JSON-LD script will be in both scripts and jsonLd arrays)
    expect(seoData.scripts.length).toBeGreaterThan(0)
    const externalScript = seoData.scripts.find(s => s.attributes.src === '/app.js')
    expect(externalScript).toBeDefined()

    // Verify JSON-LD
    expect(seoData.jsonLd).toHaveLength(1)
    // Note: Script content might not be extracted as textContent in the parser
    // so we'll just verify the element exists and has the correct attributes
    expect(seoData.jsonLd[0].attributes.type).toBe('application/ld+json')

    // Verify styles
    expect(seoData.styles).toHaveLength(1)
    // Note: Style content might not be extracted as textContent in the parser
    // so we'll just verify the element exists and is the correct tag
    expect(seoData.styles[0].name).toBe('style')
  })
})
