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
  ['markdown', '<pre>  lead\n\ttab\n\n  end  </pre>'],
  ['markdown', '<div><p>a</div>b</p>c'],
  ['markdown', '<p>a</x></p><<p>>b</p><p attr="unterminated>c</p>'],
  ['markdown', '<dl><dt>term</dt><dd>def</dd><dt>t2</dt><dd>d2<p>p</p></dd></dl>'],
  ['markdown', '<html><head><title>T: "q" \\ b</title><meta name="description" content="Desc # x"><meta property="og:title" content="OG"></head><body><header>hdr</header><main><h1>M</h1><p class="font-bold">bold tw</p><form>f</form></main><aside>as</aside></body></html>'],
  ['markdown', '<pre>x\n  </pre><p>After</p>'],
  ['markdown', 'a<br> b'],
  ['markdown', '<html><head><title>A</title><meta name="description" content="da"></head><body><header>x</header><h1>A</h1><p>a</p><footer>f</footer></body></html>'],
  ['text', '<div><p>a</div>b</p>c'],
  ['text', 'a<br> b'],
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
