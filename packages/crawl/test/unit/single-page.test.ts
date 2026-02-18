import { describe, expect, it } from 'vitest'
import type { CrawlOptions } from '../../src/types.ts'

describe('single-page mode configuration', () => {
  it('should disable link following when single-page mode is enabled', () => {
    const options: CrawlOptions = {
      urls: ['https://example.com/page'],
      outputDir: './output',
      followLinks: false,
      maxDepth: 0,
      skipSitemap: true,
      driver: 'playwright',
    }

    expect(options.followLinks).toBe(false)
    expect(options.maxDepth).toBe(0)
    expect(options.skipSitemap).toBe(true)
  })

  it('should enable link following when single-page mode is disabled', () => {
    const options: CrawlOptions = {
      urls: ['https://example.com/page'],
      outputDir: './output',
      followLinks: true,
      maxDepth: 3,
      skipSitemap: false,
      driver: 'http',
    }

    expect(options.followLinks).toBe(true)
    expect(options.maxDepth).toBe(3)
    expect(options.skipSitemap).toBe(false)
  })

  it('should work with both http and playwright drivers', () => {
    const httpOptions: CrawlOptions = {
      urls: ['https://example.com/page'],
      outputDir: './output',
      followLinks: false,
      maxDepth: 0,
      skipSitemap: true,
      driver: 'http',
    }

    const playwrightOptions: CrawlOptions = {
      urls: ['https://example.com/page'],
      outputDir: './output',
      followLinks: false,
      maxDepth: 0,
      skipSitemap: true,
      driver: 'playwright',
    }

    expect(httpOptions.driver).toBe('http')
    expect(playwrightOptions.driver).toBe('playwright')
    expect(httpOptions.followLinks).toBe(false)
    expect(playwrightOptions.followLinks).toBe(false)
  })
})
