import type { CrawlProgress } from './crawl.ts'
import type { CrawlOptions } from './types.ts'
import { accessSync, constants, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { dirname, join, resolve } from 'pathe'
import { withHttps } from 'ufo'
import { crawlAndGenerate } from './crawl.ts'
import { parseUrlPattern, validateGlobPattern } from './glob-utils.ts'
import { ensurePlaywrightInstalled, isUseChromeSupported } from './playwright-utils.ts'

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

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

async function interactiveCrawl(): Promise<CrawlOptions | null> {
  console.clear()

  p.intro(`☁️  @mdream/crawl v${version}`)

  // Get URLs
  const urlsInput = await p.text({
    message: 'Enter starting URL for crawling (supports glob patterns):',
    placeholder: 'e.g. docs.example.com, site.com/docs/**',
    validate: (value) => {
      if (!value)
        return 'Please enter at least one URL'

      const urls = value.split(',').map(url => url.trim())

      for (const url of urls) {
        // First validate glob pattern syntax
        const globError = validateGlobPattern(url)
        if (globError) {
          return globError
        }

        // Parse the URL pattern
        try {
          const parsed = parseUrlPattern(url)

          // If it's not a glob, validate as regular URL
          if (!parsed.isGlob) {
            try {
              // eslint-disable-next-line no-new
              new URL(withHttps(url))
            }
            catch {
              return `Invalid URL: ${withHttps(url)}`
            }
          }
        }
        catch (error) {
          return error instanceof Error ? error.message : 'Invalid URL pattern'
        }
      }
    },
  })

  if (p.isCancel(urlsInput)) {
    p.cancel('Operation cancelled.')
    return null
  }

  const urls = urlsInput.split(',').map(url => url.trim())

  let globPatterns
  try {
    globPatterns = urls.map(parseUrlPattern)
  }
  catch (error) {
    p.cancel(error instanceof Error ? error.message : 'Invalid URL pattern')
    return null
  }

  // Set default output directory
  const outputDir = 'output'

  // Crawler configuration
  const crawlerOptions = await p.group(
    {
      driver: () => p.select({
        message: 'Select crawler driver:',
        options: [
          { value: 'http', label: 'HTTP Crawler (Fast, for static content)', hint: 'Recommended' },
          { value: 'playwright', label: 'Playwright (Slower, supports JavaScript)' },
        ],
        initialValue: 'http',
      }),

      maxDepth: () => p.text({
        message: 'Clicks to page (crawl depth):',
        placeholder: '3',
        defaultValue: '3',
        validate: (value) => {
          const num = Number.parseInt(value)
          if (Number.isNaN(num) || num < 1 || num > 10) {
            return 'Depth must be between 1 and 10'
          }
        },
      }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.')
        process.exit(0)
      },
    },
  )

  // Advanced options
  const advancedOptions = await p.group(
    {
      outputFormats: () => p.multiselect({
        message: 'Select output formats:',
        options: [
          { value: 'llms.txt', label: 'llms.txt (basic format)', hint: 'Recommended' },
          { value: 'llms-full.txt', label: 'llms-full.txt (extended format)' },
          { value: 'markdown', label: 'Individual Markdown files' },
        ],
        initialValues: ['llms.txt', 'llms-full.txt', 'markdown'],
      }),
      verbose: () => p.confirm({
        message: 'Enable verbose logging?',
        initialValue: false,
      }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.')
        process.exit(0)
      },
    },
  )

  // Auto-infer origin URL from first URL
  const firstUrl = urls[0]
  const inferredOrigin = (() => {
    try {
      const url = new URL(withHttps(firstUrl))
      return `${url.protocol}//${url.host}`
    }
    catch {
      return undefined
    }
  })()

  // Show summary
  const outputFormats = advancedOptions.outputFormats.map((f) => {
    switch (f) {
      case 'llms.txt': return 'llms.txt'
      case 'llms-full.txt': return 'llms-full.txt'
      case 'markdown': return 'Individual MD files'
      default: return f
    }
  })

  const summary = [
    `URLs: ${urls.join(', ')}`,
    `Output: ${outputDir}`,
    `Driver: ${crawlerOptions.driver}`,
    `Max pages: Unlimited`,
    `Follow links: Yes (depth ${crawlerOptions.maxDepth})`,
    `Output formats: ${outputFormats.join(', ')}`,
    `Sitemap discovery: Automatic`,
    inferredOrigin && `Origin: ${inferredOrigin}`,
    advancedOptions.verbose && `Verbose logging: Enabled`,
  ].filter(Boolean)

  p.note(summary.join('\n'), 'Crawl Configuration')

  const shouldProceed = await p.confirm({
    message: 'Start crawling?',
    initialValue: true,
  })

  if (p.isCancel(shouldProceed) || !shouldProceed) {
    p.cancel('Crawl cancelled.')
    return null
  }

  return {
    urls,
    outputDir: resolve(outputDir),
    driver: crawlerOptions.driver as 'http' | 'playwright',
    maxRequestsPerCrawl: Number.MAX_SAFE_INTEGER, // Unlimited pages
    followLinks: true, // Always follow links
    maxDepth: Number.parseInt(crawlerOptions.maxDepth),
    generateLlmsTxt: advancedOptions.outputFormats.includes('llms.txt'),
    generateLlmsFullTxt: advancedOptions.outputFormats.includes('llms-full.txt'),
    generateIndividualMd: advancedOptions.outputFormats.includes('markdown'),
    origin: inferredOrigin,
    globPatterns,
    verbose: advancedOptions.verbose,
  }
}

async function showCrawlResults(successful: number, failed: number, outputDir: string, generatedFiles: string[], durationSeconds: number) {
  const messages = []

  // Duration formatting with 1 decimal place
  const durationStr = `${(durationSeconds).toFixed(1)}s`

  // Compact single line format
  const stats = failed > 0 ? `${successful} pages, ${failed} failed` : `${successful} pages`
  messages.push(`📄 ${stats} • ⏱️  ${durationStr}`)
  messages.push(`📦 ${generatedFiles.join(', ')}`)
  messages.push(`📁 ${outputDir}`)

  p.note(messages.join('\n'), '✅ Complete')
}

function parseCliArgs(): CrawlOptions | null {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
@mdream/crawl v${version}

Multi-page website crawler that generates comprehensive llms.txt files

Usage:
  @mdream/crawl [options] <url>             Crawl a website with CLI flags
  @mdream/crawl                             Start interactive mode

Options:
  -u, --url <url>              Website URL to crawl
  -o, --output <dir>           Output directory (default: output)
  -d, --depth <number>         Crawl depth (default: 3)
  --driver <http|playwright>   Crawler driver (default: http)
  --artifacts <list>           Comma-separated list of artifacts: llms.txt,llms-full.txt,markdown (default: all)
  --origin <url>               Origin URL for resolving relative paths (overrides auto-detection)
  --site-name <name>           Override site name (overrides auto-extracted title)
  --description <desc>         Override site description (overrides auto-extracted description)
  --max-pages <number>        Maximum pages to crawl (default: unlimited)
  --crawl-delay <seconds>     Crawl delay in seconds
  --exclude <pattern>         Exclude URLs matching glob patterns (can be used multiple times)
  -v, --verbose               Enable verbose logging
  -h, --help                  Show this help message
  --version                   Show version number

Note: Sitemap discovery and robots.txt checking are automatic

Examples:
  @mdream/crawl -u harlanzw.com --artifacts "llms.txt,markdown"
  @mdream/crawl --url https://docs.example.com --depth 2 --artifacts "llms-full.txt"
  @mdream/crawl -u example.com --exclude "*/admin/*" --exclude "*/api/*"
  @mdream/crawl -u example.com --verbose
`)
    process.exit(0)
  }

  if (args.includes('--version')) {
    console.log(`@mdream/crawl v${version}`)
    process.exit(0)
  }

  // If no arguments provided at all, return null for interactive mode
  if (args.length === 0) {
    return null
  }

  // Parse CLI arguments
  const getArgValue = (flag: string): string | undefined => {
    const index = args.findIndex(arg => arg === flag || arg === flag.replace('--', '-'))
    return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined
  }

  const getArgValues = (flag: string): string[] => {
    const values: string[] = []
    for (let i = 0; i < args.length; i++) {
      if (args[i] === flag || args[i] === flag.replace('--', '-')) {
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          values.push(args[i + 1])
        }
      }
    }
    return values
  }

  // Get URL from -u/--url flag or first non-flag argument
  const urlFromFlag = getArgValue('--url') || getArgValue('-u')
  const urlFromArgs = args.find(arg => !arg.startsWith('-') && !args[args.indexOf(arg) - 1]?.startsWith('-'))
  const url = urlFromFlag || urlFromArgs

  // If arguments were provided but no URL, this is an error
  if (!url) {
    p.log.error('Error: URL is required when using CLI arguments')
    p.log.info('Use --help for usage information or run without arguments for interactive mode')
    process.exit(1)
  }

  // Validate URL pattern
  const globError = validateGlobPattern(url)
  if (globError) {
    p.log.error(`Error: ${globError}`)
    process.exit(1)
  }

  let parsed
  try {
    parsed = parseUrlPattern(url)
  }
  catch (error) {
    p.log.error(`Error: ${error instanceof Error ? error.message : 'Invalid URL pattern'}`)
    process.exit(1)
  }

  if (!parsed.isGlob) {
    try {
      // eslint-disable-next-line no-new
      new URL(withHttps(url))
    }
    catch {
      p.log.error(`Error: Invalid URL: ${withHttps(url)}`)
      process.exit(1)
    }
  }

  // Validate exclude patterns
  const excludePatterns = getArgValues('--exclude')
  for (const pattern of excludePatterns) {
    const excludeError = validateGlobPattern(pattern)
    if (excludeError) {
      p.log.error(`Error in exclude pattern: ${excludeError}`)
      process.exit(1)
    }
  }

  // Validate depth
  const depthStr = getArgValue('--depth') || getArgValue('-d') || '3'
  const depth = Number.parseInt(depthStr)
  if (Number.isNaN(depth) || depth < 1 || depth > 10) {
    p.log.error('Error: Depth must be between 1 and 10')
    process.exit(1)
  }

  // Validate driver
  const driver = getArgValue('--driver')
  if (driver && driver !== 'http' && driver !== 'playwright') {
    p.log.error('Error: Driver must be either "http" or "playwright"')
    process.exit(1)
  }

  // Validate max-pages
  const maxPagesStr = getArgValue('--max-pages')
  if (maxPagesStr) {
    const maxPages = Number.parseInt(maxPagesStr)
    if (Number.isNaN(maxPages) || maxPages < 1) {
      p.log.error('Error: Max pages must be a positive number')
      process.exit(1)
    }
  }

  // Validate crawl-delay
  const crawlDelayStr = getArgValue('--crawl-delay')
  if (crawlDelayStr) {
    const crawlDelay = Number.parseInt(crawlDelayStr)
    if (Number.isNaN(crawlDelay) || crawlDelay < 0) {
      p.log.error('Error: Crawl delay must be a non-negative number')
      process.exit(1)
    }
  }

  // Parse artifacts
  const artifactsStr = getArgValue('--artifacts')
  const artifacts = artifactsStr ? artifactsStr.split(',').map(a => a.trim()) : ['llms.txt', 'llms-full.txt', 'markdown']

  // Validate artifacts
  const validArtifacts = ['llms.txt', 'llms-full.txt', 'markdown']
  for (const artifact of artifacts) {
    if (!validArtifacts.includes(artifact)) {
      p.log.error(`Error: Invalid artifact '${artifact}'. Valid options: ${validArtifacts.join(', ')}`)
      process.exit(1)
    }
  }

  // Get origin URL (allow override of auto-detection)
  const originOverride = getArgValue('--origin')
  const inferredOrigin = (() => {
    if (originOverride)
      return originOverride
    try {
      const urlObj = new URL(withHttps(url))
      return `${urlObj.protocol}//${urlObj.host}`
    }
    catch {
      return undefined
    }
  })()

  // Get metadata overrides
  const siteNameOverride = getArgValue('--site-name')
  const descriptionOverride = getArgValue('--description')

  const patterns = [parsed]

  // Check for verbose flag
  const verbose = args.includes('--verbose') || args.includes('-v')

  return {
    urls: [url],
    outputDir: resolve(getArgValue('--output') || getArgValue('-o') || 'output'),
    driver: (driver as 'http' | 'playwright') || 'http',
    maxRequestsPerCrawl: Number.parseInt(maxPagesStr || String(Number.MAX_SAFE_INTEGER)),
    followLinks: true,
    maxDepth: depth,
    generateLlmsTxt: artifacts.includes('llms.txt'),
    generateLlmsFullTxt: artifacts.includes('llms-full.txt'),
    generateIndividualMd: artifacts.includes('markdown'),
    siteNameOverride,
    descriptionOverride,
    origin: inferredOrigin,
    globPatterns: patterns,
    crawlDelay: crawlDelayStr ? Number.parseInt(crawlDelayStr) : undefined,
    exclude: excludePatterns.length > 0 ? excludePatterns : undefined,
    verbose,
  }
}

async function main() {
  // Try to parse CLI arguments first
  const cliOptions = parseCliArgs()

  let options: CrawlOptions | null

  if (cliOptions) {
    // Use CLI arguments - validation already done in parseCliArgs
    options = cliOptions

    // Show non-interactive summary when using CLI args
    p.intro(`☁️  mdream v${version}`)

    const formats = []
    if (options.generateLlmsTxt)
      formats.push('llms.txt')
    if (options.generateLlmsFullTxt)
      formats.push('llms-full.txt')
    if (options.generateIndividualMd)
      formats.push('Individual MD files')

    const summary = [
      `URL: ${options.urls.join(', ')}`,
      `Output: ${options.outputDir}`,
      `Driver: ${options.driver}`,
      `Depth: ${options.maxDepth}`,
      `Formats: ${formats.join(', ')}`,
      options.exclude && options.exclude.length > 0 && `Exclude: ${options.exclude.join(', ')}`,
      options.verbose && `Verbose: Enabled`,
    ].filter(Boolean)

    p.note(summary.join('\n'), 'Configuration')
  }
  else {
    // Fall back to interactive mode
    options = await interactiveCrawl()
  }

  if (!options) {
    process.exit(0)
  }

  // Check output directory permissions before proceeding
  const permCheck = checkOutputDirectoryPermissions(options.outputDir)
  if (!permCheck.success) {
    p.log.error(permCheck.error!)
    if (permCheck.error?.includes('Permission denied')) {
      p.log.info('Tip: Try running with elevated privileges (e.g., sudo) or change the output directory permissions.')
    }
    process.exit(1)
  }

  // Check playwright installation if needed
  if (options.driver === 'playwright') {
    // Check Chrome support and configure if available
    const chromeSupported = await isUseChromeSupported()
    if (chromeSupported) {
      options.useChrome = true
      p.log.info('System Chrome detected and enabled.')
    }
    else {
      const playwrightInstalled = await ensurePlaywrightInstalled()
      if (!playwrightInstalled) {
        p.log.error('Cannot proceed without Playwright. Please install it manually or use the HTTP driver instead.')
        process.exit(1)
      }
      p.log.info('Using global playwright instance.')
    }
  }

  const s = p.spinner()
  s.start('Starting crawl...')

  const startTime = Date.now()
  const results = await crawlAndGenerate(options, (progress: CrawlProgress) => {
    // Update spinner message based on current phase
    if (progress.sitemap.status === 'discovering') {
      s.message('Discovering sitemaps...')
    }
    else if (progress.sitemap.status === 'processing') {
      s.message(`Processing sitemap... Found ${progress.sitemap.found} URLs`)
    }
    else if (progress.crawling.status === 'processing') {
      const processedCount = progress.crawling.processed
      const totalCount = progress.crawling.total
      const currentUrl = progress.crawling.currentUrl

      if (currentUrl) {
        const shortUrl = currentUrl.length > 60 ? `${currentUrl.substring(0, 57)}...` : currentUrl
        // Show different format if total seems inaccurate (when following links discovers more)
        if (processedCount > totalCount) {
          s.message(`Crawling ${processedCount}: ${shortUrl}`)
        }
        else {
          s.message(`Crawling ${processedCount}/${totalCount}: ${shortUrl}`)
        }
      }
      else {
        if (processedCount > totalCount) {
          s.message(`Crawling... ${processedCount} pages`)
        }
        else {
          s.message(`Crawling... ${processedCount}/${totalCount} pages`)
        }
      }
    }
    else if (progress.generation.status === 'generating') {
      const current = progress.generation.current || 'Generating files'
      s.message(current)
    }
  })

  s.stop()

  const endTime = Date.now()
  const durationMs = endTime - startTime
  const durationSeconds = durationMs / 1000

  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const failedResults = results.filter(r => !r.success)

  // Show failed results details if any
  if (failed > 0 && cliOptions) {
    p.log.error('Failed URLs:')
    failedResults.forEach((result) => {
      p.log.error(`  ${result.url}: ${result.error || 'Unknown error'}`)
    })
  }
  else if (failed > 0) {
    console.log('\nFailed URLs:')
    failedResults.forEach((result) => {
      console.log(`  - ${result.url}: ${result.error || 'Unknown error'}`)
    })
  }

  // Build list of generated files
  const generatedFiles = []
  if (successful > 0) {
    if (options.generateLlmsTxt)
      generatedFiles.push('llms.txt')
    if (options.generateLlmsFullTxt)
      generatedFiles.push('llms-full.txt')
    if (options.generateIndividualMd)
      generatedFiles.push(`${successful} MD files`)
  }

  // Only show interactive results for interactive mode
  await showCrawlResults(successful, failed, options.outputDir, generatedFiles, durationSeconds)
  process.exit(0)
}

// Run the CLI
main().catch((error) => {
  p.log.error(`Unexpected error: ${error}`)
  process.exit(1)
})
