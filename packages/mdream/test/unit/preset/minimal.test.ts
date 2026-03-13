import { htmlToMarkdown as jsHtmlToMarkdown, withMinimalPreset } from '@mdream/js'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe('withMinimalPreset cross-engine parity', () => {
  async function bothEngines() {
    return Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
  }

  it('basic conversion produces identical output', async () => {
    const [js, rust] = await bothEngines()
    const cases = [
      '<h1>Hello World</h1><p>This is a paragraph.</p>',
      '<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <a href="/link">link</a>.</p>',
      '<h1>Title</h1><ul><li>one</li><li>two</li></ul><p>After list.</p>',
    ]
    for (const html of cases) {
      const opts = withMinimalPreset()
      const jsResult = htmlToMarkdown(html, { ...opts, engine: js }).markdown
      const rustResult = htmlToMarkdown(html, { ...opts, engine: rust }).markdown
      expect(rustResult, `Parity mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('filter plugin produces identical output', async () => {
    const [js, rust] = await bothEngines()
    const cases = [
      '<h1>Title</h1><form><input /><button>Submit</button></form><p>Content</p>',
      '<h1>Title</h1><nav><a href="/">Home</a></nav><p>Content</p>',
      '<h1>Title</h1><aside>Sidebar</aside><p>Content</p>',
      '<h1>Title</h1><iframe src="/frame">no</iframe><p>Content</p>',
      '<h1>Title</h1><select><option>A</option></select><textarea>text</textarea><p>Content</p>',
      '<h1>Title</h1><fieldset><legend>Form</legend></fieldset><p>Content</p>',
      '<h1>Title</h1><embed src="/e" /><object data="/o">obj</object><p>Content</p>',
    ]
    for (const html of cases) {
      const opts = withMinimalPreset()
      const jsResult = htmlToMarkdown(html, { ...opts, engine: js }).markdown
      const rustResult = htmlToMarkdown(html, { ...opts, engine: rust }).markdown
      expect(rustResult, `Filter parity mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('frontmatter produces identical output', async () => {
    const [js, rust] = await bothEngines()
    const html = `<html><head><title>My Page</title><meta name="description" content="A page about things" /><meta name="author" content="Alice" /></head><body><h1>Content</h1><p>Text</p></body></html>`
    const opts = withMinimalPreset()
    const jsResult = htmlToMarkdown(html, { ...opts, engine: js }).markdown
    const rustResult = htmlToMarkdown(html, { ...opts, engine: rust }).markdown
    expect(rustResult).toBe(jsResult)
  })

  it('isolateMain produces identical output', async () => {
    const [js, rust] = await bothEngines()
    const cases = [
      '<header>Header</header><h1>Main Title</h1><p>Content</p><footer>Footer</footer>',
      '<div>Before</div><h2>Start</h2><p>Content</p><footer>End</footer><div>After</div>',
      '<main><h1>In Main</h1><p>Paragraph</p></main><div>Outside</div>',
    ]
    for (const html of cases) {
      const opts = withMinimalPreset()
      const jsResult = htmlToMarkdown(html, { ...opts, engine: js }).markdown
      const rustResult = htmlToMarkdown(html, { ...opts, engine: rust }).markdown
      expect(rustResult, `IsolateMain parity mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('tailwind produces identical output', async () => {
    const [js, rust] = await bothEngines()
    const cases = [
      '<h1>Title</h1><p><span class="font-bold">bold text</span></p>',
      '<h1>Title</h1><p><span class="italic">italic text</span></p>',
      '<h1>Title</h1><p><span class="line-through">struck text</span></p>',
      '<h1>Title</h1><div class="hidden">hidden content</div><p>visible</p>',
    ]
    for (const html of cases) {
      const opts = withMinimalPreset()
      const jsResult = htmlToMarkdown(html, { ...opts, engine: js }).markdown
      const rustResult = htmlToMarkdown(html, { ...opts, engine: rust }).markdown
      expect(rustResult, `Tailwind parity mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('combined preset with full page produces identical output', async () => {
    const [js, rust] = await bothEngines()
    const html = `<html>
      <head>
        <title>Full Page Test</title>
        <meta name="description" content="Testing all minimal preset plugins together" />
      </head>
      <body>
        <header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
        <h1>Main Title</h1>
        <p>First paragraph with <strong>bold</strong> and <em>italic</em>.</p>
        <form><input type="text" /><button>Submit</button></form>
        <h2>Section</h2>
        <ul><li>Item one</li><li>Item two</li></ul>
        <aside>Sidebar content</aside>
        <p>Final paragraph with <a href="/link">a link</a>.</p>
        <footer><p>Copyright 2024</p></footer>
      </body>
    </html>`
    const opts = withMinimalPreset()
    const jsResult = htmlToMarkdown(html, { ...opts, engine: js }).markdown
    const rustResult = htmlToMarkdown(html, { ...opts, engine: rust }).markdown
    expect(rustResult).toBe(jsResult)
  })
})

describe.each(engines)('withMinimalPreset $name', (engineConfig) => {
  it('should convert basic HTML to markdown', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>Hello World</h1><p>This is a paragraph.</p>'
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, { ...options, engine }).markdown
    expect(markdown).toBe('# Hello World\n\nThis is a paragraph.')
  })

  it('should filter out excluded tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <h1>Title</h1>
      <p>Content</p>
      <form>
        <input type="text" />
        <button>Submit</button>
      </form>
      <nav>Navigation</nav>
      <footer>Footer</footer>
    `
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, { ...options, engine }).markdown
    expect(markdown).not.toContain('Submit')
    expect(markdown).not.toContain('Navigation')
    expect(markdown).not.toContain('Footer')
    expect(markdown).toContain('Title')
    expect(markdown).toContain('Content')
  })

  it('should apply plugins correctly', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // Test filtering functionality
    const html = `<h1>Title</h1><form><button>Submit</button></form><p>Content</p>`
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, { ...options, engine }).markdown

    // Should filter out form elements
    expect(markdown).not.toContain('Submit')
    expect(markdown).toContain('Title')
    expect(markdown).toContain('Content')
  })

  it('should extract frontmatter', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Test description" />
        </head>
        <body>
          <h1>Main Content</h1>
        </body>
      </html>
    `
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, { ...options, engine }).markdown

    expect(markdown).toContain('---')
    expect(markdown).toContain('title: "Test Page"')
    expect(markdown).toContain('description: "Test description"')
    expect(markdown).toContain('Main Content')
  })

  it('should isolate main content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<header>Header</header><h1>Main Title</h1><p>Content</p><footer>Footer</footer>`
    const options = withMinimalPreset()
    const markdown = htmlToMarkdown(html, { ...options, engine }).markdown

    expect(markdown).toContain('Main Title')
    expect(markdown).toContain('Content')
    expect(markdown).not.toContain('Header')
    expect(markdown).not.toContain('Footer')
  })

  it('should merge with existing plugins', async () => {
    if (engineConfig.name === 'Rust Engine')
      return // hooks not supported in Rust
    const engine = await resolveEngine(engineConfig.engine)
    let customPluginCalled = false
    const customPlugin = {
      onNodeEnter: () => {
        customPluginCalled = true
        return ''
      },
    }

    const options = withMinimalPreset({ hooks: [customPlugin] })
    const markdown = jsHtmlToMarkdown('<h1>Test</h1>', options).markdown
    expect(customPluginCalled).toBe(true)
    expect(markdown).toContain('Test')
  })
})
