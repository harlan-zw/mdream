import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.js'
import { createPlugin } from '../../../src/pluggable/plugin.ts'
import { filterPlugin } from '../../../src/plugins/filter.ts'

describe('querySelector plugin', () => {
  // Basic tests for including elements
  it('includes specified elements by tag when provided with include option', () => {
    const html = `
      <div>This should be excluded</div>
      <h1>This heading should be included</h1>
      <p>This paragraph should be included</p>
      <aside>This aside should be excluded</aside>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['h1', 'p'] }),
      ],
    })

    // Check that h1 and p elements are included
    expect(markdown).toContain('# This heading should be included')
    expect(markdown).toContain('This paragraph should be included')
  })

  it('excludes specified elements by tag', () => {
    const html = `
      <div>This should be included</div>
      <h1>This heading should be included</h1>
      <p>This paragraph should be included</p>
      <aside>This aside should be excluded</aside>
      <nav>This nav should be excluded</nav>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ exclude: ['aside', 'nav'] }),
      ],
    })

    expect(markdown).toContain('This should be included')
    expect(markdown).toContain('# This heading should be included')
    expect(markdown).toContain('This paragraph should be included')
    expect(markdown).not.toContain('This aside should be excluded')
    expect(markdown).not.toContain('This nav should be excluded')
  })

  // Tests for including/excluding by ID and class
  it('includes elements by ID selector', () => {
    const html = `
      <div>This should be excluded</div>
      <div id="main">This main div should be included</div>
      <div id="content">This content div should be included</div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['#main', '#content'] }),
      ],
    })

    expect(markdown).toContain('This main div should be included')
    expect(markdown).toContain('This content div should be included')
  })

  it('excludes elements by class selector', () => {
    const html = `
      <div>This should be included</div>
      <div class="ad">This ad should be excluded</div>
      <div class="sidebar">This sidebar should be excluded</div>
      <div class="footer">This footer should be excluded</div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ exclude: ['.ad', '.sidebar', '.footer'] }),
      ],
    })

    expect(markdown).toContain('This should be included')
    expect(markdown).not.toContain('This ad should be excluded')
    expect(markdown).not.toContain('This sidebar should be excluded')
    expect(markdown).not.toContain('This footer should be excluded')
  })

  // Tests for compound selectors
  it('handles compound selectors', () => {
    const html = `
      <div class="content">This plain content div should be excluded</div>
      <div id="main" class="content">This main content div should be included</div>
      <div class="sidebar" id="right">This sidebar should be excluded</div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['div#main.content'] }),
      ],
    })

    expect(markdown).toContain('This main content div should be included')
  })

  // Tests for attribute selectors
  it('handles attribute selectors', () => {
    const html = `
      <p>This should be excluded</p>
      <a href="https://example.com">This link should be included</a>
      <p>This link without href should be excluded <a>No href here</a></p>
      <img src="image.png" alt="Image">
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['a[href]', 'img[alt]'] }),
      ],
    })

    // Verify that link content is included
    expect(markdown).toContain('This link should be included')
    // Verify link formatting
    expect(markdown).toContain('(https://example.com)')
  })

  it('handles attribute value selectors', () => {
    const html = `
      <div data-type="header">This header should be included</div>
      <div data-type="content">This content should be included</div>
      <div data-type="sidebar">This sidebar should be excluded</div>
      <div data-type="footer">This footer should be excluded</div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['[data-type="header"]', '[data-type="content"]'] }),
      ],
    })

    expect(markdown).toContain('This header should be included')
    expect(markdown).toContain('This content should be included')
  })

  // Tests for child processing
  it('processes children of selected elements by default', () => {
    const html = `
      <div>
        <div id="main">
          <h1>Main Heading</h1>
          <p>Main paragraph</p>
          <div class="subsection">
            <h2>Subsection Heading</h2>
            <p>Subsection paragraph</p>
          </div>
        </div>
        <div id="sidebar">
          <h2>Sidebar Heading</h2>
          <p>Sidebar content</p>
        </div>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['#main'] }),
      ],
    })

    // Should include main and all its children
    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('Main paragraph')
    expect(markdown).toContain('## Subsection Heading')
    expect(markdown).toContain('Subsection paragraph')
  })

  // Test for whitelist behavior - correctly include all children of included element
  it('properly includes all children of whitelisted elements', () => {
    const html = `
      <div>Outside text</div>
      <article>
        <h1>Article Title</h1>
        <p>First paragraph</p>
        <div class="content">
          <h2>Subheading</h2>
          <p>More content here</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
        <div class="footer">Article footer</div>
      </article>
      <div>More outside text</div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['article'] }),
      ],
    })

    // Should include the article and all its descendants
    expect(markdown).toContain('# Article Title')
    expect(markdown).toContain('First paragraph')
    expect(markdown).toContain('## Subheading')
    expect(markdown).toContain('More content here')
    expect(markdown).toContain('- Item 1')
    expect(markdown).toContain('- Item 2')
    expect(markdown).toContain('Article footer')
  })

  // Test for combining multiple include selectors
  it('combines multiple include selectors correctly', () => {
    const html = `
      <div>Regular div</div>
      <header>
        <h1>Page Header</h1>
        <nav>Navigation links</nav>
      </header>
      <main>
        <p>Main content</p>
      </main>
      <footer>Page footer</footer>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ include: ['header', 'main'] }),
      ],
    })

    // Should include header and main with their contents
    expect(markdown).toContain('# Page Header')
    expect(markdown).toContain('Navigation links')
    expect(markdown).toContain('Main content')
  })

  it('can be configured to not process children', () => {
    const html = `
      <div>
        <article>
          <h1>Article Heading</h1>
          <p>Article paragraph</p>
          <aside>
            <h2>Aside Heading</h2>
            <p>Aside paragraph</p>
          </aside>
        </article>
      </div>
    `

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({
          include: ['article', 'h1', 'p'],
          exclude: ['aside'],
          processChildren: false,
        }),
      ],
    })

    // Only specified elements should be included,
    // even if they're children of included elements
    expect(markdown).toContain('# Article Heading')
    expect(markdown).toContain('Article paragraph')
    expect(markdown).not.toContain('Aside Heading')
    expect(markdown).not.toContain('Aside paragraph')
  })

  // Tests for combining with other plugins
  it('can be combined with other plugins', () => {
    const html = `
      <div>
        <h1>Main Heading</h1>
        <pre><code class="language-js">console.log('Hello');</code></pre>
        <aside>This aside should be excluded</aside>
      </div>
    `

    // We're using an imaginary code plugin just for this test
    const codePlugin = createPlugin({
      name: 'code-plugin',
      onNodeEnter: (node) => {
        if (node.type === 1 && node.name === 'code' && node.attributes?.class?.includes('language-')) {
          const lang = node.attributes.class.split('language-')[1].split(/\s+/)[0]
          return `**CodePlugin: ${lang}**\n`
        }
        return undefined
      },
    })

    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({ exclude: ['aside'] }),
        codePlugin,
      ],
    })

    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('**CodePlugin: js**')
    expect(markdown).toContain('console.log(\'Hello\');')
    expect(markdown).not.toContain('This aside should be excluded')
  })
})
