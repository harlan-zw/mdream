import type { CrawlLogger } from './logger.ts'
import type { CrawlArtifact, CrawlDriver, CrawlOptions, ParsedUrlPattern } from './types.ts'
import { normalize, resolve } from 'pathe'
import { withHttps } from 'ufo'
import { DEFAULT_BOILERPLATE_THRESHOLD } from './boilerplate.js'
import { parseUrlPattern, validateGlobPattern } from './glob-utils.js'
import { resolveLogger } from './logger.js'

export const CRAWL_ARTIFACTS: readonly CrawlArtifact[] = ['llms.txt', 'llms-full.txt', 'markdown']
const CRAWL_DRIVERS: readonly CrawlDriver[] = ['http', 'playwright']
/** Highest accepted `depth`. */
export const MAX_CRAWL_DEPTH = 10

/** Defaults for every caller: the library, the config file, and the CLI. */
export const CRAWL_DEFAULTS = {
  output: 'output',
  depth: 3,
  driver: 'http' as CrawlDriver,
  artifacts: CRAWL_ARTIFACTS,
  boilerplateThreshold: DEFAULT_BOILERPLATE_THRESHOLD,
}

/** Options after defaults and validation. The crawler trusts this shape. */
export interface ResolvedCrawlOptions {
  urls: string[]
  patterns: ParsedUrlPattern[]
  /** Absolute output directory. */
  output: string
  depth: number
  /** `Infinity` when no limit is set. */
  maxPages: number
  /** Explicit sitemap URLs. Empty means auto-discovery. */
  sitemap: string[]
  artifacts: CrawlArtifact[]
  siteName: string | undefined
  description: string | undefined
  origin: string | undefined
  driver: CrawlDriver
  useChrome: boolean
  exclude: string[]
  /** `undefined` lets robots.txt set the delay. */
  crawlDelay: number | undefined
  skipSitemap: boolean
  allowSubdomains: boolean
  stripBoilerplate: boolean
  boilerplateThreshold: number
  verbose: boolean
  logger: CrawlLogger
  hooks: CrawlOptions['hooks']
}

// A Record keyed by every option, so adding an option without listing it here
// fails the typecheck.
const OPTION_KEYS: Record<keyof CrawlOptions, true> = {
  urls: true,
  output: true,
  depth: true,
  maxPages: true,
  sitemap: true,
  artifacts: true,
  siteName: true,
  description: true,
  origin: true,
  driver: true,
  useChrome: true,
  exclude: true,
  crawlDelay: true,
  skipSitemap: true,
  allowSubdomains: true,
  stripBoilerplate: true,
  boilerplateThreshold: true,
  verbose: true,
  silent: true,
  logger: true,
  hooks: true,
  globPatterns: true,
}

const ARTIFACTS_HINT = 'Use "artifacts" instead, for example artifacts: [\'llms.txt\', \'markdown\'].'

/** v1 option names and what replaces each one. */
const REMOVED_OPTIONS: Record<string, string> = {
  maxRequestsPerCrawl: 'Use "maxPages" instead.',
  maxDepth: 'Use "depth" instead.',
  followLinks: 'Use "depth" instead. Set depth to 0 to process only the given URLs.',
  sitemapUrls: 'Use "sitemap" instead.',
  generateLlmsTxt: ARTIFACTS_HINT,
  generateLlmsFullTxt: ARTIFACTS_HINT,
  generateIndividualMd: ARTIFACTS_HINT,
  siteNameOverride: 'Use "siteName" instead.',
  descriptionOverride: 'Use "description" instead.',
  outputDir: 'Use "output" instead.',
  chunkSize: 'Remove it. It had no effect.',
  onPage: 'Use hooks: { \'crawl:page\': fn } instead.',
}

type RawOptions = Record<string, unknown>

function fail(message: string): never {
  throw new TypeError(message)
}

function show(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

/**
 * Throw a `TypeError` that names every unknown option key. A removed v1 key
 * names its replacement. Keys set to `undefined` are skipped.
 */
export function assertCrawlOptionKeys(options: object): void {
  const lines: string[] = []
  let hasTypo = false
  for (const key in options) {
    if ((options as RawOptions)[key] === undefined || key in OPTION_KEYS)
      continue
    const hint = REMOVED_OPTIONS[key]
    if (hint === undefined)
      hasTypo = true
    lines.push(hint === undefined ? `Unknown crawl option ${show(key)}.` : `Unknown crawl option ${show(key)}. ${hint}`)
  }
  if (lines.length === 0)
    return
  if (hasTypo)
    lines.push(`Valid options: ${Object.keys(OPTION_KEYS).join(', ')}.`)
  fail(lines.join('\n'))
}

/** Return an error message when the crawl URL or glob pattern is not valid. */
export function validateCrawlUrl(url: string): string | undefined {
  const globError = validateGlobPattern(url)
  if (globError)
    return globError
  if (!parseUrlPattern(url).isGlob && !URL.canParse(withHttps(url)))
    return `Invalid URL: ${show(url)}.`
  return undefined
}

function readBoolean(raw: RawOptions, key: keyof CrawlOptions, fallback: boolean): boolean {
  const value = raw[key]
  if (value === undefined)
    return fallback
  if (typeof value !== 'boolean')
    fail(`"${key}" must be true or false. You gave ${show(value)}.`)
  return value
}

function readString(raw: RawOptions, key: keyof CrawlOptions): string | undefined {
  const value = raw[key]
  if (value !== undefined && typeof value !== 'string')
    fail(`"${key}" must be a string. You gave ${show(value)}.`)
  return value
}

function readStrings(raw: RawOptions, key: keyof CrawlOptions): string[] | undefined {
  const value = raw[key]
  if (value === undefined)
    return undefined
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string'))
    fail(`"${key}" must be an array of strings.`)
  return value
}

function readObject<T>(raw: RawOptions, key: keyof CrawlOptions): T | undefined {
  const value = raw[key]
  if (value !== undefined && (typeof value !== 'object' || value === null))
    fail(`"${key}" must be an object.`)
  return value as T | undefined
}

function readUrls(raw: RawOptions): string[] {
  const urls = readStrings(raw, 'urls')
  if (!urls || urls.length === 0)
    fail('"urls" must be a non-empty array of URLs.')
  for (const url of urls) {
    const error = validateCrawlUrl(url)
    if (error)
      fail(error)
  }
  return urls
}

function readSitemap(raw: RawOptions): string[] {
  const value = raw.sitemap
  if (value === undefined)
    return []
  const list = typeof value === 'string' ? [value] : value
  if (!Array.isArray(list) || !list.every(item => typeof item === 'string'))
    fail('"sitemap" must be a URL or an array of URLs.')
  return list.map((item) => {
    const url = withHttps(item)
    if (!URL.canParse(url))
      fail(`"sitemap" has an invalid URL: ${show(item)}.`)
    return url
  })
}

function readArtifacts(raw: RawOptions): CrawlArtifact[] {
  const value = raw.artifacts
  if (value === undefined)
    return [...CRAWL_DEFAULTS.artifacts]
  const valid = `Valid artifacts: ${CRAWL_ARTIFACTS.join(', ')}.`
  if (!Array.isArray(value))
    fail(`"artifacts" must be an array. ${valid}`)
  for (const artifact of value) {
    if (!CRAWL_ARTIFACTS.includes(artifact))
      fail(`Invalid artifact ${show(artifact)}. ${valid}`)
  }
  // Canonical order, without duplicates.
  return CRAWL_ARTIFACTS.filter(artifact => value.includes(artifact))
}

function readDriver(raw: RawOptions): CrawlDriver {
  const value = raw.driver
  if (value === undefined)
    return CRAWL_DEFAULTS.driver
  if (!CRAWL_DRIVERS.includes(value as CrawlDriver))
    fail(`"driver" must be "http" or "playwright". You gave ${show(value)}.`)
  return value as CrawlDriver
}

function readDepth(raw: RawOptions): number {
  const value = raw.depth
  if (value === undefined)
    return CRAWL_DEFAULTS.depth
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_CRAWL_DEPTH)
    fail(`"depth" must be an integer from 0 to ${MAX_CRAWL_DEPTH}. You gave ${show(value)}.`)
  return value as number
}

function readMaxPages(raw: RawOptions): number {
  const value = raw.maxPages
  if (value === undefined)
    return Number.POSITIVE_INFINITY
  if (!Number.isInteger(value) || (value as number) < 1)
    fail(`"maxPages" must be an integer of 1 or more. You gave ${show(value)}.`)
  return value as number
}

function readCrawlDelay(raw: RawOptions): number | undefined {
  const value = raw.crawlDelay
  if (value === undefined)
    return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    fail(`"crawlDelay" must be a number of seconds, 0 or more. You gave ${show(value)}.`)
  return value
}

function readBoilerplateThreshold(raw: RawOptions): number {
  const value = raw.boilerplateThreshold
  if (value === undefined)
    return CRAWL_DEFAULTS.boilerplateThreshold
  if (typeof value !== 'number' || !(value > 0 && value <= 1))
    fail(`"boilerplateThreshold" must be a number greater than 0 and at most 1. You gave ${show(value)}.`)
  return value
}

function readExclude(raw: RawOptions): string[] {
  const exclude = readStrings(raw, 'exclude') ?? []
  for (const pattern of exclude) {
    const error = validateGlobPattern(pattern)
    if (error)
      fail(`"exclude" has an invalid pattern. ${error}`)
  }
  return exclude
}

/**
 * Parse crawl options once, at the boundary. Applies the defaults and throws a
 * `TypeError` for an unknown key or an invalid value.
 */
export function resolveCrawlOptions(options: Partial<CrawlOptions>): ResolvedCrawlOptions {
  if (typeof options !== 'object' || options === null)
    fail('Crawl options must be an object.')
  assertCrawlOptionKeys(options)
  const raw = options as RawOptions

  const urls = readUrls(raw)
  const globPatterns = readObject<ParsedUrlPattern[]>(raw, 'globPatterns')
  const silent = readBoolean(raw, 'silent', false)
  const logger = readObject<CrawlLogger>(raw, 'logger')

  return {
    urls,
    patterns: globPatterns && globPatterns.length > 0 ? globPatterns : urls.map(parseUrlPattern),
    output: resolve(normalize(readString(raw, 'output') ?? CRAWL_DEFAULTS.output)),
    depth: readDepth(raw),
    maxPages: readMaxPages(raw),
    sitemap: readSitemap(raw),
    artifacts: readArtifacts(raw),
    siteName: readString(raw, 'siteName'),
    description: readString(raw, 'description'),
    origin: readString(raw, 'origin'),
    driver: readDriver(raw),
    useChrome: readBoolean(raw, 'useChrome', false),
    exclude: readExclude(raw),
    crawlDelay: readCrawlDelay(raw),
    skipSitemap: readBoolean(raw, 'skipSitemap', false),
    allowSubdomains: readBoolean(raw, 'allowSubdomains', false),
    stripBoilerplate: readBoolean(raw, 'stripBoilerplate', true),
    boilerplateThreshold: readBoilerplateThreshold(raw),
    verbose: readBoolean(raw, 'verbose', false),
    logger: resolveLogger({ silent, logger }),
    hooks: readObject<CrawlOptions['hooks']>(raw, 'hooks'),
  }
}

/**
 * Merge option layers from lowest to highest precedence. A later layer wins.
 * `exclude` patterns from every layer add up. Keys set to `undefined` do not
 * override a lower layer.
 */
export function mergeCrawlOptions(...layers: Partial<CrawlOptions>[]): Partial<CrawlOptions> {
  const merged: RawOptions = {}
  const exclude: unknown[] = []
  for (const layer of layers) {
    for (const key in layer) {
      const value = (layer as RawOptions)[key]
      if (value === undefined)
        continue
      if (key === 'exclude' && Array.isArray(value))
        exclude.push(...value)
      else
        merged[key] = value
    }
  }
  if (exclude.length > 0)
    merged.exclude = exclude
  return merged as Partial<CrawlOptions>
}
