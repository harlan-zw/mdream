import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { preview } from 'vite'
import { expect, it } from 'vitest'

it.each(['default', 'relative', 'absolute'])('serves preview Markdown with a custom root and %s output directory', async (kind) => {
  const root = await mkdtemp(join(tmpdir(), 'mdream-preview-'))
  const output = join(root, kind === 'default' ? 'dist' : 'build')
  await mkdir(join(output, 'about'), { recursive: true })
  await writeFile(join(output, 'about/index.html'), '<h1>Preview page</h1><p>Built content</p>')
  const server = await preview({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [viteHtmlToMarkdownPlugin()],
    build: kind === 'default' ? undefined : { outDir: kind === 'absolute' ? output : 'build' },
    preview: { host: '127.0.0.1', port: 0, open: false },
  })
  try {
    const address = server.httpServer.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP address')
    const origin = `http://127.0.0.1:${address.port}`
    for (const [path, accept] of [['/about.md', '*/*'], ['/about', 'text/markdown']]) {
      const response = await fetch(origin + path, { headers: { Accept: accept! } })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/markdown')
      expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
      expect(await response.text()).toBe('# Preview page\n\nBuilt content')
    }
    const cached = await fetch(`${origin}/about.md`)
    expect(cached.headers.get('x-markdown-cached')).toBe('true')
    expect(await cached.text()).toBe('# Preview page\n\nBuilt content')
    const missing = await fetch(`${origin}/missing.md`)
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe('HTML content not found for /missing.md')
  }
  finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
