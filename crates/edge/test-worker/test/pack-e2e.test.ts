import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, createNitro } from 'nitropack/core'
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
      'compatibility_flags = ["nodejs_compat"]',
    ].join('\n'))
    writeFileSync(join(tmp, 'src/index.mjs'), `
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'

const isolationOptions = {
  minimal: true,
  isolateMain: true,
  filter: { exclude: ['nav', 'footer'] },
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/options' && request.method === 'POST') {
      return new Response(htmlToMarkdown(await request.text(), isolationOptions))
    }
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

  it('converts HTML after Nitro bundles the packaged edge entry', async () => {
    const handler = join(tmp, 'src/nitro-handler.mjs')
    writeFileSync(handler, `
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'
export default async (event) => {
  if (event.path.endsWith('/stream')) {
    const html = new ReadableStream({ start(controller) {
      controller.enqueue('<h1>Stream</h1><ul><li>One</li><li>Two</li></ul>')
      controller.close()
    } })
    let markdown = ''
    for await (const chunk of streamHtmlToMarkdown(html)) markdown += chunk
    return markdown
  }
  return htmlToMarkdown('<h1>Hello</h1><p>World</p>')
}
`)
    const warnings: string[] = []
    const nitro = await createNitro({
      rootDir: tmp,
      preset: 'cloudflare_module',
      compatibilityDate: '2025-03-14',
      experimental: { wasm: true },
      cloudflare: { nodeCompat: true },
      handlers: [{ route: '/api/**', handler }],
      rollupConfig: { onwarn(warning, handler) {
        warnings.push(warning.message)
        handler(warning)
      } },
    })
    try {
      await build(nitro)
    }
    finally {
      await nitro.close()
    }
    expect(warnings).not.toContainEqual(expect.stringContaining('Failed to load the WebAssembly module'))
    const worker = await unstable_dev(join(tmp, '.output/server/index.mjs'), {
      config: join(tmp, 'wrangler.toml'),
      experimental: { disableExperimentalWarning: true },
    })
    try {
      const res = await worker.fetch('/api/convert', { signal: AbortSignal.timeout(15000) })
      expect(await res.text()).toBe('# Hello\n\nWorld')
      const streamRes = await worker.fetch('/api/stream', { signal: AbortSignal.timeout(15000) })
      expect(await streamRes.text()).toBe('# Stream\n\n- One\n- Two')
    }
    finally {
      await worker.stop()
    }
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

      const optionsHtml = '<!DOCTYPE html><html><head><title>Edge Options</title></head><body><div>Outside chrome</div><main><nav>Inside nav</nav><h1>Real Content</h1><p><a href="#">Empty link</a></p></main><footer>Footer junk</footer></body></html>'
      const optionsRes = await worker.fetch('/options', {
        method: 'POST',
        body: optionsHtml,
      })
      expect(await optionsRes.text()).toBe('---\ntitle: "Edge Options"\n---\n\n# Real Content\n\nEmpty link')
    }
    finally {
      await worker.stop()
    }
  })
})
