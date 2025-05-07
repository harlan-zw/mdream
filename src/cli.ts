import { Readable } from 'node:stream'
import { cac } from 'cac'
import { streamHtmlToMarkdown } from './stream.ts'

/**
 * CLI options interface
 */
interface CliOptions {
  origin?: string
}

async function streamingConvert(options: CliOptions = {}) {
  const outputStream = process.stdout

  // Create a single markdown generator that processes the chunked HTML
  const markdownGenerator = streamHtmlToMarkdown(Readable.toWeb(process.stdin), options)

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
  .option('--strategy <strategy>', 'Conversion strategy: minimal, minimal-from-first-header, full', {
    default: 'full',
  })
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli
  .help()
  .version('1.0.0')
  .parse()
