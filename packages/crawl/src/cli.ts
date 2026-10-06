import type { CrawlLogger } from './logger.js'
import type { ResolvedCrawlOptions } from './options.js'
import type { CrawlArtifact, CrawlDriver, CrawlOptions, CrawlProgress } from './types.js'
import { accessSync, constants, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { dirname, join, relative } from 'pathe'
import { parseCrawlArgs } from './cli-args.js'
import { loadMdreamConfig } from './config.js'
import { runCrawl } from './crawl.js'
import { resolveLogger } from './logger.js'
import { assertCrawlOptionKeys, CRAWL_ARTIFACTS, CRAWL_DEFAULTS, MAX_CRAWL_DEPTH, mergeCrawlOptions, resolveCrawlOptions, validateCrawlUrl } from './options.js'

const QUIET_FLAGS = new Set(['--silent', '--quiet', '-q'])

/** Detect the quiet flag from raw argv (used before options are fully parsed). */
function isSilentArgv(args: string[]): boolean {
  return args.some(arg => QUIET_FLAGS.has(arg))
}

// The run-wide logger. Seeded from argv so the top-level error handler can
// report even before config loads, then upgraded by main() once config-driven
// silent is known (a `silent: true` in mdream.config must also mute crashes).
let runLogger = resolveLogger({ silent: isSilentArgv(process.argv.slice(2)) })
// playwright-utils is dynamically imported only when Playwright driver is used
// to avoid requiring crawlee for HTTP-only users

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

const HELP = `
@mdream/crawl v${version}

Crawl a website and generate llms.txt, llms-full.txt, and Markdown files.

Usage:
  mdream-crawl [options] <url>     Crawl a website
  mdream-crawl                     Start interactive mode
  npx @mdream/crawl [options] <url>

Options:
  -u, --url <url>               URL to crawl. Accepts glob patterns. Repeatable
  -o, --output <dir>            Output directory (default: ${CRAWL_DEFAULTS.output})
  -d, --depth <number>          Link depth from 0 to ${MAX_CRAWL_DEPTH}. 0 processes only the given URLs (default: ${CRAWL_DEFAULTS.depth})
  --single-page                 Same as --depth 0
  --driver <http|playwright>    Crawler driver (default: ${CRAWL_DEFAULTS.driver})
  --artifacts <list>            Comma-separated list of ${CRAWL_ARTIFACTS.join(', ')} (default: all)
  --origin <url>                Origin for relative links in page Markdown (default: the page origin)
  --site-name <name>            Site name in llms.txt (default: the home page title)
  --description <text>          Site description in llms.txt (default: the home page description)
  --max-pages <number>          Maximum number of pages to fetch (default: no limit)
  --crawl-delay <seconds>       Delay between requests (default: the robots.txt Crawl-delay)
  --exclude <pattern>           Skip URLs that match a glob pattern. Repeatable
  --skip-sitemap                Skip sitemap and robots.txt discovery
  --sitemap <url>               Use this sitemap instead of auto-discovery. Repeatable
  --allow-subdomains            Crawl other subdomains of the same domain
  --keep-boilerplate            Keep repeated navigation and footers in page Markdown
  --boilerplate-threshold <n>   Fraction of pages that a block must appear in to count as boilerplate (default: ${CRAWL_DEFAULTS.boilerplateThreshold})
  -v, --verbose                 Log details for each failed URL
  -q, --quiet, --silent         Drop all logs. Use it to keep stdout clean for JSON-RPC or MCP
  -h, --help                    Show this help
  --version                     Show the version

A flag can also take its value as --flag=value.
Flags override mdream.config.* values. Config values override the defaults.

Examples:
  mdream-crawl harlanzw.com --artifacts "llms.txt,markdown"
  mdream-crawl https://docs.example.com --depth 2 --artifacts llms-full.txt
  mdream-crawl example.com --exclude "*/admin/*" --exclude "*/api/*"
  mdream-crawl example.com --sitemap https://example.com/custom/sitemap.xml
  mdream-crawl example.com/pricing --driver playwright --single-page
`

/** Print a usage error on stderr and exit 1. Stdout stays clean. */
function exitWithError(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function checkOutputDirectoryPermissions(outputDir: string): { success: boolean, error?: string } {
  try {
    // Try to create the directory if it doesn't exist
    mkdirSync(outputDir, { recursive: true })

    // Check if we can write to the directory
    accessSync(outputDir, constants.W_OK)

    // Try to create a test file to ensure we can actually write
    const testFile = join(outputDir, '.mdream-test')
    try {
      writeFileSync(testFile, 'test')
      unlinkSync(testFile)
    }
    catch (err) {
      return {
        success: false,
        error: `Cannot write to output directory: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
    }

    return { success: true }
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('EACCES')) {
        return {
          success: false,
          error: `Permission denied: Cannot write to output directory '${outputDir}'. Please check permissions or run with appropriate privileges.`,
        }
      }
      return {
        success: false,
        error: `Failed to access output directory: ${err.message}`,
      }
    }
    return {
      success: false,
      error: 'Failed to access output directory',
    }
  }
}

function splitUrls(input: string): string[] {
  return input.split(',').map(url => url.trim()).filter(Boolean)
}

/**
 * Ask for the URL, driver, artifacts, and sitemap discovery. The config file
 * gives the initial answers. Returns null when the user cancels.
 */
async function interactiveCrawl(config: Partial<CrawlOptions>): Promise<Partial<CrawlOptions> | null> {
  console.clear()

  p.intro(`☁️  @mdream/crawl v${version}`)

  const urlsInput = await p.text({
    message: 'Enter starting URL for crawling (supports glob patterns):',
    placeholder: 'e.g. docs.example.com, site.com/docs/**',
    initialValue: config.urls?.join(', '),
    validate: (value) => {
      const urls = splitUrls(value ?? '')
      if (urls.length === 0)
        return 'Enter at least one URL.'
      for (const url of urls) {
        const error = validateCrawlUrl(url)
        if (error)
          return error
      }
    },
  })

  if (typeof urlsInput !== 'string') {
    p.cancel('Operation cancelled.')
    return null
  }

  const answers = await p.group(
    {
      driver: () => p.select<CrawlDriver>({
        message: 'Select crawler driver:',
        options: [
          { value: 'http', label: 'HTTP Crawler (Fast, for static content)', hint: 'Recommended' },
          { value: 'playwright', label: 'Playwright (Slower, supports JavaScript)' },
        ],
        initialValue: config.driver ?? CRAWL_DEFAULTS.driver,
      }),
      artifacts: () => p.multiselect<CrawlArtifact>({
        message: 'Select artifacts:',
        options: [
          { value: 'llms.txt', label: 'llms.txt (link index)', hint: 'Recommended' },
          { value: 'llms-full.txt', label: 'llms-full.txt (full content)' },
          { value: 'markdown', label: 'Markdown file for each page' },
        ],
        initialValues: config.artifacts ?? [...CRAWL_DEFAULTS.artifacts],
      }),
      skipSitemap: () => p.confirm({
        message: 'Skip sitemap.xml and robots.txt discovery?',
        initialValue: config.skipSitemap ?? false,
      }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.')
        process.exit(0)
      },
    },
  )

  return {
    urls: splitUrls(urlsInput),
    driver: answers.driver,
    artifacts: answers.artifacts,
    skipSitemap: answers.skipSitemap,
  }
}

function summarize(options: ResolvedCrawlOptions): string {
  const maxPages = Number.isFinite(options.maxPages) ? String(options.maxPages) : 'no limit'
  return [
    `URL: ${options.urls.join(', ')}`,
    `Output: ${relative(process.cwd(), options.output) || '.'}`,
    `Driver: ${options.driver} · Depth: ${options.depth} · Max pages: ${maxPages}`,
    `Artifacts: ${options.artifacts.length > 0 ? options.artifacts.join(', ') : 'none'}`,
    options.origin && `Origin: ${options.origin}`,
    options.exclude.length > 0 && `Exclude: ${options.exclude.join(', ')}`,
    options.skipSitemap && `Skip sitemap: yes`,
    options.sitemap.length > 0 && `Sitemap: ${options.sitemap.join(', ')}`,
    options.allowSubdomains && `Allow subdomains: yes`,
    options.verbose && `Verbose: on`,
  ].filter(Boolean).join('\n')
}

interface LatencyStats { total: number, min: number, max: number, count: number }

async function showCrawlResults(logger: CrawlLogger, successful: number, failed: number, outputDir: string, generatedFiles: string[], durationSeconds: number, latency?: LatencyStats) {
  const durationStr = `${durationSeconds.toFixed(1)}s`

  let line = `${successful} pages in ${durationStr}`
  if (failed > 0)
    line += ` (${failed} failed)`
  if (latency && latency.count > 0) {
    const avg = Math.round(latency.total / latency.count)
    const min = latency.min === Infinity ? 0 : Math.round(latency.min)
    const max = Math.round(latency.max)
    line += ` · HTTP Latency: avg ${avg}ms, min ${min}ms, max ${max}ms`
  }

  logger.success(line)
  if (generatedFiles.length > 0)
    logger.info(`${generatedFiles.join(', ')} → ${relative(process.cwd(), outputDir) || '.'}`)
}

async function main() {
  const command = parseCrawlArgs(process.argv.slice(2))
  if (command._tag === 'Help') {
    console.log(HELP)
    process.exit(0)
  }
  if (command._tag === 'Version') {
    console.log(`@mdream/crawl v${version}`)
    process.exit(0)
  }
  if (command._tag === 'Invalid')
    exitWithError(command.message)

  // Load config file (mdream.config.ts). Check its keys before any prompt.
  const fileConfig = await loadMdreamConfig()
  try {
    assertCrawlOptionKeys(fileConfig)
  }
  catch (error) {
    exitWithError(`mdream.config: ${error instanceof Error ? error.message : String(error)}`)
  }

  const interactive = command._tag === 'Interactive'
  const layer = interactive ? await interactiveCrawl(fileConfig) : command.options
  if (!layer)
    process.exit(0)

  // Precedence: CLI flags or prompt answers, then the config file, then the library defaults.
  const input = mergeCrawlOptions(fileConfig, layer)
  if (!input.urls || input.urls.length === 0)
    exitWithError('A URL is required. Pass it as an argument, with --url, or as "urls" in mdream.config. Run without arguments for interactive mode.')

  let options: ResolvedCrawlOptions
  try {
    options = resolveCrawlOptions(input)
  }
  catch (error) {
    exitWithError(error instanceof Error ? error.message : String(error))
  }

  // Single logging seam for the whole run, resolved from the flags and the
  // config file, so a quiet run keeps stdout clean (issue #100). Upgrade the
  // run-wide logger so an unhandled error below is muted too.
  const logger = options.logger
  runLogger = logger

  if (!interactive)
    logger.intro(`☁️  mdream v${version}`)
  logger.note(summarize(options), 'Configuration')

  if (options.skipSitemap && options.patterns.some(pattern => pattern.isGlob))
    logger.warn('Sitemap discovery is off. A glob URL can miss pages that no link reaches.')

  // Check output directory permissions before proceeding
  const permCheck = checkOutputDirectoryPermissions(options.output)
  if (!permCheck.success) {
    logger.error(permCheck.error!)
    if (permCheck.error?.includes('Permission denied')) {
      logger.info('Tip: Try running with elevated privileges (e.g., sudo) or change the output directory permissions.')
    }
    process.exit(1)
  }

  // Check playwright + crawlee installation if needed
  if (options.driver === 'playwright') {
    // Crawlee is required for Playwright driver
    try {
      await import('crawlee')
    }
    catch {
      logger.error('The Playwright driver requires crawlee. Install it with: npm install crawlee')
      process.exit(1)
    }

    const { ensurePlaywrightInstalled, isUseChromeSupported } = await import('./playwright-utils.js')
    // Use system Chrome when available, unless the options turn it off.
    if (input.useChrome !== false && await isUseChromeSupported()) {
      options = { ...options, useChrome: true }
      logger.info('System Chrome detected and enabled.')
    }
    else {
      const playwrightInstalled = await ensurePlaywrightInstalled(logger)
      if (!playwrightInstalled) {
        logger.error('Cannot proceed without Playwright. Please install it manually or use the HTTP driver instead.')
        process.exit(1)
      }
      logger.info('Using global playwright instance.')
    }
  }

  const s = logger.spinner()
  s.start('Discovering sitemaps')

  const startTime = Date.now()
  let crawlStartTime = 0
  let lastProgress: CrawlProgress | undefined
  const results = await runCrawl(options, (progress: CrawlProgress) => {
    lastProgress = progress
    if (progress.sitemap.status === 'discovering') {
      s.message('Discovering sitemaps')
    }
    else if (progress.sitemap.status === 'processing') {
      s.message(`Processing sitemap... Found ${progress.sitemap.found} URLs`)
    }
    else if (progress.crawling.status === 'processing') {
      if (!crawlStartTime)
        crawlStartTime = Date.now()

      const processed = progress.crawling.processed
      const total = progress.crawling.total
      const failed = progress.crawling.failed
      const elapsed = (Date.now() - crawlStartTime) / 1000
      const rate = elapsed > 0.1 ? Math.round(processed / elapsed) : 0

      let msg = processed > total
        ? `Crawling ${processed} pages`
        : `Crawling ${processed}/${total}`

      if (rate > 0)
        msg += ` · ${rate}/s`
      if (failed > 0)
        msg += ` · ${failed} failed`

      s.message(msg)
    }
    else if (progress.generation.status === 'generating') {
      s.message(progress.generation.current || 'Generating files')
    }
  })

  s.stop()

  const durationSeconds = (Date.now() - startTime) / 1000

  const successful = results.filter(r => r.success).length
  const failedResults = results.filter(r => !r.success)

  if (failedResults.length > 0) {
    logger.error('Failed URLs:')
    for (const result of failedResults)
      logger.error(`  ${result.url}: ${result.error || 'Unknown error'}`)
  }

  // Build list of generated files
  const generatedFiles: string[] = []
  if (successful > 0) {
    for (const artifact of options.artifacts)
      generatedFiles.push(artifact === 'markdown' ? `${successful} MD files` : artifact)
  }

  await showCrawlResults(logger, successful, failedResults.length, options.output, generatedFiles, durationSeconds, lastProgress?.crawling.latency)
  process.exit(0)
}

// Run the CLI
main().catch((error) => {
  // runLogger honors config-driven silent once main() has resolved it, and
  // falls back to the argv-seeded logger if main throws before that point.
  const logger = runLogger
  const msg = error instanceof Error ? error.message : String(error)
  // Surface a clear hint when the error is the Windows wmic.exe removal
  if (msg.includes('wmic') || (msg.includes('ENOENT') && process.platform === 'win32')) {
    logger.error(
      'Crawlee failed because wmic.exe is not available on this system. '
      + 'Windows 11 removed wmic.exe, which older crawlee versions depend on for memory monitoring.\n'
      + 'Fix: upgrade crawlee to >=3.16.0 or switch to the HTTP driver (--driver http).',
    )
  }
  else {
    logger.error(`Unexpected error: ${msg}`)
  }
  process.exit(1)
})
