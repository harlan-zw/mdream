import { defineBuildConfig } from 'obuild/config'

const rolldown = {
  external: [/\.\.\/napi\//],
}

const rolldownWasm = {
  external: [/\.\.\/wasm\//],
}

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: './src/index.ts', rolldown },
    { type: 'bundle', input: './src/browser.ts', rolldown: rolldownWasm },
    { type: 'bundle', input: './src/edge.ts', rolldown: rolldownWasm },
  ],
})
