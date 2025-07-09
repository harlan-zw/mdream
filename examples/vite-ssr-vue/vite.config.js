import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Disable plugin middleware for SSR - we handle .md routes in server.js
    {
      ...viteHtmlToMarkdownPlugin({
        verbose: true,
        cacheEnabled: true,
        cacheTtl: 60000,
        // outputDir defaults to '' (same directory as HTML files)
        // preserveStructure defaults to true
      }),
      configureServer: undefined, // Disable dev server middleware
      configurePreviewServer: undefined, // Disable preview server middleware
    },
  ],
  server: {
    port: 5173,
  },
})
