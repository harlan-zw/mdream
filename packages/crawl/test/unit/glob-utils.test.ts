import { describe, expect, it } from 'vitest'
import { isUrlExcluded } from '../../src/glob-utils.ts'

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
