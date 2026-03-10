import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: './src/index.ts' },
    { type: 'bundle', input: './src/cli.ts' },
    { type: 'bundle', input: './src/llms-txt.ts' },
    { type: 'bundle', input: './src/negotiate.ts' },
    { type: 'bundle', input: './src/plugins.ts' },
    { type: 'bundle', input: './src/preset/minimal.ts' },
    { type: 'bundle', input: './src/splitter.ts' },
    { type: 'bundle', input: './src/parse.ts' },
  ],
})
