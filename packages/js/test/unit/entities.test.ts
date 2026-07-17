import { describe, expect, it } from 'vitest'
import { parseAttributes } from '../../src/parse'
import { decodeHTMLEntities } from '../../src/utils'

describe('html character references', () => {
  it('decodes canonical names using the longest match', () => {
    expect(decodeHTMLEntities('&copy; &notin; &thetasym;'))
      .toBe('© ∉ ϑ')
    expect(decodeHTMLEntities('&notit;')).toBe('¬it;')
  })

  it('supports legacy named references without semicolons', () => {
    expect(decodeHTMLEntities('&copy &AMP &nbsp!')).toBe('© & \u00A0!')
  })

  it('consumes only valid numeric digits and accepts a missing semicolon', () => {
    expect(decodeHTMLEntities('&#65 &#x41; &#65copy; &#x41zz;'))
      .toBe('A A Acopy; Azz;')
  })

  it('applies numeric replacement rules', () => {
    expect(decodeHTMLEntities('&#x80; &#0; &#xD800; &#x110000; &#999999999999999999999;'))
      .toBe('€ � � � �')
  })

  it('preserves nbsp and legacy uppercase names', () => {
    expect(decodeHTMLEntities('&nbsp;&COPY;&thetasym;'))
      .toBe('\u00A0©ϑ')
  })

  it('uses the attribute ambiguous-ampersand rule for legacy names', () => {
    expect(decodeHTMLEntities('&copycat &copy=1 &copy! &copy;cat', true))
      .toBe('&copycat &copy=1 ©! ©cat')
    expect(decodeHTMLEntities('&copycat')).toBe('©cat')

    expect(parseAttributes('title="&copycat &copy=1 &copy! &copy;cat"'))
      .toEqual({ title: '&copycat &copy=1 ©! ©cat' })
  })

  it('does not scan malformed references through a later semicolon', () => {
    expect(decodeHTMLEntities('&bogus &#65;')).toBe('&bogus A')
    expect(decodeHTMLEntities('&#nope; &#xnope;')).toBe('&#nope; &#xnope;')
  })
})
