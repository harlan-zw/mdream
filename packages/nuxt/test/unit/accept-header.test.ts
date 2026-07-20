import { parseAcceptHeader, shouldServeMarkdown } from '@mdream/js/negotiate'
import { describe, expect, it } from 'vitest'

describe('parseAcceptHeader', () => {
  it('should parse simple types', () => {
    const entries = parseAcceptHeader('text/html, text/plain')
    expect(entries).toEqual([
      { type: 'text/html', q: 1, position: 0 },
      { type: 'text/plain', q: 1, position: 1 },
    ])
  })

  it('should parse quality weights', () => {
    const entries = parseAcceptHeader('text/markdown, text/html;q=0.9, */*;q=0.1')
    expect(entries).toEqual([
      { type: 'text/markdown', q: 1, position: 0 },
      { type: 'text/html', q: 0.9, position: 1 },
      { type: '*/*', q: 0.1, position: 2 },
    ])
  })

  it('should return empty array for empty string', () => {
    expect(parseAcceptHeader('')).toEqual([])
  })
})

describe('shouldServeMarkdown', () => {
  // Real-world client scenarios from the issue

  it('openClaw: text/markdown preferred over text/html', () => {
    expect(shouldServeMarkdown('text/markdown, text/html;q=0.9, */*;q=0.1')).toBe(true)
  })

  it('claude Code: text/markdown before text/html (same q)', () => {
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

  // Browser / crawler scenarios that must NOT serve markdown

  it('browser: standard Accept header', () => {
    expect(shouldServeMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(false)
  })

  it('browser: sec-fetch-dest document', () => {
    expect(shouldServeMarkdown('application/json, text/plain, */*', 'document')).toBe(false)
  })

  it('facebook/LinkedIn OG crawler: */* only', () => {
    expect(shouldServeMarkdown('*/*')).toBe(false)
  })

  it('gemini (bare */*): should not serve markdown', () => {
    expect(shouldServeMarkdown('*/*')).toBe(false)
  })

  it('empty Accept header', () => {
    expect(shouldServeMarkdown('')).toBe(false)
  })

  it('application/json only (no markdown types)', () => {
    expect(shouldServeMarkdown('application/json')).toBe(false)
  })

  // Edge cases: text/html preferred over markdown types

  it('text/html before text/plain (same q) → HTML wins', () => {
    expect(shouldServeMarkdown('text/html, text/plain')).toBe(false)
  })

  it('text/html higher q than text/markdown', () => {
    expect(shouldServeMarkdown('text/markdown;q=0.5, text/html;q=0.9')).toBe(false)
  })

  it('text/plain with higher q than text/html → markdown', () => {
    expect(shouldServeMarkdown('text/html;q=0.5, text/plain;q=0.9')).toBe(true)
  })

  it('sec-fetch-dest: document overrides even markdown-preferring Accept', () => {
    expect(shouldServeMarkdown('text/markdown', 'document')).toBe(false)
  })
})
