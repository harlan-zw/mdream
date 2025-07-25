import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/minimal',
    'src/await',
    'src/await-fetch',
    'src/stream',
    'src/stream-fetch',
    'src/string',
  ],
  outDir: 'dist',
  failOnWarn: false,
  // rollup: {
  //   inlineDependencies: true,
  //   esbuild: {
  //     treeShaking: true,
  //     minify: true,
  //   },
  // },
  externals: [
    'cac',
  ],
  declaration: false,
  hooks: {
    'rollup:options': (ctx, config) => {
      config.experimentalLogSideEffects = true
    },
    'build:done': () => {
      const files = fs.readdirSync(path.resolve(__dirname, 'dist', 'shared'))
      files.forEach((file) => {
        const contents = fs.readFileSync(path.resolve(__dirname, 'dist', 'shared', file))
        const size = contents.length
        const compressed = zlib.gzipSync(contents).length
        // show as kB size instead of bytes
        // round to 1 decimal place
        console.log(`Size: ${Math.round(size / 102.4) / 10} kB (gzipped: ${Math.round(compressed / 102.4) / 10} kB)`)
      })
    },
  },
})
