import type { OutputChunk, RollupOutput } from 'rollup'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

// This test lives in @mdream/vite because it needs Vite, and it bundles
// mdream the way a Vite client build does.
const root = fileURLToPath(new URL('../fixtures/mdream-client', import.meta.url))

async function clientModules(entry: string): Promise<string[]> {
  const output = await build({
    root,
    logLevel: 'silent',
    configFile: false,
    build: { write: false, lib: { entry, formats: ['es'], fileName: 'entry' } },
  }) as RollupOutput[]
  return output.flatMap(({ output }) => output)
    .filter((file): file is OutputChunk => file.type === 'chunk')
    .flatMap(chunk => chunk.moduleIds)
}

function isMdreamModule(id: string): boolean {
  return id.includes('/packages/mdream/') || id.includes('/node_modules/mdream/')
}

describe('mdream in a Vite client build', () => {
  it('drops mdream when shared code never calls it in the browser', async () => {
    expect((await clientModules('shared.js')).filter(isMdreamModule)).toEqual([])
  })

  it('keeps the browser engine when client code calls it', async () => {
    expect((await clientModules('used.js')).some(isMdreamModule)).toBe(true)
  })
})
