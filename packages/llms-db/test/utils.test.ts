import { describe, expect, it } from 'vitest'
import { extractDomain, formatFileSize, normalizeUrl, sanitizeFilename, validateUrl } from '../src/utils.ts'

describe('utils', () => {
  describe('validateUrl', () => {
    it('should validate valid URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://example.com')).toBe(true)
      expect(validateUrl('https://subdomain.example.com/path')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateUrl('ftp://example.com')).toBe(false)
      expect(validateUrl('not-a-url')).toBe(false)
      expect(validateUrl('javascript:alert(1)')).toBe(false)
    })
  })

  describe('normalizeUrl', () => {
    it('should normalize URLs by removing trailing slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path')
    })

    it('should preserve URLs without trailing slash', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com')
      expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path')
    })

    it('should throw on invalid URLs', () => {
      expect(() => normalizeUrl('not-a-url')).toThrow('Invalid URL')
    })
  })

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://example.com')).toBe('example.com')
      expect(extractDomain('https://subdomain.example.com/path')).toBe('subdomain.example.com')
    })

    it('should remove www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com')
      expect(extractDomain('https://www.subdomain.example.com')).toBe('subdomain.example.com')
    })

    it('should throw on invalid URLs', () => {
      expect(() => extractDomain('not-a-url')).toThrow('Invalid URL')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500.00 B')
      expect(formatFileSize(1024)).toBe('1.00 KB')
      expect(formatFileSize(1536)).toBe('1.50 KB')
      expect(formatFileSize(1048576)).toBe('1.00 MB')
      expect(formatFileSize(1073741824)).toBe('1.00 GB')
    })
  })

  describe('sanitizeFilename', () => {
    it('should sanitize filenames', () => {
      expect(sanitizeFilename('Test Site')).toBe('test-site')
      expect(sanitizeFilename('Test@Site#123')).toBe('testsite123')
      expect(sanitizeFilename('Multiple   Spaces')).toBe('multiple-spaces')
      expect(sanitizeFilename('Special/Chars\\File')).toBe('specialcharsfile')
    })
  })
})
