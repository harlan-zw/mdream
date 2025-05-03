import type { WorkerResponse } from '../../../src/workers/types.ts'
import { beforeEach, describe, expect, it } from 'vitest'
import { OrderedChunkQueue } from '../../../src/workers/queue.ts'

// Set test environment
process.env.NODE_ENV = 'test'

describe('orderedChunkQueue', () => {
  let queue: OrderedChunkQueue

  beforeEach(() => {
    queue = new OrderedChunkQueue()
  })

  it('processes chunks in order when added sequentially', () => {
    const processedChunks: WorkerResponse[] = []

    // Create test chunks
    const chunk0: WorkerResponse = { id: 0, events: [], unprocessedHtml: '', state: {} as any }
    const chunk1: WorkerResponse = { id: 1, events: [], unprocessedHtml: '', state: {} as any }
    const chunk2: WorkerResponse = { id: 2, events: [], unprocessedHtml: '', state: {} as any }

    // Add chunks in order
    queue.addChunk(chunk0)
    queue.addChunk(chunk1)
    queue.addChunk(chunk2)

    // Set up waitForChunk promises
    const promise0 = queue.waitForChunk(0).then((chunk) => { processedChunks.push(chunk); return chunk })
    const promise1 = queue.waitForChunk(1).then((chunk) => { processedChunks.push(chunk); return chunk })
    const promise2 = queue.waitForChunk(2).then((chunk) => { processedChunks.push(chunk); return chunk })

    // Wait for all promises to resolve
    return Promise.all([promise0, promise1, promise2]).then(() => {
      expect(processedChunks.length).toBe(3)
      expect(processedChunks[0].id).toBe(0)
      expect(processedChunks[1].id).toBe(1)
      expect(processedChunks[2].id).toBe(2)
    })
  })

  it('processes chunks in order when added out of order', async () => {
    const processedChunks: WorkerResponse[] = []

    // Create test chunks
    const chunk0: WorkerResponse = { id: 0, events: [], unprocessedHtml: '', state: {} as any }
    const chunk1: WorkerResponse = { id: 1, events: [], unprocessedHtml: '', state: {} as any }
    const chunk2: WorkerResponse = { id: 2, events: [], unprocessedHtml: '', state: {} as any }

    // Set up waitForChunk promises before adding any chunks
    const promise0 = queue.waitForChunk(0).then((chunk) => { processedChunks.push(chunk); return chunk })
    const promise1 = queue.waitForChunk(1).then((chunk) => { processedChunks.push(chunk); return chunk })
    const promise2 = queue.waitForChunk(2).then((chunk) => { processedChunks.push(chunk); return chunk })

    // Add chunks out of order
    queue.addChunk(chunk1) // Add chunk 1 first
    queue.addChunk(chunk2) // Add chunk 2 second
    queue.addChunk(chunk0) // Add chunk 0 last

    // Wait for all promises to resolve
    await Promise.all([promise0, promise1, promise2])

    // Check that chunks were processed in order despite being added out of order
    expect(processedChunks.length).toBe(3)
    expect(processedChunks[0].id).toBe(0)
    expect(processedChunks[1].id).toBe(1)
    expect(processedChunks[2].id).toBe(2)
  })

  it('handles a large number of out-of-order chunks correctly', async () => {
    const numChunks = 100
    const processedChunks: WorkerResponse[] = []
    const promises: Promise<WorkerResponse>[] = []

    // Create promises for all chunks
    for (let i = 0; i < numChunks; i++) {
      promises.push(queue.waitForChunk(i).then((chunk) => {
        processedChunks.push(chunk)
        return chunk
      }))
    }

    // Add chunks in reverse order
    for (let i = numChunks - 1; i >= 0; i--) {
      queue.addChunk({
        id: i,
        events: [],
        unprocessedHtml: '',
        state: {} as any,
      })
    }

    // Wait for all promises to resolve
    await Promise.all(promises)

    // Check that all chunks were processed in order
    expect(processedChunks.length).toBe(numChunks)
    for (let i = 0; i < numChunks; i++) {
      expect(processedChunks[i].id).toBe(i)
    }
  })

  it('clears the queue correctly', async () => {
    const chunk0: WorkerResponse = { id: 0, events: [], unprocessedHtml: '', state: {} as any }
    const chunk1: WorkerResponse = { id: 1, events: [], unprocessedHtml: '', state: {} as any }

    // Add a chunk
    queue.addChunk(chunk0)

    // Wait for the first chunk
    const promise0 = queue.waitForChunk(0)
    await promise0

    // Set up a promise for the next chunk
    const promise1 = queue.waitForChunk(1)

    // Clear the queue
    queue.clear()

    // Add the second chunk after clearing
    queue.addChunk(chunk1)

    // The promise should still resolve with an empty response
    const result = await promise1
    expect(result.id).toBe(1)
  })

  it('returns the correct next chunk ID', () => {
    expect(queue.getNextChunkId()).toBe(0)

    // Add some chunks
    queue.addChunk({ id: 0, events: [], unprocessedHtml: '', state: {} as any })
    expect(queue.getNextChunkId()).toBe(1)

    queue.addChunk({ id: 1, events: [], unprocessedHtml: '', state: {} as any })
    expect(queue.getNextChunkId()).toBe(2)

    // Add an out-of-order chunk
    queue.addChunk({ id: 3, events: [], unprocessedHtml: '', state: {} as any })
    // The next chunk ID should be the highest ID + 1
    expect(queue.getNextChunkId()).toBe(3 + 1)

    // Process all chunks
    queue.waitForChunk(0)
    queue.waitForChunk(1)
    queue.waitForChunk(2) // This will wait for chunk 2 which doesn't exist yet
    queue.waitForChunk(3)

    // Add the missing chunk
    queue.addChunk({ id: 2, events: [], unprocessedHtml: '', state: {} as any })
    expect(queue.getNextChunkId()).toBe(4)
  })
})
