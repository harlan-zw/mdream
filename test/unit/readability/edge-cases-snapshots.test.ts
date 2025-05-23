import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'
import { frontmatterPlugin } from '../../../src/plugins/frontmatter.ts'
import { readabilityPlugin } from '../../../src/plugins/readability'

describe('readability edge cases', () => {
  // Helper function to process HTML with readability
  function processWithReadability(html: string) {
    return syncHtmlToMarkdown(html, {
      plugins: [
        readabilityPlugin(),
        frontmatterPlugin(),
      ],
    })
  }

  it('should handle empty or nearly empty documents', () => {
    const emptyHtml = `<html><body></body></html>`
    const result = processWithReadability(emptyHtml)
    expect(result).toMatchInlineSnapshot(`""`)

    const nearlyEmptyHtml = `<html><body><div></div></body></html>`
    const result2 = processWithReadability(nearlyEmptyHtml)
    expect(result2).toMatchInlineSnapshot(`""`)
  })

  it('should properly score and extract content from div with article class', () => {
    const html = `
      <html>
      <head>
      <title>title tag</title>
      <meta name="description" content="description tag">
      </head>
        <body>
          <div class="page-header">
            <div class="navigation">
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/about">About</a></li>
              </ul>
            </div>
          </div>
          <div class="article">
            <h1>Article Title</h1>
            <p>This is the main content of the article with enough text to pass the threshold. It should contain multiple sentences to ensure it's picked up by the readability algorithm. This paragraph has commas, periods, and enough length to score well.</p>
          </div>
          <div class="page-footer">
            <p>Footer content should be excluded</p>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "---
      title: "title tag"
      meta:
        description: "description tag"
      ---

      # Article Title

      This is the main content of the article with enough text to pass the threshold. It should contain multiple sentences to ensure it's picked up by the readability algorithm. This paragraph has commas, periods, and enough length to score well."
    `)

    // The snapshot alone should be the source of truth, no additional assertions needed
  })

  it('should handle deeply nested content correctly', () => {
    const html = `
      <html>
        <body>
          <div>
            <div>
              <div>
                <div class="content">
                  <h2>Deeply Nested Content</h2>
                  <p>This content is deeply nested but has the content class, so it should be identified as main content. It should contain multiple sentences to ensure it's picked up by the readability algorithm. This paragraph has commas, periods, and enough length to score well.</p>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "## Deeply Nested Content

      This content is deeply nested but has the content class, so it should be identified as main content. It should contain multiple sentences to ensure it's picked up by the readability algorithm. This paragraph has commas, periods, and enough length to score well."
    `)
  })

  it('should handle content with high link density correctly', () => {
    const html = `
      <html>
        <body>
          <div class="main-content">
            <div class="article">
              <h1>Article with Links</h1>
              <p>This is a paragraph with <a href="#">some</a> <a href="#">links</a> but not too many, so it should still score well.</p>
              <div class="navigation">
                <p>This section has <a href="#">way</a> <a href="#">too</a> <a href="#">many</a> <a href="#">links</a> <a href="#">and</a> <a href="#">should</a> <a href="#">be</a> <a href="#">penalized</a> heavily.</p>
              </div>
              <p>This is another paragraph with normal content that should score well and be included in the output.</p>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)

    // Let's consistently use snapshot testing only
    expect(result).toMatchInlineSnapshot(`
      "# Article with Links

      This is a paragraph with [some](#) [links](#) but not too many, so it should still score well.

      This is another paragraph with normal content that should score well and be included in the output."
    `)
  })

  it.skip('should handle article with mixed quality sections', () => {
    const html = `
      <html>
        <body>
          <div class="content-wrapper">
            <div class="content-area">
              <h1>Mixed Quality Content</h1>
              <p>This is high-quality content that should be included. It has enough text, commas, and proper structure.</p>
              <div class="ad-section">
                <h3>Sponsored Content</h3>
                <p>This is an advertisement and should be excluded.</p>
                <a href="#">Click here</a>
              </div>
              <p>This is another high-quality paragraph that should be included in the output.</p>
              <div class="comments">
                <h3>Comments (5)</h3>
                <div class="comment">
                  <p>User comment that should be excluded.</p>
                </div>
                <div class="comment">
                  <p>Another user comment that should be excluded.</p>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "# Mixed Quality Content

      This is high-quality content that should be included. It has enough text, commas, and proper structure.

      This is another high-quality paragraph that should be included in the output."
    `)
  })

  it.skip('should handle content split across multiple divs', () => {
    const html = `
      <html>
        <body>
          <div class="page">
            <div class="header">
              <h1>Page Title</h1>
              <nav>
                <a href="#">Home</a>
                <a href="#">About</a>
              </nav>
            </div>
            <div class="content-part-1">
              <p>This is the first part of the content. It has enough text to be considered high quality.</p>
            </div>
            <div class="advertisement">
              <p>This is an ad that should be excluded.</p>
            </div>
            <div class="content-part-2">
              <p>This is the second part of the content. It should be included with the first part.</p>
            </div>
            <div class="footer">
              <p>Footer text should be excluded.</p>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "# Page Title

      [Home](#) [About](#)

      This is the first part of the content. It has enough text to be considered high quality.

      This is the second part of the content. It should be included with the first part."
    `)

    // Check only the most important aspects: proper content order
    const titlePosition = result.indexOf('Page Title')
    const part1Position = result.indexOf('first part of the content')
    const part2Position = result.indexOf('second part of the content')

    // Verify only that content appears in the correct sequence
    expect(titlePosition).toBeLessThan(part1Position)
    expect(part1Position).toBeLessThan(part2Position)

    // Check what should be excluded
    const adPosition = result.indexOf('ad that should be excluded')
    const footerPosition = result.indexOf('Footer text should be excluded')
    expect(adPosition).toBe(-1) // -1 means not found, which is what we want
    expect(footerPosition).toBe(-1)
  })

  it('should handle content with code blocks properly without semantic tags', () => {
    const html = `
      <html>
        <body>
          <div class="main-container">
            <div class="article-content">
              <h1>Code Tutorial</h1>
              <p>This is an introduction to a programming tutorial.</p>
              <pre><code>
function example() {
  console.log("This is a code block");
  return true;
}
              </code></pre>
              <p>The code above demonstrates a simple JavaScript function.</p>
              <pre><code>
const result = example();
if (result) {
  console.log("Success!");
}
              </code></pre>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "# Code Tutorial

      This is an introduction to a programming tutorial.

      \`\`\`
      function example() {
        console.log("This is a code block");
        return true;
      }
      \`\`\`

      The code above demonstrates a simple JavaScript function.

      \`\`\`
      const result = example();
      if (result) {
        console.log("Success!");
      }
      \`\`\`"
    `)

    // For technical formatting, it's reasonable to verify code blocks are properly formatted
    const codeBlockCount = (result.match(/```/g) || []).length
    expect(codeBlockCount).toBe(4) // 2 opening, 2 closing markers
  })

  it('should properly handle very short content with strong indicators', () => {
    const html = `
      <html>
        <body>
          <div class="navigation">
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
            </ul>
          </div>
          <div class="content">
            <div class="post">
              <h1>Short Article</h1>
              <p>This is very short content.</p>
            </div>
          </div>
          <div class="copyright-section">
            <p>Copyright 2025</p>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "# Short Article

      This is very short content."
    `)
  })

  it('should handle hidden content correctly', () => {
    const html = `
      <html>
        <body>
          <div style="display:none">
            <p>This content is hidden and should be excluded even though it has good content.</p>
          </div>
          <div class="visually-hidden">
            <p>This content is visually hidden via class and should be excluded.</p>
          </div>
          <div aria-hidden="true">
            <p>This content is hidden via aria attributes and should be excluded.</p>
          </div>
          <div class="article-content">
            <p>This content is visible and should be included if it scores well.</p>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`"This content is visible and should be included if it scores well."`)

    // If the snapshot is showing unexpected behavior (including hidden content),
    // this demonstrates a bug that should be fixed in the implementation
  })

  it('should handle nested content sections correctly without semantic tags', () => {
    const html = `
      <html>
        <body>
          <div class="container">
            <div class="page-header">
              <h1>Main Page Title</h1>
            </div>
            <div class="article-content">
              <h2>Main Article</h2>
              <p>This is the main article content with enough length to be considered substantial.</p>
              <div class="content-section">
                <h3>Section 1</h3>
                <p>This is content in section 1 that should be included.</p>
              </div>
              <div class="content-section">
                <h3>Section 2</h3>
                <p>This is content in section 2 that should be included.</p>
              </div>
            </div>
            <div class="sidebar">
              <h3>Related Content</h3>
              <p>This is sidebar content that should be excluded.</p>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "## Main Article

      This is the main article content with enough length to be considered substantial.

      ### Section 1

      This is content in section 1 that should be included.

      ### Section 2

      This is content in section 2 that should be included."
    `)

    // For nested content, it's important to verify hierarchy is preserved
    expect(result).not.toContain('Related Content')
    expect(result).not.toContain('This is sidebar content that should be excluded')
  })

  it('should handle content with ambiguous structure', () => {
    const html = `
      <html>
        <body>
          <div>
            <h1>Page Title</h1>
            <div>
              <p>This page has no semantic HTML5 elements or clear class/id indicators.</p>
              <p>It represents content that has minimal structural hints for the readability algorithm.</p>
              <p>The algorithm should still identify this as content based on text metrics alone.</p>
            </div>
            <div>
              <ul>
                <li><a href="#">Link 1</a></li>
                <li><a href="#">Link 2</a></li>
                <li><a href="#">Link 3</a></li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `
    const result = processWithReadability(html)
    expect(result).toMatchInlineSnapshot(`
      "# Page Title

      This page has no semantic HTML5 elements or clear class/id indicators.

      It represents content that has minimal structural hints for the readability algorithm.

      The algorithm should still identify this as content based on text metrics alone.

      - [Link 1](#)
      - [Link 2](#)
      - [Link 3](#)"
    `)
  })
})
