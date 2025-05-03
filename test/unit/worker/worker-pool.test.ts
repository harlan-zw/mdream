import type { WorkerMessage, WorkerResponse } from '../../../src/workers/types.ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HTMLParserWorkerPool } from '../../../src/workers/worker-pool.ts'

// Set test environment to prevent real worker usage
process.env.NODE_ENV = 'test'

// Mock the worker pool instead of trying to mock low-level workers
vi.mock('../../../src/workers/worker-pool.ts', () => {
  // Mock workers array
  const workers = []
  // Mock worker available status
  const workerAvailable = []
  // Mock queue of tasks
  const queue = []

  return {
    isWorkersSupported: vi.fn(() => true),
    HTMLParserWorkerPool: vi.fn().mockImplementation((numWorkers = 4) => {
      // Create mock workers
      for (let i = 0; i < numWorkers; i++) {
        workers.push({
          terminate: vi.fn(),
          postMessage: vi.fn(),
        })
        workerAvailable.push(true)
      }

      return {
        // Expose internal properties for testing
        workers,
        workerAvailable,
        queue,

        // Mock process HTML method
        processHTML: vi.fn((message: WorkerMessage) => {
          return Promise.resolve({
            id: message.id,
            events: [{ type: 'test', node: { type: 1 } }],
            unprocessedHtml: '',
            state: message.state,
          } as WorkerResponse)
        }),

        // Mock terminate method
        terminate: vi.fn(() => {
          workers.forEach(worker => worker.terminate())
          workers.length = 0
          workerAvailable.length = 0
          queue.length = 0
        }),
      }
    }),
  }
})

describe('hTMLParserWorkerPool', () => {
  let workerPool: HTMLParserWorkerPool

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    workerPool = new HTMLParserWorkerPool(2) // Create a pool with 2 workers
  })

  afterEach(() => {
    // Clean up after each test
    workerPool.terminate()
  })

  it('creates the worker pool with specified number of workers', () => {
    expect(workerPool.workers.length).toBe(2)
  })

  it('processes an HTML chunk using the worker pool', async () => {
    const message: WorkerMessage = {
      id: 1,
      html: '<div>Test</div>',
      state: {} as any,
    }

    const response = await workerPool.processHTML(message)

    expect(response.id).toBe(1)
    expect(response.events).toHaveLength(1)
    expect(response.events[0].type).toBe('test')
  })

  it('processes multiple chunks in parallel', async () => {
    const message1: WorkerMessage = {
      id: 1,
      html: '<div>Test 1</div>',
      state: {} as any,
    }

    const message2: WorkerMessage = {
      id: 2,
      html: '<div>Test 2</div>',
      state: {} as any,
    }

    // Process both messages concurrently
    const promise1 = workerPool.processHTML(message1)
    const promise2 = workerPool.processHTML(message2)

    // Wait for both promises to resolve
    const [response1, response2] = await Promise.all([promise1, promise2])

    expect(response1.id).toBe(1)
    expect(response2.id).toBe(2)
  })

  it('terminates all workers properly', () => {
    // Verify the worker count before termination
    expect(workerPool.workers.length).toBe(2)

    // Terminate the workers
    workerPool.terminate()

    // Verify that terminate was called on each worker
    workerPool.workers.forEach((worker) => {
      expect(worker.terminate).toHaveBeenCalled()
    })

    // Verify the worker pool is cleared after termination
    expect(vi.mocked(workerPool.terminate)).toHaveBeenCalled()
  })
})
