import { parseAttributes } from '@mdream/js/parse'
import { describe, expect, it } from 'vitest'

function browserAttributes(source: string): Record<string, string> {
  const template = document.createElement('template')
  template.innerHTML = `<a ${source}>link</a>`
  const anchor = template.content.querySelector('a')!
  return Object.fromEntries(
    Array.from(anchor.attributes, attribute => [attribute.name, attribute.value]),
  )
}

describe('html attribute browser parity', () => {
  it.each([
    String.raw`href="x\" onclick=alert(1)"`,
    String.raw`href="c:\path\" title=t`,
    String.raw`href='x\' title=t`,
    String.raw`href="x\\" title=t`,
    String.raw`href="a\b"`,
    `alt=Bob's src=/i.png`,
  ])('matches Chromium for %s', (source) => {
    expect(parseAttributes(source)).toEqual(browserAttributes(source))
  })
})
