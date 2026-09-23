import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { htmlToSafeHtml } from '@mdream/js/html'
import { htmlToText } from '@mdream/js/text'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src'

type Format = 'markdown' | 'text' | 'html'

const JS: Record<Format, (html: string) => string> = {
  markdown: html => jsHtmlToMarkdown(html),
  text: html => htmlToText(html),
  html: html => htmlToSafeHtml(html),
}

const ALL: Format[] = ['markdown', 'text', 'html']
// Markdown escaping of `<` in rawtext is a separate, open difference.
const TEXT_AND_HTML: Format[] = ['text', 'html']

// The Rust engine is the output reference. Each group lists inputs where the
// JavaScript engine used to differ from it.
const GROUPS: Record<string, string[] | [string[], Format[]]> = {
  'trailing root text collapses whitespace': [
    'a\nb',
    '<p>a\nb',
    'r\n\n[',
    '* |\n|',
    'I\r>',
  ],
  'rawtext keeps an unfinished end tag at EOF': [[
    '<textarea>a</t',
    '<textarea>a</tx>b',
    '<textarea>a</textarea',
    '<textarea>a</textarea ',
    '<textarea>a</TEXTAREA x',
    '<xmp>a</',
    '<title>a</x',
  ], TEXT_AND_HTML],
}

describe('javaScript engine matches Rust output', () => {
  for (const [group, entry] of Object.entries(GROUPS)) {
    const [inputs, formats] = typeof entry[0] === 'string' ? [entry as string[], ALL] : entry as [string[], Format[]]
    it(group, () => {
      for (const html of inputs) {
        for (const format of formats)
          expect(JS[format](html), `${format} ${JSON.stringify(html)}`).toBe(htmlToMarkdown(html, { format }))
      }
    })
  }
})
