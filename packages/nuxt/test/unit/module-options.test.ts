import { fileURLToPath } from 'node:url'
import { loadNuxt } from '@nuxt/kit'
import { describe, expect, it } from 'vitest'

const cwd = fileURLToPath(new URL('../fixtures/basic', import.meta.url))

describe('module options', () => {
  it('rejects mdreamOptions.preset when Nuxt loads', async () => {
    const load = loadNuxt({ cwd, ready: true, overrides: { mdream: { mdreamOptions: { preset: 'minimal' } } } as any })
    await expect(load).rejects.toThrow('@mdream/nuxt has no `mdreamOptions.preset` option. Pass mdreamOptions: { minimal: true }.')
  })
})
