import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/minimal',
  ],
  outDir: 'dist',
  failOnWarn: false,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      treeShaking: true,
      minify: true,
    },
  },
  externals: [
    'cac',
  ],
  declaration: false,
  hooks: {
    'rollup:options': (ctx, config) => {
      config.experimentalLogSideEffects = true
    },
    'build:done': () => {
      // check gzip size of ./dist/minimal.mjs
      const file = path.resolve(__dirname, 'dist/minimal.mjs')
      const contents = fs.readFileSync(file)
      const size = contents.length
      const compressed = zlib.gzipSync(contents).length
      // show as kB size instead of bytes
      // round to 1 decimal place
      console.log(`Size: ${Math.round(size / 102.4) / 10} kB (gzipped: ${Math.round(compressed / 102.4) / 10} kB)`)
    },
  },
})
