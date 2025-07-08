import { minimatch } from 'minimatch'
import { withHttps } from 'ufo'

export interface ParsedUrlPattern {
  baseUrl: string
  pattern: string
  isGlob: boolean
}

/**
 * Parse a URL that may contain glob patterns
 * Example: https://nuxtseo.com/docs/** -> { baseUrl: "https://nuxtseo.com", pattern: "/docs/**", isGlob: true }
 */
export function parseUrlPattern(input: string): ParsedUrlPattern {
  // Check if the input contains glob patterns
  const hasGlob = input.includes('*') || input.includes('?') || input.includes('[')

  if (!hasGlob) {
    return {
      baseUrl: input,
      pattern: '',
      isGlob: false,
    }
  }

  try {
    const url = new URL(input.replace(/\*.*$/, ''))
    const baseUrl = `${url.protocol}//${url.host}`

    // Extract the pattern part (everything after the domain)
    const patternStart = input.indexOf(url.host) + url.host.length
    const pattern = input.substring(patternStart)

    return {
      baseUrl,
      pattern,
      isGlob: true,
    }
  }
  catch {
    // If URL parsing fails, treat as non-glob
    return {
      baseUrl: input,
      pattern: '',
      isGlob: false,
    }
  }
}

/**
 * Check if a URL matches a glob pattern
 */
export function matchesGlobPattern(url: string, parsedPattern: ParsedUrlPattern): boolean {
  if (!parsedPattern.isGlob) {
    return true // No pattern means match everything
  }

  try {
    const urlObj = new URL(url)
    const urlPath = urlObj.pathname + urlObj.search + urlObj.hash

    // Only match URLs from the same base domain
    const urlBase = `${urlObj.protocol}//${urlObj.host}`
    if (urlBase !== parsedPattern.baseUrl) {
      return false
    }

    return minimatch(urlPath, parsedPattern.pattern)
  }
  catch {
    return false
  }
}

/**
 * Get the starting URL for crawling from a glob pattern
 * For https://nuxtseo.com/docs/**, we want to start at https://nuxtseo.com
 */
export function getStartingUrl(parsedPattern: ParsedUrlPattern): string {
  if (!parsedPattern.isGlob) {
    return withHttps(parsedPattern.baseUrl)
  }

  // For glob patterns, start at the base URL or go up to the first non-glob directory
  const pattern = parsedPattern.pattern
  const firstGlobIndex = pattern.search(/[*?[]/)

  if (firstGlobIndex === -1) {
    return withHttps(parsedPattern.baseUrl + pattern)
  }

  // Find the last complete directory before the glob
  const beforeGlob = pattern.substring(0, firstGlobIndex)
  const lastSlash = beforeGlob.lastIndexOf('/')
  const pathBeforeGlob = lastSlash >= 0 ? beforeGlob.substring(0, lastSlash + 1) : '/'

  return withHttps(parsedPattern.baseUrl + pathBeforeGlob)
}

/**
 * Check if a URL should be excluded based on exclude patterns
 */
export function isUrlExcluded(url: string, excludePatterns: string[]): boolean {
  if (!excludePatterns || excludePatterns.length === 0) {
    return false
  }

  try {
    const urlObj = new URL(url)
    const urlPath = urlObj.pathname + urlObj.search + urlObj.hash

    // Check if URL matches any exclude pattern
    return excludePatterns.some((pattern) => {
      // Handle patterns that start with domain
      if (pattern.includes('://')) {
        const parsedPattern = parseUrlPattern(pattern)
        if (parsedPattern.isGlob) {
          return matchesGlobPattern(url, parsedPattern)
        }
        return url === pattern
      }

      // Handle path-only patterns
      if (pattern.startsWith('/')) {
        // For patterns like /admin/*, /api/*, we need to handle nested paths
        // Convert /api/* to /api/** to match subdirectories
        const adjustedPattern = pattern.endsWith('/*') ? pattern.replace('/*', '/**') : pattern
        return minimatch(urlPath, adjustedPattern)
      }

      // For patterns like *.pdf, */private/*, etc.
      // Try matching against both full path and without leading slash
      return minimatch(urlPath, pattern)
        || minimatch(urlPath.substring(1), pattern)
    })
  }
  catch {
    return false
  }
}

/**
 * Validate glob pattern syntax
 */
export function validateGlobPattern(pattern: string): string | undefined {
  try {
    parseUrlPattern(pattern)
    return undefined // No error
  }
  catch (error) {
    return `Invalid glob pattern: ${error instanceof Error ? error.message : error}`
  }
}
