import type { MdreamOptions } from './types.js'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { cac } from 'cac'
import { dirname, join, resolve } from 'pathe'
import { createEngine } from './engine.js'
import { streamHtmlToMarkdown } from './index.js'
import { generateLlmsTxtArtifacts } from './llms-txt.js'
import { withMinimalPreset } from './preset/minimal.js'

/**
 * CLI options interface
 */
interface CliOptions {
  origin?: string
  preset?: string
  engine?: 'rust' | 'js'
}

/**
 * Generate llms.txt artifacts from HTML files
 */
interface LlmsOptions {
  patterns: string[]
  siteName?: string
  description?: string
  output: string
  artifacts?: string
  origin?: string
  engine?: 'rust' | 'js'
}

async function streamingConvert(options: CliOptions = {}) {
  const outputStream = process.stdout
  let conversionOptions: MdreamOptions = {
    origin: options.origin,
    engine: await createEngine(options.engine || 'rust'),
  }

  // Apply the appropriate preset based on the preset option
  if (options.preset === 'minimal') {
    conversionOptions = {
      ...withMinimalPreset(conversionOptions),
      engine: conversionOptions.engine,
    }
  }

  // Create a single markdown generator that processes the chunked HTML
  const markdownGenerator = streamHtmlToMarkdown(Readable.toWeb(process.stdin) as any, conversionOptions)

  // Process the markdown output with optional delay
  for await (const markdownChunk of markdownGenerator) {
    if (markdownChunk && markdownChunk.length > 0) {
      outputStream.write(markdownChunk)
    }
  }
}

async function generateLlms(patterns: string[], options: LlmsOptions) {
  try {
    // Parse artifacts - default to all if not specified
    const artifacts = options.artifacts ? options.artifacts.split(',').map(a => a.trim()) : ['llms.txt', 'llms-full.txt', 'markdown']

    // Normalize output directory
    const outputDir = resolve(options.output)

    const result = await generateLlmsTxtArtifacts({
      patterns,
      siteName: options.siteName,
      description: options.description,
      origin: options.origin,
      generateFull: artifacts.includes('llms-full.txt'),
      generateMarkdown: artifacts.includes('markdown'),
      engine: await createEngine(options.engine || 'rust'),
    })

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true })

    // Write llms.txt file
    const llmsPath = join(outputDir, 'llms.txt')
    await writeFile(llmsPath, result.llmsTxt, 'utf-8')

    // Write llms-full.txt if requested
    if (artifacts.includes('llms-full.txt') && result.llmsFullTxt) {
      const fullPath = join(outputDir, 'llms-full.txt')
      await writeFile(fullPath, result.llmsFullTxt, 'utf-8')
    }

    // Write individual markdown files if requested
    if (artifacts.includes('markdown') && result.markdownFiles) {
      for (const mdFile of result.markdownFiles) {
        const fullPath = join(outputDir, mdFile.path)
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, mdFile.content, 'utf-8')
      }
    }

    // Success message
    console.log(`✅ Generated llms.txt artifacts in: ${outputDir}`)
  }
  catch (error) {
    console.error('❌ Error generating llms.txt:', error)
    process.exit(1)
  }
}

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

const cli = cac()

cli.command('[options]', 'Convert HTML from stdin to Markdown on stdout')
  .option('--origin <url>', 'Origin URL for resolving relative image paths')
  .option('--preset <preset>', 'Conversion presets: minimal')
  .option('--engine <engine>', 'Markdown engine to use (rust or js)', { default: 'rust' })
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli.command('llms <patterns...>', 'Generate llms.txt artifacts from HTML files')
  .option('--site-name <name>', 'Name of the site for llms.txt header')
  .option('--description <desc>', 'Description of the site for llms.txt')
  .option('--origin <url>', 'Origin URL for resolving relative paths and generating absolute URLs')
  .option('-o, --output <dir>', 'Output directory for generated files', { default: process.cwd() })
  .option('--artifacts <list>', 'Comma-separated list of artifacts to generate: llms.txt,llms-full.txt,markdown', { default: 'llms.txt,llms-full.txt,markdown' })
  .option('--engine <engine>', 'Markdown engine to use (rust or js)', { default: 'rust' })
  .action(async (patterns: string[], opts) => {
    await generateLlms(patterns, { patterns, ...opts })
  })

cli
  .help()
  .version(version)
  .parse()
