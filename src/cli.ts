import type { HTMLToMarkdownOptions } from './types.ts'
import { cac } from 'cac'
import { createMarkdownStreamFromHTMLStream } from './stream.ts'

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

/**
 * Creates a buffered async iterable from an input stream
 * Collects chunks up to chunkSize before yielding
 */
class ChunkedStreamReader {
  private buffer: string = ''
  private streamEnded: boolean = false
  private streamReader: AsyncIterator<string>
  private chunkSize: number

  constructor(stream: AsyncIterable<string>, chunkSize: number) {
    this.streamReader = stream[Symbol.asyncIterator]()
    this.chunkSize = chunkSize
  }

  async* iterate(): AsyncGenerator<string> {
    while (!this.streamEnded || this.buffer.length > 0) {
      // Try to fill buffer if not at desired chunk size and stream not ended
      while (!this.streamEnded && this.buffer.length < this.chunkSize) {
        const result = await this.streamReader.next()
        if (result.done) {
          this.streamEnded = true
          break
        }
        this.buffer += result.value
      }

      // Yield available chunk if we have any data
      if (this.buffer.length > 0) {
        const yieldSize = Math.min(this.buffer.length, this.chunkSize)
        const chunk = this.buffer.slice(0, yieldSize)
        this.buffer = this.buffer.slice(yieldSize)
        yield chunk
      }
    }
  }
}

/**
 * Creates an AsyncIterable from stdin
 */
async function* streamToAsyncIterable(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  // Set up stdin to provide string data
  stream.setEncoding('utf8')

  for await (const chunk of stream) {
    yield chunk as string
  }
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

    // Create HTML input stream from stdin
    const rawHtmlStream = streamToAsyncIterable(inputStream)

    // Use our chunked reader to read in chunks of the specified size
    const chunkedReader = new ChunkedStreamReader(rawHtmlStream, chunkSize)

    // Create a single markdown generator that processes the chunked HTML
    const markdownGenerator = createMarkdownStreamFromHTMLStream(chunkedReader.iterate(), convertOptions)

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
