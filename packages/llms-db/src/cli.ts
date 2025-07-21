#!/usr/bin/env node
import type { LlmsRepository } from './repository.ts'
import type { CreateEntryOptions } from './types.ts'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { dirname, join, resolve } from 'pathe'
import { withHttps } from 'ufo'
import { createArchive } from './archive.ts'
import { createRepository } from './drizzle-repository.ts'
import { normalizeUrl, validateUrl } from './utils.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Centralized repository creation with production detection
function createRepositoryWithAutoDetection(forceLocal = false) {
  if (forceLocal) {
    return createRepository({ production: false })
  }
  const isProduction = process.env.NODE_ENV === 'production' || !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)
  return createRepository({ production: isProduction })
}
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

interface CrawlOptions {
  url: string
  name?: string
  description?: string
  depth?: number
  maxPages?: number
  exclude?: string[]
  output?: string
  artifacts?: string
  local?: boolean
}

async function crawlUrl(options: CrawlOptions & { local?: boolean }) {
  const repository = createRepositoryWithAutoDetection(options.local)

  try {
    await repository.ensureDbDirectory()

    // Validate and normalize URL
    const urlWithProtocol = withHttps(options.url)
    if (!validateUrl(urlWithProtocol)) {
      p.log.error(`Invalid URL: ${urlWithProtocol}`)
      process.exit(1)
    }
    const normalizedUrl = normalizeUrl(urlWithProtocol)

    // Auto-generate name if not provided
    const entryName = options.name || new URL(normalizedUrl).hostname.replace(/^www\./, '')

    // Check if entry already exists by URL (dedupe by URL, not name)
    const existingEntry = await repository.getEntryByUrl(normalizedUrl)
    let entry

    if (existingEntry) {
      p.log.info(`Entry for URL "${normalizedUrl}" already exists (name: "${existingEntry.name}"), updating...`)
      entry = existingEntry

      // Update entry with new options if provided
      if (options.description || options.depth || options.maxPages || options.exclude) {
        // Update logic could be added here if needed
        p.log.info('Using existing entry configuration')
      }
    }
    else {
      // Create database entry
      const createOptions: CreateEntryOptions = {
        name: entryName,
        url: normalizedUrl,
        description: options.description,
        crawlDepth: options.depth || 3,
        maxPages: options.maxPages,
        excludePatterns: options.exclude,
      }

      p.intro(`📚 Creating new llms.txt entry: ${entryName}`)
      entry = await repository.createEntry(createOptions)
      p.log.success(`Created entry with ID: ${entry.id}`)
    }

    // Always crawl
    await crawlEntry(repository, entry.id, options.output)

    // Always generate llms.txt after crawling
    await generateLlmsTxtFromDb(repository)
  }
  catch (error) {
    p.log.error(`Failed to crawl: ${error}`)
    process.exit(1)
  }
  finally {
    repository.close()
  }
}

async function crawlEntry(repository: LlmsRepository, entryId: number, outputDir?: string) {
  try {
    const entry = await repository.getEntry(entryId)
    if (!entry) {
      p.log.error(`Entry with ID ${entryId} not found`)
      process.exit(1)
    }

    if (entry.status === 'crawling') {
      p.log.error(`Entry "${entry.name}" is already being crawled`)
      process.exit(1)
    }

    // Update status to crawling
    await repository.updateEntryStatus(entryId, 'crawling')

    p.log.info(`Starting crawl for: ${entry.name}`)

    // Import crawl functionality dynamically
    const { crawlAndGenerate } = await import('@mdream/crawl')

    // Prepare crawl options
    const crawlOptions = {
      urls: [entry.url],
      outputDir: resolve(outputDir || join(process.cwd(), '.mdream', 'crawls', entry.name)),
      driver: 'http' as const,
      maxRequestsPerCrawl: entry.maxPages || Number.MAX_SAFE_INTEGER,
      followLinks: true,
      maxDepth: entry.crawlDepth,
      generateLlmsTxt: true,
      generateLlmsFullTxt: true,
      generateIndividualMd: true,
      origin: entry.url,
      exclude: entry.excludePatterns,
      globPatterns: [{ baseUrl: entry.url, isGlob: false, pattern: entry.url }],
    }

    // Ensure output directory exists
    await mkdir(crawlOptions.outputDir, { recursive: true })

    const s = p.spinner()
    s.start('Crawling website...')

    // Start crawling with progress tracking
    const results = await crawlAndGenerate(crawlOptions, (progress) => {
      if (progress.crawling.status === 'processing') {
        const processed = progress.crawling.processed
        const current = progress.crawling.currentUrl
        if (current) {
          const shortUrl = current.length > 50 ? `${current.substring(0, 47)}...` : current
          s.message(`Crawling ${processed}: ${shortUrl}`)
        }
      }
    })

    s.stop('Crawl completed!')

    // Process results
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    // Store crawled pages in database
    for (const result of results) {
      await repository.addCrawledPage(
        entryId,
        result.url,
        result.title,
        result.content?.length,
        result.success,
        result.error,
      )
    }

    if (successful.length === 0) {
      await repository.updateEntryStatus(entryId, 'failed', 'No pages were successfully crawled')
      p.log.error('Crawl failed - no pages processed successfully')
      return
    }

    p.log.success(`Crawled ${successful.length} pages successfully`)
    if (failed.length > 0) {
      p.log.warn(`${failed.length} pages failed`)
    }

    // Create compressed archive
    const archivePath = await createArchive(crawlOptions.outputDir, entry.name)

    // Calculate archive size
    const { size } = await import('node:fs/promises').then(fs => fs.stat(archivePath))

    // Update database with artifacts info
    await repository.updateEntryArtifacts(entryId, archivePath, size, successful.length)
    await repository.updateEntryStatus(entryId, 'completed')

    // Record artifacts in database
    const artifactTypes = ['llms.txt', 'llms-full.txt', 'markdown', 'archive'] as const
    for (const type of artifactTypes) {
      let filePath = archivePath
      if (type !== 'archive') {
        filePath = join(crawlOptions.outputDir, `${type === 'markdown' ? 'md' : type}`)
      }
      await repository.addArtifact(entryId, type, filePath, type === 'archive' ? size : undefined)
    }

    p.outro(`🎉 Entry "${entry.name}" processed successfully!`)
    p.log.info(`Archive: ${archivePath}`)
    p.log.info(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`)
  }
  catch (error) {
    await repository.updateEntryStatus(entryId, 'failed', String(error))
    p.log.error(`Crawl failed: ${error}`)
    process.exit(1)
  }
}

async function listEntries() {
  const repository = createRepositoryWithAutoDetection()

  try {
    const entries = await repository.getAllEntries()

    if (entries.length === 0) {
      p.log.info('No entries found. Use "mdream-db add" to create your first entry.')
      return
    }

    console.log('\n📚 LLMs.txt Database Entries\n')

    for (const entry of entries) {
      const statusEmoji = {
        pending: '⏳',
        crawling: '🔄',
        completed: '✅',
        failed: '❌',
      }[entry.status]

      console.log(`${statusEmoji} ${entry.name}`)
      console.log(`   ID: ${entry.id}`)
      console.log(`   URL: ${entry.url}`)
      console.log(`   Status: ${entry.status}`)
      console.log(`   Pages: ${entry.pageCount}`)
      console.log(`   Created: ${new Date(entry.createdAt).toLocaleDateString()}`)

      if (entry.artifactsSize) {
        console.log(`   Size: ${(entry.artifactsSize / 1024 / 1024).toFixed(2)} MB`)
      }

      if (entry.errorMessage) {
        console.log(`   Error: ${entry.errorMessage}`)
      }

      console.log()
    }
  }
  finally {
    repository.close()
  }
}

async function generateLlmsTxtFromDb(repository: LlmsRepository, outputPath?: string) {
  const content = await repository.generateLlmsTxt()
  const filePath = resolve(outputPath || 'llms.txt')

  await writeFile(filePath, content, 'utf-8')
  p.log.success(`Generated llms.txt: ${filePath}`)
}

async function generateLlmsTxt(outputPath?: string) {
  const repository = createRepositoryWithAutoDetection()

  try {
    await generateLlmsTxtFromDb(repository, outputPath)
  }
  finally {
    repository.close()
  }
}

async function removeEntry(nameOrId: string, force: boolean = false) {
  const repository = createRepositoryWithAutoDetection()

  try {
    let entry = await repository.getEntryByName(nameOrId)
    if (!entry) {
      const id = Number.parseInt(nameOrId)
      if (!Number.isNaN(id)) {
        entry = await repository.getEntry(id)
      }
    }

    if (!entry) {
      p.log.error(`Entry "${nameOrId}" not found`)
      process.exit(1)
    }

    if (!force) {
      p.log.error(`Use --force to confirm removal of "${entry.name}"`)
      process.exit(1)
    }

    await repository.deleteEntry(entry.id)
    p.log.success(`Removed entry: ${entry.name}`)
  }
  finally {
    repository.close()
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    p.intro('📚 mdream-db - LLMs.txt Database Management')
    console.log('Commands:')
    console.log('  run <url>       Run crawler on a URL and generate llms.txt (creates/updates entry)')
    console.log('  recrawl <id>    Re-crawl an existing entry by ID or name')
    console.log('  list            List all entries in the database')
    console.log('  generate        Generate llms.txt from database entries')
    console.log('  remove <id>     Remove an entry from the database (use --force to skip confirmation)')
    console.log('\nRun Command Options:')
    console.log('  --name <name>           Custom name for the entry')
    console.log('  --description <desc>    Description of the site')
    console.log('  --depth <number>        Crawl depth (default: 3)')
    console.log('  --max-pages <number>    Maximum pages to crawl')
    console.log('  --output <dir>          Output directory for crawled files')
    console.log('  --local                 Force local mode (ignore production env vars)')
    console.log('\nGlobal Options:')
    console.log('  --help, -h      Show this help message')
    console.log('  --version, -v   Show version')
    return
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`mdream-db v${version}`)
    return
  }

  const [command, ...commandArgs] = args

  try {
    switch (command) {
      case 'run': {
        if (commandArgs.length === 0) {
          p.log.error('URL is required for run command')
          process.exit(1)
        }

        const [url] = commandArgs

        // Parse command line options
        const options: CrawlOptions = { url }

        // Parse flags
        for (let i = 1; i < commandArgs.length; i++) {
          const arg = commandArgs[i]
          if (arg === '--name' && i + 1 < commandArgs.length) {
            options.name = commandArgs[i + 1]
            i++
          }
          else if (arg === '--description' && i + 1 < commandArgs.length) {
            options.description = commandArgs[i + 1]
            i++
          }
          else if (arg === '--depth' && i + 1 < commandArgs.length) {
            options.depth = Number.parseInt(commandArgs[i + 1])
            i++
          }
          else if (arg === '--max-pages' && i + 1 < commandArgs.length) {
            options.maxPages = Number.parseInt(commandArgs[i + 1])
            i++
          }
          else if (arg === '--output' && i + 1 < commandArgs.length) {
            options.output = commandArgs[i + 1]
            i++
          }
          else if (arg === '--local') {
            options.local = true
          }
        }

        // No interactive prompts - use defaults for missing options

        await crawlUrl(options)
        break
      }

      case 'recrawl': {
        if (commandArgs.length === 0) {
          p.log.error('Entry ID or name is required for recrawl command')
          process.exit(1)
        }

        const [idOrName] = commandArgs
        const entryId = Number.parseInt(idOrName)

        if (Number.isNaN(entryId)) {
          // Try to find by name
          const repository = createRepositoryWithAutoDetection()
          try {
            const entry = await repository.getEntryByName(idOrName)

            if (!entry) {
              p.log.error(`Entry "${idOrName}" not found`)
              process.exit(1)
            }

            await crawlEntry(repository, entry.id)
            await generateLlmsTxtFromDb(repository)
          }
          finally {
            repository.close()
          }
        }
        else {
          const repository = createRepositoryWithAutoDetection()
          try {
            await crawlEntry(repository, entryId)
            await generateLlmsTxtFromDb(repository)
          }
          finally {
            repository.close()
          }
        }
        break
      }

      case 'list': {
        await listEntries()
        break
      }

      case 'generate': {
        const output = commandArgs[0]
        await generateLlmsTxt(output)
        break
      }

      case 'remove': {
        if (commandArgs.length === 0) {
          p.log.error('Entry ID or name is required for remove command')
          process.exit(1)
        }

        const [nameOrId] = commandArgs
        const force = commandArgs.includes('--force')
        await removeEntry(nameOrId, force)
        break
      }

      default:
        p.log.error(`Unknown command: ${command}`)
        p.log.info('Use --help to see available commands')
        process.exit(1)
    }
  }
  catch (error) {
    if (p.isCancel(error)) {
      p.cancel('Operation cancelled')
      process.exit(0)
    }

    p.log.error(`Error: ${error}`)
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  p.log.error(`Uncaught error: ${error}`)
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  p.log.error(`Unhandled rejection: ${error}`)
  process.exit(1)
})

main().catch((error) => {
  p.log.error(`Fatal error: ${error}`)
  process.exit(1)
})
