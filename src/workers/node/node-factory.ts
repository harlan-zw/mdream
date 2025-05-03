/**
 * Node.js worker factory implementation
 */
import type {HTMLParserWorker, WorkerFactory, WorkerFactoryOptions, WorkerMessage, WorkerResponse} from '../types.ts'
import { cpus } from 'node:os'
import { Worker } from 'node:worker_threads'

// Default export for the node worker factory
const nodeWorkerFactory: WorkerFactory = (options?: WorkerFactoryOptions) => {
  const maxWorkers = options?.maxWorkers || 0

  // Try to determine the number of CPUs for optimal worker count
  let cpuCount = 4 // Default if we can't detect
  try {
    cpuCount = cpus().length
  } catch (e) {
    // Ignore errors if os module is not available
  }

  /**
   * Get the recommended worker count based on available CPUs
   */
  const getRecommendedWorkerCount = () => {
    return maxWorkers > 0 ? maxWorkers : Math.max(1, Math.min(cpuCount - 1, 4))
  }

  /**
   * Create a new Node.js worker
   */
  const createWorker = (): HTMLParserWorker => {
    try {
      // Try creating with different paths for bundled or development environments
      let nodeWorker: any
      try {
        nodeWorker = new Worker('./dist/workers/node/parser.worker.mjs')
      } catch (e) {
        try {
          nodeWorker = new Worker(new URL('./parser.worker.ts', import.meta.url))
        } catch (e2) {
          throw new Error(`Failed to create Node.js worker: ${e2}`)
        }
      }

      return {
        postMessage: (message: WorkerMessage) => {
          nodeWorker.postMessage(JSON.stringify(message))
        },

        onMessage: (callback: (response: WorkerResponse) => void) => {
          nodeWorker.once('message', callback)
        },

        onError: (callback: (error: Error) => void) => {
          nodeWorker.on('error', callback)
        },

        terminate: () => {
          nodeWorker.terminate()
        }
      }
    } catch (e) {
      throw new Error(`Node.js workers not supported in this environment: ${e}`)
    }
  }

  return {
    createWorker,
    getRecommendedWorkerCount
  }
}

export default nodeWorkerFactory
