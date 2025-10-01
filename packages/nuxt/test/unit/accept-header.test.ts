import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'

// Mock the shouldServeMarkdown function logic for testing
function shouldServeMarkdown(accept: string, secFetchDest?: string): boolean {
  // Browsers send sec-fetch-dest header - if it's 'document', it's a browser navigation
  if (secFetchDest === 'document') {
    return false
  }

  // Must NOT include text/html (excludes browsers)
  if (accept.includes('text/html')) {
    return false
  }

  // Must explicitly opt-in with either */* or text/markdown
  return accept.includes('*/*') || accept.includes('text/markdown')
}

describe('accept header detection', () => {
  it('should serve markdown when Accept header lacks text/html (Claude Code)', () => {
    const accept = 'application/json, text/plain, */*'
    expect(shouldServeMarkdown(accept)).toBe(true)
  })

  it('should serve markdown when Accept explicitly requests text/markdown', () => {
    const accept = 'text/markdown'
    expect(shouldServeMarkdown(accept)).toBe(true)
  })

  it('should NOT serve markdown when Accept has only application/json (no */* or text/markdown)', () => {
    const accept = 'application/json'
    expect(shouldServeMarkdown(accept)).toBe(false)
  })

  it('should NOT serve markdown when Accept header includes text/html (browser)', () => {
    const accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    expect(shouldServeMarkdown(accept)).toBe(false)
  })

  it('should NOT serve markdown when sec-fetch-dest is document (browser)', () => {
    const accept = 'application/json, text/plain, */*'
    const secFetchDest = 'document'
    expect(shouldServeMarkdown(accept, secFetchDest)).toBe(false)
  })

  it('should serve markdown when sec-fetch-dest is empty (API client)', () => {
    const accept = 'application/json, text/plain, */*'
    const secFetchDest = ''
    expect(shouldServeMarkdown(accept, secFetchDest)).toBe(true)
  })

  it('should NOT serve markdown when Accept is empty', () => {
    const accept = ''
    expect(shouldServeMarkdown(accept)).toBe(false)
  })

  it('should serve markdown for axios default headers (like Bun/Claude Code)', () => {
    // Axios default Accept header
    const accept = 'application/json, text/plain, */*'
    expect(shouldServeMarkdown(accept)).toBe(true)
  })

  it('should NOT serve markdown when both text/html and sec-fetch-dest present', () => {
    const accept = 'text/html,application/xhtml+xml,application/xml;q=0.9'
    const secFetchDest = 'document'
    expect(shouldServeMarkdown(accept, secFetchDest)).toBe(false)
  })
})
