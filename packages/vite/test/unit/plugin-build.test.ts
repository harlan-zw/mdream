import type { OutputAsset, RollupOutput } from 'rollup'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/index.js'

let root: string | undefined

afterEach(() => {
  if (root)
    rmSync(root, { recursive: true, force: true })
  root = undefined
})

describe('viteHtmlToMarkdownPlugin in a Vite build', () => {
  it('emits Markdown for built HTML when used without extra config', async () => {
    root = mkdtempSync(join(tmpdir(), 'mdream-vite-'))
    writeFileSync(join(root, 'index.html'), '<html><body><h1>Hello</h1><p>World</p></body></html>')

    const output = await build({
      root,
      logLevel: 'silent',
      configFile: false,
      build: { write: false },
      plugins: [viteHtmlToMarkdownPlugin()],
    }) as RollupOutput

    const markdown = output.output.find((file): file is OutputAsset => file.fileName === 'index.md')
    expect(markdown?.source).toBe('# Hello\n\nWorld')
  })
})
