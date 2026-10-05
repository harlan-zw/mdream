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

it.each(['td', 'th'])('keeps table ownership under a %s enter override', (cell) => {
  const html = `<table><tr></tr><tr><${cell}>a</${cell}></tr></table>`
  for (const enter of ['', '[']) {
    const options = { tagOverrides: { [cell]: { enter } } }
    const expected = htmlToMarkdown(html, options)
    expect(expected).toBe(`| ${enter}a |\n| --- |`)
    expect(jsHtmlToMarkdown(html, options)).toBe(expected)
  }
})

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
  'unknown tags are inline': [
    'A<x>B',
    'x<v>>',
    '<p>m<x>h</x> t</p>',
    '<p>a <x>c</x></p>',
    '<p>a <x></x>c</p>',
  ],
  'root inline text drops its leading space only at a line start': [
    'a<x> b',
    'a(<span> b',
    '<p>a</p><span> b</span>',
    'a<br><span> b</span>',
    'a<br> b',
  ],
  'table rows outside a table': [
    '<tr><td>a</td><td>b</td></tr>',
    '<th>',
    '<tr><th align="right">a</th><td>b</td></tr><tr><td>c</td></tr>',
  ],
  'rawtext keeps an unfinished end tag at EOF': [
    '<textarea>a</t',
    '<textarea>a</tx>b',
    '<textarea>a</textarea',
    '<textarea>a</textarea ',
    '<textarea>a</TEXTAREA x',
    '<xmp>a</',
    '<title>a</x',
  ],
  'block boundary trims the whole trailing space run': [
    '<ul><li><br></li><li>b</li></ul>',
    '<pre>nd  ',
    '<pre>x\n  ',
  ],
  'stray end tags add no separator': [
    'b</>c',
    'a<div>b</>c',
    'x</span>y',
    'g t</>x',
  ],
  'empty blockquote after content': [
    'a<blockquote><blockquote></blockquote></blockquote>',
    '<li><blockquote>',
  ],
  'a nested pre stays inside the outer fence': [
    '<pre><li><pre><li><blockquote>x<code>',
    '<pre><li><pre><li><blockquote>x<li>',
    '<pre><pre><code>x</code></pre>y</pre>',
  ],
  'final trim keeps non-ASCII spaces': [
    '<p>a&nbsp;</p>',
    'd&nbsp',
    'x<p>&nbsp',
    '<img alt=\u0085>',
    '\uFEFFa',
  ],
  'whitespace after a comment keeps the word separator': [
    '<a title="k" href="ea"><div>I<!> ',
    '<b><div>I<!-- --> </div>k</b>',
  ],
  'quotation with only empty children': [
    '<p>x<q><span></span></q>y</p>',
    '<p>x<q><q></q></q>y</p>',
    '<p>a<q><br></q>b</p>',
    '<p>x<q><q>a</q></q>y</p>',
  ],
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
