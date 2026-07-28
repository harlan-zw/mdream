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

  describe('< before a non-letter', () => {
    // `<3` was scanned as a tag named `3` whose attributes ran to the next `>`,
    // so the rest of the text node disappeared.
    it.each([
      ['<p>I <3 Rust</p>', 'I <3 Rust'],
      ['<p>5 <10 and 10> 5</p>', '5 <10 and 10> 5'],
      ['<p>a <1b>c</p>', 'a <1b>c'],
      ['<p>a <-b>c</p>', 'a <-b>c'],
      ['<p>a <<em>b</em>c</p>', 'a <*b*c'],
      ['<3', '<3'],
      ['<>', '<>'],
      ['< 3', '< 3'],
    ])('keeps the text of %s', async (html, expected) => {
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })
      expect(markdown).toBe(expected)
    })

    it('still discards a bogus comment opened by ?', async () => {
      const resolved = await resolveEngine(engine)
      expect(htmlToMarkdown('<?pi?>after', { engine: resolved })).toBe('after')
      expect(htmlToMarkdown('<p>a <?b>c</p>', { engine: resolved })).toBe('a c')
    })

    it('still drops an incomplete tag at end of input', async () => {
      const resolved = await resolveEngine(engine)
      expect(htmlToMarkdown('<div', { engine: resolved })).toBe('')
      expect(htmlToMarkdown('<p>ok</p><div', { engine: resolved })).toBe('ok')
    })

    // A run whose only non-whitespace byte is `<` must still count as non-empty,
    // or the text node is dropped. Table cells take a separate emit path.
    it.each([
      ['<p>< </p>', '<'],
      ['<p><\t</p>', '<'],
      ['<div>< </div>', '<'],
      ['<p>< <b>x</b></p>', '< **x**'],
      ['<table><tr><td>< </td></tr></table>', '| < |\n| --- |'],
      ['<table><tr><td>< <b>x</b></td></tr></table>', '| < **x** |\n| --- |'],
    ])('emits a lone < in %s', async (html, expected) => {
      const markdown = htmlToMarkdown(html, { engine: await resolveEngine(engine) })
      expect(markdown).toBe(expected)
    })
  })
})
