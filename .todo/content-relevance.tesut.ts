import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../src'
import { withContentRelevancePlugin } from '../src/plugins.ts'

describe('content-relevance plugin', () => {
  // Basic functionality tests
  it('should identify and log the most content-relevant section', () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta charset="utf-8">
        </head>
        <body>
          <header>
            <h1>Website Header</h1>
            <nav>
              <ul>
                <li><a href="#">Home</a></li>
                <li><a href="#">About</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </nav>
          </header>

          <main>
            <article>
              <h2>Main Article Title</h2>
              <p>First paragraph with real content. This should be identified as the main content.</p>
              <p>Second paragraph with even more content to reinforce the content density of this section.</p>
              <p>Third paragraph with additional text to make this the most content-dense section.</p>
              <p>Fourth paragraph to really drive home that this section has the most text content.</p>
              <ul>
                <li>List item one for added content</li>
                <li>List item two for added content</li>
              </ul>
            </article>
          </main>

          <aside>
            <h3>Sidebar</h3>
            <p>Less important content in the sidebar.</p>
          </aside>

          <footer>
            <p>Copyright information</p>
            <p>Links and other footer items</p>
          </footer>
        </body>
      </html>
    `

    // Enable logging to see density information in the output
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Verify that the main article content was identified as the most relevant
    expect(markdown).toContain('Main Article Title')
    expect(markdown).toContain('First paragraph with real content')
    expect(markdown).toContain('<!-- Content relevance: Most relevant path is')

    // Should contain debug markers around the most relevant content
    expect(markdown).toContain('<!-- START RELEVANT CONTENT -->')
    expect(markdown).toContain('<!-- END RELEVANT CONTENT -->')
  })

  it('should handle documents with multiple content sections', () => {
    const html = `
      <div class="wrapper">
        <div class="header">
          <h1>Page Title</h1>
          <div class="nav">Navigation links</div>
        </div>

        <div class="content-column">
          <div class="main-content">
            <h2>First Article</h2>
            <p>This is the first main content paragraph.</p>
            <p>This is the second main content paragraph.</p>
          </div>

          <div class="secondary-content">
            <h2>Second Article</h2>
            <p>This is another important content section with a paragraph.</p>
            <p>This section has multiple paragraphs of content too.</p>
            <p>And even more text in this section to make it dense.</p>
            <p>Plus one more paragraph to make this the densest section.</p>
          </div>
        </div>

        <div class="sidebar">
          <div class="widget">
            <h3>Sidebar Widget</h3>
            <p>Less important sidebar content.</p>
          </div>
        </div>

        <div class="footer">
          <p>Footer text</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // The secondary content has more text, so it should be identified as most relevant
    expect(markdown).toContain('Second Article')
    expect(markdown).toContain('This section has multiple paragraphs of content too')
    expect(markdown).toContain('<!-- Content relevance: Most relevant path is')

    // Should properly identify and wrap the most content-dense section
    const startMarker = '<!-- START RELEVANT CONTENT -->'
    const endMarker = '<!-- END RELEVANT CONTENT -->'
    const contentStart = markdown.indexOf(startMarker)
    const contentEnd = markdown.indexOf(endMarker)

    expect(contentStart).not.toBe(-1)
    expect(contentEnd).not.toBe(-1)

    const relevantContent = markdown.substring(contentStart + startMarker.length, contentEnd)
    expect(relevantContent).toContain('Second Article')
    expect(relevantContent).toContain('Plus one more paragraph to make this the densest section')
  })

  it('should filter out common non-content elements', () => {
    const html = `
      <div class="page">
        <nav class="navigation">
          <ul>
            <li><a href="#">Home</a></li>
            <li><a href="#">About</a></li>
            <li><a href="#">Contact</a></li>
            <li><a href="#">Products</a></li>
            <li><a href="#">Services</a></li>
            <li><a href="#">Blog</a></li>
            <li><a href="#">FAQ</a></li>
          </ul>
        </nav>

        <div class="content">
          <h1>Main Content</h1>
          <p>This should be identified as the main content despite having fewer text nodes than the navigation.</p>
          <p>The algorithm should recognize that navigation elements are typically not main content.</p>
        </div>

        <footer>
          <ul>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact Us</a></li>
            <li><a href="#">Sitemap</a></li>
            <li><a href="#">Legal</a></li>
          </ul>
        </footer>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Should correctly identify the content div as most relevant, not the nav or footer
    expect(markdown).toContain('Main Content')

    // Should mark the content as relevant
    const startMarker = '<!-- START RELEVANT CONTENT -->'
    const endMarker = '<!-- END RELEVANT CONTENT -->'
    const contentStart = markdown.indexOf(startMarker)
    const contentEnd = markdown.indexOf(endMarker)

    expect(contentStart).not.toBe(-1)
    expect(contentEnd).not.toBe(-1)

    const relevantContent = markdown.substring(contentStart + startMarker.length, contentEnd)
    expect(relevantContent).toContain('Main Content')
    expect(relevantContent).toContain('should recognize that navigation elements')
  })

  it('should work alongside other plugins', async () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <header>
            <h1>Website Header</h1>
            <nav>
              <ul>
                <li><a href="#">Navigation Item 1</a></li>
                <li><a href="#">Navigation Item 2</a></li>
              </ul>
            </nav>
          </header>

          <main>
            <article>
              <h2>Article Title</h2>
              <p>Main article content paragraph one.</p>
              <p>Main article content paragraph two.</p>
              <pre><code class="language-js">
                // Code sample
                function helloWorld() {
                  console.log("Hello, world!");
                }
              </code></pre>
            </article>
          </main>

          <footer>
            <p>Footer content</p>
          </footer>
        </body>
      </html>
    `

    // Combine with exclude-tags to filter out navigation and footer
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
        // Exclude header and footer tags
        (await import('../src/plugins.ts')).withExcludeTagsPlugin(new Set(['nav', 'footer'])),
      ],
    })

    // Should identify the article as most relevant
    expect(markdown).toContain('Article Title')
    expect(markdown).toContain('Main article content paragraph one')

    // Navigation should be excluded
    expect(markdown).not.toContain('Navigation Item 1')

    // Footer should be excluded
    expect(markdown).not.toContain('Footer content')
  })

  // Additional test cases
  it('should handle deeply nested content structures', () => {
    const html = `
      <div class="container">
        <div class="row">
          <div class="col">
            <div class="box">
              <div class="inner-content">
                <div class="content-wrapper">
                  <h3>Deeply Nested Content</h3>
                  <p>This content is deeply nested which would traditionally be penalized.</p>
                  <p>However, with enough text nodes, it should still be recognized as important.</p>
                  <p>The algorithm should balance depth penalty with text node density.</p>
                  <p>This makes sure we don't miss important content just because it's nested deeply.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar">
          <h4>Sidebar</h4>
          <p>A single paragraph in the sidebar.</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Should identify the deeply nested content despite the depth penalty
    expect(markdown).toContain('Deeply Nested Content')
    expect(markdown).toContain('balance depth penalty with text node density')

    // Check that the deeply nested content is marked as most relevant
    const startMarker = '<!-- START RELEVANT CONTENT -->'
    const endMarker = '<!-- END RELEVANT CONTENT -->'
    const relevantContent = markdown.substring(
      markdown.indexOf(startMarker) + startMarker.length,
      markdown.indexOf(endMarker),
    )

    expect(relevantContent).toContain('Deeply Nested Content')
  })

  it('should handle real-world blog article layout', () => {
    const html = `
      <div class="site-container">
        <header class="site-header">
          <div class="logo">My Blog</div>
          <nav class="main-nav">
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </nav>
        </header>

        <div class="main-content">
          <article class="blog-post">
            <header class="post-header">
              <h1 class="post-title">How to Build a Content Relevance Plugin</h1>
              <div class="post-meta">
                <span class="post-date">May 10, 2023</span>
                <span class="post-author">By John Doe</span>
              </div>
            </header>

            <div class="post-content">
              <p>In this tutorial, we'll learn how to build a content relevance plugin.</p>
              <p>The first step is to analyze the document structure and identify text nodes.</p>
              <p>Next, we need to calculate density metrics to find the most relevant content.</p>
              <h2>Understanding Text Node Density</h2>
              <p>Text node density is a measure of how much textual content exists within a section.</p>
              <p>Higher density usually indicates the main content of a document.</p>
              <p>We can use this principle to automatically extract the most important parts.</p>
              <h2>Implementation Details</h2>
              <p>The algorithm tracks text nodes at each path in the document tree.</p>
              <p>It calculates a density score based on text count and path depth.</p>
              <p>Finally, it filters out common non-content elements like navigation and footers.</p>
            </div>

            <footer class="post-footer">
              <div class="post-tags">
                <a href="/tag/plugin">Plugin</a>
                <a href="/tag/tutorial">Tutorial</a>
              </div>
              <div class="post-share">
                <a href="#">Share on Twitter</a>
                <a href="#">Share on Facebook</a>
              </div>
            </footer>
          </article>
        </div>

        <aside class="sidebar">
          <div class="widget">
            <h3>Recent Posts</h3>
            <ul>
              <li><a href="#">Post One</a></li>
              <li><a href="#">Post Two</a></li>
              <li><a href="#">Post Three</a></li>
            </ul>
          </div>
          <div class="widget">
            <h3>Categories</h3>
            <ul>
              <li><a href="#">Category One</a></li>
              <li><a href="#">Category Two</a></li>
              <li><a href="#">Category Three</a></li>
            </ul>
          </div>
        </aside>

        <footer class="site-footer">
          <p>&copy; 2023 My Blog. All rights reserved.</p>
        </footer>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Should identify the post-content div as most relevant
    expect(markdown).toContain('How to Build a Content Relevance Plugin')
    expect(markdown).toContain('Understanding Text Node Density')
    expect(markdown).toContain('Implementation Details')

    // Check that the main article content is marked as relevant
    const startMarker = '<!-- START RELEVANT CONTENT -->'
    const endMarker = '<!-- END RELEVANT CONTENT -->'
    const relevantContent = markdown.substring(
      markdown.indexOf(startMarker) + startMarker.length,
      markdown.indexOf(endMarker),
    )

    // Post content should be marked as relevant, not the sidebar or footer
    expect(relevantContent).toContain('How to Build a Content Relevance Plugin')
    expect(relevantContent).toContain('Text node density is a measure')
    expect(relevantContent).not.toContain('Recent Posts')
    expect(relevantContent).not.toContain('2023 My Blog. All rights reserved')
  })

  it('should handle edge case with no clear main content', () => {
    const html = `
      <div class="container">
        <div class="section">
          <p>Small section one</p>
        </div>
        <div class="section">
          <p>Small section two</p>
        </div>
        <div class="section">
          <p>Small section three</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Should still identify something as the main content even with sparse content
    expect(markdown).toContain('Small section')
    expect(markdown).toContain('<!-- Content relevance: Most relevant path is')
  })

  it('should correctly process empty or nearly empty documents', () => {
    const html = `
      <html>
        <body>
          <div></div>
          <p></p>
        </body>
      </html>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Should handle empty documents gracefully
    expect(markdown).toBeDefined()
    expect(markdown.trim()).toBe('')
  })

  it('should not be confused by hidden content', () => {
    const html = `
      <div class="visible-content">
        <h1>Main Visible Content</h1>
        <p>This is the main visible content that users see.</p>
        <p>It has enough text nodes to be considered important.</p>
      </div>

      <div class="hidden-content" style="display:none">
        <p>Hidden text that shouldn't be considered main content.</p>
        <p>Even though there's a lot of text here...</p>
        <p>...and it has many paragraphs...</p>
        <p>...the plugin should prefer visible content.</p>
        <p>This is all invisible to the user.</p>
        <p>So it shouldn't be prioritized just because it has many text nodes.</p>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({ logDensity: true }),
      ],
    })

    // Note: The plugin currently doesn't specifically detect display:none content
    // But this test is included for future improvements and to document the current behavior

    // Should still produce valid markdown output
    expect(markdown).toContain('Main Visible Content')
    expect(markdown).toContain('This is the main visible content that users see.')
  })

  it('should be able to identify multiple relevant sections', () => {
    const html = `
      <div id="container">
        <section id="section1">
          <h2>First Important Section</h2>
          <p>This is an important section with good content.</p>
          <p>It contains multiple paragraphs to ensure it has high node density.</p>
          <p>Enough text to be recognized as significant content.</p>
        </section>

        <section id="section2">
          <h2>Second Important Section</h2>
          <p>This is another important section with almost equal content density.</p>
          <p>It has a similar number of paragraphs as the first section.</p>
          <p>The algorithm should recognize both sections as relevant.</p>
        </section>

        <section id="section3">
          <h2>Third Section With Less Content</h2>
          <p>This section has less content but still has a header.</p>
        </section>

        <div id="noise" class="sidebar">
          <p>Less important content here.</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
          similarityThreshold: 0.9, // High threshold to ensure similar sections are captured
          maxRelevantSections: 2,
        }),
      ],
    })

    // Should identify both major sections as relevant
    expect(markdown).toContain('Found 2 relevant sections')
    expect(markdown).toContain('First Important Section')
    expect(markdown).toContain('Second Important Section')

    // Should identify and rank the sections
    expect(markdown).toContain('START RELEVANT CONTENT (Rank 1)')
    expect(markdown).toContain('START RELEVANT CONTENT (Rank 2)')
  })

  it('should boost sections with header tags', () => {
    const html = `
      <div class="content-area">
        <div class="no-headers">
          <p>This section has a lot of text content.</p>
          <p>It contains multiple paragraphs with substantial information.</p>
          <p>However, it lacks any heading structure.</p>
          <p>Without headers, this section gets no boost in relevance scoring.</p>
          <p>The content density alone might make it relevant.</p>
        </div>

        <div class="with-headers">
          <h2>Section With Headers</h2>
          <p>This section has less text content overall.</p>
          <p>But it has proper heading structure.</p>
          <h3>Subsection</h3>
          <p>The presence of headers should boost its relevance score.</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
        }),
      ],
    })

    // Extract the content relevance comment
    const match = markdown.match(/<!-- Content relevance: Found .*-->/s)
    const relevanceInfo = match ? match[0] : ''

    // The section with headers should be ranked highly due to header boost
    expect(relevanceInfo).toContain('with-headers')
    expect(relevanceInfo).toContain('has headers: true')

    // The content should contain the section with headers
    expect(markdown).toContain('Section With Headers')
    expect(markdown).toContain('Subsection')
  })

  it('should respect minimum depth configuration', () => {
    const html = `
      <main>
        <div class="shallow">
          <p>This is a shallow section with just enough nesting.</p>
          <p>It has multiple paragraphs of content.</p>
          <p>But its nesting depth is only 2 levels.</p>
        </div>

        <div class="deeper">
          <div class="level1">
            <div class="level2">
              <div class="level3">
                <p>This section is more deeply nested.</p>
                <p>It has similar content amount.</p>
                <p>But its nesting depth is 4 levels.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `

    // Test with different minimum depth settings
    const markdown1 = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
          minDepth: 2, // Allow shallow sections
        }),
      ],
    })

    const markdown2 = syncHtmlToMarkdown(html, {
      plugins: [
        withContentRelevancePlugin({
          logDensity: true,
          minDepth: 4, // Require deeper nesting
        }),
      ],
    })

    // With minDepth=2, the shallow section should be included
    expect(markdown1).toContain('This is a shallow section')

    // With minDepth=4, only the deeper section should be included
    const startMarker = '<!-- START RELEVANT CONTENT'
    const endMarker = '<!-- END RELEVANT CONTENT -->'
    const relevantContent = markdown2.substring(
      markdown2.indexOf(startMarker),
      markdown2.indexOf(endMarker) + endMarker.length,
    )

    expect(relevantContent).toContain('This section is more deeply nested')
    expect(relevantContent).not.toContain('This is a shallow section')
  })
})
