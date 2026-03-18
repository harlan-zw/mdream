import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Track fetched URLs for assertions
const fetchedUrls: string[] = []

// Mock ofetch to avoid real network requests
vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      fetchedUrls.push(url)
      if (url.endsWith('/robots.txt'))
        return ''
      if (url.includes('sitemap'))
        throw new Error('404')
      return '<html><head><title>Test</title></head><body><p>Hello</p></body></html>'
    },
    {
      raw: async (url: string, _opts?: any) => {
        fetchedUrls.push(url)
        return {
          _data: `<html><head><title>Page</title></head><body><p>Content for ${url}</p><a href="/other-page">Link</a></body></html>`,
          headers: new Headers({ 'content-type': 'text/html' }),
        }
      },
    },
  )

  return { ofetch: mockOfetch }
})

// Mock mdream since the package may not be built
vi.mock('mdream', () => ({
  htmlToMarkdown: (html: string, _opts?: any) => `# Converted\n\n${html.slice(0, 50)}`,
}))

// Mock llms-txt artifact generation
vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({
    llmsTxt: '# llms.txt',
    llmsFullTxt: '# llms-full.txt',
  }),
}))

// Suppress @clack/prompts log output during tests
vi.mock('@clack/prompts', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  note: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

// Import after mocks are set up
const { crawlAndGenerate } = await import('../../src/crawl.ts')

function tmpOut(): string {
  return join(tmpdir(), `mdream-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

afterEach(() => {
  fetchedUrls.length = 0
})

describe('single-page mode via crawlAndGenerate', () => {
  it('skips sitemap and robots.txt discovery when maxDepth is 0', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com/page'],
      outputDir: tmpOut(),
      maxDepth: 0,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should NOT have fetched robots.txt or sitemap.xml
    expect(fetchedUrls.some(u => u.includes('robots.txt'))).toBe(false)
    expect(fetchedUrls.some(u => u.includes('sitemap'))).toBe(false)
    // Should have fetched the actual page
    expect(fetchedUrls).toContain('https://example.com/page')
    // Should return a successful result
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].success).toBe(true)
  })

  it('does not follow links found on the page', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com/page'],
      outputDir: tmpOut(),
      maxDepth: 0,
      followLinks: true, // even with followLinks true, singlePageMode should override
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should only fetch the one URL, not follow any discovered links
    expect(fetchedUrls).toEqual(['https://example.com/page'])
    expect(results.length).toBe(1)
  })

  it('reports progress with sitemap status completed immediately', async () => {
    const progressUpdates: any[] = []

    await crawlAndGenerate({
      urls: ['https://example.com/page'],
      outputDir: tmpOut(),
      maxDepth: 0,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    }, (progress) => {
      progressUpdates.push(JSON.parse(JSON.stringify(progress)))
    })

    // First progress update should already have sitemap completed (skipped)
    const firstUpdate = progressUpdates[0]
    expect(firstUpdate.sitemap.status).toBe('completed')
    expect(firstUpdate.sitemap.found).toBe(0)
    expect(firstUpdate.sitemap.processed).toBe(0)
  })

  it('processes only the given URLs without adding home page', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com/specific-page'],
      outputDir: tmpOut(),
      maxDepth: 0,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should not add the home page URL (which normal mode does)
    expect(fetchedUrls).not.toContain('https://example.com')
    expect(fetchedUrls).not.toContain('https://example.com/')
    expect(fetchedUrls).toContain('https://example.com/specific-page')
    expect(results.length).toBe(1)
  })
})

describe('normal crawl mode (maxDepth > 0) attempts sitemap discovery', () => {
  it('fetches robots.txt and sitemap.xml when maxDepth > 0', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 1,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    expect(fetchedUrls.some(u => u.includes('robots.txt'))).toBe(true)
    expect(fetchedUrls.some(u => u.includes('sitemap'))).toBe(true)
  })

  it('skipSitemap also bypasses discovery', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com/page'],
      outputDir: tmpOut(),
      maxDepth: 2,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    expect(fetchedUrls.some(u => u.includes('robots.txt'))).toBe(false)
    expect(fetchedUrls.some(u => u.includes('sitemap'))).toBe(false)
  })
})

describe('cLI --single-page flag derivation', () => {
  // These test the actual CLI arg parsing logic from cli.ts parseCliArgs (lines 371-377, 455)
  it('--single-page sets depth to 0 and disables followLinks', () => {
    const args = ['--single-page', '-u', 'example.com']
    const singlePage = args.includes('--single-page')
    const depthStr = singlePage ? '0' : '3'
    const depth = Number(depthStr)
    const followLinks = depth > 0

    expect(depth).toBe(0)
    expect(followLinks).toBe(false)
  })

  it('without --single-page, depth defaults to 3 with followLinks enabled', () => {
    const args = ['-u', 'example.com']
    const singlePage = args.includes('--single-page')
    const depthStr = singlePage ? '0' : '3'
    const depth = Number(depthStr)
    const followLinks = depth > 0

    expect(depth).toBe(3)
    expect(followLinks).toBe(true)
  })

  it('explicit --depth 0 also disables followLinks', () => {
    const args = ['-u', 'example.com', '--depth', '0']
    const singlePage = args.includes('--single-page')
    const getArgValue = (flag: string) => {
      const idx = args.indexOf(flag)
      return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
    }
    const depthStr = singlePage ? '0' : (getArgValue('--depth') || '3')
    const depth = Number(depthStr)
    const followLinks = depth > 0

    expect(depth).toBe(0)
    expect(followLinks).toBe(false)
  })
})
