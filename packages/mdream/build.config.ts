import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['./src/index.ts', './src/cli.ts', './src/llms-txt.ts', './src/plugins.ts', './src/preset/minimal.ts'],
    },
    {
      input: './src/browser.ts',
      outdir: './dist/browser',
      format: 'iife',
      name: 'MDream',
      minify: true,
      rollup: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  ],
})
