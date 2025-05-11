import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../src'
import { withContentRelevancePlugin } from '../src/plugins.ts'

describe('heuristic-based content relevance', () => {
  it('should identify content trees with highest text node density', () => {
    const html = `
      <div class="page">
        <div class="header">
          <h1>Page Title</h1>
          <nav>
            <ul>
              <li><a href="#">Link 1</a></li>
              <li><a href="#">Link 2</a></li>
              <li><a href="#">Link 3</a></li>
              <li><a href="#">Link 4</a></li>
              <li><a href="#">Link 5</a></li>
            </ul>
          </nav>
        </div>

        <div class="content">
          <article>
            <h2>Main Article</h2>
            <p>This should be identified as the main content due to text node density.</p>
            <p>It has multiple paragraphs with substantial text content.</p>
            <p>The density algorithm should favor this over navigation lists.</p>
            <p>Even though the navigation list has more elements, they contain less text.</p>
          </article>
        </div>

        <div class="footer">
          <ul>
            <li><a href="#">Footer 1</a></li>
            <li><a href="#">Footer 2</a></li>
            <li><a href="#">Footer 3</a></li>
          </ul>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // The markdown should contain the article content
    expect(markdown).toContain('Main Article')
    expect(markdown).toContain('identified as the main content due to text node density')

    // Given our test data with 1 clearly relevant section, we should see that in the output
    expect(markdown).toMatch(/Most relevant path is/)
  })

  it('should boost sections with header elements', () => {
    const html = `
      <div class="page">
        <div class="section-without-headers">
          <p>This section has more text content in total.</p>
          <p>It contains multiple paragraphs with lots of text.</p>
          <p>But it doesn't have any header elements to structure it.</p>
          <p>Without headers, it might be less likely to be the main content.</p>
          <p>The algorithm should prefer structured content.</p>
        </div>

        <div class="section-with-headers">
          <h2>Structured Content</h2>
          <p>This section has less text overall.</p>
          <p>But it has proper heading structure.</p>
          <h3>Subsection With Header</h3>
          <p>The presence of headers should boost its relevance.</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // The section with headers should be in the output
    expect(markdown).toContain('Structured Content')
  })

  it('should prefer deeper nested content when scores are similar', () => {
    const html = `
      <div>
        <div class="shallow-content">
          <p>This is shallow content with just 2 levels of nesting.</p>
          <p>It has multiple text nodes but isn't deeply nested.</p>
          <p>The algorithm should prefer deeper nesting.</p>
        </div>

        <div class="deep-section">
          <div class="level1">
            <div class="level2">
              <div class="level3">
                <div class="level4">
                  <h3>Deeply Nested Content</h3>
                  <p>This content is 5 levels deep.</p>
                  <p>With moderate text density, it should be favored.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
          minDepth: 2,
        }),
      ],
    })

    // Should contain the deeply nested content in the relevance info
    expect(markdown).toContain('Deeply Nested Content')
  })

  it('should identify multiple relevant sections when scores are similar', () => {
    const html = `
      <div>
        <section class="section1">
          <h2>First Important Section</h2>
          <p>This section has important content.</p>
          <p>It has a similar score to the second section.</p>
        </section>

        <section class="section2">
          <h2>Second Important Section</h2>
          <p>This is also important content.</p>
          <p>It should also be identified as relevant.</p>
        </section>

        <aside>
          <p>Less important content.</p>
        </aside>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
          similarityThreshold: 0.9, // High similarity threshold
          maxRelevantSections: 2,
        }),
      ],
    })

    // Should include both important sections in the output
    expect(markdown).toContain('First Important Section')
    expect(markdown).toContain('Second Important Section')
  })
})
