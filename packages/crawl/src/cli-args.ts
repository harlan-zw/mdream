import type { CrawlArtifact, CrawlDriver, CrawlOptions } from './types.ts'

/** What the command line asks for. `Crawl` holds only the options the user set. */
export type CliCommand
  = | { _tag: 'Help' }
    | { _tag: 'Version' }
    | { _tag: 'Interactive' }
    | { _tag: 'Crawl', options: Partial<CrawlOptions> }
    | { _tag: 'Invalid', message: string }

type FlagSpec
  = | { _tag: 'Switch', apply: (options: Partial<CrawlOptions>) => void }
    | { _tag: 'Text', apply: (options: Partial<CrawlOptions>, value: string) => void }
    | { _tag: 'Number', apply: (options: Partial<CrawlOptions>, value: number) => void }

function toList(value: string | string[] | undefined): string[] {
  if (value === undefined)
    return []
  return typeof value === 'string' ? [value] : value
}

function addUrl(options: Partial<CrawlOptions>, url: string): void {
  options.urls = [...(options.urls ?? []), url]
}

// Each long flag is the kebab-case name of the option it sets. Value checks
// (ranges, artifact names, drivers) belong to resolveCrawlOptions.
const FLAGS: Record<string, FlagSpec> = {
  '--url': { _tag: 'Text', apply: addUrl },
  '--output': { _tag: 'Text', apply: (o, v) => { o.output = v } },
  '--depth': { _tag: 'Number', apply: (o, v) => { o.depth = v } },
  // Handled in parseCrawlArgs so it wins over --depth in any order.
  '--single-page': { _tag: 'Switch', apply: () => {} },
  '--driver': { _tag: 'Text', apply: (o, v) => { o.driver = v as CrawlDriver } },
  '--artifacts': { _tag: 'Text', apply: (o, v) => { o.artifacts = v.split(',').map(a => a.trim()) as CrawlArtifact[] } },
  '--origin': { _tag: 'Text', apply: (o, v) => { o.origin = v } },
  '--site-name': { _tag: 'Text', apply: (o, v) => { o.siteName = v } },
  '--description': { _tag: 'Text', apply: (o, v) => { o.description = v } },
  '--max-pages': { _tag: 'Number', apply: (o, v) => { o.maxPages = v } },
  '--crawl-delay': { _tag: 'Number', apply: (o, v) => { o.crawlDelay = v } },
  '--exclude': { _tag: 'Text', apply: (o, v) => { o.exclude = [...(o.exclude ?? []), v] } },
  '--skip-sitemap': { _tag: 'Switch', apply: (o) => { o.skipSitemap = true } },
  '--sitemap': { _tag: 'Text', apply: (o, v) => { o.sitemap = [...toList(o.sitemap), v] } },
  '--allow-subdomains': { _tag: 'Switch', apply: (o) => { o.allowSubdomains = true } },
  '--keep-boilerplate': { _tag: 'Switch', apply: (o) => { o.stripBoilerplate = false } },
  '--boilerplate-threshold': { _tag: 'Number', apply: (o, v) => { o.boilerplateThreshold = v } },
  '--verbose': { _tag: 'Switch', apply: (o) => { o.verbose = true } },
  '--quiet': { _tag: 'Switch', apply: (o) => { o.silent = true } },
  '--silent': { _tag: 'Switch', apply: (o) => { o.silent = true } },
}

const SHORT_FLAGS: Record<string, string> = {
  '-u': '--url',
  '-o': '--output',
  '-d': '--depth',
  '-v': '--verbose',
  '-q': '--quiet',
}

function invalid(message: string): CliCommand {
  return { _tag: 'Invalid', message }
}

function unknownFlag(flag: string): CliCommand {
  // A single-dash long form such as -url. Name the flag the user meant.
  if (flag[1] !== '-' && Object.hasOwn(FLAGS, `-${flag}`))
    return invalid(`Unknown flag "${flag}". Use "-${flag}".`)
  return invalid(`Unknown flag "${flag}". Run "mdream-crawl --help" to list the flags.`)
}

function isFlag(arg: string): boolean {
  return arg.startsWith('--') || Object.hasOwn(SHORT_FLAGS, arg)
}

/**
 * Parse CLI arguments. Pure: it does not read the config file, log, or exit.
 * An unknown flag, a single-dash long flag, or a flag without its value gives
 * `Invalid` with a one-line message.
 */
export function parseCrawlArgs(argv: string[]): CliCommand {
  if (argv.length === 0)
    return { _tag: 'Interactive' }
  if (argv.includes('--help') || argv.includes('-h'))
    return { _tag: 'Help' }
  if (argv.includes('--version'))
    return { _tag: 'Version' }

  const options: Partial<CrawlOptions> = {}
  let singlePage = false
  let positionalOnly = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (positionalOnly || arg[0] !== '-') {
      addUrl(options, arg)
      continue
    }
    if (arg === '--') {
      positionalOnly = true
      continue
    }

    const equals = arg.startsWith('--') ? arg.indexOf('=') : -1
    const written = equals === -1 ? arg : arg.slice(0, equals)
    const name = Object.hasOwn(SHORT_FLAGS, written) ? SHORT_FLAGS[written] : written
    if (!Object.hasOwn(FLAGS, name))
      return unknownFlag(written)
    const spec = FLAGS[name]

    if (spec._tag === 'Switch') {
      if (equals !== -1)
        return invalid(`"${written}" takes no value.`)
      if (name === '--single-page')
        singlePage = true
      spec.apply(options)
      continue
    }

    let value: string
    if (equals !== -1) {
      value = arg.slice(equals + 1)
    }
    else {
      const next = argv[i + 1]
      if (next === undefined || isFlag(next))
        return invalid(`"${written}" needs a value.`)
      value = next
      i++
    }

    if (spec._tag === 'Number') {
      const number = Number(value)
      if (value.trim() === '' || Number.isNaN(number))
        return invalid(`"${written}" needs a number. You gave ${JSON.stringify(value)}.`)
      spec.apply(options, number)
    }
    else {
      spec.apply(options, value)
    }
  }

  if (singlePage)
    options.depth = 0
  return { _tag: 'Crawl', options }
}
