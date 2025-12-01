import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  optimizeDeps: {
    exclude: ['lightningcss'],
  },
  test: {
    projects: [
      defineProject({
        test: {
          name: 'unit',
          environment: 'node',
          include: ['./test/unit/**/*.test.ts', './src/**/*.test.ts'],
        },
      }),
      defineProject({
        test: {
          name: 'e2e',
          include: ['./test/e2e/**/*.test.ts'],
          setupFiles: ['./test/setup.ts'],
        },
      }),
    ],
  },
})
