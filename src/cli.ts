import type { HTMLToMarkdownOptions } from './types.ts'
import { cac } from 'cac'
import { streamHtmlToMarkdown } from './stream.ts'

/**
 * CLI options interface
 */
interface CliOptions {
  chunkSize?: number | string
  verbose?: boolean
  origin?: string
  delay?: number | string
}

/**
 * Creates a configured logger based on verbosity setting
 */
function createLogger(options: CliOptions = {}) {
  // Safely access properties with fallbacks
  const verbose = options?.verbose === true

  // Return a no-op function if verbose is false
  if (!verbose) {
    return () => {} // Does nothing when called
  }

  // Return an actual logging function when verbose is true
  const startTime = Date.now()
  return (message: string) => {
    const elapsed = Date.now() - startTime
    process.stdout.write(`[${elapsed}ms] ${message}\n`)
  }
}

function nodeStreamToWebReadable(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array | string> {
  nodeStream.setEncoding('utf8') // Ensure we get string chunks

  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(chunk)
      })

      nodeStream.on('end', () => {
        controller.close()
      })

      nodeStream.on('error', (err) => {
        controller.error(err)
      })
    },
  })
}

/**
 * Introduces an artificial delay
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function streamingConvert(options: CliOptions = {}) {
  // Create logger with safe property access
  const log = createLogger({ verbose: options?.verbose === true })

  log('streamingConvert started')

  // Configure conversion options with safe property access
  const chunkSize = Number.parseInt(String(options?.chunkSize || ''), 10) || 4096
  const delayMs = Number.parseInt(String(options?.delay || ''), 10) || 0

  const convertOptions: HTMLToMarkdownOptions = {
    chunkSize,
  }

  // Add origin if provided
  if (options?.origin) {
    convertOptions.origin = options.origin
    log(`Using origin ${convertOptions.origin}`)
  }

  log(`Using chunk size ${chunkSize} with delay ${delayMs}ms`)

  const inputStream = process.stdin
  const outputStream = process.stdout

  log('Reading from stdin, writing to stdout')

  try {
    log('Starting conversion process')

    // Create a single markdown generator that processes the chunked HTML
    const markdownGenerator = streamHtmlToMarkdown(nodeStreamToWebReadable(inputStream), convertOptions)

    // Process the markdown output with optional delay
    for await (const markdownChunk of markdownGenerator) {
      if (markdownChunk && markdownChunk.length > 0) {
        log(`Writing markdown chunk of length ${markdownChunk.length}`)
        outputStream.write(markdownChunk)

        // Add artificial delay if configured
        if (delayMs > 0) {
          log(`Delaying for ${delayMs}ms before next chunk`)
          await sleep(delayMs)
        }
      }
    }

    log('Conversion completed successfully')
  }
  catch (error) {
    log(`Conversion error: ${(error as Error)?.message || 'Unknown error'}`)
    throw error
  }
}

const cli = cac()

cli.command('[options]', 'Convert HTML from stdin to Markdown on stdout')
  .option('--chunk-size <size>', 'Chunk size for streaming', { default: 4096 })
  .option('-v, --verbose', 'Enable verbose debug logging')
  .option('--origin <url>', 'Origin URL for resolving relative image paths')
  .option('--delay <ms>', 'Artificial delay in ms between processing chunks', { default: 0 })
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli
  .help()
  .version('1.0.0')
  .parse()
