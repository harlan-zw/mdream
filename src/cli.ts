import type { HTMLToMarkdownOptions } from './types.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { cac } from 'cac'
import { withMinimalPreset } from './preset/minimal.ts'
import { streamHtmlToMarkdown } from './stream.ts'

/**
 * CLI options interface
 */
interface CliOptions {
  origin?: string
  preset?: string
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

cli
  .help()
  .version(version)
  .parse()
