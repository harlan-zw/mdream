import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchedUrls: string[] = []

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/blog</loc></url>
</urlset>`

const pageRegistry: Record<string, string> = {
  '/': '<html><head><title>Home</title></head><body><a href="/hidden-page">Hidden</a><a href="/secret">Secret</a></body></html>',
  '/about': '<html><head><title>About</title></head><body><a href="/also-hidden">Also Hidden</a><p>About</p></body></html>',
  '/blog': '<html><head><title>Blog</title></head><body><p>Blog</p></body></html>',
  '/hidden-page': '<html><head><title>Hidden</title></head><body><p>Should not be crawled</p></body></html>',
  '/secret': '<html><head><title>Secret</title></head><body><p>Should not be crawled</p></body></html>',
  '/also-hidden': '<html><head><title>Also Hidden</title></head><body><p>Should not be crawled</p></body></html>',
}

function getHtmlForUrl(url: string): string {
  const path = new URL(url).pathname
  return pageRegistry[path] || '<html><head><title>404</title></head><body><p>Not found</p></body></html>'
}

vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      fetchedUrls.push(url)
      if (url.endsWith('/robots.txt'))
        return ''
      if (url.endsWith('/sitemap.xml'))
        return SITEMAP_XML
      if (url.includes('sitemap'))
        throw new Error('404')
      return getHtmlForUrl(url)
    },
    {
      raw: async (url: string, _opts?: any) => {
        fetchedUrls.push(url)
        return {
          _data: getHtmlForUrl(url),
          headers: new Headers({ 'content-type': 'text/html' }),
        }
      },
    },
  )
  return { ofetch: mockOfetch }
})

vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({
    llmsTxt: '# llms.txt',
    llmsFullTxt: '# llms-full.txt',
  }),
}))

vi.mock('@clack/prompts', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
  note: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

const { crawlAndGenerate } = await import('../../src/crawl.ts')

function tmpOut(): string {
  return join(tmpdir(), `mdream-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

afterEach(() => {
  fetchedUrls.length = 0
})

describe('sitemap link skip', () => {
  it('does not follow discovered links when sitemap provides URLs', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      followLinks: true,
      // sitemap discovery is NOT skipped, so it will find sitemap.xml
      skipSitemap: false,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should only crawl the URLs from the sitemap: /, /about, /blog
    const crawledPagePaths = fetchedUrls
      .filter(u => !u.includes('robots.txt') && !u.includes('sitemap'))
      .map(u => new URL(u).pathname)

    expect(crawledPagePaths).toContain('/')
    expect(crawledPagePaths).toContain('/about')
    expect(crawledPagePaths).toContain('/blog')

    // Should NOT have followed any links discovered in page content
    expect(crawledPagePaths).not.toContain('/hidden-page')
    expect(crawledPagePaths).not.toContain('/secret')
    expect(crawledPagePaths).not.toContain('/also-hidden')

    // Only sitemap URLs should produce results
    const successUrls = results.filter(r => r.success).map(r => new URL(r.url).pathname)
    expect(successUrls).toContain('/')
    expect(successUrls).toContain('/about')
    expect(successUrls).toContain('/blog')
  })
})
