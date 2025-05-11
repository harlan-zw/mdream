import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../src'
import { withContentRelevancePlugin } from '../src/plugins.ts'

describe('tree-based content relevance', () => {
  it('should prioritize deeper tree structures', () => {
    const html = `
      <div id="container">
        <div class="shallow-content">
          <p>This is a shallow content area.</p>
          <p>It has several paragraphs.</p>
          <p>But it's not deeply nested.</p>
          <p>Despite having more text nodes, it might not be the most relevant.</p>
          <p>The depth is only 2 levels.</p>
        </div>

        <div class="deeper-structure">
          <div class="level1">
            <div class="level2">
              <article class="level3">
                <header>
                  <h2>Deep Tree Structure</h2>
                </header>
                <div class="content">
                  <p>This content is more deeply nested (5+ levels).</p>
                  <p>Depth weighting should favor this section.</p>
                  <p>It also has a header element, which adds importance.</p>
                </div>
              </article>
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

    // Because of the depth boost, the deeper structure should be preferred
    // despite having fewer text nodes
    expect(markdown).toContain('Deep Tree Structure')
    expect(markdown).toContain('more deeply nested')

    // Check that the deep structure is marked as relevant content
    const startMarker = '<!-- START RELEVANT CONTENT'
    const endMarker = '<!-- END RELEVANT CONTENT -->'
    const contentStart = markdown.indexOf(startMarker)
    const contentEnd = markdown.indexOf(endMarker)

    expect(contentStart).not.toBe(-1)
    expect(contentEnd).not.toBe(-1)

    const relevantContent = markdown.substring(contentStart, contentEnd)
    expect(relevantContent).toContain('Deep Tree Structure')
  })

  it('should favor content trees that include related sections', () => {
    const html = `
      <main>
        <div class="top-level-section">
          <h1>Main Content Title</h1>
          <div class="first-subsection">
            <h2>First Subsection</h2>
            <p>This is part of a cohesive content tree.</p>
            <p>It should be detected as part of the main content.</p>
          </div>
          <div class="second-subsection">
            <h2>Second Subsection</h2>
            <p>This is another part of the same content tree.</p>
            <p>The algorithm should favor the entire tree structure.</p>
          </div>
        </div>

        <aside>
          <div class="unrelated-section">
            <h2>Unrelated Content</h2>
            <p>This section has some content but is not related to the main tree.</p>
            <p>It should not be considered part of the same content structure.</p>
          </div>
        </aside>
      </main>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
        }),
      ],
    })

    // Verify the entire content tree is included in the results
    const relevanceComment = (markdown.match(/<!-- Content relevance: Found .*?-->/s) || [''])[0]

    // The parent node should be identified as relevant
    expect(relevanceComment).toContain('top-level-section')

    // The markdown should include the entire tree structure
    expect(markdown).toContain('Main Content Title')
    expect(markdown).toContain('First Subsection')
    expect(markdown).toContain('Second Subsection')
  })

  it('should optimize tree selection when scores are similar', () => {
    const html = `
      <div class="container">
        <div class="content-area">
          <div class="section-one">
            <h2>Section One</h2>
            <p>This section contains some important content.</p>
            <p>Its score should be quite good due to depth and headers.</p>
          </div>

          <div class="section-two">
            <h2>Section Two</h2>
            <p>This section has similar content density.</p>
            <p>But it's part of the same overall tree.</p>
          </div>
        </div>

        <div class="sidebar">
          <div class="widget">
            <h3>Sidebar Widget</h3>
            <p>This has some content but is not part of the main tree.</p>
            <p>Even if it scores well, tree coherence should favor the main content.</p>
          </div>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
          similarityThreshold: 0.8,
          maxRelevantSections: 3,
        }),
      ],
    })

    // Extract content from the output
    const relevanceInfo = (markdown.match(/<!-- Content relevance: Found .*?-->/s) || [''])[0]

    // The algorithm should find multiple relevant sections that form a coherent tree
    expect(relevanceInfo).toContain('Found')

    // Both main sections should be included
    expect(markdown).toContain('Section One')
    expect(markdown).toContain('Section Two')
  })
})
