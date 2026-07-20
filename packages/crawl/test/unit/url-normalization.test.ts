import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '../../src/crawl.ts'

describe('normalizeUrl', () => {
  it('strips tracking params (utm_*, fbclid, gclid)', () => {
    const url = new URL('https://example.com/page?utm_source=twitter&utm_medium=social&fbclid=abc123&real=keep')
    const result = normalizeUrl(url)
    expect(result).toBe('https://example.com/page?real=keep')
  })

  it('strips all known tracking params', () => {
    const params = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'utm_id',
      'fbclid',
      'gclid',
      'gclsrc',
      'dclid',
      'gbraid',
      'wbraid',
      'msclkid',
      'twclid',
      'li_fat_id',
      'mc_cid',
      'mc_eid',
      'ref',
      'source',
      'sessionid',
      'session_id',
      'sid',
      '_ga',
      '_gl',
      '_hsenc',
      '_hsmi',
      '_openstat',
      'yclid',
      'ymclid',
      'spm',
      'scm',
    ]
    for (const param of params) {
      const url = new URL(`https://example.com/page?${param}=value&keep=yes`)
      const result = normalizeUrl(url)
      expect(result, `should strip ${param}`).toBe('https://example.com/page?keep=yes')
    }
  })

  it('strips fragments', () => {
    const url = new URL('https://example.com/page#section')
    const result = normalizeUrl(url)
    expect(result).toBe('https://example.com/page')
  })

  it('strips trailing slashes', () => {
    const url = new URL('https://example.com/page/')
    const result = normalizeUrl(url)
    expect(result).toBe('https://example.com/page')
  })

  it('sorts remaining query params for consistent dedup', () => {
    const url = new URL('https://example.com/page?z=1&a=2')
    const result = normalizeUrl(url)
    expect(result).toBe('https://example.com/page?a=2&z=1')
  })

  it('preserves legitimate query params', () => {
    const url = new URL('https://example.com/search?q=test&page=2')
    const result = normalizeUrl(url)
    expect(result).toBe('https://example.com/search?page=2&q=test')
  })

  it('returns clean URL when all params are tracking', () => {
    const url = new URL('https://example.com/page?utm_source=x&fbclid=y')
    const result = normalizeUrl(url)
    expect(result).toBe('https://example.com/page')
  })
})
