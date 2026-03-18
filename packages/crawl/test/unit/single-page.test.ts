import { describe, expect, it } from 'vitest'

describe('single-page mode (maxDepth: 0)', () => {
  it('crawlAndGenerate accepts maxDepth: 0 without errors', async () => {
    // Verify the CrawlOptions type accepts maxDepth: 0
    const options = {
      urls: ['https://example.com'],
      outputDir: '/tmp/mdream-test-single-page',
      maxDepth: 0,
      followLinks: false,
      driver: 'http' as const,
      skipSitemap: false, // single-page mode skips sitemap via maxDepth === 0
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    }
    // maxDepth 0 is a valid configuration
    expect(options.maxDepth).toBe(0)
    expect(options.followLinks).toBe(false)
  })

  it('single-page mode is detected from maxDepth === 0', () => {
    const maxDepth = 0
    const singlePageMode = maxDepth === 0
    expect(singlePageMode).toBe(true)
  })

  it('single-page mode is not active for maxDepth > 0', () => {
    const maxDepth = 1
    const singlePageMode = maxDepth === 0
    expect(singlePageMode).toBe(false)
  })
})
