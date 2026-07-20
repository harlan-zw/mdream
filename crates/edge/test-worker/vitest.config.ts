import { cloudflarePool, cloudflareTest } from '@cloudflare/vitest-pool-workers'
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
          testTimeout: 240_000,
          hookTimeout: 240_000,
        },
      },
    ],
  },
})
