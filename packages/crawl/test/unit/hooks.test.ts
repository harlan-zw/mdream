import type { CrawlHooks, CrawlResult, PageData } from '../../src/types.js'
import { createHooks } from 'hookable'
import { describe, expect, it } from 'vitest'
import { defineConfig } from '../../src/types.js'

describe('hooks', () => {
  describe('crawl:url', () => {
    it('should skip url when ctx.skip is set to true', async () => {
      const hooks = createHooks<CrawlHooks>()
      hooks.hook('crawl:url', (ctx) => {
        if (ctx.url.includes('/admin'))
          ctx.skip = true
      })

      const ctx1 = { url: 'https://example.com/admin/settings', skip: false }
      await hooks.callHook('crawl:url', ctx1)
      expect(ctx1.skip).toBe(true)

      const ctx2 = { url: 'https://example.com/about', skip: false }
      await hooks.callHook('crawl:url', ctx2)
      expect(ctx2.skip).toBe(false)
    })

    it('should support async hooks', async () => {
      const hooks = createHooks<CrawlHooks>()
      hooks.hook('crawl:url', async (ctx) => {
        await new Promise(resolve => setTimeout(resolve, 1))
        if (ctx.url.includes('/api'))
          ctx.skip = true
      })

      const ctx = { url: 'https://example.com/api/v1', skip: false }
      await hooks.callHook('crawl:url', ctx)
      expect(ctx.skip).toBe(true)
    })
  })

  describe('crawl:page', () => {
    it('should allow mutating page title', async () => {
      const hooks = createHooks<CrawlHooks>()
      hooks.hook('crawl:page', (page) => {
        page.title = page.title.replace(/ \| My Brand$/, '')
      })

      const page: PageData = {
        url: 'https://example.com/about',
        html: '<html></html>',
        title: 'About Us | My Brand',
        metadata: { title: 'About Us | My Brand', links: [] },
        origin: 'https://example.com',
      }

      await hooks.callHook('crawl:page', page)
      expect(page.title).toBe('About Us')
    })
  })

  describe('crawl:content', () => {
    it('should allow transforming content before write', async () => {
      const hooks = createHooks<CrawlHooks>()
      hooks.hook('crawl:content', (ctx) => {
        ctx.content = ctx.content.replace(/SECRET/g, '[REDACTED]')
      })

      const ctx = {
        url: 'https://example.com/page',
        title: 'Page',
        content: 'Some SECRET data here with another SECRET',
        filePath: '/output/page.md',
      }

      await hooks.callHook('crawl:content', ctx)
      expect(ctx.content).toBe('Some [REDACTED] data here with another [REDACTED]')
    })

    it('should allow changing filePath', async () => {
      const hooks = createHooks<CrawlHooks>()
      hooks.hook('crawl:content', (ctx) => {
        ctx.filePath = ctx.filePath.replace('.md', '.mdx')
      })

      const ctx = {
        url: 'https://example.com/page',
        title: 'Page',
        content: '# Hello',
        filePath: '/output/page.md',
      }

      await hooks.callHook('crawl:content', ctx)
      expect(ctx.filePath).toBe('/output/page.mdx')
    })
  })

  describe('crawl:done', () => {
    it('should allow filtering results', async () => {
      const hooks = createHooks<CrawlHooks>()
      hooks.hook('crawl:done', (ctx) => {
        const filtered = ctx.results.filter(r => r.success)
        ctx.results.length = 0
        ctx.results.push(...filtered)
      })

      const results: CrawlResult[] = [
        { url: 'https://example.com/a', title: 'A', content: '# A', timestamp: 1, success: true },
        { url: 'https://example.com/b', title: 'B', content: '', timestamp: 2, success: false, error: '404' },
        { url: 'https://example.com/c', title: 'C', content: '# C', timestamp: 3, success: true },
      ]

      await hooks.callHook('crawl:done', { results })
      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })
  })

  describe('onPage backwards compatibility', () => {
    it('should work when registered as crawl:page hook', async () => {
      const pages: string[] = []
      const hooks = createHooks<CrawlHooks>()

      // Simulate what crawl.ts does with onPage
      const onPage = (page: PageData) => { pages.push(page.url) }
      hooks.hook('crawl:page', onPage)

      const page: PageData = {
        url: 'https://example.com/test',
        html: '',
        title: 'Test',
        metadata: { title: 'Test', links: [] },
        origin: 'https://example.com',
      }

      await hooks.callHook('crawl:page', page)
      expect(pages).toEqual(['https://example.com/test'])
    })
  })

  describe('defineConfig', () => {
    it('should return the config as-is (identity function)', () => {
      const config = defineConfig({
        exclude: ['*/admin/*'],
        hooks: {
          'crawl:page': (page) => {
            page.title = page.title.replace(/ \| Brand$/, '')
          },
        },
      })

      expect(config.exclude).toEqual(['*/admin/*'])
      expect(config.hooks).toBeDefined()
      expect(config.hooks!['crawl:page']).toBeTypeOf('function')
    })

    it('should accept all config options', () => {
      const config = defineConfig({
        driver: 'playwright',
        maxDepth: 5,
        maxPages: 100,
        crawlDelay: 2,
        skipSitemap: true,
        allowSubdomains: true,
        verbose: true,
        artifacts: ['llms.txt', 'markdown'],
        exclude: ['*/private/*'],
      })

      expect(config.driver).toBe('playwright')
      expect(config.maxDepth).toBe(5)
      expect(config.artifacts).toEqual(['llms.txt', 'markdown'])
    })
  })
})
