import type {HTMLParserWorker, WorkerFactory, WorkerMessage, WorkerResponse} from './types.ts'
import nodeWorkerFactory from './node/node-factory.ts'

/**
 * Worker pool for parallel HTML parsing
 */
export class HTMLParserWorkerPool {
  private workers: HTMLParserWorker[] = []
  private workerAvailable: boolean[] = []
  private queue: [WorkerMessage, (response: WorkerResponse) => void][] = []
  private numWorkers: number
  private workerFactory: ReturnType<WorkerFactory>

  /**
   * Create a new worker pool
   * @param numWorkersOrFactory - Number of workers to create or a worker factory
   * @param factory - Optional worker factory (if first parameter is a number)
   */
  constructor(numWorkersOrFactory?: number | WorkerFactory, factory?: WorkerFactory) {
    // Handle different constructor signatures
    let workerCount: number | undefined
    let workerFactoryFn: WorkerFactory

    if (typeof numWorkersOrFactory === 'function') {
      // First argument is a factory function
      workerFactoryFn = numWorkersOrFactory
    } else {
      // First argument is worker count (or undefined)
      workerCount = numWorkersOrFactory
      workerFactoryFn = factory || nodeWorkerFactory // Default to Node.js workers
    }

    // Initialize worker factory
    this.workerFactory = workerFactoryFn({ maxWorkers: workerCount })

    // Use provided count or get recommended count from factory
    this.numWorkers = workerCount || this.workerFactory.getRecommendedWorkerCount()

    this.initialize()
  }

  private initialize(): void {
    for (let i = 0; i < this.numWorkers; i++) {
      try {
        const worker = this.workerFactory.createWorker()

        this.workers.push(worker)
        this.workerAvailable.push(true)

        // Setup message and error handling
        worker.onError((error: Error) => {
          console.error(`Worker error: ${error.message}`)
          this.restartWorker(i)
        })
      }
      catch (error) {
        console.warn(`Failed to create worker ${i}: ${error}`)
        // Continue with fewer workers
      }
    }
  }

  /**
   * Handle worker messages in a unified way
   */
  private handleWorkerMessage(workerIndex: number, response: WorkerResponse): void {
    // Mark worker as available
    this.workerAvailable[workerIndex] = true

    // Process next item in queue if any
    if (this.queue.length > 0) {
      const [nextMessage, nextCallback] = this.queue.shift()!
      this.processWithWorker(workerIndex, nextMessage, nextCallback)
    }
  }

  /**
   * Restart a worker after error
   * @param index - Index of worker to restart
   */
  private restartWorker(index: number): void {
    try {
      // Terminate the worker
      this.workers[index].terminate()
    }
    catch (e) {
      // Ignore termination errors
    }

    try {
      // Create a new worker
      const worker = this.workerFactory.createWorker()
      this.workers[index] = worker
      this.workerAvailable[index] = true

      // Set up error handling again
      worker.onError(() => {
        this.restartWorker(index)
      })
    }
    catch (error) {
      console.warn(`Failed to restart worker ${index}: ${error}`)
      // Remove this worker from the pool
      this.workers.splice(index, 1)
      this.workerAvailable.splice(index, 1)
    }
  }

  /**
   * Process an HTML chunk with a specific worker
   * @param workerIndex - Worker index to use
   * @param message - Message to process
   * @param callback - Callback to call with result
   */
  private processWithWorker(
    workerIndex: number,
    message: WorkerMessage,
    callback: (response: WorkerResponse) => void
  ): void {
    console.log('Processing with worker:', workerIndex, message.id)
    this.workerAvailable[workerIndex] = false

    const worker = this.workers[workerIndex]

    // Set up one-time message handler
    worker.onMessage((response: WorkerResponse) => {
      this.handleWorkerMessage(workerIndex, response)
      callback(response)
    })

    // Send the message to the worker
    worker.postMessage(message)
  }

  /**
   * Process an HTML chunk using a worker from the pool
   * @param message - Message containing HTML chunk and state
   * @returns Promise resolving to the worker response
   */
  processHTML(message: WorkerMessage): Promise<WorkerResponse> {
    return new Promise((resolve) => {
      // Start measuring performance
      const startTime = Date.now()

      // Create a wrapper for the callback to track performance
      const resolveWithTiming = (response: WorkerResponse) => {
        const endTime = Date.now()
        console.log(`Worker processed chunk ${message.id} in ${endTime - startTime}ms`)
        resolve(response)
      }

      // Find an available worker
      const availableWorkerIndex = this.workerAvailable.findIndex(available => available)

      if (availableWorkerIndex !== -1) {
        this.processWithWorker(availableWorkerIndex, message, resolveWithTiming)
      }
      else {
        // Queue the task if no workers are available
        console.log(`All workers busy, queuing chunk ${message.id}`)
        this.queue.push([message, resolveWithTiming])
      }
    })
  }

  /**
   * Terminate all workers in the pool
   */
  terminate(): void {
    for (const worker of this.workers) {
      if (worker) {
        try {
          worker.terminate()
        } catch (e) {
          // Ignore termination errors
        }
      }
    }

    this.workers = []
    this.workerAvailable = []
    this.queue = []
  }
}
