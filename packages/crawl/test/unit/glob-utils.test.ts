import { describe, expect, it } from 'vitest'
import { getRegistrableDomain, isUrlExcluded, isValidSitemapXml, matchesGlobPattern, parseUrlPattern } from '../../src/glob-utils.ts'

describe('isUrlExcluded', () => {
  it('returns false when no exclude patterns provided', () => {
    expect(isUrlExcluded('https://example.com/page', [])).toBe(false)
    expect(isUrlExcluded('https://example.com/page', undefined as any)).toBe(false)
  })

  it('excludes URLs matching path-only patterns', () => {
    const excludePatterns = ['/admin/*', '/api/*']

    expect(isUrlExcluded('https://example.com/admin/users', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/api/v1/users', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/public/page', excludePatterns)).toBe(false)
  })

  it('excludes URLs matching full URL patterns', () => {
    const excludePatterns = ['https://example.com/admin/*']

    expect(isUrlExcluded('https://example.com/admin/users', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://other.com/admin/users', excludePatterns)).toBe(false)
  })

  it('handles complex glob patterns', () => {
    const excludePatterns = ['/*/private/*', '**/*.pdf']

    expect(isUrlExcluded('https://example.com/docs/private/page', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/files/document.pdf', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/public/page.html', excludePatterns)).toBe(false)
  })

  it('handles query parameters and fragments', () => {
    const excludePatterns = ['/search*']

    expect(isUrlExcluded('https://example.com/search?q=test', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/search#results', excludePatterns)).toBe(true)
  })

  it('handles invalid URLs gracefully', () => {
    const excludePatterns = ['/admin/*']

    expect(isUrlExcluded('not-a-url', excludePatterns)).toBe(false)
  })

  it('supports multiple exclude patterns', () => {
    const excludePatterns = ['/admin/*', '/api/*', '**/*.tmp']

    expect(isUrlExcluded('https://example.com/admin/panel', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/api/users', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/files/temp.tmp', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/public/page', excludePatterns)).toBe(false)
  })

  it('works with parseUrlPattern and matchesGlobPattern for full URLs', () => {
    const excludePatterns = ['https://example.com/admin/**']

    expect(isUrlExcluded('https://example.com/admin/users/123', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/admin/settings/profile', excludePatterns)).toBe(true)
    expect(isUrlExcluded('https://example.com/public/page', excludePatterns)).toBe(false)
  })
})

describe('getRegistrableDomain', () => {
  it('returns hostname for simple domains', () => {
    expect(getRegistrableDomain('example.com')).toBe('example.com')
  })

  it('extracts registrable domain from subdomains', () => {
    expect(getRegistrableDomain('info.example.com')).toBe('example.com')
    expect(getRegistrableDomain('docs.api.example.com')).toBe('example.com')
  })

  it('handles multi-part TLDs correctly', () => {
    expect(getRegistrableDomain('example.co.uk')).toBe('example.co.uk')
    expect(getRegistrableDomain('info.example.co.uk')).toBe('example.co.uk')
    expect(getRegistrableDomain('example.com.au')).toBe('example.com.au')
    expect(getRegistrableDomain('blog.example.com.au')).toBe('example.com.au')
  })

  it('treats github.io subdomains as separate sites', () => {
    expect(getRegistrableDomain('foo.github.io')).toBe('foo.github.io')
    expect(getRegistrableDomain('bar.github.io')).toBe('bar.github.io')
    expect(getRegistrableDomain('foo.github.io')).not.toBe(getRegistrableDomain('bar.github.io'))
  })

  it('handles IP addresses without collapsing', () => {
    expect(getRegistrableDomain('10.0.0.1')).toBe('10.0.0.1')
    expect(getRegistrableDomain('192.168.0.1')).toBe('192.168.0.1')
    expect(getRegistrableDomain('10.0.0.1')).not.toBe(getRegistrableDomain('192.168.0.1'))
  })

  it('returns single-label hostnames as-is', () => {
    expect(getRegistrableDomain('localhost')).toBe('localhost')
  })
})

describe('matchesGlobPattern with allowSubdomains', () => {
  it('matches URLs from same registrable domain when allowSubdomains is true', () => {
    const pattern = parseUrlPattern('https://example.com/docs/**')
    expect(matchesGlobPattern('https://sub.example.com/docs/page', pattern, true)).toBe(true)
    expect(matchesGlobPattern('https://example.com/docs/page', pattern, true)).toBe(true)
  })

  it('rejects URLs from different registrable domains', () => {
    const pattern = parseUrlPattern('https://example.com/docs/**')
    expect(matchesGlobPattern('https://other.com/docs/page', pattern, true)).toBe(false)
  })

  it('still rejects cross-domain without allowSubdomains', () => {
    const pattern = parseUrlPattern('https://example.com/docs/**')
    expect(matchesGlobPattern('https://sub.example.com/docs/page', pattern, false)).toBe(false)
  })

  it('does not match across github.io sites', () => {
    const pattern = parseUrlPattern('https://foo.github.io/docs/**')
    expect(matchesGlobPattern('https://bar.github.io/docs/page', pattern, true)).toBe(false)
  })
})

describe('isValidSitemapXml', () => {
  it('accepts valid sitemap with urlset', () => {
    expect(isValidSitemapXml('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>')).toBe(true)
  })

  it('accepts valid sitemap index', () => {
    expect(isValidSitemapXml('<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap></sitemapindex>')).toBe(true)
  })

  it('rejects HTML pages (e.g. from redirect)', () => {
    expect(isValidSitemapXml('<!DOCTYPE html><html><head><title>Product Page</title></head><body></body></html>')).toBe(false)
  })

  it('rejects empty content', () => {
    expect(isValidSitemapXml('')).toBe(false)
  })
})
