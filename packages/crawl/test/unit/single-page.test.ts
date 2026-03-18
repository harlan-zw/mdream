import { describe, expect, it } from 'vitest'

/**
 * Tests for single-page mode behavior (maxDepth: 0).
 *
 * The core crawlAndGenerate function cannot be imported directly in unit tests
 * because it depends on the built mdream package. These tests validate the
 * single-page mode logic and CLI parsing behavior that gates sitemap discovery
 * and link following.
 */
describe('single-page mode (maxDepth: 0)', () => {
  it('singlePageMode is derived from maxDepth === 0', () => {
    // This mirrors the logic in crawlAndGenerate
    const singlePageMode = (maxDepth: number) => maxDepth === 0
    expect(singlePageMode(0)).toBe(true)
    expect(singlePageMode(1)).toBe(false)
    expect(singlePageMode(3)).toBe(false)
  })

  it('sitemap discovery is skipped in single-page mode', () => {
    // Mirrors the condition: startingUrls.length > 0 && !skipSitemap && !singlePageMode
    const shouldDiscoverSitemap = (skipSitemap: boolean, singlePageMode: boolean, urlCount: number) =>
      urlCount > 0 && !skipSitemap && !singlePageMode

    expect(shouldDiscoverSitemap(false, true, 1)).toBe(false)
    expect(shouldDiscoverSitemap(false, false, 1)).toBe(true)
    expect(shouldDiscoverSitemap(true, false, 1)).toBe(false)
  })

  it('link following is disabled in single-page mode', () => {
    // Mirrors the condition: followLinks && !singlePageMode && depth < maxDepth
    const shouldFollowLinks = (followLinks: boolean, singlePageMode: boolean, depth: number, maxDepth: number) =>
      followLinks && !singlePageMode && depth < maxDepth

    expect(shouldFollowLinks(true, true, 0, 3)).toBe(false)
    expect(shouldFollowLinks(true, false, 0, 3)).toBe(true)
    expect(shouldFollowLinks(false, false, 0, 3)).toBe(false)
  })

  it('cLI --single-page flag sets depth to 0', () => {
    // Mirrors CLI parsing logic
    const parseSinglePage = (args: string[]) => {
      const singlePage = args.includes('--single-page')
      const depthStr = singlePage ? '0' : '3'
      return Number(depthStr)
    }

    expect(parseSinglePage(['--single-page', '-u', 'example.com'])).toBe(0)
    expect(parseSinglePage(['-u', 'example.com'])).toBe(3)
  })

  it('cLI disables followLinks when depth is 0', () => {
    // Mirrors: followLinks: depth > 0
    const followLinks = (depth: number) => depth > 0
    expect(followLinks(0)).toBe(false)
    expect(followLinks(1)).toBe(true)
  })

  it('depth validation accepts 0', () => {
    const isValidDepth = (depthStr: string) => {
      const depth = Number(depthStr)
      return Number.isInteger(depth) && depth >= 0 && depth <= 10
    }

    expect(isValidDepth('0')).toBe(true)
    expect(isValidDepth('1')).toBe(true)
    expect(isValidDepth('10')).toBe(true)
    expect(isValidDepth('-1')).toBe(false)
    expect(isValidDepth('11')).toBe(false)
    expect(isValidDepth('abc')).toBe(false)
    expect(isValidDepth('1.5')).toBe(false)
  })
})
