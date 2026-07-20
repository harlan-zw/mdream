import type { CrawlLogger } from '../../src/logger.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// Mock network so the crawl runs offline. The sitemap 404 makes the library
// emit its "Sitemap: not found" info log, which is what issue #100 is about.
vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      if (url.endsWith('/robots.txt'))
        return ''
      if (url.includes('sitemap'))
        throw new Error('404')
      return '<html><head><title>Test</title></head><body><p>Hello</p></body></html>'
    },
    {
      raw: async (url: string) => ({
        _data: `<html><head><title>Page</title></head><body><p>Content for ${url}</p></body></html>`,
        headers: new Headers({ 'content-type': 'text/html' }),
      }),
    },
  )
  return { ofetch: mockOfetch }
})

vi.mock('mdream', () => ({
  htmlToMarkdown: (html: string) => `# Converted\n\n${html.slice(0, 50)}`,
}))

vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({ llmsTxt: '# llms.txt', llmsFullTxt: '' }),
}))

// Fail the test loudly if the library ever falls back to clack (stdout) output.
const clackInfo = vi.fn()
vi.mock('@clack/prompts', () => ({
  log: { info: clackInfo, warn: vi.fn(), error: vi.fn(), success: vi.fn() },
  intro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

const { crawlAndGenerate } = await import('../../src/crawl.ts')

function tmpOut(): string {
  return join(tmpdir(), `mdream-silent-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

function recordingLogger(messages: string[]): CrawlLogger {
  const push = (m: string) => messages.push(m)
  return {
    intro: push,
    note: push,
    cancel: push,
    info: push,
    warn: push,
    error: push,
    success: push,
    spinner: () => ({ start: () => {}, message: () => {}, stop: () => {} }),
  }
}

describe('crawl logging (issue #100)', () => {
  it('routes library logs through a custom logger', async () => {
    const messages: string[] = []
    await crawlAndGenerate({
      urls: ['https://example.com/'],
      outputDir: tmpOut(),
      maxDepth: 1,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
      logger: recordingLogger(messages),
    })

    expect(messages.some(m => m.includes('Sitemap'))).toBe(true)
  })

  it('emits no clack output when silent is set', async () => {
    clackInfo.mockClear()
    const results = await crawlAndGenerate({
      urls: ['https://example.com/'],
      outputDir: tmpOut(),
      maxDepth: 1,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
      silent: true,
    })

    expect(clackInfo).not.toHaveBeenCalled()
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
