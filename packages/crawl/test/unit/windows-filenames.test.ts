import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { crawlAndGenerate } from '../../src/index.ts'

vi.mock('ofetch', () => ({
  ofetch: Object.assign(async () => '', {
    raw: async (url: string) => ({
      _data: `<html><head><title>Page</title></head><body><pre>Content for ${url}</pre></body></html>`,
      headers: new Headers({ 'content-type': 'text/html' }),
    }),
  }),
}))

async function crawlPaths(paths: string[], expectedPaths: string[], host = 'example.com', allowSubdomains = false) {
  const output = await mkdtemp(join(tmpdir(), 'mdream-windows-filenames-'))
  try {
    const urls = paths.map(path => `https://${host}${path}`)
    const results = await crawlAndGenerate({
      urls,
      output,
      depth: 0,
      artifacts: ['markdown', 'llms.txt'],
      silent: true,
      stripBoilerplate: false,
      allowSubdomains,
    })
    expect(results.map(result => result.success)).toEqual(paths.map(() => true))
    expect(results.map(result => result.filePath)).toEqual(expectedPaths.map(path => join(output, path)))
    for (const [index, path] of expectedPaths.entries()) {
      const markdown = await readFile(join(output, path), 'utf8')
      expect(markdown).toContain(`Content for ${urls[index]}`)
    }
    const llmsTxt = await readFile(join(output, 'llms.txt'), 'utf8')
    const links = [...llmsTxt.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1])
    expect(links.sort()).toEqual([...expectedPaths].sort())
  }
  finally {
    await rm(output, { recursive: true, force: true })
  }
}

describe('portable crawler output paths', () => {
  it.each([
    ['/CON', '~CON.md'],
    ['/con', '~con.md'],
    ['/PRN', '~PRN.md'],
    ['/AUX', '~AUX.md'],
    ['/nul', '~nul.md'],
    ['/COM1', '~COM1.md'],
    ['/LPT9', '~LPT9.md'],
    ['/aux/CoM9', '~aux/~CoM9.md'],
    ['/Nul/LpT1/guide', '~Nul/~LpT1/guide.md'],
    ['/_CON', '_CON.md'],
    ['/-CON', '-CON.md'],
    ['/~CON', '-CON.md'],
    ['/con.txt', 'con-txt.md'],
    ['/COM10', 'COM10.md'],
    ['/auxiliary', 'auxiliary.md'],
  ])('writes %s to %s and links to that file', async (path, output) => {
    await crawlPaths([path], [output])
  })

  it('escapes reserved hostname namespaces', async () => {
    await crawlPaths(['/guide'], ['~aux/guide.md'], 'aux', true)
  })

  it('keeps escaped device names distinct from existing sanitized paths', async () => {
    await crawlPaths(['/CON', '/~CON', '/_CON'], ['~CON.md', '-CON.md', '_CON.md'])
  })
})
