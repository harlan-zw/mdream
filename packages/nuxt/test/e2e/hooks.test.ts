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
