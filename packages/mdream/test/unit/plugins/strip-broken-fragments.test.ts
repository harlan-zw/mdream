import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('clean $name', (engineConfig) => {
  describe('clean: true (all features)', () => {
    const opts = { clean: true as const }

    it('strips fragment link when no matching heading exists', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="#my-anchor">Jump to anchor</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('Jump to anchor')
    })

    it('keeps fragment link when matching heading exists', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<h2>My Anchor</h2><a href="#my-anchor">Jump to anchor</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('## My Anchor\n\n[Jump to anchor](#my-anchor)')
    })

    it('strips empty fragment links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="#">Link</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('Link')
    })

    it('strips javascript: links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="javascript:void(0)">Click me</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('Click me')
    })

    it('does not strip absolute URL fragment links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="https://example.com/page#section">Link</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('[Link](https://example.com/page#section)')
    })

    it('strips broken fragment but keeps valid ones in same document', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<h2>Introduction</h2><p><a href="#introduction">Intro</a> and <a href="#missing">Missing</a></p>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('## Introduction\n\n[Intro](#introduction) and Missing')
    })

    it('strips self-referencing heading links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<h2><a href="#new-project">New Project</a></h2>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('## New Project')
    })

    it('strips redundant links where text equals URL', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="https://example.com">https://example.com</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('https://example.com')
    })

    it('keeps non-redundant links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="https://example.com">Example</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('[Example](https://example.com)')
    })

    it('strips self-link heading but keeps external heading links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<h2><a href="https://example.com">My Section</a></h2>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('## [My Section](https://example.com)')
    })

    it('strips empty images (no alt)', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<img src="icon.svg" alt="" />'
      const md = htmlToMarkdown(html, { engine, ...opts }).trim()
      expect(md).toBe('')
    })

    it('strips images with no alt attribute', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<img src="spacer.gif" />'
      const md = htmlToMarkdown(html, { engine, ...opts }).trim()
      expect(md).toBe('')
    })

    it('keeps images with alt text', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<img src="photo.jpg" alt="A photo" />'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('![A photo](photo.jpg)')
    })

    it('collapses excessive blank lines', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<p>First</p><br><br><br><br><br><p>Second</p>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      // Should not have more than one blank line (2 newlines) between content
      expect(md).not.toMatch(/\n{3,}/)
      expect(md).toContain('First')
      expect(md).toContain('Second')
    })
  })

  describe('clean: { fragments: true } (selective)', () => {
    const opts = { clean: { fragments: true } }

    it('strips broken fragments', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="#nonexistent">Link</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('Link')
    })

    it('does not strip empty # links when emptyLinks is not enabled', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      // Bare # is an emptyLinks concern, not fragments — fragments only handles #slug
      const html = '<h2>Heading</h2><a href="#">Link</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('## Heading\n\n[Link](#)')
    })
  })

  describe('clean: { emptyLinks: true } (selective)', () => {
    const opts = { clean: { emptyLinks: true } }

    it('strips empty # links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="#">Link</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('Link')
    })

    it('strips javascript: links', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="javascript:void(0)">Click</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('Click')
    })

    it('keeps fragment links (not emptyLinks concern)', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="#section">Link</a>'
      const md = htmlToMarkdown(html, { engine, ...opts })
      expect(md).toBe('[Link](#section)')
    })

    // All of these are the `javascript:` scheme to a browser.
    it.each([
      ' javascript:void(0)',
      '\tjavascript:void(0)',
      '\njavascript:void(0)',
      '\u0001javascript:void(0)',
      'java\tscript:void(0)',
      'java\nscript:void(0)',
      'java\rscript:void(0)',
      ' java\tscript:void(0)',
      ' data:text/html,payload',
      'da\tta:text/html,payload',
      ' vbscript:msgbox(1)',
      '\tVbScRiPt:msgbox(1)',
    ])('strips %j', async (href) => {
      const engine = await resolveEngine(engineConfig.engine)
      const md = htmlToMarkdown(`<a href="${href}">Click</a>`, { engine, ...opts })
      expect(md).toBe('Click')
    })

    // Entity-encoded controls are the form these actually take in real HTML.
    it.each([
      'java&#9;script:void(0)',
      'java&#10;script:void(0)',
      'java&#13;script:void(0)',
      '&#32;javascript:void(0)',
    ])('strips the decoded form of %s', async (href) => {
      const engine = await resolveEngine(engineConfig.engine)
      const md = htmlToMarkdown(`<a href="${href}">Click</a>`, { engine, ...opts })
      expect(md).toBe('Click')
    })

    it('strips a bare # surrounded by whitespace', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      for (const href of [' # ', '#\t', '\t#']) {
        const md = htmlToMarkdown(`<a href="${href}">Link</a>`, { engine, ...opts })
        expect(md, href).toBe('Link')
      }
    })

    // An interior space is NOT removed, so these stay links.
    it.each([
      ['java script:x', '[Keep](<java script:x>)'],
      ['notjavascript:x', '[Keep](notjavascript:x)'],
      ['/javascript/guide', '[Keep](/javascript/guide)'],
      ['https://x.com/a', '[Keep](https://x.com/a)'],
      ['#section', '[Keep](#section)'],
    ])('keeps %j', async (href, expected) => {
      const engine = await resolveEngine(engineConfig.engine)
      const md = htmlToMarkdown(`<a href="${href}">Keep</a>`, { engine, ...opts })
      expect(md).toBe(expected)
    })
  })

  describe('disabled by default', () => {
    it('does not strip when clean is not set', async () => {
      const engine = await resolveEngine(engineConfig.engine)
      const html = '<a href="#my-anchor">Jump to anchor</a>'
      const md = htmlToMarkdown(html, { engine })
      expect(md).toBe('[Jump to anchor](#my-anchor)')
    })
  })
})
