import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { htmlToSafeHtml } from '@mdream/js/html'
import { htmlToText } from '@mdream/js/text'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src'

type Format = 'markdown' | 'text' | 'html'

it('preserves leading Unicode whitespace before a paragraph', () => {
  const html = '\uFEFF<p>x</p>'
  const expected = '\uFEFF\n\nx'
  expect(htmlToMarkdown(html)).toBe(expected)
  expect(jsHtmlToMarkdown(html)).toBe(expected)
})

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
  'delimiters around removed content': [
    '<p>x <strong><svg></svg>*y</strong></p>',
    '<p>a<q><strong><svg></svg> x</strong></q></p>',
    '<p><kbd>a<strong> x</strong></kbd></p>',
    '<p><a href="/x"><strong><svg></svg> now</strong></a></p>',
  ],
  'blank opening emphasis': [
    '<p>a<strong> <span>b</span></strong></p>',
    '<p>a<strong> </strong>b</p>',
    '<p>a<em> <span>b</span></em></p>',
    '<p>a<strong> <em> </em></strong>b</p>',
    '<p>a<strong> </strong><em></em> b</p>',
    '<p><a href="/x"><span>x</span><strong> </strong><em></em></a></p>',
    '<figure><figcaption>a<strong> </strong>b</figcaption></figure>',
    '<p><code>a<strong> <span>b</span></strong></code></p>',
    '<p>Click<strong><span class="w"> <a href="/x">here</a></span></strong> now</p>',
    '<p>a<strong><span> </span></strong>b</p>',
    '<p>a<q><em> </em></q>b</p>',
    '<p>a<strong><q><em> </em></q>c</strong>b</p>',
    '<p>a<strong><q><em> </em></q><em>c</em></strong>b</p>',
    '<p><q><cite>&#32;</cite></q></p>',
    '<p>a <q><span>y </span><q><a href="#"></a></q></q>z</p>',
    '<p><i>a<i> <svg></svg> x</i></i></p>',
    '<p>x<b>y<b> <strong></strong><br>z</b></b></p>',
    '<p><code>a<del> </del></code>z</p>',
    '<p><code>a<strong> <svg></svg> b</strong></code></p>',
  ],
  'blank opening an inline wrapper': [
    '<p>a<span> <span>b</span></span></p>',
    '<p>a<span> <strong>b</strong></span></p>',
    '<p>a<font> <b>x</b></font></p>',
    '<p>a<u> <span>b</span></u></p>',
    '<p>a<font><small> <label><b>x</b></label></small></font></p>',
    '<p>a<span> <strong></strong></span>b</p>',
    '<p><strong>a<span> </span></strong>b</p>',
    '<p>a<a href="/x"> <span>b</span></a></p>',
    '<p>a<q> <span>b</span></q></p>',
    '<p><code>a<span> <span>b</span></span></code></p>',
    '<figure><figcaption>a<span> <span>b</span></span></figcaption></figure>',
    '<h2>w<span> <br>b</span></h2>',
    '<h2>w<strong>a </strong><br>b</h2>',
    '<table><tr><th>h</th></tr><tr><td>w<strong>a </strong><br>b</td></tr></table>',
  ],
  'redundant link title ignores a standalone separator': [[
    '<a href="/x" title="Q"><div>x</div> ',
    '<i><<a title=e href=/"><p>U</p> ',
    '<a href="/x" title="Q">Q</a>',
    '<a title="T" href="/x">T </a>',
    '<a href title="Aa Bbbbbbbbb"><span>< </span><o>Aa Bbbbbbbbb</',
  ], ['markdown']],
  'retained blank at the fragment root': [[
    '<span><svg>x</svg> <span>c</span></span>',
    '<span><svg>x</svg> <b>c</b></span>',
    '<span><svg>x</svg> y</span>',
    '<span> <span>c</span></span>',
    '<span><div>x</div> y</span>',
  ], ['markdown', 'text']],
  'empty quotation around a dropped element': [[
    '<p>a<q><strong> <svg></svg></strong></q> b</p>',
    '<p>a<q><svg></svg></q>b</p>',
    '<p>a<q>x</q>b</p>',
    '<p>a<em><q><strong> <svg></svg></strong></q></em> b</p>',
  ], ['text']],
  'no-break space after an owed separator': [[
    '<p>Total:<span> </span>&nbsp;<b>5</b></p>',
    '<p>a<span>x </span>&nbsp;<span>b</span></p>',
    '<p>a<span> <span>&nbsp;</span></span>b</p>',
    '<p>a<span> </span>&nbsp;</p>',
    '<table><tr><td>a<span> </span><span>&nbsp;</span>b</td></tr></table>',
  ], ['markdown', 'html']],
  'written space after a blank that opened an inline element': [[
    'Aa<span> </span> <form><span>Bb</span></form>',
    'Aa<span> </span> <select><span>Bb</span></select>',
    'Aa<span> </span>\n<form><span>Bb</span></form>',
    'Aa<span> </span> <form></form><span>Bb</span>',
    'Aa<strong> </strong> <form><span>Bb</span></form>',
    'Aa<span> </span> <address>Bb</address>',
    '<table><tr><td>Aa<span> </span> <blockquote>Bb</blockquote></td></tr></table>',
    '<strong>h<span> </span>&#32;</strong>x',
    'Aa<span> </span>&#32;<form><span>Bb</span></form>',
  ], ['markdown', 'text']],
  'decoded blank after a blank that opened an inline element': [[
    'Aa<span> </span>&#32; <form><span>Bb</span></form>',
    'Aa<span> </span>&#9;<form><span>Bb</span></form>',
    'Aa<span> </span>&#32;<form></form><span>Bb</span>',
    '<b>Aa</b><i> </i>&#32;<form><span>Bb</span></form>',
    'Aa<span> </span>&#32;<address>Bb</address>',
    '<table><tr><td>Aa<span> </span>&#32;<form><span>Bb</span></form></td></tr></table>',
    'Aa<span> </span>&#32;<blockquote>Bb</blockquote>',
    '<strong>Aa<span> </span>&#32;<i></i> <blockquote></blockquote>Bb</strong>',
    '<ul><li>Aa<span> </span>&#32;<pre>Bb</pre></li></ul>',
    '<ul><li><span>Aa </span><i></i><pre>Bb</pre></li></ul>',
    '<h2><span>Aa </span><i></i><pre>Bb</pre></h2>',
  ], ['markdown', 'text']],
  'raw HTML block before a closer': [[
    '<figcaption>k<h2>t</h2><address>A</address></figcaption>',
    '<figure><img src="/a.png"><figcaption>k<br><dl><dt>A</dt></dl></figcaption></figure>',
    '<b>k<br><dl><dt>A</dt></dl></b>',
    '<em>k<br><address></address></em>',
    '<a href="/x">k<br><address></address></a>',
    '<blockquote><figcaption><h2>t</h2><address></address></figcaption></blockquote>',
    '<ul><li><figcaption>k<hr><dl><dt>A</dt></dl></figcaption></li></ul>',
    '<figcaption>k<h2>t</h2><address>A</address>z</figcaption>',
    '<b>k<br><dl><dt>A</dt></dl><i>z</i></b>',
  ], ['markdown']],
  'paragraph after a trimmed element in a list item': [[
    '<ul><li><span><span>Aa</span> </span><p>Bb</p></li></ul>',
    '<ul><li><span><span>Aa</span> </span><i></i> <p>Bb</p></li></ul>',
  ], ['markdown', 'text']],
  'link title after a pair dropped in an earlier block': [[
    '<blockquote><br><em>h</em><i></i></blockquote><a href="/x" title="x">x</a>',
  ], ['markdown']],
  'inline code in a list item after an element that writes nothing': [[
    '<ul><li><code>Aa</code> <table></table><code>Bb</code></li></ul>',
    '<ul><li>Aa<span> </span> <p><code>Bb</code></p></li></ul>',
    '<ul><li>Aa<span> </span> <section><code>Bb</code></section></li></ul>',
  ], ['markdown']],
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
