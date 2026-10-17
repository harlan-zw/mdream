import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { preview } from 'vite'
import { expect, it } from 'vitest'

it('decodes preview filenames once and preserves encoded path separators', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mdream-preview-encoded-'))
  const output = join(root, 'dist')
  const files = [
    ['café.html', '/caf%C3%A9', 'Unicode'],
    ['two words.html', '/two%20words', 'Space'],
    ['hash#&.html', '/hash%23%26', 'Reserved'],
    ['100%.html', '/100%25', 'Percent'],
    ['literal%20.html', '/literal%2520', 'Once'],
    ['nested/café/index.html', '/nested/caf%C3%A9', 'Nested'],
    ['literal%2Fpage.html', '/literal%2Fpage', 'Encoded slash'],
    ['literal%5Cpage.html', '/literal%5Cpage', 'Encoded backslash'],
  ] as const
  for (const [file, , heading] of files) {
    await mkdir(dirname(join(output, file)), { recursive: true })
    await writeFile(join(output, file), `<h1>${heading}</h1>`)
  }
  const server = await preview({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [viteHtmlToMarkdownPlugin()],
    preview: { host: '127.0.0.1', port: 0, open: false },
  })
  try {
    const address = server.httpServer.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP address')
    const origin = `http://127.0.0.1:${address.port}`
    for (const [, path, heading] of files) {
      for (const extension of ['.md', '']) {
        const response = await fetch(`${origin}${path}${extension}?source=preview`, { headers: { Accept: 'text/markdown' } })
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/markdown')
        expect(await response.text()).toBe(`# ${heading}`)
      }
    }
  }
  finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

it('does not resolve encoded separators or malformed escapes as preview file paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mdream-preview-separators-'))
  const output = join(root, 'dist')
  await mkdir(join(output, 'nested'), { recursive: true })
  await writeFile(join(output, 'nested/secret.html'), '<h1>Nested file</h1>')
  await writeFile(join(root, 'private.html'), '<h1>Outside output</h1>')
  await writeFile(join(root, 'index.html'), '<h1>Outside index</h1>')
  await writeFile(join(output, 'healthy.html'), '<h1>Healthy</h1>')
  const server = await preview({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [viteHtmlToMarkdownPlugin()],
    preview: { host: '127.0.0.1', port: 0, open: false },
  })
  try {
    const address = server.httpServer.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP address')
    const origin = `http://127.0.0.1:${address.port}`
    for (const path of ['/%2e%2e', '/.%2E', '/..', '/nested%2Fsecret', '/nested%5Csecret', '/..%2Fprivate', '/..%5Cprivate', '/%2e%2e%2fprivate', '/%252e%252e%252fprivate', '/%E0%A4%A', '/%ZZ']) {
      const response = await fetch(`${origin}${path}.md`)
      expect(response.status).toBe(404)
      expect(await response.text()).not.toContain('<h1>')
    }
    const response = await fetch(`${origin}/healthy.md`)
    expect(await response.text()).toBe('# Healthy')
  }
  finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

it('resolves Markdown requests with query strings to the requested preview page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mdream-preview-query-'))
  const output = join(root, 'dist')
  await mkdir(join(output, 'contact'), { recursive: true })
  await writeFile(join(output, 'index.html'), '<h1>Home</h1>')
  await writeFile(join(output, 'about.html'), '<h1>About</h1>')
  await writeFile(join(output, 'contact/index.html'), '<h1>Contact</h1>')
  const server = await preview({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [viteHtmlToMarkdownPlugin()],
    preview: { host: '127.0.0.1', port: 0, open: false },
  })
  try {
    const address = server.httpServer.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP address')
    const origin = `http://127.0.0.1:${address.port}`
    for (const [page, expected] of [['about', 'About'], ['contact', 'Contact'], ['index', 'Home']]) {
      for (const [path, accept] of [[`/${page}.md?utm_source=llm`, '*/*'], [`/${page}?query=other`, 'text/markdown']]) {
        const response = await fetch(origin + path, { headers: { Accept: accept! } })
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/markdown')
        expect(await response.text()).toBe(`# ${expected}`)
      }
    }
  }
  finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

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
