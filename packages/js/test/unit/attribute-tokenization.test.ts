import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src'
import { parseAttributes } from '../../src/parse'

describe('html attribute tokenization', () => {
  it.each([
    [
      String.raw`href="x\" onclick=alert(1)"`,
      { href: 'x\\', onclick: 'alert(1)"' },
    ],
    [
      String.raw`href="c:\path\" title=t`,
      { href: 'c:\\path\\', title: 't' },
    ],
    [
      String.raw`href='x\' title=t`,
      { href: 'x\\', title: 't' },
    ],
    [
      String.raw`href="x\\" title=t`,
      { href: 'x\\\\', title: 't' },
    ],
    [
      String.raw`href="a\b"`,
      { href: String.raw`a\b` },
    ],
    [
      `alt=Bob's src=/i.png`,
      { alt: `Bob's`, src: '/i.png' },
    ],
  ])('treats backslashes and quotes as HTML does for %s', (source, expected) => {
    expect(parseAttributes(source)).toEqual(expected)
  })

  it('keeps the isolated parser EOF recovery for an unterminated quoted value', () => {
    expect(parseAttributes('title="unterminated')).toEqual({ title: 'unterminated' })
  })

  it.each([
    [
      String.raw`<a href="x\" onclick=alert(1)">link</a>`,
      String.raw`[link](<x\\>)`,
    ],
    [
      String.raw`<a href="c:\path\" title=t>link</a>`,
      String.raw`[link](<c:\\path\\> "t")`,
    ],
    [
      `<p>ok</p><img alt=Bob's src=/i.png><p>after</p>`,
      `ok\n\n![Bob's](/i.png)\n\nafter`,
    ],
  ])('keeps conversion aligned with browser attributes for %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })
})
