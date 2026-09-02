import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        './src/index.ts',
        './src/text.ts',
        './src/html.ts',
        './src/negotiate.ts',
        './src/plugins.ts',
        './src/preset/minimal.ts',
        './src/splitter.ts',
        './src/parse.ts',
        './src/cli.ts',
        './src/llms-txt.ts',
      ],
    },
  ],
})
