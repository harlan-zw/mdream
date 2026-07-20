import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// A small multi-page fixture site that wraps every page in identical chrome:
// a top nav and a footer "testimonial wall". Each page has a unique <main> body.
const SHARED_HEADER = '<header><nav>Home About Blog Products Pricing Customers Docs Support Careers Press Community Login Signup Contact <a href="https://site.test/cta">CTA</a> <a href="https://site.test/tips">Tips</a> <a href="https://site.test/guide">Guide</a></nav></header>'
const SHARED_FOOTER = '<footer><p>Subscribe to our newsletter and join ten thousand happy marketers for weekly growth tips.</p><p>"Best resource ever" said Alice from Acme.</p><p>"Changed my career" said Bob from Globex.</p><p>Copyright 2024 Marketing Examples all rights reserved worldwide.</p></footer>'

function htmlPage(title: string, main: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>${SHARED_HEADER}<main>${main}</main>${SHARED_FOOTER}</body></html>`
}

// Bodies are unique per page, including their trailing words, so the tiny-corpus
// k-gram boundary effect does not nibble the last real word before the footer.
const BODIES: Record<string, { title: string, main: string }> = {
  '': { title: 'Home', main: '<h1>Welcome</h1><p>Welcome to the homepage overview today.</p>' },
  '/cta': { title: 'CTA', main: '<h1>Call To Action</h1><p>Short unique cta content lives here.</p>' },
  '/tips': { title: 'Tips', main: '<h1>Tips</h1><p>A paragraph of tips written down.</p><p>Another distinct tip writeup section.</p>' },
  '/guide': { title: 'Guide', main: '<h1>Guide</h1><p>Guide paragraph one is long and detailed enough.</p><p>Guide paragraph two continues the explanation further.</p><p>Guide paragraph three wraps it up nicely overall.</p>' },
}

const fetchedUrls: string[] = []

vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async () => '',
    {
      raw: async (url: string) => {
        fetchedUrls.push(url)
        const path = url.replace('https://site.test', '')
        const entry = BODIES[path] ?? BODIES['']
        return {
          _data: htmlPage(entry.title, entry.main),
          headers: new Headers({ 'content-type': 'text/html' }),
        }
      },
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

// Real htmlToMarkdown + real llms-txt generation (packages are built).
const { crawlAndGenerate } = await import('../../src/crawl.ts')

function tmpOut(): string {
  return join(tmpdir(), `mdream-boilerplate-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

afterEach(() => {
  fetchedUrls.length = 0
})

describe('boilerplate stripping across a crawled corpus', () => {
  it('removes shared nav/footer chrome from per-page markdown while keeping bodies and the link index', async () => {
    const outputDir = tmpOut()

    await crawlAndGenerate({
      urls: ['https://site.test'],
      outputDir,
      maxDepth: 1,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: true,
      generateLlmsFullTxt: true,
      generateIndividualMd: true,
      silent: true,
    })

    const cta = await readFile(join(outputDir, 'cta.md'), 'utf-8')
    const tips = await readFile(join(outputDir, 'tips.md'), 'utf-8')
    const guide = await readFile(join(outputDir, 'guide.md'), 'utf-8')
    const index = await readFile(join(outputDir, 'index.md'), 'utf-8')

    // Chrome is gone from every per-page file.
    for (const md of [cta, tips, guide, index]) {
      expect(md).not.toContain('Subscribe to our newsletter')
      expect(md).not.toContain('Best resource ever')
      expect(md).not.toContain('Changed my career')
      expect(md).not.toContain('Copyright 2024 Marketing Examples')
      // The nav link list is repeated chrome too.
      expect(md).not.toContain('Products Pricing Customers')
    }

    // Bodies survive.
    expect(cta).toContain('Short unique cta content lives here.')
    expect(tips).toContain('A paragraph of tips written down.')
    expect(tips).toContain('Another distinct tip writeup section.')
    expect(guide).toContain('Guide paragraph one is long and detailed enough.')
    expect(guide).toContain('Guide paragraph two continues the explanation further.')
    expect(guide).toContain('Guide paragraph three wraps it up nicely overall.')
    expect(index).toContain('Welcome to the homepage overview today.')

    // llms.txt still lists every discovered page (link index is unaffected).
    const llmsTxt = await readFile(join(outputDir, 'llms.txt'), 'utf-8')
    expect(llmsTxt).toContain('index.md')
    expect(llmsTxt).toContain('cta.md')
    expect(llmsTxt).toContain('tips.md')
    expect(llmsTxt).toContain('guide.md')

    // llms-full.txt page sections are also stripped.
    const llmsFull = await readFile(join(outputDir, 'llms-full.txt'), 'utf-8')
    expect(llmsFull).not.toContain('Subscribe to our newsletter')
    expect(llmsFull).toContain('Short unique cta content lives here.')
  })

  it('keeps chrome when stripBoilerplate is disabled', async () => {
    const outputDir = tmpOut()

    await crawlAndGenerate({
      urls: ['https://site.test'],
      outputDir,
      maxDepth: 1,
      followLinks: true,
      skipSitemap: true,
      generateIndividualMd: true,
      stripBoilerplate: false,
      silent: true,
    })

    const cta = await readFile(join(outputDir, 'cta.md'), 'utf-8')
    expect(cta).toContain('Subscribe to our newsletter')
    expect(cta).toContain('Short unique cta content lives here.')
  })
})
