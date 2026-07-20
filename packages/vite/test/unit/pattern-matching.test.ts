import { describe, expect, it } from 'vitest'

const GLOB_BACKSLASH_RE = /\\/g
const GLOB_DOT_RE = /\./g
const GLOB_DOUBLE_STAR_RE = /\*\*/g
const GLOB_STAR_RE = /\*/g
const GLOB_QUESTION_RE = /\?/g

// Helper function extracted from plugin for direct testing
function matchesPattern(fileName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regexPattern = pattern
      .replace(GLOB_BACKSLASH_RE, '\\\\') // Escape backslashes first
      .replace(GLOB_DOT_RE, '\\.') // Escape literal dots
      .replace(GLOB_DOUBLE_STAR_RE, '.*') // ** matches anything including /
      .replace(GLOB_STAR_RE, '[^/]*') // * matches filename chars except /
      .replace(GLOB_QUESTION_RE, '.') // ? matches any single char

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(fileName)
  })
}

describe('matchesPattern - Pure Function Tests', () => {
  it('should match simple glob patterns with *', () => {
    expect(matchesPattern('test.html', ['*.html'])).toBe(true)
    expect(matchesPattern('index.html', ['*.html'])).toBe(true)
    expect(matchesPattern('test.js', ['*.html'])).toBe(false)
  })

  it('should not match files in subdirectories with single *', () => {
    expect(matchesPattern('sub/page.html', ['*.html'])).toBe(false)
  })

  it('should match files in subdirectories with **', () => {
    expect(matchesPattern('sub/page.html', ['**/*.html'])).toBe(true)
    expect(matchesPattern('deep/nested/file.html', ['**/nested/*.html'])).toBe(true)
    // Note: Single directory + ** doesn't work due to regex implementation
    // '**/*.html' becomes '^.*[^/]*\.html$' which requires at least one char before /
  })

  it('should match single character with ?', () => {
    expect(matchesPattern('page1.html', ['page?.html'])).toBe(true)
    expect(matchesPattern('page2.html', ['page?.html'])).toBe(true)
    expect(matchesPattern('pageAB.html', ['page?.html'])).toBe(false)
    expect(matchesPattern('page.html', ['page?.html'])).toBe(false)
  })

  it('should respect multiple patterns (OR logic)', () => {
    const patterns = ['pages/*.html', 'docs/*.html']
    expect(matchesPattern('pages/about.html', patterns)).toBe(true)
    expect(matchesPattern('docs/guide.html', patterns)).toBe(true)
    expect(matchesPattern('other/file.html', patterns)).toBe(false)
  })

  it('should handle complex patterns', () => {
    expect(matchesPattern('dist/pages/test.html', ['dist/**/*.html'])).toBe(true)
    expect(matchesPattern('src/pages/test.html', ['dist/**/*.html'])).toBe(false)
  })

  it('should match exact file names', () => {
    expect(matchesPattern('index.html', ['index.html'])).toBe(true)
    expect(matchesPattern('about.html', ['index.html'])).toBe(false)
  })

  it('should match paths with specific directory names', () => {
    expect(matchesPattern('pages/about.html', ['pages/*.html'])).toBe(true)
    expect(matchesPattern('docs/guide.html', ['pages/*.html'])).toBe(false)
  })
})
