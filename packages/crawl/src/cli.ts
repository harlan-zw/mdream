import type { CrawlOptions } from './types.ts'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { withHttps } from 'ufo'
import { crawlAndGenerate } from './crawl.ts'
import { parseUrlPattern, validateGlobPattern } from './glob-utils.ts'
import { ensurePlaywrightInstalled } from './playwright-utils.ts'

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

async function interactiveCrawl(): Promise<CrawlOptions | null> {
  console.clear()

  p.intro('☁️  mdream-crawl')

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
    },
  })

  if (p.isCancel(urlsInput)) {
    p.cancel('Operation cancelled.')
    return null
  }

  const urls = urlsInput.split(',').map(url => url.trim())
  const globPatterns = urls.map(parseUrlPattern)

  // Set default output directory
  const outputDir = './output'

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
          { value: 'llms-txt', label: 'llms.txt (basic format)', hint: 'Recommended' },
          { value: 'llms-full-txt', label: 'llms-full.txt (extended format)' },
          { value: 'individual-md', label: 'Individual Markdown files' },
        ],
        initialValues: ['llms-txt', 'llms-full-txt', 'individual-md'],
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
      case 'llms-txt': return 'llms.txt'
      case 'llms-full-txt': return 'llms-full.txt'
      case 'individual-md': return 'Individual MD files'
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
    generateLlmsTxt: advancedOptions.outputFormats.includes('llms-txt'),
    generateLlmsFullTxt: advancedOptions.outputFormats.includes('llms-full-txt'),
    generateIndividualMd: advancedOptions.outputFormats.includes('individual-md'),
    origin: inferredOrigin,
    globPatterns,
  }
}

async function showCrawlResults(successful: number, failed: number, outputDir: string, generatedFiles: string[]) {
  const messages = []

  if (successful > 0) {
    messages.push(`✅ ${successful} pages processed successfully`)
  }

  if (failed > 0) {
    messages.push(`❌ ${failed} pages failed`)
  }

  if (generatedFiles.length > 0) {
    messages.push(`📄 Generated: ${generatedFiles.join(', ')}`)
  }

  messages.push(`📁 Output: ${outputDir}`)

  p.note(messages.join('\n'), 'Crawl Results')

  if (successful > 0) {
    p.outro('🎉 Crawling completed successfully!')
  }
  else {
    p.outro('❌ Crawling failed - no pages processed')
  }
}

function parseCliArgs(): CrawlOptions | null {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
mdream-crawl v${version}

Multi-page website crawler that generates comprehensive llms.txt files

Usage:
  mdream-crawl [options] <url>             Crawl a website with CLI flags
  mdream-crawl                             Start interactive mode

Options:
  -u, --url <url>              Website URL to crawl
  -o, --output <dir>           Output directory (default: ./output)
  -d, --depth <number>         Crawl depth (default: 3)
  --driver <http|playwright>   Crawler driver (default: http)
  --llms-txt                   Generate llms.txt file
  --llms-full-txt             Generate llms-full.txt file
  --individual-md             Generate individual MD files
  --max-pages <number>        Maximum pages to crawl (default: unlimited)
  --crawl-delay <seconds>     Crawl delay in seconds
  --exclude <pattern>         Exclude URLs matching glob patterns (can be used multiple times)
  -h, --help                  Show this help message
  --version                   Show version number

Note: Sitemap discovery and robots.txt checking are automatic

Examples:
  mdream-crawl -u harlanzw.com --llms-txt --individual-md
  mdream-crawl --url https://docs.example.com --depth 2 --llms-full-txt
  mdream-crawl -u example.com --exclude "*/admin/*" --exclude "*/api/*"
`)
    process.exit(0)
  }

  if (args.includes('--version')) {
    console.log(`mdream-crawl v${version}`)
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

  const hasFlag = (flag: string): boolean => {
    return args.includes(flag) || args.includes(flag.replace('--', '-'))
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

  const parsed = parseUrlPattern(url)
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

  // Parse output formats
  const outputFormats: string[] = []
  if (hasFlag('--llms-txt'))
    outputFormats.push('llms-txt')
  if (hasFlag('--llms-full-txt'))
    outputFormats.push('llms-full-txt')
  if (hasFlag('--individual-md'))
    outputFormats.push('individual-md')

  // Default to all formats if none specified
  if (outputFormats.length === 0) {
    outputFormats.push('llms-txt', 'llms-full-txt', 'individual-md')
  }

  // Auto-infer origin URL from provided URL
  const inferredOrigin = (() => {
    try {
      const urlObj = new URL(withHttps(url))
      return `${urlObj.protocol}//${urlObj.host}`
    }
    catch {
      return undefined
    }
  })()

  const patterns = [parseUrlPattern(url)]

  return {
    urls: [url],
    outputDir: resolve(getArgValue('--output') || getArgValue('-o') || './output'),
    driver: (driver as 'http' | 'playwright') || 'http',
    maxRequestsPerCrawl: Number.parseInt(maxPagesStr || String(Number.MAX_SAFE_INTEGER)),
    followLinks: true,
    maxDepth: depth,
    generateLlmsTxt: outputFormats.includes('llms-txt'),
    generateLlmsFullTxt: outputFormats.includes('llms-full-txt'),
    generateIndividualMd: outputFormats.includes('individual-md'),
    origin: inferredOrigin,
    globPatterns: patterns,
    crawlDelay: crawlDelayStr ? Number.parseInt(crawlDelayStr) : undefined,
    exclude: excludePatterns.length > 0 ? excludePatterns : undefined,
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
    p.intro('☁️  mdream-crawl - Multi-Page Website Crawler')

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

  // Check playwright installation if needed
  if (options.driver === 'playwright') {
    const playwrightInstalled = await ensurePlaywrightInstalled()
    if (!playwrightInstalled) {
      p.log.error('Cannot proceed without Playwright. Please install it manually or use the HTTP driver instead.')
      process.exit(1)
    }
  }

  const s = p.spinner()
  s.start('Starting crawl...')
  const results = await crawlAndGenerate(options)
  s.stop('Crawl completed!')

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
  if (!cliOptions) {
    await showCrawlResults(successful, failed, options.outputDir, generatedFiles)
  }
  else {
    // Simple output for CLI mode
    const messages = []

    if (successful > 0) {
      messages.push(`✅ ${successful} pages processed`)
    }

    if (failed > 0) {
      messages.push(`❌ ${failed} pages failed`)
    }

    if (generatedFiles.length > 0) {
      messages.push(`📄 Generated: ${generatedFiles.join(', ')}`)
    }

    messages.push(`📁 Output: ${options.outputDir}`)

    p.note(messages.join('\n'), 'Results')

    if (successful > 0) {
      p.outro('🎉 Crawling completed!')
    }
    else {
      p.outro('❌ Crawling failed - no pages processed')
      process.exit(1)
    }
  }
}

// Run the CLI
main().catch((error) => {
  p.log.error(`Unexpected error: ${error}`)
  process.exit(1)
})
