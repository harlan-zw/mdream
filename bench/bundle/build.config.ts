import { rmSync } from 'node:fs'
import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: './fixtures/core.ts',
      outDir: './dist/core',
      minify: true,
      dts: false,
      license: false,
    },
    {
      type: 'bundle',
      input: './fixtures/minimal.ts',
      outDir: './dist/minimal',
      minify: true,
      dts: false,
      license: false,
    },
    {
      type: 'bundle',
      input: './fixtures/stream.ts',
      outDir: './dist/stream',
      minify: true,
      dts: false,
      license: false,
    },
  ],
  hooks: {
    start() {
      rmSync(new URL('./dist', import.meta.url), { force: true, recursive: true })
    },
  },
})
