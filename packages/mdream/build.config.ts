import { defineBuildConfig } from 'obuild/config'
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { gzipSync } from 'zlib'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['./src/index.ts', './src/cli.ts', './src/llms-txt.ts', './src/plugins.ts', './src/preset/minimal.ts'],
    },
    {
      type: 'bundle',
      input: './src/browser.ts',
      name: 'browser',
      minify: true,
    },
  ],
  hooks: {
    end(ctx) {
      // Create IIFE version of browser bundle
      const cwd = ctx?.cwd || process.cwd()
      const browserMjsPath = resolve(cwd, 'dist/browser.mjs')
      try {
        const browserContent = readFileSync(browserMjsPath, 'utf-8')

        // Create IIFE wrapper
        const iifeContent = `(function() {
'use strict';

${browserContent.replace(/^export \{[^}]+\};\s*$/m, '')}

// Expose mdream globally
if (typeof window !== 'undefined') {
  window.mdream = mdream;
}

})();`

        // Clean up browser ES module files (we only need the IIFE)
        try {
          unlinkSync(browserMjsPath)
          unlinkSync(browserMjsPath.replace('.mjs', '.d.mts'))
        } catch (error) {
          // Files might not exist, continue
        }

        // Ensure directory exists
        const browserDir = resolve(cwd, 'dist/browser')
        mkdirSync(browserDir, { recursive: true })

        // Write IIFE bundle
        const outputPath = resolve(browserDir, 'browser.js')
        writeFileSync(outputPath, iifeContent)

        // Calculate sizes
        const uncompressedSize = iifeContent.length
        const gzippedSize = gzipSync(iifeContent).length

        console.log(`✅ Browser IIFE bundle created: ${outputPath}`)
        console.log(`Size: ${Math.round(uncompressedSize / 1024)}kB, ${Math.round(gzippedSize / 1024 * 10) / 10}kB gzipped`)
      } catch (error) {
        console.warn('Could not create IIFE bundle:', error.message)
      }
    },
  },
})
