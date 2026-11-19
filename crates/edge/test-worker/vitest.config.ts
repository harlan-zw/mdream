import { cloudflarePool, cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.toml' },
          }),
        ],
        test: {
          name: 'workers',
          pool: cloudflarePool(),
          include: ['test/worker.test.ts'],
        },
      },
      {
        test: {
          name: 'pack-e2e',
          include: ['test/pack-e2e.test.ts'],
          // The pack lifecycle rebuilds dist while workerd imports it.
          sequence: { groupOrder: 1 },
          testTimeout: 240_000,
          hookTimeout: 240_000,
        },
      },
    ],
  },
})
