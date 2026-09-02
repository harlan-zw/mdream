import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// A page two directories deep: bare relative, dot-prefixed, parent-relative
// and root-relative links.
const PAGE_URL = 'https://site.test/docs/guide/intro.html'
const PAGE_HTML = `<!doctype html><html><head><title>Intro</title></head><body><main>
<p>The introduction paragraph explains what this guide covers in detail.</p>
<p><a href="setup.html">Setup</a> <a href="./install.html">Install</a> <a href="../faq.html">FAQ</a> <a href="/index.html">Home</a></p>
<p><img src="images/diagram.png" alt="Diagram"></p>
</main></body></html>`

vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async () => '',
    {
      raw: async () => ({
        _data: PAGE_HTML,
        headers: new Headers({ 'content-type': 'text/html' }),
      }),
    },
  )
  return { ofetch: mockOfetch }
})

vi.mock('@clack/prompts', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
  note: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

const { crawlAndGenerate } = await import('../../src/crawl.ts')

function tmpOut(): string {
  return join(tmpdir(), `mdream-links-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

async function crawlIntro(origin?: string): Promise<string> {
  const outputDir = tmpOut()
  await crawlAndGenerate({
    urls: [PAGE_URL],
    outputDir,
    maxDepth: 0,
    skipSitemap: true,
    generateIndividualMd: true,
    silent: true,
    origin,
  })
  return readFile(join(outputDir, 'docs/guide/intro-html.md'), 'utf-8')
}

describe('relative links in crawled markdown', () => {
  it('resolves against the page URL, not the site root', async () => {
    const md = await crawlIntro()

    expect(md).toContain('[Setup](https://site.test/docs/guide/setup.html)')
    expect(md).toContain('[Install](https://site.test/docs/guide/install.html)')
    expect(md).toContain('[FAQ](https://site.test/docs/faq.html)')
    expect(md).toContain('[Home](https://site.test/index.html)')
    expect(md).toContain('(https://site.test/docs/guide/images/diagram.png)')
  })

  it('keeps the page path when an origin override is given', async () => {
    const md = await crawlIntro('https://cdn.site.test/')

    expect(md).toContain('[Setup](https://cdn.site.test/docs/guide/setup.html)')
    expect(md).toContain('[FAQ](https://cdn.site.test/docs/faq.html)')
    expect(md).toContain('[Home](https://cdn.site.test/index.html)')
  })
})
