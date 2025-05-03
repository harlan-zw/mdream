import type { HTMLToMarkdownOptions, MdreamRuntimeState, NodeEvent } from './types.ts'
import type { WorkerMessage} from './workers/types.ts'
import { DEFAULT_CHUNK_SIZE } from './const.ts'
import { processHtmlEventToMarkdown } from './markdown.ts'
import { processPartialHTMLToMarkdown } from './parser.ts'
import { OrderedChunkQueue } from './workers/queue.ts'
import { HTMLParserWorkerPool, isWorkersSupported } from './workers/worker-pool.ts'

// Check if worker threads are supported in the current environment
// Disable workers in test environment to prevent test interference
// But explicitly enable for worker tests
const WORKERS_SUPPORTED = true /*false /*isWorkersSupported()
  && (process.env.NODE_ENV === 'worker-test'
    || (process.env.NODE_ENV !== 'test'
      && process.env.NODE_ENV !== 'vitest')) */

/**
 * Creates a markdown stream from an HTML stream with parallel processing
 * @param htmlStream - ReadableStream of HTML content (as Uint8Array or string)
 * @param options - Configuration options for conversion
 * @returns An async generator yielding markdown chunks
 */
export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string>,
  options: HTMLToMarkdownOptions = {},
): AsyncIterable<string> {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()

  // Initialize worker pool if supported and not explicitly disabled
  // Workers are enabled by default with 4 threads
  const useWorkers = true // WORKERS_SUPPORTED && options.useWorkers !== false
  let workerPool = null
  let chunkQueue = null

  if (useWorkers) {
    try {
      if (options.worker) {
        // Use custom worker configuration
        workerPool = new HTMLParserWorkerPool(
          options.worker.factory,
          // { maxWorkers: options.worker.maxWorkers }
        )
      } else {
        // Use default worker configuration
        workerPool = new HTMLParserWorkerPool(options.workerCount)
      }
      chunkQueue = new OrderedChunkQueue()
    }
    catch (error) {
      console.warn(`Failed to initialize worker pool: ${error}. Falling back to single-threaded mode.`)
      // Fall back to single-threaded mode
    }
  }

  // Initialize state
  const state: Partial<MdreamRuntimeState> = {
    options,
    buffer: '',
  }

  let inputBuffer = ''
  let pendingHtml = ''
  let chunkId = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process any remaining content
        if (inputBuffer.length > 0 || pendingHtml.length > 0) {
          const finalChunk = pendingHtml + inputBuffer
          if (finalChunk.length > 0) {
            if (useWorkers && workerPool && chunkQueue) {
              // Process final chunk and wait for all pending chunks to complete
              const finalResultPromise = processChunkWithWorker(
                workerPool,
                chunkQueue,
                finalChunk,
                chunkId++,
                { ...state } as MdreamRuntimeState,
              )

              // Wait for final result
              const result = await finalResultPromise

              if (result.chunk) {
                yield result.chunk
              }
            }
            else {
              const { chunk } = processPartialHTMLToMarkdown(finalChunk, state)
              if (chunk) {
                yield chunk
              }
            }
          }
        }
        break
      }

      // Decode binary chunk to string if needed
      inputBuffer += typeof value === 'string'
        ? value
        : decoder.decode(value, { stream: true })

      // Process buffer in chunks
      const pendingResults: Promise<{
        chunk: string
        remainingHTML: string
        state: MdreamRuntimeState
      }>[] = []

      while (inputBuffer.length >= chunkSize) {
        const currentChunk = pendingHtml + inputBuffer.slice(0, chunkSize)

        if (useWorkers && workerPool && chunkQueue) {
          // Process with worker threads - send to worker immediately without waiting
          // This allows parallel processing of multiple chunks
          const resultPromise = processChunkWithWorker(
            workerPool,
            chunkQueue,
            currentChunk,
            chunkId++,
            { ...state } as MdreamRuntimeState,
          )

          // Store the promise to be awaited later - we'll collect results in order
          pendingResults.push(resultPromise)

          // Reset pendingHtml for now - it will be updated when we consume the result
          pendingHtml = ''
        }
        else {
          // Process with the main thread (unchanged)
          const result = processPartialHTMLToMarkdown(currentChunk, state)

          if (result.chunk) {
            yield result.chunk
          }

          pendingHtml = result.remainingHTML
        }

        inputBuffer = inputBuffer.slice(chunkSize)
      }

      // Process any pending results in order
      if (pendingResults.length > 0) {
        for (const resultPromise of pendingResults) {
          const result = await resultPromise

          if (result.chunk) {
            yield result.chunk
          }

          pendingHtml = result.remainingHTML

          // Merge the state back
          Object.assign(state, result.state)
        }
      }
    }
    // Final cleanup - decode any remaining bytes
    if (inputBuffer.length === 0) {
      const finalBytes = decoder.decode()
      if (finalBytes) {
        if (useWorkers && workerPool && chunkQueue) {
          // Process final decoder bytes
          const finalResultPromise = processChunkWithWorker(
            workerPool,
            chunkQueue,
            pendingHtml + finalBytes,
            chunkId++,
            { ...state } as MdreamRuntimeState,
          )

          // Wait for this final result
          const result = await finalResultPromise

          if (result.chunk) {
            yield result.chunk
          }
        }
        else {
          const result = processPartialHTMLToMarkdown(pendingHtml + finalBytes, state)
          if (result.chunk) {
            yield result.chunk
          }
        }
      }
    }
  }
  finally {
    reader.releaseLock()
    // Cleanup worker pool if used
    if (workerPool) {
      workerPool.terminate()
    }
  }
}

/**
 * Process an HTML chunk using a worker thread
 * @param workerPool - The worker pool to use
 * @param chunkQueue - The ordered chunk queue
 * @param html - The HTML to process
 * @param chunkId - The ID of this chunk
 * @param state - The current state
 * @returns The result of processing the chunk
 */
async function processChunkWithWorker(
  workerPool: HTMLParserWorkerPool,
  chunkQueue: OrderedChunkQueue,
  html: string,
  chunkId: number,
  state: MdreamRuntimeState,
): Promise<{
  chunk: string
  remainingHTML: string
  state: MdreamRuntimeState
}> {
  // Send the chunk to a worker
  const message: WorkerMessage = {
    id: chunkId,
    html,
    state: state as MdreamRuntimeState,
  }

  // Process the chunk with a worker - don't wait for completion
  const workerPromise = workerPool.processHTML(message)

  // Set up a separate promise to add the result to the queue when it's ready
  workerPromise.then(workerResult => {
    chunkQueue.addChunk(workerResult)
  }).catch(error => {
    console.error(`Error processing chunk ${chunkId}:`, error)
  })

  // Wait for this chunk in the ordered queue (previous chunks may still be processing)
  const workerResult = await chunkQueue.waitForChunk(chunkId)

  // Convert worker events to markdown
  const { events, unprocessedHtml, state: updatedState } = workerResult
  const markdownChunk = processEventsToMarkdown(events, state)

  return {
    chunk: markdownChunk,
    remainingHTML: unprocessedHtml,
    state: updatedState,
  }
}

/**
 * Process a list of HTML node events into markdown
 * @param events - The events to process
 * @param state - The current state
 * @returns The markdown string
 */
function processEventsToMarkdown(events: NodeEvent[], state: MdreamRuntimeState): string {
  let chunk = ''
  for (const event of events) {
    let fragment: string | undefined

    fragment = processHtmlEventToMarkdown(event, state)
    if (fragment) {
      chunk += fragment
      state.buffer += fragment
    }
  }

  return chunk
}
