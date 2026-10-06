import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      defineProject({
        // Nuxt sets this flag in every build. The composables run client side.
        define: { 'import.meta.client': 'true' },
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
