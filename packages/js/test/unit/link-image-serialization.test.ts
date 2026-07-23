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
})
