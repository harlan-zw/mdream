import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { createPlugin } from '@mdream/js/plugins'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines.ts'

const RE_WHITESPACE = /\s+/

describe.each(engines)('querySelector plugin %s', ({ name, engine }) => {
  // Basic tests for including elements
  it('includes specified elements by tag when provided with include option', async () => {
    const html = `
      <div>This should be excluded</div>
      <h1>This heading should be included</h1>
      <p>This paragraph should be included</p>
      <aside>This aside should be excluded</aside>
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['h1', 'p'] } },
    }).markdown

    // Check that h1 and p elements are included
    expect(markdown).toContain('# This heading should be included')
    expect(markdown).toContain('This paragraph should be included')
  })

  it('excludes specified elements by tag', async () => {
    const html = `
      <div>This should be included</div>
      <h1>This heading should be included</h1>
      <p>This paragraph should be included</p>
      <aside>This aside should be excluded</aside>
      <nav>This nav should be excluded</nav>
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { exclude: ['aside', 'nav'] } },
    }).markdown

    expect(markdown).toContain('This should be included')
    expect(markdown).toContain('# This heading should be included')
    expect(markdown).toContain('This paragraph should be included')
    expect(markdown).not.toContain('This aside should be excluded')
    expect(markdown).not.toContain('This nav should be excluded')
  })

  // Tests for including/excluding by ID and class
  it('includes elements by ID selector', async () => {
    const html = `
      <div>This should be excluded</div>
      <div id="main">This main div should be included</div>
      <div id="content">This content div should be included</div>
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['#main', '#content'] } },
    }).markdown

    expect(markdown).toContain('This main div should be included')
    expect(markdown).toContain('This content div should be included')
  })

  it('excludes elements by class selector', async () => {
    const html = `
      <div>This should be included</div>
      <div class="ad">This ad should be excluded</div>
      <div class="sidebar">This sidebar should be excluded</div>
      <div class="footer">This footer should be excluded</div>
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { exclude: ['.ad', '.sidebar', '.footer'] } },
    }).markdown

    expect(markdown).toContain('This should be included')
    expect(markdown).not.toContain('This ad should be excluded')
    expect(markdown).not.toContain('This sidebar should be excluded')
    expect(markdown).not.toContain('This footer should be excluded')
  })

  // Tests for compound selectors
  it('handles compound selectors', async () => {
    const html = `
      <div class="content">This plain content div should be excluded</div>
      <div id="main" class="content">This main content div should be included</div>
      <div class="sidebar" id="right">This sidebar should be excluded</div>
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['div#main.content'] } },
    }).markdown

    expect(markdown).toContain('This main content div should be included')
  })

  // Tests for attribute selectors
  it('handles attribute selectors', async () => {
    const html = `
      <p>This should be excluded</p>
      <a href="https://example.com">This link should be included</a>
      <p>This link without href should be excluded <a>No href here</a></p>
      <img src="image.png" alt="Image">
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['a[href]', 'img[alt]'] } },
    }).markdown

    // Verify that link content is included
    expect(markdown).toContain('This link should be included')
    // Verify link formatting
    expect(markdown).toContain('(https://example.com)')
  })

  it('handles attribute value selectors', async () => {
    const html = `
      <div data-type="header">This header should be included</div>
      <div data-type="content">This content should be included</div>
      <div data-type="sidebar">This sidebar should be excluded</div>
      <div data-type="footer">This footer should be excluded</div>
    `

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['[data-type="header"]', '[data-type="content"]'] } },
    }).markdown

    expect(markdown).toContain('This header should be included')
    expect(markdown).toContain('This content should be included')
  })

  // Tests for child processing
  it('processes children of selected elements by default', async () => {
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

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['#main'] } },
    }).markdown

    // Should include main and all its children
    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('Main paragraph')
    expect(markdown).toContain('## Subsection Heading')
    expect(markdown).toContain('Subsection paragraph')
  })

  // Test for whitelist behavior - correctly include all children of included element
  it('properly includes all children of whitelisted elements', async () => {
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

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['article'] } },
    }).markdown

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
  it('combines multiple include selectors correctly', async () => {
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

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: { include: ['header', 'main'] } },
    }).markdown

    // Should include header and main with their contents
    expect(markdown).toContain('# Page Header')
    expect(markdown).toContain('Navigation links')
    expect(markdown).toContain('Main content')
  })

  it('can be configured to not process children', async () => {
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

    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { filter: {
        include: ['article', 'h1', 'p'],
        exclude: ['aside'],
        processChildren: false,
      } },
    }).markdown

    // Only specified elements should be included,
    // even if they're children of included elements
    expect(markdown).toContain('# Article Heading')
    expect(markdown).toContain('Article paragraph')
    expect(markdown).not.toContain('Aside Heading')
    expect(markdown).not.toContain('Aside paragraph')
  })

  it('can be combined with other plugins', async () => {
    if (name === 'Rust Engine')
      return // JS functions cannot run over Rust boundary
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
      onNodeEnter: (node: any) => {
        if (node.type === 1 && node.name === 'code' && node.attributes?.class?.includes('language-')) {
          const lang = node.attributes.class.split('language-')[1].split(RE_WHITESPACE)[0]
          return `**CodePlugin: ${lang}**\n`
        }
        return undefined
      },
    })

    const markdown = jsHtmlToMarkdown(html, {
      plugins: { filter: { exclude: ['aside'] } },
      hooks: [codePlugin],
    }).markdown

    expect(markdown).toContain('# Main Heading')
    expect(markdown).toContain('**CodePlugin: js**')
    expect(markdown).toContain('console.log(\'Hello\');')
    expect(markdown).not.toContain('This aside should be excluded')
  })
})
