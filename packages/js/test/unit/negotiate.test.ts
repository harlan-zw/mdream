import { describe, expect, it } from 'vitest'
import { parseAcceptHeader, shouldServeMarkdown } from '../../src/negotiate'

describe('parseAcceptHeader', () => {
  it('returns empty array for empty string', () => {
    expect(parseAcceptHeader('')).toEqual([])
  })

  it('parses single type without quality', () => {
    const result = parseAcceptHeader('text/html')
    expect(result).toEqual([{ type: 'text/html', q: 1, position: 0 }])
  })

  it('parses multiple types preserving position', () => {
    const result = parseAcceptHeader('text/html, application/json, text/plain')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: 'text/html', q: 1, position: 0 })
    expect(result[1]).toEqual({ type: 'application/json', q: 1, position: 1 })
    expect(result[2]).toEqual({ type: 'text/plain', q: 1, position: 2 })
  })

  it('parses quality values', () => {
    const result = parseAcceptHeader('text/html;q=0.9, text/markdown;q=0.5')
    expect(result[0]!.q).toBe(0.9)
    expect(result[1]!.q).toBe(0.5)
  })

  it('handles missing q as default 1', () => {
    const result = parseAcceptHeader('text/markdown, text/html;q=0.8')
    expect(result[0]!.q).toBe(1)
    expect(result[1]!.q).toBe(0.8)
  })

  it('handles whitespace around entries', () => {
    const result = parseAcceptHeader('  text/html ,  text/plain  ')
    expect(result[0]!.type).toBe('text/html')
    expect(result[1]!.type).toBe('text/plain')
  })

  it('skips empty entries from trailing commas', () => {
    const result = parseAcceptHeader('text/html,,text/plain')
    expect(result).toHaveLength(2)
  })

  it('handles q=0 (explicitly rejected)', () => {
    const result = parseAcceptHeader('text/html;q=0')
    expect(result[0]!.q).toBe(0)
  })

  it('parses browser-style Accept header', () => {
    const result = parseAcceptHeader('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
    expect(result).toHaveLength(4)
    expect(result[0]!.type).toBe('text/html')
    expect(result[0]!.q).toBe(1)
    expect(result[2]!.type).toBe('application/xml')
    expect(result[2]!.q).toBe(0.9)
    expect(result[3]!.type).toBe('*/*')
    expect(result[3]!.q).toBe(0.8)
  })
})

describe('shouldServeMarkdown', () => {
  // Browser / crawler scenarios - should NOT serve markdown
  it('returns false for undefined Accept header', () => {
    expect(shouldServeMarkdown()).toBe(false)
  })

  it('returns false for empty Accept header', () => {
    expect(shouldServeMarkdown('')).toBe(false)
  })

  it('returns false for sec-fetch-dest: document', () => {
    expect(shouldServeMarkdown('text/markdown', 'document')).toBe(false)
  })

  it('returns false for sec-fetch-dest: document even with wildcard', () => {
    expect(shouldServeMarkdown('*/*', 'document')).toBe(false)
  })

  it('returns false for standard browser Accept header', () => {
    expect(shouldServeMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(false)
  })

  it('returns false for bare wildcard (OG crawlers)', () => {
    expect(shouldServeMarkdown('*/*')).toBe(false)
  })

  it('returns false for application/json only', () => {
    expect(shouldServeMarkdown('application/json')).toBe(false)
  })

  it('returns false when text/html appears before text/plain (same q)', () => {
    expect(shouldServeMarkdown('text/html, text/plain')).toBe(false)
  })

  it('returns false when text/html has higher q than text/markdown', () => {
    expect(shouldServeMarkdown('text/markdown;q=0.5, text/html;q=0.9')).toBe(false)
  })

  // LLM bot / markdown-preferring client scenarios
  it('returns true for text/markdown only', () => {
    expect(shouldServeMarkdown('text/markdown')).toBe(true)
  })

  it('returns true for text/plain only (codex-style)', () => {
    expect(shouldServeMarkdown('text/plain')).toBe(true)
  })

  it('returns true for openClaw: text/markdown preferred via quality', () => {
    expect(shouldServeMarkdown('text/markdown, text/html;q=0.9, */*;q=0.1')).toBe(true)
  })

  it('returns true for Claude Code: text/markdown before text/html (position wins)', () => {
    expect(shouldServeMarkdown('text/markdown, text/html, */*')).toBe(true)
  })

  it('returns true for axios-style: application/json, text/plain, */*', () => {
    expect(shouldServeMarkdown('application/json, text/plain, */*')).toBe(true)
  })

  it('returns true when text/plain has higher q than text/html', () => {
    expect(shouldServeMarkdown('text/html;q=0.5, text/plain;q=0.9')).toBe(true)
  })

  it('returns true when text/markdown listed without text/html', () => {
    expect(shouldServeMarkdown('text/markdown, application/json')).toBe(true)
  })

  // sec-fetch-dest with non-document values should not block
  it('allows markdown when sec-fetch-dest is empty', () => {
    expect(shouldServeMarkdown('text/markdown', '')).toBe(true)
  })

  it('allows markdown when sec-fetch-dest is undefined', () => {
    expect(shouldServeMarkdown('text/markdown', undefined)).toBe(true)
  })
})
