/**
 * Web worker factory implementation
 */
import type {HTMLParserWorker, WorkerFactory, WorkerFactoryOptions, WorkerMessage, WorkerResponse} from '../types.ts'

// Default export for the web worker factory
const webWorkerFactory: WorkerFactory = (options?: WorkerFactoryOptions) => {
  const maxWorkers = options?.maxWorkers || 0

  /**
   * Get the recommended worker count for web environments
   * Web browsers typically benefit from fewer workers to avoid excessive thread creation
   */
  const getRecommendedWorkerCount = () => {
    // Use user-specified count, or default to browser recommendation
    return maxWorkers > 0 ? maxWorkers :
      (navigator?.hardwareConcurrency
        ? Math.min(navigator.hardwareConcurrency - 1, 4)
        : 2)
  }

  /**
   * Create a new Web worker
   */
  const createWorker = (): HTMLParserWorker => {
    try {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        throw new Error('Web Workers not supported in this environment')
      }

      // Try creating with different paths for bundled or development environments
      let webWorker: Worker
      try {
        webWorker = new Worker(new URL('./parser.worker.web.ts', import.meta.url))
      } catch (e) {
        try {
          webWorker = new Worker('./workers/parser.worker.web.js')
        } catch (e2) {
          throw new Error(`Failed to create Web Worker: ${e2}`)
        }
      }

      return {
        postMessage: (message: WorkerMessage) => {
          webWorker.postMessage(message)
        },

        onMessage: (callback: (response: WorkerResponse) => void) => {
          const onMessageHandler = (event: MessageEvent) => {
            webWorker.removeEventListener('message', onMessageHandler)
            callback(event.data)
          }
          webWorker.addEventListener('message', onMessageHandler)
        },

        onError: (callback: (error: Error) => void) => {
          webWorker.addEventListener('error', (event) => {
            callback(new Error(event.message))
          })
        },

        terminate: () => {
          webWorker.terminate()
        }
      }
    } catch (e) {
      throw new Error(`Web Workers not supported in this environment: ${e}`)
    }
  }

  return {
    createWorker,
    getRecommendedWorkerCount
  }
}

export default webWorkerFactory
