import { resolve } from 'pathe'
import { describe, expect, it, vi } from 'vitest'

// Option errors must surface before any request. Fail loudly if one is sent.
vi.mock('ofetch', () => {
  const blocked = async (url: string) => {
    throw new Error(`Unexpected request to ${url}`)
  }
  return { ofetch: Object.assign(blocked, { raw: blocked }) }
})

const { crawlAndGenerate } = await import('../../src/index.ts')
const { resolveCrawlOptions } = await import('../../src/options.ts')

describe('crawlAndGenerate option validation', () => {
  it.each([
    ['maxRequestsPerCrawl', 10, '"maxPages"'],
    ['maxDepth', 2, '"depth"'],
    ['followLinks', false, '"depth"'],
    ['sitemapUrls', ['https://example.com/sitemap.xml'], '"sitemap"'],
    ['generateLlmsTxt', true, '"artifacts"'],
    ['generateLlmsFullTxt', true, '"artifacts"'],
    ['generateIndividualMd', false, '"artifacts"'],
    ['siteNameOverride', 'Docs', '"siteName"'],
    ['descriptionOverride', 'About', '"description"'],
    ['outputDir', './out', '"output"'],
    ['chunkSize', 1000, 'Remove it'],
    ['onPage', () => {}, 'hooks: { \'crawl:page\': fn }'],
  ])('rejects the v1 option %s and names its replacement', async (key, value, replacement) => {
    const call = crawlAndGenerate({ urls: ['https://example.com'], [key]: value } as never)

    await expect(call).rejects.toThrow(TypeError)
    await expect(call).rejects.toThrow(`"${key}"`)
    await expect(call).rejects.toThrow(replacement)
  })

  it('rejects followLinks: false instead of running a deep crawl', async () => {
    await expect(crawlAndGenerate({ urls: ['https://example.com'], followLinks: false } as never))
      .rejects
      .toThrow('Use "depth" instead. Set depth to 0 to process only the given URLs.')
  })

  it('names every unknown key in one error', async () => {
    await expect(crawlAndGenerate({ urls: ['https://example.com'], maxDepth: 1, maxpages: 2 } as never))
      .rejects
      .toThrow(/"maxDepth"[\s\S]*"maxpages"/)
  })

  it.each([
    [{ depth: -1 }, '"depth"'],
    [{ depth: 11 }, '"depth"'],
    [{ depth: 1.5 }, '"depth"'],
    [{ maxPages: 0 }, '"maxPages"'],
    [{ artifacts: ['llms.txt', 'pdf'] }, '"pdf"'],
    [{ driver: 'puppeteer' }, '"driver"'],
    [{ boilerplateThreshold: 0 }, '"boilerplateThreshold"'],
    [{ crawlDelay: -1 }, '"crawlDelay"'],
    [{ sitemap: 'https://' }, '"sitemap"'],
    [{ urls: [] }, '"urls"'],
    [{ urls: ['https://exa mple.com'] }, 'exa mple.com'],
  ])('rejects the invalid value %o', async (overrides, expected) => {
    const call = crawlAndGenerate({ urls: ['https://example.com'], ...overrides } as never)

    await expect(call).rejects.toThrow(TypeError)
    await expect(call).rejects.toThrow(expected)
  })
})

describe('resolveCrawlOptions', () => {
  it('skips keys whose value is undefined', () => {
    const resolved = resolveCrawlOptions({ urls: ['https://example.com'], maxDepth: undefined, depth: undefined } as never)

    expect(resolved.depth).toBe(3)
  })

  it('crawls three levels and writes every artifact by default', () => {
    const resolved = resolveCrawlOptions({ urls: ['https://example.com'] })

    expect(resolved.depth).toBe(3)
    expect(resolved.maxPages).toBe(Number.POSITIVE_INFINITY)
    expect(resolved.artifacts).toEqual(['llms.txt', 'llms-full.txt', 'markdown'])
    expect(resolved.driver).toBe('http')
    expect(resolved.stripBoilerplate).toBe(true)
    expect(resolved.output).toBe(resolve(process.cwd(), 'output'))
  })

  it('accepts one sitemap string and adds the https protocol', () => {
    const resolved = resolveCrawlOptions({ urls: ['example.com'], sitemap: 'example.com/custom/sitemap.xml' })

    expect(resolved.sitemap).toEqual(['https://example.com/custom/sitemap.xml'])
  })

  it('keeps an empty artifact list so only hooks run', () => {
    const resolved = resolveCrawlOptions({ urls: ['https://example.com'], artifacts: [] })

    expect(resolved.artifacts).toEqual([])
  })
})
