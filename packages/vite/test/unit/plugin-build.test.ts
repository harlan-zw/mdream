import type { OutputAsset, RollupOutput } from 'rollup'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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
  it.each([
    ['docs.html/page.html', 'docs.html/page.md'],
    ['page.html.html', 'page.html.md'],
    ['page.html', 'page.md'],
  ])('replaces only the final HTML extension in %s', async (fileName, markdownFileName) => {
    root = mkdtempSync(join(tmpdir(), 'mdream-vite-'))
    const input = join(root, fileName)
    mkdirSync(dirname(input), { recursive: true })
    writeFileSync(input, '<html><body><h1>Hello</h1><p>World</p></body></html>')

    const output = await build({
      root,
      logLevel: 'silent',
      configFile: false,
      build: { write: false, rollupOptions: { input } },
      plugins: [viteHtmlToMarkdownPlugin({ include: [fileName] })],
    }) as RollupOutput

    expect(output.output.map(file => file.fileName).sort()).toEqual([fileName, markdownFileName].sort())
    const markdown = output.output.find((file): file is OutputAsset => file.fileName === markdownFileName)
    expect(markdown?.source).toBe('# Hello\n\nWorld')
  })

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
