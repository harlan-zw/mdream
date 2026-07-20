import { shouldServeMarkdown } from '@mdream/js/negotiate'
import { describe, expect, it } from 'vitest'

describe('shouldServeMarkdown - Content Negotiation', () => {
  it('should return false when sec-fetch-dest is document (browser navigation)', () => {
    expect(shouldServeMarkdown('*/*', 'document')).toBe(false)
    expect(shouldServeMarkdown('text/markdown', 'document')).toBe(false)
  })

  // Real-world client scenarios
  it('openClaw: text/markdown preferred over text/html via quality', () => {
    expect(shouldServeMarkdown('text/markdown, text/html;q=0.9, */*;q=0.1')).toBe(true)
  })

  it('claude Code: text/markdown before text/html (same q, position wins)', () => {
    expect(shouldServeMarkdown('text/markdown, text/html, */*')).toBe(true)
  })

  it('codex: text/plain only', () => {
    expect(shouldServeMarkdown('text/plain')).toBe(true)
  })

  it('claude Code (axios): application/json, text/plain, */*', () => {
    expect(shouldServeMarkdown('application/json, text/plain, */*')).toBe(true)
  })

  it('explicit text/markdown only', () => {
    expect(shouldServeMarkdown('text/markdown')).toBe(true)
  })

  // Browser / crawler scenarios
  it('browser: standard Accept header (text/html first)', () => {
    expect(shouldServeMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(false)
  })

  it('facebook/LinkedIn OG crawler: bare */*', () => {
    expect(shouldServeMarkdown('*/*')).toBe(false)
  })

  it('should return false when Accept header is undefined', () => {
    expect(shouldServeMarkdown()).toBe(false)
  })

  it('should return false when Accept header is empty string', () => {
    expect(shouldServeMarkdown('')).toBe(false)
  })

  it('application/json only (no markdown types)', () => {
    expect(shouldServeMarkdown('application/json')).toBe(false)
  })

  // Edge cases
  it('text/html before text/plain → HTML wins', () => {
    expect(shouldServeMarkdown('text/html, text/plain')).toBe(false)
  })

  it('text/html higher q than text/markdown', () => {
    expect(shouldServeMarkdown('text/markdown;q=0.5, text/html;q=0.9')).toBe(false)
  })

  it('text/plain with higher q than text/html → markdown', () => {
    expect(shouldServeMarkdown('text/html;q=0.5, text/plain;q=0.9')).toBe(true)
  })
})
