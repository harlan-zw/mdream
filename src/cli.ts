import type { HTMLToMarkdownOptions } from './types.ts';
import { pipeline, Transform } from 'node:stream';
import { promisify } from 'node:util';
import { cac } from 'cac';
import { createMarkdownStreamFromHTMLStream } from './htmlStreamAdapter.ts';

const pipelineAsync = promisify(pipeline);

/**
 * Creates a configured logger based on verbosity setting
 */
function createLogger(options = {}) {
  // Safely access properties with fallbacks
  const verbose = options?.verbose === true;

  // Return a no-op function if verbose is false
  if (!verbose) {
    return () => {}; // Does nothing when called
  }

  // Return an actual logging function when verbose is true
  const startTime = Date.now();
  return (message) => {
    const elapsed = Date.now() - startTime;
    process.stderr.write(`[${elapsed}ms] ${message}\n`);
  };
}

const cli = cac();

cli.command('[options]', 'Convert HTML from stdin to Markdown on stdout')
  .option('--chunk-size <size>', 'Chunk size for streaming', { default: 4096 })
  .option('-v, --verbose', 'Enable verbose debug logging')
  .action(async (options = {}) => {
    try {
      await streamingConvert(options);
    }
    catch (error) {
      console.error('Error:', error?.message || 'Unknown error');
      process.exit(1);
    }
  });

cli
  .help()
  .version('1.0.0')
  .parse();

/**
 * Creates a transform stream that converts HTML chunks to Markdown
 */
function createHtmlToMarkdownTransform(options = {}, log = () => {}) {
  let buffer = '';
  log('Creating transform stream');

  return new Transform({
    decodeStrings: false,
    encoding: 'utf8',
    transform(chunk, encoding, callback) {
      try {
        const chunkStr = chunk.toString();
        log(`Received chunk of length ${chunkStr.length}`);

        // Add new chunk to the buffer
        buffer += chunkStr;
        log(`Buffer size now ${buffer.length}`);

        // Process immediately
        (async () => {
          try {
            log('Processing buffer');

            // Create a generator for this chunk of HTML
            const generator = createMarkdownStreamFromHTMLStream([buffer], options);
            let processedAny = false;

            for await (const markdownChunk of generator) {
              if (markdownChunk && markdownChunk.length > 0) {
                processedAny = true;
                log(`Pushing markdown chunk of length ${markdownChunk.length}`);
                this.push(markdownChunk);
              }
            }

            if (processedAny) {
              log('Cleared buffer after processing');
              buffer = '';
            }
            else {
              log('No output generated, keeping buffer');
            }

            callback();
          }
          catch (err) {
            log(`Error in transform processing: ${err?.message || 'Unknown error'}`);
            callback(err);
          }
        })();
      }
      catch (error) {
        log(`Transform error: ${error?.message || 'Unknown error'}`);
        callback(error);
      }
    },
    flush(callback) {
      log(`Flush called with remaining buffer of length ${buffer.length}`);

      if (buffer.length > 0) {
        (async () => {
          try {
            const generator = createMarkdownStreamFromHTMLStream([buffer], options);

            for await (const markdownChunk of generator) {
              if (markdownChunk && markdownChunk.length > 0) {
                log(`Flush pushing markdown chunk of length ${markdownChunk.length}`);
                this.push(markdownChunk);
              }
            }

            log('Flush complete');
            callback();
          }
          catch (err) {
            log(`Flush error: ${err?.message || 'Unknown error'}`);
            callback(err);
          }
        })();
      }
      else {
        log('Nothing to flush');
        callback();
      }
    },
  });
}

async function streamingConvert(options = {}) {
  // Create logger with safe property access
  const log = createLogger({ verbose: options?.verbose === true });

  log('streamingConvert started');

  // Configure conversion options with safe property access
  const convertOptions = {
    chunkSize: parseInt(options?.chunkSize, 10) || 4096,
  };
  log(`Using chunk size ${convertOptions.chunkSize}`);

  // Always use stdin and stdout for streaming
  const inputStream = process.stdin;
  const outputStream = process.stdout;

  log('Reading from stdin, writing to stdout');

  // Create HTML to Markdown transform stream
  const transformStream = createHtmlToMarkdownTransform(convertOptions, log);

  try {
    log('Starting pipeline');
    // Connect stdin -> transform -> stdout
    await pipelineAsync(
      inputStream,
      transformStream,
      outputStream,
    );
    log('Pipeline completed successfully');
  }
  catch (error) {
    log(`Pipeline error: ${error?.message || 'Unknown error'}`);
    throw error;
  }
}
