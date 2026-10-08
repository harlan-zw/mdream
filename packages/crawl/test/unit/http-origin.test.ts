import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crawlAndGenerate } from '@mdream/crawl'
import { expect, it } from 'vitest'

it.each(['', '/docs/**'])('preserves HTTP origins when crawling %s and following links', async (pattern) => {
  const output = await mkdtemp(join(tmpdir(), 'mdream-http-'))
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.end(request.url === '/docs/guide'
      ? '<main><h1>Guide</h1><p>Guide content</p></main>'
      : '<main><h1>Home</h1><a href="/docs/guide">Guide</a></main>')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP address')
    const origin = `http://127.0.0.1:${address.port}`
    const results = await crawlAndGenerate({
      urls: [origin + pattern],
      output,
      depth: 1,
      maxPages: 2,
      skipSitemap: true,
      artifacts: [],
      silent: true,
    })
    expect(results).toHaveLength(2)
    expect(results.every(result => result.success)).toBe(true)
    expect(results.find(result => result.url === `${origin}/docs/guide`)?.content).toContain('Guide content')
  }
  finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(output, { recursive: true, force: true })
  }
})
