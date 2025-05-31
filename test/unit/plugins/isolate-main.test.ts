import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { isolateMainPlugin } from '../../../src/plugins/isolate-main.ts'

describe('isolateMainPlugin', () => {
  it('prioritizes explicit main element over header heuristic', () => {
    const html = `
      <html>
        <body>
          <nav>Navigation content (should be excluded)</nav>
          <h1>Page Title (should be excluded - outside main)</h1>
          <main>
            <h1>Article Title (should be included)</h1>
            <p>This is the main content that should be included.</p>
            <h2>Subsection</h2>
            <p>More main content here.</p>
          </main>
          <footer>Footer content (should be excluded)</footer>
          <div class="related">Related articles (should be excluded)</div>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    // Should include content inside main
    expect(markdown).toContain('# Article Title')
    expect(markdown).toContain('This is the main content that should be included.')
    expect(markdown).toContain('## Subsection')
    expect(markdown).toContain('More main content here.')

    // Should exclude content outside main, even headers
    expect(markdown).not.toContain('Navigation content')
    expect(markdown).not.toContain('Footer content')
    expect(markdown).not.toContain('Related articles')
  })

  it('handles main element with nested content correctly', () => {
    const html = `
      <body>
        <header>Site header (excluded)</header>
        <main>
          <article>
            <header>
              <h1>Article Header</h1>
              <p>Article subtitle</p>
            </header>
            <section>
              <h2>Section Title</h2>
              <p>Section content</p>
            </section>
            <footer>Article footer (included - inside main)</footer>
          </article>
        </main>
        <footer>Site footer (excluded)</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Article Header')
    expect(markdown).toContain('Article subtitle')
    expect(markdown).toContain('## Section Title')
    expect(markdown).toContain('Section content')
    expect(markdown).toContain('Article footer (included - inside main)')
    expect(markdown).not.toContain('Site header')
    expect(markdown).not.toContain('Site footer')
  })

  it('ignores main element if deeper than 5 levels', () => {
    const html = `
      <body>
        <nav>Before content (excluded)</nav>
        <h1>Header Title</h1>
        <p>Content after header</p>
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <main>
                      <h2>Deep Main Title (should be excluded - too deep)</h2>
                      <p>Deep main content</p>
                    </main>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <footer>Footer (excluded)</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    // Should fall back to header heuristic since main is too deep
    expect(markdown).toContain('# Header Title')
    expect(markdown).toContain('Content after header')
    expect(markdown).toContain('## Deep Main Title') // This is included because it's after the header
    expect(markdown).toContain('Deep main content')
    expect(markdown).not.toContain('Before content')
    expect(markdown).not.toContain('Footer')
  })

  it('handles multiple main elements - uses the first one within depth limit', () => {
    const html = `
      <body>
        <nav>Before (excluded)</nav>
        <main>
          <h1>First Main Title</h1>
          <p>First main content</p>
        </main>
        <p>Between mains (excluded)</p>
        <main>
          <h1>Second Main Title</h1>
          <p>Second main content</p>
        </main>
        <footer>Footer (excluded)</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# First Main Title')
    expect(markdown).toContain('First main content')
    expect(markdown).not.toContain('Before')
    expect(markdown).not.toContain('Between mains')
    expect(markdown).not.toContain('Second Main Title')
    expect(markdown).not.toContain('Second main content')
    expect(markdown).not.toContain('Footer')
  })

  it('isolates content between first header and footer', () => {
    const html = `
      <html>
        <body>
          <nav>Navigation content (should be excluded)</nav>
          <div class="header-ads">Ad content (should be excluded)</div>
          <h1>Main Article Title</h1>
          <p>This is the main content that should be included.</p>
          <h2>Subsection</h2>
          <p>More main content here.</p>
          <footer>Footer content (should be excluded)</footer>
          <div class="related">Related articles (should be excluded)</div>
        </body>
      </html>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    // Should include main content
    expect(markdown).toContain('# Main Article Title')
    expect(markdown).toContain('This is the main content that should be included.')
    expect(markdown).toContain('## Subsection')
    expect(markdown).toContain('More main content here.')

    // Should exclude content before first header
    expect(markdown).not.toContain('Navigation content')
    expect(markdown).not.toContain('Ad content')

    // Should exclude footer and content after footer
    expect(markdown).not.toContain('Footer content')
    expect(markdown).not.toContain('Related articles')
  })

  it('works with different header levels', () => {
    const html = `
      <body>
        <div>Before content (excluded)</div>
        <h3>Starting with H3</h3>
        <p>Main content paragraph</p>
        <footer>Footer (excluded)</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('### Starting with H3')
    expect(markdown).toContain('Main content paragraph')
    expect(markdown).not.toContain('Before content')
    expect(markdown).not.toContain('Footer')
  })

  it('excludes footer only if within 5 node depth', () => {
    const html = `
      <body>
        <nav>Before (excluded)</nav>
        <h1>Main Title</h1>
        <p>Content before deep footer</p>
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <footer>Deep footer (should NOT be excluded - too deep)</footer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p>Content after deep footer (should be included)</p>
        <footer>Shallow footer (should be excluded)</footer>
        <div>After shallow footer (excluded)</div>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Main Title')
    expect(markdown).toContain('Content before deep footer')
    expect(markdown).toContain('Deep footer (should NOT be excluded - too deep)')
    expect(markdown).toContain('Content after deep footer')
    expect(markdown).not.toContain('Before (excluded)')
    expect(markdown).not.toContain('Shallow footer')
    expect(markdown).not.toContain('After shallow footer')
  })

  it('handles case with no footer found', () => {
    const html = `
      <body>
        <nav>Navigation (excluded)</nav>
        <h1>Article Title</h1>
        <p>Main content paragraph 1</p>
        <p>Main content paragraph 2</p>
        <div>More content without footer</div>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Article Title')
    expect(markdown).toContain('Main content paragraph 1')
    expect(markdown).toContain('Main content paragraph 2')
    expect(markdown).toContain('More content without footer')
    expect(markdown).not.toContain('Navigation')
  })

  it('handles case with no header found', () => {
    const html = `
      <body>
        <nav>Navigation content</nav>
        <p>Regular paragraph</p>
        <div>Regular div content</div>
        <footer>Footer content</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    // Since no header is found, everything before should be excluded
    expect(markdown).not.toContain('Navigation content')
    expect(markdown).not.toContain('Regular paragraph')
    expect(markdown).not.toContain('Regular div content')
    expect(markdown).not.toContain('Footer content')
  })

  it('handles multiple headers - uses only the first one', () => {
    const html = `
      <body>
        <nav>Before first header (excluded)</nav>
        <h2>First Header (included)</h2>
        <p>Content after first header</p>
        <h1>Second Header (included)</h1>
        <p>Content after second header</p>
        <footer>Footer (excluded)</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('## First Header')
    expect(markdown).toContain('Content after first header')
    expect(markdown).toContain('# Second Header')
    expect(markdown).toContain('Content after second header')
    expect(markdown).not.toContain('Before first header')
    expect(markdown).not.toContain('Footer')
  })

  it('handles multiple footers - uses only the first eligible one', () => {
    const html = `
      <body>
        <nav>Before (excluded)</nav>
        <h1>Main Title</h1>
        <p>Main content</p>
        <footer>First footer (excluded)</footer>
        <p>Content after first footer (excluded)</p>
        <footer>Second footer (excluded)</footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Main Title')
    expect(markdown).toContain('Main content')
    expect(markdown).not.toContain('Before')
    expect(markdown).not.toContain('First footer')
    expect(markdown).not.toContain('Content after first footer')
    expect(markdown).not.toContain('Second footer')
  })

  it('handles nested content structure correctly', () => {
    const html = `
      <body>
        <header class="site-header">
          <nav>Site navigation (excluded)</nav>
        </header>

        <main>
          <article>
            <h1>Article Title</h1>
            <div class="content">
              <p>Article paragraph 1</p>
              <h2>Section Title</h2>
              <p>Article paragraph 2</p>
              <ul>
                <li>List item 1</li>
                <li>List item 2</li>
              </ul>
            </div>
          </article>
        </main>

        <footer class="site-footer">
          <p>Copyright notice (excluded)</p>
        </footer>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Article Title')
    expect(markdown).toContain('Article paragraph 1')
    expect(markdown).toContain('## Section Title')
    expect(markdown).toContain('Article paragraph 2')
    expect(markdown).toContain('- List item 1')
    expect(markdown).toContain('- List item 2')
    expect(markdown).not.toContain('Site navigation')
    expect(markdown).not.toContain('Copyright notice')
  })

  it('preserves text nodes correctly', () => {
    const html = `
      <body>
        Text before header (excluded)
        <h1>Main Title</h1>
        Text after header (included)
        <p>Paragraph content</p>
        More text content (included)
        <footer>Footer (excluded)</footer>
        Text after footer (excluded)
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Main Title')
    expect(markdown).toContain('Text after header')
    expect(markdown).toContain('Paragraph content')
    expect(markdown).toContain('More text content')
    expect(markdown).not.toContain('Text before header')
    expect(markdown).not.toContain('Footer')
    expect(markdown).not.toContain('Text after footer')
  })

  it('handles edge case with footer as direct sibling of header', () => {
    const html = `
      <body>
        <nav>Before (excluded)</nav>
        <h1>Title</h1>
        <footer>Adjacent footer (excluded)</footer>
        <div>After footer (excluded)</div>
      </body>
    `

    const markdown = htmlToMarkdown(html, {
      plugins: [isolateMainPlugin()],
    })

    expect(markdown).toContain('# Title')
    expect(markdown).not.toContain('Before')
    expect(markdown).not.toContain('Adjacent footer')
    expect(markdown).not.toContain('After footer')
  })
})
