import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCrawlArgs } from '../../src/cli-args.ts'
import { loadMdreamConfig } from '../../src/config.ts'
import { mergeCrawlOptions, resolveCrawlOptions } from '../../src/options.ts'

function configDir(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mdream-crawl-config-'))
  writeFileSync(join(dir, 'mdream.config.mjs'), source)
  return dir
}

function cliOptions(argv: string[]) {
  const command = parseCrawlArgs(argv)
  if (command._tag !== 'Crawl')
    throw new Error(`Expected a crawl command, received ${command._tag}`)
  return command.options
}

async function resolveCli(argv: string[], cwd: string) {
  return resolveCrawlOptions(mergeCrawlOptions(await loadMdreamConfig(cwd), cliOptions(argv)))
}

describe('parseCrawlArgs', () => {
  it('returns only the options the user set', () => {
    expect(parseCrawlArgs(['-u', 'example.com', '--verbose'])).toEqual({
      _tag: 'Crawl',
      options: { urls: ['example.com'], verbose: true },
    })
  })

  it('reads a positional URL after a switch', () => {
    expect(cliOptions(['--verbose', 'example.com']).urls).toEqual(['example.com'])
  })

  it('maps every flag to its option name', () => {
    expect(cliOptions([
      'https://example.com',
      '-o',
      'out',
      '-d',
      '2',
      '--driver',
      'playwright',
      '--artifacts',
      'llms.txt, markdown',
      '--origin',
      'https://cdn.example.com',
      '--site-name',
      'Example',
      '--description=About Example',
      '--max-pages',
      '50',
      '--crawl-delay',
      '0.5',
      '--exclude',
      '/admin/*',
      '--exclude',
      '/api/*',
      '--skip-sitemap',
      '--sitemap',
      'https://example.com/a.xml',
      '--allow-subdomains',
      '--keep-boilerplate',
      '--boilerplate-threshold',
      '0.7',
      '-q',
    ])).toEqual({
      urls: ['https://example.com'],
      output: 'out',
      depth: 2,
      driver: 'playwright',
      artifacts: ['llms.txt', 'markdown'],
      origin: 'https://cdn.example.com',
      siteName: 'Example',
      description: 'About Example',
      maxPages: 50,
      crawlDelay: 0.5,
      exclude: ['/admin/*', '/api/*'],
      skipSitemap: true,
      sitemap: ['https://example.com/a.xml'],
      allowSubdomains: true,
      stripBoilerplate: false,
      boilerplateThreshold: 0.7,
      silent: true,
    })
  })

  it('treats --single-page as depth 0, even after --depth', () => {
    expect(cliOptions(['-u', 'example.com', '--depth', '2', '--single-page']).depth).toBe(0)
  })

  it.each([
    [['-u', 'example.com', '--bogus'], 'Unknown flag "--bogus".'],
    [['-url', 'example.com'], 'Unknown flag "-url". Use "--url".'],
    [['-u', 'example.com', '-vq'], 'Unknown flag "-vq".'],
    [['-u', 'example.com', '--depth'], '"--depth" needs a value.'],
    [['-u', 'example.com', '--sitemap', '--verbose'], '"--sitemap" needs a value.'],
    [['-u', 'example.com', '--depth', 'deep'], '"--depth" needs a number. You gave "deep".'],
    [['-u', 'example.com', '--verbose=yes'], '"--verbose" takes no value.'],
  ])('rejects %j', (argv, message) => {
    const command = parseCrawlArgs(argv)

    expect(command).toEqual({ _tag: 'Invalid', message: expect.stringContaining(message) })
    expect(command._tag === 'Invalid' && command.message.includes('\n')).toBe(false)
  })

  it('starts interactive mode without arguments', () => {
    expect(parseCrawlArgs([])).toEqual({ _tag: 'Interactive' })
  })

  it('shows help before it reports other flag errors', () => {
    expect(parseCrawlArgs(['--bogus', '--help'])).toEqual({ _tag: 'Help' })
  })
})

describe('config file precedence', () => {
  it('applies config maxPages, artifacts, driver, and depth when no flag sets them', async () => {
    const cwd = configDir(`export default { maxPages: 2, artifacts: ['llms.txt'], driver: 'playwright', depth: 1 }\n`)

    const resolved = await resolveCli(['-u', 'example.com'], cwd)

    expect(resolved.maxPages).toBe(2)
    expect(resolved.artifacts).toEqual(['llms.txt'])
    expect(resolved.driver).toBe('playwright')
    expect(resolved.depth).toBe(1)
  })

  it('lets a CLI flag override the config file', async () => {
    const cwd = configDir(`export default { maxPages: 2, depth: 1, artifacts: ['llms.txt'], driver: 'playwright' }\n`)

    const resolved = await resolveCli(['-u', 'example.com', '--max-pages', '9', '--single-page', '--artifacts', 'markdown', '--driver', 'http'], cwd)

    expect(resolved.maxPages).toBe(9)
    expect(resolved.depth).toBe(0)
    expect(resolved.artifacts).toEqual(['markdown'])
    expect(resolved.driver).toBe('http')
  })

  it('appends CLI exclude patterns to the config patterns', async () => {
    const cwd = configDir(`export default { exclude: ['/admin/*'] }\n`)

    const resolved = await resolveCli(['-u', 'example.com', '--exclude', '/api/*'], cwd)

    expect(resolved.exclude).toEqual(['/admin/*', '/api/*'])
  })

  it('uses config URLs when the command line has none', async () => {
    const cwd = configDir(`export default { urls: ['https://docs.example.com'] }\n`)

    const resolved = await resolveCli(['--verbose'], cwd)

    expect(resolved.urls).toEqual(['https://docs.example.com'])
  })

  it('rejects a v1 key in the config file', async () => {
    const cwd = configDir(`export default { maxDepth: 2 }\n`)

    await expect(resolveCli(['-u', 'example.com'], cwd)).rejects.toThrow('Unknown crawl option "maxDepth". Use "depth" instead.')
  })
})
