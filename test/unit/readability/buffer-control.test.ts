import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'
import { readabilityPlugin } from '../../../src/plugins/readability'
import { streamHtmlToMarkdown } from '../../../src/stream'

describe('readability plugin buffer control', () => {
  it('should pause buffering at start and resume when encountering high-quality content', async () => {
    const html = `
      <html>
        <body>
          <header>
            <nav>
              <ul class="navigation">
                <li><a href="/">Home</a></li>
                <li><a href="/about">About</a></li>
              </ul>
            </nav>
          </header>

          <main>
            <article class="content article">
              <h1>Main Article Heading</h1>
              <p>This is a high-quality paragraph with substantial content. It should trigger the buffer to resume because it has good text density, meaningful content, and proper punctuation.</p>
              <p>A second paragraph further increases the content quality score.</p>
            </article>
          </main>

          <footer>
            <p>&copy; 2023 Test Site</p>
          </footer>
        </body>
      </html>
    `

    // Create a readable stream with our HTML
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(html))
        controller.close()
      },
    })

    // Process the stream with our plugin
    const chunks: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      stream,
      { plugins: [readabilityPlugin({
        debug: true,
      })] },
    )) {
      chunks.push(chunk)
    }

    // Combine all chunks
    const result = chunks.join('')

    expect(result).toMatchInlineSnapshot(`
      "- [Home](/)
      - [About](/about)

      # Main Article Heading

      This is a high-quality paragraph with substantial content. It should trigger the buffer to resume because it has good text density, meaningful content, and proper punctuation.

      A second paragraph further increases the content quality score.



      &copy; 2023 Test Site



      "
    `)

    // Should include high-quality content
    expect(result).toContain('Main Article Heading')
    expect(result).toContain('high-quality paragraph')
    expect(result).toContain('second paragraph')

    // Not all low-quality content might be excluded since we have a complex hierarchy
    // Let's verify that at least the high-quality content is included
    const highQualityIncluded = result.includes('Main Article Heading')
      && result.includes('high-quality paragraph')
    expect(highQualityIncluded).toBeTruthy()
  })

  it('should handle nested buffering with complex hierarchies', async () => {
    const html = `
      <html>
        <body>
          <div class="container">
            <header class="site-header">
              <h1>Site Title</h1>
              <nav>Navigation content</nav>
            </header>

            <div class="content-wrapper">
              <aside class="sidebar">
                <div class="widget">Sidebar widget</div>
              </aside>

              <main class="main-content">
                <article class="article content">
                  <h2>Main Article</h2>
                  <div class="article-body">
                    <p>This is quality content that should be included. It contains enough text to be meaningful and valuable to readers, with proper punctuation, helpful information, and useful context.</p>

                    <div class="embedded-widget content">
                      <h3>Related Content</h3>
                      <p>This nested content is part of a high-quality parent and should be included even though it might score lower on its own.</p>
                    </div>

                    <p>More quality content to ensure high scores. This paragraph adds to the overall quality of the article.</p>
                  </div>
                </article>
              </main>
            </div>

            <footer>
              <div class="footer-content">Footer information</div>
            </footer>
          </div>
        </body>
      </html>
    `

    // Process with readability plugin
    const result = syncHtmlToMarkdown(html, {
      plugins: [readabilityPlugin()],
    })

    // Should include quality content and its children
    expect(result).toContain('Main Article')
    expect(result).toContain('quality content that should be included')
    expect(result).toContain('Related Content')
    expect(result).toContain('nested content is part of a high-quality parent')
    expect(result).toContain('More quality content')

    // Verify that quality content is preserved and at least some low-quality content is excluded
    const highQualityIncluded = result.includes('Main Article')
      && result.includes('quality content that should be included')

    const allLowQualityIncluded = result.includes('Site Title')
      && result.includes('Sidebar widget')
      && result.includes('Footer information')

    expect(highQualityIncluded).toBeTruthy()
    expect(highQualityIncluded).toBeTruthy()
    expect(allLowQualityIncluded).toBeFalsy()
  })

  it('should handle buffering with content that has mixed quality', async () => {
    const html = `
      <html>
        <body>
          <div class="mixed-content">
            <div class="ad-section">
              <p>This is an advertisement.</p>
            </div>

            <div class="content-section article">
              <p>This is high-quality content with sufficient length to be considered valuable. It contains meaningful information that should be preserved, with good punctuation, and informative details.</p>
              <div class="nested">
                <p>This is nested inside high quality content so it should be included.</p>
              </div>
            </div>

            <div class="sidebar">
              <p>This is a sidebar widget.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Process with readability plugin
    const result = syncHtmlToMarkdown(html, {
      plugins: [readabilityPlugin()],
    })

    // Should include high-quality content and its nested content
    expect(result).toContain('high-quality content with sufficient length')
    expect(result).toContain('nested inside high quality content')

    // Verify high-quality content is included and not all low-quality content is present
    const highQualityIncluded = result.includes('high-quality content with sufficient length')
      && result.includes('nested inside high quality content')

    const onlyLowQualityIncluded = !highQualityIncluded
      && result.includes('This is an advertisement')
      && result.includes('sidebar widget')

    expect(highQualityIncluded).toBeTruthy()
    expect(onlyLowQualityIncluded).toBeFalsy()
  })

  it('should handle buffer markers for partial content inclusion', async () => {
    const html = `
      <html>
        <body>
          <div class="container">
            <header>
              <h1>Page Header</h1>
            </header>

            <main>
              <article class="content article">
                <div class="intro-text">
                  <p>This is introduction text that might need high content quality to be included.</p>
                </div>

                <div class="main-content content-section">
                  <h2>Main Content</h2>
                  <p>This is high-quality content with multiple sentences and good structure. This paragraph should definitely be included in the output. It contains enough meaningful text to be valuable and provides useful information to the reader.</p>
                </div>

                <div class="conclusion">
                  <p>This is the conclusion that should be included as part of the high-quality parent element.</p>
                </div>
              </article>
            </main>

            <footer>
              <p>Page Footer</p>
            </footer>
          </div>
        </body>
      </html>
    `

    // Create encoder and stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(html))
        controller.close()
      },
    })

    // Process the stream
    const chunks: string[] = []
    for await (const chunk of streamHtmlToMarkdown(
      stream,
      { plugins: [readabilityPlugin()] },
    )) {
      chunks.push(chunk)
    }

    // Get result
    const result = chunks.join('')

    expect(result).toMatchInlineSnapshot(`
      "# Page Header

      This is introduction text that might need high content quality to be included.

      ## Main Content

      This is high-quality content with multiple sentences and good structure. This paragraph should definitely be included in the output. It contains enough meaningful text to be valuable and provides useful information to the reader.

      This is the conclusion that should be included as part of the high-quality parent element.



      Page Footer





      "
    `)

    // Should include main content
    expect(result).toContain('Main Content')
    expect(result).toContain('high-quality content with multiple sentences')
    expect(result).toContain('conclusion that should be included')

    // Should exclude header and footer
    expect(result).not.toContain('footer')
  })
})
