import type { HTMLToMarkdownOptions } from './types.ts'
import { Readable } from 'node:stream'
import { cac } from 'cac'
import { withMinimalPreset } from './preset/minimal.ts'
import { streamHtmlToMarkdown } from './stream.ts'

/**
 * CLI options interface
 */
interface CliOptions {
  origin?: string
  filters?: string
}

async function streamingConvert(options: CliOptions = {}) {
  const outputStream = process.stdout
  let conversionOptions: HTMLToMarkdownOptions = { origin: options.origin }

  // Apply the appropriate preset based on the filter option
  if (options.filters === 'minimal') {
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

const cli = cac()

cli.command('[options]', 'Convert HTML from stdin to Markdown on stdout')
  .option('--origin <url>', 'Origin URL for resolving relative image paths')
  .option('--preset <preset>', 'Conversion presets: minimal')
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli
  .help()
  .version('1.0.0')
  .parse()
