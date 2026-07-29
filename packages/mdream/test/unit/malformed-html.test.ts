import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../utils/engines'

describe.each(engines)('malformed html %s', ({ name: _name, engine }) => {
  describe.skip('correctly tracks element depth in nested structures', () => {
    it('handles incorrectly nested tags that overlap', async () => {
      const html = '<p><strong>Bold text <em>Bold and italic</strong> just italic</em></p>'
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })

      // The parser should maintain emphasis even though tags are improperly nested
      expect(markdown).toContain('**Bold text *Bold and italic** just italic*')
    })

    it('recovers from malformed attributes in tags', async () => {
      const html = '<a href="https://example.com" title="missing quote>Link text</a>'
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })

      // The parser should still create a link despite the malformed attribute
      expect(markdown).toContain('[Link text](https://example.com)')
    })

    it('handles broken HTML comments appropriately', async () => {
      const html = '<!-- This comment is not closed <p>This paragraph should be visible</p>'
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })

      // The parser should still process content after a broken comment
      expect(markdown).toContain('This paragraph should be visible')
    })
  })

  describe('comment end states', () => {
    // `<!-->`, `<!--->` and `--!>` all end a comment. Scanning for `-->` alone
    // left them open, so every byte after them was discarded.
    it.each([
      'before<!-->after',
      'before<!--->after',
      'before<!--x--!>after',
      'before<!----!>after',
      'before<!--x---!>after',
    ])('closes %s and keeps the rest of the document', async (html) => {
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })
      expect(markdown).toBe('before after')
    })

    it('does not treat a > inside the comment body as a terminator', async () => {
      const html = 'before<!--[if IE]>hidden<![endif]-->after'
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })
      expect(markdown).toBe('before after')
    })

    it('keeps a long document that contains a five-byte malformed comment', async () => {
      const body = Array.from({ length: 200 }, (_, i) => `<p>para ${i}</p>`).join('')
      const markdown = htmlToMarkdown(`<p>lead</p><!-->${body}`, { engine: await resolveEngine(engine) })
      expect(markdown.match(/para /g)?.length).toBe(200)
    })
  })
})
