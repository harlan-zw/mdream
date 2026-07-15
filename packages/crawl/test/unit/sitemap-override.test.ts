import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchedUrls: string[] = []

// Sitemap responses keyed by exact URL. Anything not present 404s.
const sitemapRegistry: Record<string, string> = {}

function html(title: string): string {
  return `<html><head><title>${title}</title></head><body><p>${title}</p></body></html>`
}

vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      fetchedUrls.push(url)
      if (url.endsWith('/robots.txt'))
        return sitemapRegistry.__robots__ ?? ''
      if (url in sitemapRegistry)
        return sitemapRegistry[url]
      throw new Error('404')
    },
    {
      raw: async (url: string, _opts?: any) => {
        fetchedUrls.push(url)
        return {
          _data: html(new URL(url).pathname),
          headers: new Headers({ 'content-type': 'text/html' }),
        }
      },
    },
  )
  return { ofetch: mockOfetch }
})

vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({ llmsTxt: '# llms.txt', llmsFullTxt: '# llms-full.txt' }),
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

function urlset(...locs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map(l => `  <url><loc>${l}</loc></url>`).join('\n')}
</urlset>`
}

function sitemapindex(...locs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map(l => `  <sitemap><loc>${l}</loc></sitemap>`).join('\n')}
</sitemapindex>`
}

afterEach(() => {
  fetchedUrls.length = 0
  for (const key of Object.keys(sitemapRegistry))
    delete sitemapRegistry[key]
})

const baseOpts = {
  maxDepth: 1,
  followLinks: false,
  generateLlmsTxt: false,
  generateLlmsFullTxt: false,
  generateIndividualMd: false,
}

describe('sitemap override (#116)', () => {
  it('uses an explicit sitemap URL and skips default /sitemap.xml discovery', async () => {
    sitemapRegistry['https://example.com/custom/sitemap.xml'] = urlset(
      'https://example.com/alpha',
      'https://example.com/beta',
    )
    // A default sitemap also exists but must NOT be consulted.
    sitemapRegistry['https://example.com/sitemap.xml'] = urlset('https://example.com/should-not-appear')

    const results = await crawlAndGenerate({
      ...baseOpts,
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      sitemapUrls: ['https://example.com/custom/sitemap.xml'],
    })

    const successPaths = results.filter(r => r.success).map(r => new URL(r.url).pathname)
    expect(successPaths).toContain('/alpha')
    expect(successPaths).toContain('/beta')
    expect(successPaths).not.toContain('/should-not-appear')
    // Default sitemap path was never fetched.
    expect(fetchedUrls.includes('https://example.com/sitemap.xml')).toBe(false)
  })

  it('merges multiple explicit sitemap parts', async () => {
    sitemapRegistry['https://example.com/sitemap-1.xml'] = urlset('https://example.com/one')
    sitemapRegistry['https://example.com/sitemap-2.xml'] = urlset('https://example.com/two')

    const results = await crawlAndGenerate({
      ...baseOpts,
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      sitemapUrls: [
        'https://example.com/sitemap-1.xml',
        'https://example.com/sitemap-2.xml',
      ],
    })

    const successPaths = results.filter(r => r.success).map(r => new URL(r.url).pathname)
    expect(successPaths).toContain('/one')
    expect(successPaths).toContain('/two')
  })

  it('decodes XML entities in <loc> query strings', async () => {
    sitemapRegistry['https://example.com/sitemap.xml'] = urlset(
      'https://example.com/search?a=1&amp;b=2',
    )

    await crawlAndGenerate({
      ...baseOpts,
      urls: ['https://example.com'],
      outputDir: tmpOut(),
    })

    // The decoded URL should be fetched, not the literal &amp; form.
    expect(fetchedUrls).toContain('https://example.com/search?a=1&b=2')
    expect(fetchedUrls.some(u => u.includes('&amp;'))).toBe(false)
  })

  it('prefers robots.txt sitemap over well-known /sitemap.xml (no overwrite)', async () => {
    sitemapRegistry.__robots__ = 'Sitemap: https://example.com/robots-sitemap.xml\n'
    sitemapRegistry['https://example.com/robots-sitemap.xml'] = urlset('https://example.com/from-robots')
    // A default sitemap also exists; it must not replace the robots.txt result.
    sitemapRegistry['https://example.com/sitemap.xml'] = urlset('https://example.com/from-default')

    const results = await crawlAndGenerate({
      ...baseOpts,
      urls: ['https://example.com'],
      outputDir: tmpOut(),
    })

    const successPaths = results.filter(r => r.success).map(r => new URL(r.url).pathname)
    expect(successPaths).toContain('/from-robots')
    expect(successPaths).not.toContain('/from-default')
  })

  it('terminates on a cyclic sitemap index and merges child URLs', async () => {
    // A indexes B (+ child-a), B indexes A (+ child-b). The A->B->A cycle must be
    // broken by the visited guard while both leaf urlsets are still collected.
    sitemapRegistry['https://example.com/sitemap-a.xml'] = sitemapindex(
      'https://example.com/child-a.xml',
      'https://example.com/sitemap-b.xml',
    )
    sitemapRegistry['https://example.com/sitemap-b.xml'] = sitemapindex(
      'https://example.com/child-b.xml',
      'https://example.com/sitemap-a.xml',
    )
    sitemapRegistry['https://example.com/child-a.xml'] = urlset('https://example.com/a-page')
    sitemapRegistry['https://example.com/child-b.xml'] = urlset('https://example.com/b-page')

    const results = await crawlAndGenerate({
      ...baseOpts,
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      sitemapUrls: ['https://example.com/sitemap-a.xml'],
    })

    const successPaths = results.filter(r => r.success).map(r => new URL(r.url).pathname)
    expect(successPaths).toContain('/a-page')
    expect(successPaths).toContain('/b-page')
    // Each sitemap fetched at most once despite the cycle.
    expect(fetchedUrls.filter(u => u === 'https://example.com/sitemap-a.xml').length).toBe(1)
    expect(fetchedUrls.filter(u => u === 'https://example.com/sitemap-b.xml').length).toBe(1)
  })

  it('keeps entity text literal inside CDATA (no decode)', async () => {
    // Inside CDATA the URL is literal text, so &amp; must survive verbatim.
    sitemapRegistry['https://example.com/sitemap.xml'] = urlset(
      '<![CDATA[https://example.com/path?a=1&amp;b=2]]>',
    )

    await crawlAndGenerate({
      ...baseOpts,
      urls: ['https://example.com'],
      outputDir: tmpOut(),
    })

    expect(fetchedUrls).toContain('https://example.com/path?a=1&amp;b=2')
  })
})
