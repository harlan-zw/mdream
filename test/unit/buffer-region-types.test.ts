import type {
  BufferRegion,
  Plugin,
  PluginCreationOptions,
  StreamingBufferRegion,
  StreamingMdreamState,
} from '../../src/types'
import { describe, expect, it } from 'vitest'

describe('buffer Region Types', () => {
  it('should define BufferRegion interface correctly', () => {
    // Test that BufferRegion interface compiles and has expected structure
    const mockElementNode = {
      type: 1,
      depth: 0,
      index: 0,
      name: 'div',
      attributes: {},
      depthMap: new Uint8Array(10),
    } as any

    const region: BufferRegion = {
      id: 'region-1',
      startNode: mockElementNode,
      include: true,
      depth: 1,
      isComplete: false,
    }

    expect(region.id).toBe('region-1')
    expect(region.include).toBe(true)
    expect(region.depth).toBe(1)
    expect(region.isComplete).toBe(false)
  })

  it('should define StreamingBufferRegion interface correctly', () => {
    const mockElementNode = {
      type: 1,
      depth: 0,
      index: 0,
      name: 'div',
      attributes: {},
      depthMap: new Uint8Array(10),
    } as any

    const streamingRegion: StreamingBufferRegion = {
      id: 'stream-region-1',
      startNode: mockElementNode,
      include: true,
      depth: 1,
      startChunkId: 0,
      canFlush: false,
      accumulatedContent: ['some content'],
      isPartiallyProcessed: false,
      lastProcessedPosition: 0,
    }

    expect(streamingRegion.startChunkId).toBe(0)
    expect(streamingRegion.canFlush).toBe(false)
    expect(streamingRegion.accumulatedContent).toEqual(['some content'])
    expect(streamingRegion.isPartiallyProcessed).toBe(false)
  })

  it('should define StreamingMdreamState interface correctly', () => {
    const streamingState: StreamingMdreamState = {
      currentChunkId: 1,
      lastFlushedChunkId: 0,
      pendingOutput: [],
      maxBufferedContent: 1024 * 1024,
      totalBufferedSize: 0,
      defaultIncludeNodes: true,
      bufferRegions: [],
      nodeRegionMap: new WeakMap(),
      regionContentBuffers: new Map(),
      formattingContext: new Map(),
    }

    expect(streamingState.currentChunkId).toBe(1)
    expect(streamingState.maxBufferedContent).toBe(1024 * 1024)
    expect(streamingState.defaultIncludeNodes).toBe(true)
    expect(streamingState.bufferRegions).toEqual([])
  })

  it('should define PluginCreationOptions interface correctly', () => {
    const options: PluginCreationOptions = {
      order: 10,
      priority: 5,
    }

    expect(options.order).toBe(10)
    expect(options.priority).toBe(5)
  })

  it('should define Plugin interface with new fields correctly', () => {
    const plugin: Plugin = {
      priority: 10,
      onChunkComplete: (state) => {
        // Mock implementation
      },
      onNodeEnter: (node, state) => {
        return 'test content'
      },
    }

    expect(plugin.priority).toBe(10)
    expect(typeof plugin.onChunkComplete).toBe('function')
    expect(typeof plugin.onNodeEnter).toBe('function')
  })
})
