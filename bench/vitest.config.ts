import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 300_000,
    // Native imports avoid measuring Vite's module instrumentation overhead.
    experimental: {
      viteModuleRunner: false,
    },
    benchmark: {
      include: ['**/*.bench.ts'],
    },
  },
})
