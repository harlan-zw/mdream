import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

// Tests that mdream works after Nitro bundling (production build).
// The native NAPI binding uses createRequire(import.meta.url) to load .node files.
// If mdream is bundled by Nitro, import.meta.url resolves to the output bundle and
// the .node file won't be found, crashing the server on startup.
// These tests verify the rollupConfig.external fix keeps mdream as a bare import.
describe('nuxt-mdream build mode', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../fixtures/basic', import.meta.url)),
    dev: false,
    server: true,
    build: true,
  })

  it('native binding loads after Nitro bundling', async () => {
    const markdown = await $fetch('/index.md')
    expect(markdown).toContain('# Test Fixture')
    expect(markdown).toContain('test fixture for the mdream module')
  })
})
