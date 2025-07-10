import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('nuxt-mdream e2e', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../fixtures/basic', import.meta.url)),
    dev: true,
    server: true,
  })

  it('converts HTML to markdown via .md extension', async () => {
    const markdown = await $fetch('/index.md')
    expect(markdown).toBeTruthy()
    expect(typeof markdown).toBe('string')
    expect(markdown).toContain('#') // Should contain markdown headers
  })

  it('handles valid routes and converts to markdown', async () => {
    // Test with /about.md which should work
    const aboutMarkdown = await $fetch('/about.md')
    expect(aboutMarkdown).toBeTruthy()
    expect(typeof aboutMarkdown).toBe('string')
    expect(aboutMarkdown).toContain('#') // Should contain markdown headers
  })
})
