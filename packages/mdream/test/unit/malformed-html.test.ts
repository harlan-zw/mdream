import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../utils/engines'

describe.each(engines)('malformed html %s', ({ name, engine }) => {
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
})
