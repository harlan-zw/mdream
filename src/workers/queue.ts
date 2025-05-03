import type { WorkerResponse } from './types.ts'

/**
 * A queue that ensures chunks are processed in order
 * even when processed in parallel
 */
export class OrderedChunkQueue {
  private orderedChunks: Map<number, WorkerResponse> = new Map()
  private nextChunkId = 0
  private callbacks: Map<number, (chunk: WorkerResponse) => void> = new Map()

  /**
   * Add a processed chunk to the queue
   * @param chunk - The processed chunk
   * @returns true if the chunk was processed in order, false if it's waiting
   */
  addChunk(chunk: WorkerResponse): boolean {
    const chunkId = chunk.id

    // If this is the next chunk in order, process it and any subsequent chunks that are ready
    if (chunkId === this.nextChunkId) {
      this.processNextChunks(chunk)
      return true
    }

    // Otherwise, store it for later processing
    this.orderedChunks.set(chunkId, chunk)
    return false
  }

  /**
   * Process chunks in order, starting from the given chunk
   * @param chunk - The next chunk to process
   */
  private processNextChunks(chunk: WorkerResponse): void {
    // Process the current chunk
    this.processChunk(chunk)
    this.nextChunkId++

    // Process any subsequent chunks that are ready
    let nextChunk = this.orderedChunks.get(this.nextChunkId)
    while (nextChunk) {
      this.orderedChunks.delete(this.nextChunkId)
      this.processChunk(nextChunk)
      this.nextChunkId++
      nextChunk = this.orderedChunks.get(this.nextChunkId)
    }
  }

  /**
   * Process a chunk by calling its associated callback
   * @param chunk - The chunk to process
   */
  private processChunk(chunk: WorkerResponse): void {
    const callback = this.callbacks.get(chunk.id)
    if (callback) {
      callback(chunk)
      this.callbacks.delete(chunk.id)
    }
  }

  /**
   * Wait for a specific chunk to be processed
   * @param chunkId - The ID of the chunk to wait for
   * @returns A promise that resolves with the processed chunk
   */
  waitForChunk(chunkId: number): Promise<WorkerResponse> {
    return new Promise((resolve) => {
      // If the chunk is already in the queue, and it's time to process it, do so immediately
      if (chunkId === this.nextChunkId) {
        const chunk = this.orderedChunks.get(chunkId)
        if (chunk) {
          this.orderedChunks.delete(chunkId)
          this.processNextChunks(chunk)
          resolve(chunk)
          return
        }
      }
      else if (chunkId < this.nextChunkId) {
        // This chunk has already been processed, this shouldn't happen
        // but we'll resolve with a dummy response to avoid hanging
        console.warn(`Requested chunk ${chunkId} has already been processed`)
        resolve({
          id: chunkId,
          events: [],
          unprocessedHtml: '',
          state: {} as any,
        })
        return
      }

      // Otherwise, store the callback for when the chunk is processed
      this.callbacks.set(chunkId, resolve)
    })
  }

  /**
   * Get the next chunk ID to use
   * @returns The next chunk ID
   */
  getNextChunkId(): number {
    // Find the max chunk ID in the ordered chunks, or -1 if there are none
    const maxChunkId = Array.from(this.orderedChunks.keys()).reduce(
      (max, id) => Math.max(max, id),
      this.nextChunkId - 1,
    )

    // Return the maximum of nextChunkId or maxChunkId+1
    return Math.max(this.nextChunkId, maxChunkId + 1)
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.orderedChunks.clear()
    this.nextChunkId = 0

    // Resolve any pending callbacks with empty responses
    for (const [id, callback] of this.callbacks) {
      callback({
        id,
        events: [],
        unprocessedHtml: '',
        state: {} as any,
      })
    }

    this.callbacks.clear()
  }
}
