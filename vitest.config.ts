import { playwright } from '@vitest/browser-playwright'
import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  optimizeDeps: {
    exclude: ['lightningcss'],
  },
  test: {
    projects: [
      defineProject({
        test: {
          name: 'node',
          environment: 'node',
          include: ['./packages/mdream/test/unit/**/*.test.ts', './packages/mdream/test/integration/**/*.test.ts', './packages/vite/test/unit/**/*.test.ts', './packages/crawl/test/unit/**/*.test.ts'],
          exclude: ['**/*.browser.test.ts'],
        },
      }),
      defineProject({
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
            ],
            headless: true,
            screenshotFailures: true,
          },
          include: ['**/*.browser.test.ts'],
        },
      }),
    ],
  },
})
