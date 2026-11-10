import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { htmlToSafeHtml } from '@mdream/js/html'
import { frontmatterPlugin } from '@mdream/js/plugins'
import { htmlToText } from '@mdream/js/text'
import { describe, expect, it } from 'vitest'
import { CONVERSION_CORPUS } from '../../../js/test/fixtures/conversion-corpus'
import { htmlToMarkdown } from '../../src'

type Format = 'markdown' | 'text' | 'html'

const JS: Record<Format, (html: string) => string> = {
  markdown: html => jsHtmlToMarkdown(html),
  text: html => htmlToText(html),
  html: html => htmlToSafeHtml(html),
}

describe('javaScript and Rust engines agree on the corpus', () => {
  for (const format of ['markdown', 'text', 'html'] as const) {
    it(format, () => {
      for (const html of CONVERSION_CORPUS) {
        const rust = htmlToMarkdown(html, { format })
        const js = JS[format](html)
        expect(js, JSON.stringify(html)).toBe(rust)
      }
    })
  }

  // Long enough to cross the incremental quote flush; too large for the split-heavy corpus.
  it('long quotes flushed at a code span', () => {
    const words = 'w '.repeat(4500)
    for (const template of [
      '<blockquote><p>{W}</p>x<br><code></code><p>l</p></blockquote>',
      '<blockquote><blockquote><p>{W}</p>x<br><code></code><p>l</p></blockquote></blockquote>',
      '<blockquote>{W}<br><s></s><code> </code> <h2>l</h2>',
      '<blockquote><ul><li><blockquote>{W}</blockquote><code></code><br><p>l</p></li></ul></blockquote>',
      '<ul><li><blockquote><blockquote>{W}</blockquote><br><code></code><p>l</p></blockquote></li></ul>',
    ]) {
      const html = template.replace('{W}', words)
      expect(jsHtmlToMarkdown(html), template).toBe(htmlToMarkdown(html))
    }
  })

  it('frontmatter onExtract payloads', () => {
    for (const html of CONVERSION_CORPUS) {
      const rust: Record<string, string>[] = []
      const js: Record<string, string>[] = []
      htmlToMarkdown(html, { frontmatter: { additionalFields: { source: 'test' }, onExtract: fm => rust.push(fm) } })
      jsHtmlToMarkdown(html, { plugins: [frontmatterPlugin({ additionalFields: { source: 'test' }, onExtract: fm => js.push(fm) })] })
      expect(js, JSON.stringify(html)).toEqual(rust)
    }
  })
})
