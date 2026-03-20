import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Track fetched URLs for assertions
const fetchedUrls: string[] = []

// Page content registry: maps URL paths to HTML with links
const pageRegistry: Record<string, string> = {
  '/': '<html><head><title>Home</title></head><body><a href="/about">About</a><a href="/blog">Blog</a></body></html>',
  '/about': '<html><head><title>About</title></head><body><a href="/about/team">Team</a><p>About page</p></body></html>',
  '/blog': '<html><head><title>Blog</title></head><body><a href="/blog/post-1">Post 1</a></body></html>',
  '/about/team': '<html><head><title>Team</title></head><body><a href="/about/team/alice">Alice</a><p>Team page</p></body></html>',
  '/blog/post-1': '<html><head><title>Post 1</title></head><body><p>Blog post</p></body></html>',
  '/about/team/alice': '<html><head><title>Alice</title></head><body><p>Alice bio</p></body></html>',
}

function getHtmlForUrl(url: string): string {
  const path = new URL(url).pathname
  return pageRegistry[path] || '<html><head><title>404</title></head><body><p>Not found</p></body></html>'
}

// Mock ofetch to serve pages from registry
vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      fetchedUrls.push(url)
      if (url.endsWith('/robots.txt'))
        return ''
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

// Use real mdream so extraction callbacks fire and links are discovered
// Mock llms-txt artifact generation
vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({
    llmsTxt: '# llms.txt',
    llmsFullTxt: '# llms-full.txt',
  }),
}))

// Suppress @clack/prompts output
vi.mock('@clack/prompts', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

describe('follow links (BFS crawling)', () => {
  it('discovers and crawls linked pages when followLinks is enabled', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 1,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should have crawled home + discovered /about and /blog at depth 1
    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).toContain('/about')
    expect(crawledPaths).toContain('/blog')
    // Should NOT have followed depth 2 links
    expect(crawledPaths).not.toContain('/about/team')
    expect(crawledPaths).not.toContain('/blog/post-1')
    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('respects maxDepth=2 and crawls two levels deep', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 2,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).toContain('/about')
    expect(crawledPaths).toContain('/blog')
    expect(crawledPaths).toContain('/about/team')
    expect(crawledPaths).toContain('/blog/post-1')
    // Depth 3 links should NOT be followed
    expect(crawledPaths).not.toContain('/about/team/alice')
    expect(results.length).toBeGreaterThanOrEqual(5)
  })

  it('does not follow links when followLinks is false', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      followLinks: false,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).not.toContain('/about')
    expect(crawledPaths).not.toContain('/blog')
  })

  it('does not crawl duplicate URLs', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Count occurrences of each path
    const pathCounts: Record<string, number> = {}
    for (const url of fetchedUrls) {
      const path = new URL(url).pathname
      pathCounts[path] = (pathCounts[path] || 0) + 1
    }
    // Each page should only be fetched once
    for (const [path, count] of Object.entries(pathCounts)) {
      expect(count, `${path} fetched ${count} times`).toBe(1)
    }
  })

  it('respects maxRequestsPerCrawl limit across BFS waves', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      maxRequestsPerCrawl: 3,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should process at most 3 URLs total
    expect(fetchedUrls.length).toBeLessThanOrEqual(3)
  })
})
