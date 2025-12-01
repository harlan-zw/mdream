import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['./src/index.ts', './src/cli.ts', './src/llms-txt.ts', './src/plugins.ts', './src/preset/minimal.ts', './src/splitter.ts'],
    },
    {
      type: 'bundle',
      input: './src/iife.ts',
      minify: true,
    },
  ],
  hooks: {
    end(ctx) {
      // Create IIFE version of browser bundle
      const cwd = ctx?.cwd || process.cwd()
      const browserMjsPath = resolve(cwd, 'dist/iife.mjs')
      try {
        const iifeContent = readFileSync(browserMjsPath, 'utf-8').replace(/export\s*\{[^}]+\};\s*$/m, '')

        // Clean up browser ES module files (we only need the IIFE)
        try {
          unlinkSync(browserMjsPath)
          unlinkSync(browserMjsPath.replace('.mjs', '.d.mts'))
        }
        catch (error) {
          // Files might not exist, continue
        }

        // Ensure directory exists
        const browserDir = resolve(cwd, 'dist')
        mkdirSync(browserDir, { recursive: true })

        // Write IIFE bundle
        const outputPath = resolve(browserDir, 'iife.js')
        writeFileSync(outputPath, iifeContent)

        // Calculate sizes
        const uncompressedSize = iifeContent.length
        const gzippedSize = gzipSync(iifeContent).length

        console.log(`✅ Browser IIFE bundle created: ${outputPath}`)
        console.log(`Size: ${Math.round(uncompressedSize / 1024)}kB, ${Math.round(gzippedSize / 1024 * 10) / 10}kB gzipped`)
      }
      catch (error) {
        console.warn('Could not create IIFE bundle:', error.message)
      }
    },
  },
})
