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

// Inputs where the engines differ today. Most also differ in v1. Remove an
// entry once the engines agree; the test fails until you do.
const KNOWN_DIFFERENCES = new Set<string>([
  ['text', '<ul><li>a<ul><li>b<ol><li>c</li><li>d<p>para</p></li></ol></li></ul></li><li>e</li></ul>'],
  ['text', '<blockquote><p>q1</p><blockquote><p>q2</p><pre>p</pre></blockquote><p>q3</p></blockquote>'],
  ['markdown', '<pre>  lead\n\ttab\n\n  end  </pre>'],
  ['markdown', '<div><p>a</div>b</p>c'],
  ['text', '<div><p>a</div>b</p>c'],
  ['text', '<p>a</x></p><<p>>b</p><p attr="unterminated>c</p>'],
  ['markdown', '<select><option>a</option><option>b</option></select><textarea>t <b>x</b></textarea><button>btn</button><input value="v">'],
  ['text', '<html><head><title>T: "q" \\ b</title><meta name="description" content="Desc # x"><meta property="og:title" content="OG"></head><body><header>hdr</header><main><h1>M</h1><p class="font-bold">bold tw</p><form>f</form></main><aside>as</aside></body></html>'],
  ['markdown', '<svg><text>svg text</text></svg><math><mi>x</mi></math>'],
  ['text', '<svg><text>svg text</text></svg><math><mi>x</mi></math>'],
  ['markdown', '<custom-el>custom</custom-el><x-heading>xh</x-heading>'],
  ['text', '<custom-el>custom</custom-el><x-heading>xh</x-heading>'],
  ['text', '<table><caption>Cap</caption><tr><th>h</th></tr><tr><td>|pipe|</td></tr></table>'],
  ['markdown', '<pre>a<b>bold</b>\n<br>after br</pre>'],
  ['text', '<pre>a<b>bold</b>\n<br>after br</pre>'],
  ['markdown', '<pre>x\n  </pre><p>After</p>'],
  ['text', '<pre>x\n  </pre><p>After</p>'],
  ['markdown', '<p>x<x-v>>y</x-v></p>'],
  ['text', '<p>x<x-v>>y</x-v></p>'],
  ['markdown', 'a<br> b'],
  ['text', 'a<br> b'],
  ['text', '<html><head><title>A</title><meta name="description" content="da"></head><body><header>x</header><h1>A</h1><p>a</p><footer>f</footer></body></html>'],
  // Rust leaves `<` in rawtext unescaped in Markdown.
  ['markdown', '<textarea>a</tx>b'],
  ['markdown', '<textarea>a</textarea'],
].map(([format, html]) => `${format}\u0000${html}`))

describe('javaScript and Rust engines agree on the corpus', () => {
  for (const format of ['markdown', 'text', 'html'] as const) {
    it(format, () => {
      for (const html of CONVERSION_CORPUS) {
        const rust = htmlToMarkdown(html, { format })
        const js = JS[format](html)
        if (KNOWN_DIFFERENCES.has(`${format}\u0000${html}`))
          expect(js, `remove the fixed known difference for ${JSON.stringify(html)}`).not.toBe(rust)
        else
          expect(js, JSON.stringify(html)).toBe(rust)
      }
    })
  }

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
