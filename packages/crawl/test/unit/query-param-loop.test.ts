import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchedUrls: string[] = []

// Page that generates many query param variants linking to the same path
function makeFacetedPage(path: string, paramVariants: number): string {
  const links = Array.from({ length: paramVariants }, (_, i) =>
    `<a href="${path}?page=${i + 1}&sort=asc">Page ${i + 1}</a>`).join('')
  return `<html><head><title>Faceted</title></head><body>${links}<p>Content</p></body></html>`
}

const pageRegistry: Record<string, string> = {
  '/': makeFacetedPage('/products', 20), // home links to 20 variants of /products
  '/products': '<html><head><title>Products</title></head><body><p>Products page</p></body></html>',
}

function getHtmlForUrl(url: string): string {
  const u = new URL(url)
  return pageRegistry[u.pathname] || '<html><head><title>Page</title></head><body><p>Content</p></body></html>'
}

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

describe('query param loop prevention', () => {
  it('caps query param variants per pathname at 5', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 2,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Home page generates 20 links to /products?page=N&sort=asc
    // Only 5 variants should be queued (plus the home page itself)
    const productUrls = fetchedUrls.filter(u => u.includes('/products'))
    expect(productUrls.length).toBeLessThanOrEqual(5)
    // Total fetched: home + up to 5 product variants
    expect(fetchedUrls.length).toBeLessThanOrEqual(7) // home + robots.txt attempts + 5 variants
  })

  it('strips tracking params from discovered links for dedup', async () => {
    // Override page registry for this test
    pageRegistry['/'] = `<html><head><title>Home</title></head><body>
      <a href="/about?utm_source=twitter">About 1</a>
      <a href="/about?utm_source=facebook">About 2</a>
      <a href="/about?fbclid=xyz">About 3</a>
      <a href="/about">About clean</a>
    </body></html>`
    pageRegistry['/about'] = '<html><head><title>About</title></head><body><p>About</p></body></html>'

    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 1,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // All 4 links should normalize to the same /about URL, fetched only once
    const aboutFetches = fetchedUrls.filter(u => new URL(u).pathname === '/about')
    expect(aboutFetches.length).toBe(1)

    // Restore
    pageRegistry['/'] = makeFacetedPage('/products', 20)
    delete pageRegistry['/about']
  })
})
