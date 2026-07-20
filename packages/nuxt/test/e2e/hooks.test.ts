import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('mdream hooks e2e', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../fixtures/hooks', import.meta.url)),
    dev: false,
    server: true,
    build: true,
  })

  describe('mdream:markdown hook', () => {
    it('should call hook when serving .md routes', async () => {
      // This tests the runtime hook by fetching a .md route
      const markdown = await $fetch('/index.md')
      expect(markdown).toBeTruthy()
      expect(typeof markdown).toBe('string')
      expect(markdown).toContain('# Home Page')
    })

    it('should work for multiple routes', async () => {
      const aboutMarkdown = await $fetch('/about.md')
      expect(aboutMarkdown).toBeTruthy()
      expect(typeof aboutMarkdown).toBe('string')
      expect(aboutMarkdown).toContain('# About Page')
    })
  })

  describe('mdream:config hook', () => {
    it('should allow modifying mdream options before conversion', async () => {
      // The server plugin sets filter.exclude = ['p'] via mdream:config
      // so paragraph text should be stripped from the markdown output
      const markdown = await $fetch('/index.md')
      expect(markdown).toContain('# Home Page')
      // The <p> content should be filtered out by the config hook
      expect(markdown).not.toContain('testing hooks')
    })

    it('should apply config modifications on every request', async () => {
      const aboutMarkdown = await $fetch('/about.md')
      expect(aboutMarkdown).toContain('# About Page')
      // Paragraph content filtered out on this route too
      expect(aboutMarkdown).not.toContain('testing hooks')
    })
  })

  describe('mdream:negotiate hook', () => {
    it('should force markdown serving via X-Force-Markdown header', async () => {
      // Request without .md extension but with X-Force-Markdown header
      // The negotiate hook should override and serve markdown
      const response = await $fetch.raw('/', {
        headers: {
          'x-force-markdown': 'true',
        },
      })
      expect(response.headers.get('content-type')).toContain('text/markdown')
      expect(response._data).toContain('# Home Page')
    })

    it('should block markdown serving via X-Block-Markdown header', async () => {
      // Request with accept header preferring markdown but blocked by hook
      const response = await $fetch.raw('/', {
        headers: {
          'accept': 'text/markdown',
          'x-block-markdown': 'true',
        },
      })
      // Should serve HTML, not markdown
      expect(response.headers.get('content-type')).toContain('text/html')
    })

    it('should not affect .md extension requests', async () => {
      // .md extension bypass negotiate entirely (hasMarkdownExtension check)
      const response = await $fetch.raw('/index.md', {
        headers: {
          'x-block-markdown': 'true',
        },
      })
      // .md requests always serve markdown regardless of negotiate hook
      expect(response.headers.get('content-type')).toContain('text/markdown')
      expect(response._data).toContain('# Home Page')
    })
  })

  describe('mdream:llms-txt:generate hook', () => {
    it('should generate llms.txt with hook modifications', async () => {
      const llmsTxt = await $fetch('/llms.txt')
      expect(llmsTxt).toBeTruthy()
      expect(typeof llmsTxt).toBe('string')

      // Should contain the custom section added by the hook
      expect(llmsTxt).toContain('## Custom Hook Section')
      expect(llmsTxt).toContain('This was added by a hook!')
    })

    it('should generate llms-full.txt with hook modifications', async () => {
      const llmsFullTxt = await $fetch('/llms-full.txt')
      expect(llmsFullTxt).toBeTruthy()
      expect(typeof llmsFullTxt).toBe('string')

      // Should contain the custom section added by the hook
      expect(llmsFullTxt).toContain('## Custom Hook Section (Full)')
      expect(llmsFullTxt).toContain('This was added by a hook!')
    })
  })
})
