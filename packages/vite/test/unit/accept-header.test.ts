import { describe, expect, it } from 'vitest'

// Helper function extracted from plugin for direct testing
function shouldServeMarkdown(acceptHeader?: string, secFetchDest?: string): boolean {
  // Browsers send sec-fetch-dest header - if it's 'document', it's a browser navigation
  if (secFetchDest === 'document') {
    return false
  }

  const accept = acceptHeader || ''
  // Must NOT include text/html (excludes browsers)
  const hasHtml = accept.includes('text/html')
  if (hasHtml) {
    return false
  }

  // Must explicitly opt-in with either */* or text/markdown
  const hasWildcard = accept.includes('*/*')
  return hasWildcard || accept.includes('text/markdown')
}

describe('shouldServeMarkdown - Pure Function Tests', () => {
  it('should return false when sec-fetch-dest is document (browser navigation)', () => {
    expect(shouldServeMarkdown('*/*', 'document')).toBe(false)
    expect(shouldServeMarkdown('text/markdown', 'document')).toBe(false)
  })

  it('should return false when Accept header includes text/html', () => {
    expect(shouldServeMarkdown('text/html,application/xhtml+xml')).toBe(false)
    expect(shouldServeMarkdown('text/html')).toBe(false)
  })

  it('should return true when Accept header is */*', () => {
    expect(shouldServeMarkdown('*/*')).toBe(true)
    expect(shouldServeMarkdown('application/json, text/plain, */*')).toBe(true)
  })

  it('should return true when Accept header includes text/markdown', () => {
    expect(shouldServeMarkdown('text/markdown')).toBe(true)
    expect(shouldServeMarkdown('application/json, text/markdown')).toBe(true)
  })

  it('should return false when Accept header does not include text/html, */* or text/markdown', () => {
    expect(shouldServeMarkdown('application/json')).toBe(false)
    expect(shouldServeMarkdown('text/plain')).toBe(false)
    expect(shouldServeMarkdown('image/png')).toBe(false)
  })

  it('should return false when Accept header is undefined', () => {
    expect(shouldServeMarkdown()).toBe(false)
  })

  it('should return false when Accept header is empty string', () => {
    expect(shouldServeMarkdown('')).toBe(false)
  })

  it('should handle Claude Code client (axios with multiple types)', () => {
    expect(shouldServeMarkdown('application/json, text/plain, */*')).toBe(true)
  })

  it('should handle Bun client', () => {
    expect(shouldServeMarkdown('*/*')).toBe(true)
  })

  it('should reject browser requests with typical Accept header', () => {
    const browserAccept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    expect(shouldServeMarkdown(browserAccept)).toBe(false)
  })

  it('should handle sec-fetch-dest override even with valid accept', () => {
    expect(shouldServeMarkdown('*/*', 'document')).toBe(false)
    expect(shouldServeMarkdown('text/markdown', 'document')).toBe(false)
  })
})
