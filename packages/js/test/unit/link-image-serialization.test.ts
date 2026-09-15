import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'

describe('gfm link and image serialization', () => {
  it.each([
    ['<a href="">text</a>', '[text]()'],
    ['<a href="docs/a b">text</a>', '[text](<docs/a b>)'],
    [String.raw`<a href="docs/(a)\file">text</a>`, String.raw`[text](<docs/(a)\\file>)`],
    [String.raw`<a href="/x" title="say &quot;hi&quot; \ path">text</a>`, String.raw`[text](/x "say \"hi\" \\ path")`],
  ])('serializes a reparsable link for %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it.each([
    [
      String.raw`<img src="/x.png" alt="a ] \ *bold* _em_ &#96;code&#96;">`,
      String.raw`![a \] \\ \*bold\* \_em\_ \`code\`](/x.png)`,
    ],
    [
      String.raw`<img src="/x.png" alt="alt" title="say &quot;hi&quot; \ path">`,
      String.raw`![alt](/x.png "say \"hi\" \\ path")`,
    ],
  ])('serializes a reparsable image for %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it.each([
    ['<img src="data:image/png;base64,iVBORw0KGgo=" alt="chart">', '![chart]()'],
    ['<img src="data:image/png;base64,iVBORw0KGgo=">', '![]()'],
    ['<img src="data:image/png;base64,AAA=" alt="chart" title="Fig 1">', '![chart]( "Fig 1")'],
    ['<a href="https://x.com"><img src="data:image/png;base64,AAA=" alt="linked"></a>', '[![linked]()](https://x.com)'],
    ['<img src="/photo.png" alt="remote">', '![remote](/photo.png)'],
  ])('drops the data URL payload for %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it.each([
    ['<img src="data:image/png;base64,AAA=" alt="Alt">', 'Alt'],
    ['<img src="data:image/png;base64,AAA=" title="Title">', 'Title'],
    ['<img src="data:image/png;base64,AAA=">', ''],
    ['<img src="image.png">', 'image.png'],
  ])('never falls back to a data URL in text output for %s', (html, expected) => {
    expect(htmlToMarkdown(html, { format: 'text' })).toBe(expected)
  })
})
