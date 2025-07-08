import type { HTMLToMarkdownOptions } from './types.ts'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { cac } from 'cac'
import { generateLlmsTxtArtifacts } from './llms-txt.ts'
import { withMinimalPreset } from './preset/minimal.ts'
import { streamHtmlToMarkdown } from './stream.ts'

/**
 * CLI options interface
 */
interface CliOptions {
  origin?: string
  preset?: string
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
}

async function streamingConvert(options: CliOptions = {}) {
  const outputStream = process.stdout
  let conversionOptions: HTMLToMarkdownOptions = { origin: options.origin }

  // Apply the appropriate preset based on the preset option
  if (options.preset === 'minimal') {
    conversionOptions = withMinimalPreset(conversionOptions)
  }

  // Create a single markdown generator that processes the chunked HTML
  const markdownGenerator = streamHtmlToMarkdown(Readable.toWeb(process.stdin), conversionOptions)

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

    const result = await generateLlmsTxtArtifacts({
      patterns,
      siteName: options.siteName,
      description: options.description,
      origin: options.origin,
      generateFull: artifacts.includes('llms-full.txt'),
      generateMarkdown: artifacts.includes('markdown'),
    })

    // Ensure output directory exists
    await mkdir(options.output, { recursive: true })

    // Write llms.txt file
    const llmsPath = join(options.output, 'llms.txt')
    await writeFile(llmsPath, result.llmsTxt, 'utf-8')

    // Write llms-full.txt if requested
    if (artifacts.includes('llms-full.txt') && result.llmsFullTxt) {
      const fullPath = join(options.output, 'llms-full.txt')
      await writeFile(fullPath, result.llmsFullTxt, 'utf-8')
    }

    // Write individual markdown files if requested
    if (artifacts.includes('markdown') && result.markdownFiles) {
      for (const mdFile of result.markdownFiles) {
        const fullPath = join(options.output, mdFile.path)
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, mdFile.content, 'utf-8')
      }
    }
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
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli.command('llms <patterns...>', 'Generate llms.txt artifacts from HTML files')
  .option('--site-name <name>', 'Name of the site for llms.txt header')
  .option('--description <desc>', 'Description of the site for llms.txt')
  .option('--origin <url>', 'Origin URL for resolving relative paths and generating absolute URLs')
  .option('-o, --output <dir>', 'Output directory for generated files', { default: '.' })
  .option('--artifacts <list>', 'Comma-separated list of artifacts to generate: llms.txt,llms-full.txt,markdown', { default: 'llms.txt,llms-full.txt,markdown' })
  .action(async (patterns: string[], opts) => {
    await generateLlms(patterns, { patterns, ...opts })
  })

cli
  .help()
  .version(version)
  .parse()
