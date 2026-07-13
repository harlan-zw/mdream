import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { unstable_dev } from 'wrangler'

// End-to-end regression for #119: pack the real npm tarball, install it into a
// fresh Worker project, and run it through wrangler's own bundling in workerd.
// This catches both runtime breakage (wasm init) and packaging breakage
// (wasm/ missing from the tarball, e.g. wasm-pack's generated .gitignore).
const pkgDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../packages/mdream')

describe('mdream npm tarball in wrangler dev (#119)', () => {
  let tmp: string
  let tarballFiles: string[]

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mdream-workerd-e2e-'))
    const tarball = join(tmp, 'mdream.tgz')
    execSync(`pnpm pack --out ${JSON.stringify(tarball)}`, { cwd: pkgDir, stdio: 'pipe' })
    tarballFiles = execSync(`tar -tzf ${JSON.stringify(tarball)}`, { encoding: 'utf-8' })
      .trim()
      .split('\n')

    // Extract the tarball as node_modules/mdream, exactly like npm install would
    mkdirSync(join(tmp, 'node_modules'), { recursive: true })
    execSync(`tar -xzf ${JSON.stringify(tarball)} -C ${JSON.stringify(tmp)}`)
    renameSync(join(tmp, 'package'), join(tmp, 'node_modules/mdream'))

    mkdirSync(join(tmp, 'src'))
    writeFileSync(join(tmp, 'wrangler.toml'), [
      'name = "mdream-workerd-repro"',
      'main = "src/index.mjs"',
      'compatibility_date = "2025-03-14"',
    ].join('\n'))
    writeFileSync(join(tmp, 'src/index.mjs'), `
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/stream' && request.method === 'POST') {
      let md = ''
      for await (const chunk of streamHtmlToMarkdown(request.body)) {
        md += chunk
      }
      return new Response(md)
    }
    return new Response(htmlToMarkdown('<h1>Hello</h1><p>World</p>'))
  },
}
`)
  })

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('ships the wasm runtime files in the tarball', () => {
    expect(tarballFiles).toContain('package/dist/edge.mjs')
    expect(tarballFiles).toContain('package/wasm/mdream_edge.js')
    expect(tarballFiles).toContain('package/wasm/mdream_edge_bg.wasm')
  })

  it('converts and streams HTML in workerd via the workerd export condition', async () => {
    const worker = await unstable_dev(join(tmp, 'src/index.mjs'), {
      config: join(tmp, 'wrangler.toml'),
      experimental: { disableExperimentalWarning: true },
    })
    try {
      const res = await worker.fetch('/')
      expect(await res.text()).toBe('# Hello\n\nWorld')

      const streamRes = await worker.fetch('/stream', {
        method: 'POST',
        body: '<h1>Stream</h1><ul><li>One</li><li>Two</li></ul>',
      })
      const md = await streamRes.text()
      expect(md).toContain('# Stream')
      expect(md).toContain('- One')
      expect(md).toContain('- Two')
    }
    finally {
      await worker.stop()
    }
  })
})
