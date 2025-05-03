/**
 * Type definitions for worker-related interfaces
 */

export interface WorkerMessage {
  /** Unique ID for this chunk to maintain order */
  id: number
  /** HTML chunk to process */
  html: string
  /** Processing state */
  state: any // Using any here to avoid circular imports with MdreamProcessingState
}

/**
 * Worker response structure
 */
export interface WorkerResponse {
  /** Matches the incoming chunk ID */
  id: number
  /** Parsed node events */
  events: any[] // Using any[] here to avoid circular imports with NodeEvent
  /** Any unprocessed HTML */
  unprocessedHtml: string
  /** Updated state */
  state: any
  /** Error message if processing failed */
  error?: string
}

/**
 * Interface for a worker implementation
 */
export interface HTMLParserWorker {
  /** Post a message to the worker */
  postMessage(message: WorkerMessage): void

  /** Set up a one-time message handler */
  onMessage(callback: (response: WorkerResponse) => void): void

  /** Set up an error handler */
  onError(callback: (error: Error) => void): void

  /** Terminate the worker */
  terminate(): void
}

/**
 * Configuration options for worker factories
 */
export interface WorkerFactoryOptions {
  /** Maximum number of workers to create */
  maxWorkers?: number
}

/**
 * Worker factory function type
 */
export type WorkerFactory = (options?: WorkerFactoryOptions) => {
  /** Create a new worker */
  createWorker: () => HTMLParserWorker

  /** Get the recommended number of workers for the current environment */
  getRecommendedWorkerCount: () => number
}
