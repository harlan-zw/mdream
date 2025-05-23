import type {
  ElementNode,
  MdreamRuntimeState,
  StreamingBufferRegion,
  StreamingMdreamState,
} from '../../src/types'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  adjustRegionBoundariesForWordBoundaries,
  applyRegionFormatting,
  assembleBufferedContent,
  assembleRegionContent,
  calculateRegionPositions,
  cleanupFlushedRegions,
  closeBufferRegion,
  collectNodeContent,
  createBufferRegion,
  flushCompletedRegions,
  getFlushableRegions,
  handlePartialRegions,
  isNodeIncluded,
  preserveFormattingState,
  resolveRegionConflicts,
} from '../../src/buffer-region'

describe('buffer Region Core Functions', () => {
  let mockElementNode: ElementNode
  let mockState: MdreamRuntimeState
  let mockStreamingState: StreamingMdreamState

  beforeEach(() => {
    mockElementNode = {
      type: 1,
      depth: 1,
      index: 0,
      name: 'div',
      attributes: { class: 'content' },
      depthMap: new Uint8Array(10),
    } as ElementNode

    mockState = {
      defaultIncludeNodes: true,
      bufferRegions: [],
      nodeRegionMap: new WeakMap(),
      regionContentBuffers: new Map(),
      formattingContext: new Map(),
      fragments: [],
      currentMdPosition: 0,
    }

    mockStreamingState = {
      ...mockState,
      currentChunkId: 0,
      lastFlushedChunkId: -1,
      pendingOutput: [],
      streamingRegions: [],
      maxBufferedContent: 1024 * 1024,
      totalBufferedSize: 0,
      regionFragments: new Map(),
    } as StreamingMdreamState
  })

  describe('createBufferRegion', () => {
    it('should create a new buffer region', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)

      expect(region).not.toBeNull()
      expect(region!.include).toBe(true)
      expect(region!.startNode).toBe(mockElementNode)
      expect(region!.depth).toBe(1)
      expect(region!.isComplete).toBe(false)
      expect(mockState.bufferRegions).toHaveLength(1)
      expect(mockState.nodeRegionMap!.has(mockElementNode)).toBe(true)
      expect(mockState.regionContentBuffers!.has(region!.id)).toBe(true)
    })

    it('should return null if node already has a region', () => {
      // Create first region
      const firstRegion = createBufferRegion(mockElementNode, mockState, true)
      expect(firstRegion).not.toBeNull()

      // Try to create second region for same node
      const secondRegion = createBufferRegion(mockElementNode, mockState, false)
      expect(secondRegion).toBeNull()
      expect(mockState.bufferRegions).toHaveLength(1)
    })

    it('should initialize state fields if they do not exist', () => {
      const emptyState: MdreamRuntimeState = {}
      const region = createBufferRegion(mockElementNode, emptyState, true)

      expect(region).not.toBeNull()
      expect(emptyState.bufferRegions).toHaveLength(1)
      expect(emptyState.nodeRegionMap).toBeDefined()
      expect(emptyState.regionContentBuffers).toBeDefined()
    })
  })

  describe('closeBufferRegion', () => {
    it('should close an existing buffer region', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      expect(region!.isComplete).toBe(false)
      expect(region!.endNode).toBeUndefined()

      closeBufferRegion(mockElementNode, mockState)

      expect(region!.isComplete).toBe(true)
      expect(region!.endNode).toBe(mockElementNode)
    })

    it('should handle closing non-existent regions gracefully', () => {
      expect(() => closeBufferRegion(mockElementNode, mockState)).not.toThrow()
    })

    it('should handle empty state gracefully', () => {
      const emptyState: MdreamRuntimeState = {}
      expect(() => closeBufferRegion(mockElementNode, emptyState)).not.toThrow()
    })
  })

  describe('isNodeIncluded', () => {
    it('should return region inclusion state for nodes in regions', () => {
      createBufferRegion(mockElementNode, mockState, true)
      expect(isNodeIncluded(mockElementNode, mockState)).toBe(true)

      const excludedNode = { ...mockElementNode, name: 'span' } as ElementNode
      createBufferRegion(excludedNode, mockState, false)
      expect(isNodeIncluded(excludedNode, mockState)).toBe(false)
    })

    it('should check ancestor nodes for region membership', () => {
      const parentNode = { ...mockElementNode, name: 'parent' } as ElementNode
      const childNode = {
        ...mockElementNode,
        name: 'child',
        parent: parentNode,
      } as ElementNode

      createBufferRegion(parentNode, mockState, false)
      expect(isNodeIncluded(childNode, mockState)).toBe(false)
    })

    it('should return default inclusion state for nodes without regions', () => {
      mockState.defaultIncludeNodes = false
      expect(isNodeIncluded(mockElementNode, mockState)).toBe(false)

      mockState.defaultIncludeNodes = true
      expect(isNodeIncluded(mockElementNode, mockState)).toBe(true)
    })

    it('should default to true when defaultIncludeNodes is undefined', () => {
      delete mockState.defaultIncludeNodes
      expect(isNodeIncluded(mockElementNode, mockState)).toBe(true)
    })
  })

  describe('collectNodeContent', () => {
    it('should collect content into region buffers', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, 'test content', mockState)

      const buffer = mockState.regionContentBuffers!.get(region!.id)
      expect(buffer).toEqual(['test content'])
    })

    it('should handle nodes without regions gracefully', () => {
      expect(() => collectNodeContent(mockElementNode, 'test', mockState)).not.toThrow()
    })

    it('should handle empty content gracefully', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, '', mockState)

      const buffer = mockState.regionContentBuffers!.get(region!.id)
      expect(buffer).toEqual([])
    })

    it('should find region through parent nodes', () => {
      const parentNode = { ...mockElementNode, name: 'parent' } as ElementNode
      const childNode = {
        ...mockElementNode,
        name: 'child',
        parent: parentNode,
      } as ElementNode

      const region = createBufferRegion(parentNode, mockState, true)
      collectNodeContent(childNode, 'child content', mockState)

      const buffer = mockState.regionContentBuffers!.get(region!.id)
      expect(buffer).toEqual(['child content'])
    })
  })

  describe('assembleBufferedContent', () => {
    it('should assemble content from included regions only', () => {
      const region1 = createBufferRegion(mockElementNode, mockState, true)
      const excludedNode = { ...mockElementNode, name: 'excluded' } as ElementNode
      const region2 = createBufferRegion(excludedNode, mockState, false)

      collectNodeContent(mockElementNode, 'included content', mockState)
      collectNodeContent(excludedNode, 'excluded content', mockState)

      const result = assembleBufferedContent(mockState)
      expect(result).toBe('included content')
    })

    it('should return empty string for empty state', () => {
      const emptyState: MdreamRuntimeState = {}
      expect(assembleBufferedContent(emptyState)).toBe('')
    })

    it('should handle multiple content fragments in regions', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, 'first ', mockState)
      collectNodeContent(mockElementNode, 'second', mockState)

      const result = assembleBufferedContent(mockState)
      expect(result).toBe('first second')
    })
  })

  describe('assembleRegionContent', () => {
    it('should assemble content with formatting applied', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, 'test content', mockState)

      const result = assembleRegionContent(mockState)
      expect(result).toBe('test content')
    })

    it('should fallback to fragments.join when regions not available', () => {
      mockState.fragments = ['fragment1', 'fragment2']
      delete mockState.bufferRegions

      const result = assembleRegionContent(mockState)
      expect(result).toBe('fragment1fragment2')
    })
  })

  describe('calculateRegionPositions', () => {
    it('should calculate and update node positions', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, 'test content', mockState)
      closeBufferRegion(mockElementNode, mockState)

      calculateRegionPositions(mockState)

      expect(mockElementNode.mdStart).toBe(0)
      expect(mockElementNode.mdExit).toBe(12) // 'test content'.length
      expect(mockState.currentMdPosition).toBe(12)
    })

    it('should handle multiple regions correctly', () => {
      const region1 = createBufferRegion(mockElementNode, mockState, true)
      const node2 = { ...mockElementNode, name: 'node2' } as ElementNode
      const region2 = createBufferRegion(node2, mockState, true)

      collectNodeContent(mockElementNode, 'first', mockState)
      collectNodeContent(node2, 'second', mockState)

      calculateRegionPositions(mockState)

      expect(mockElementNode.mdStart).toBe(0)
      expect(mockElementNode.mdExit).toBe(5)
      expect(node2.mdStart).toBe(5)
      expect(node2.mdExit).toBe(6)
      expect(mockState.currentMdPosition).toBe(11)
    })
  })

  describe('applyRegionFormatting', () => {
    it('should return content unchanged when no formatting context', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)!
      const formatted = applyRegionFormatting(region, 'test content', mockState)
      expect(formatted).toBe('test content')
    })

    it('should apply indentation when specified in context', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)!
      mockState.formattingContext!.set(region.id, { indentation: '  ' })

      const formatted = applyRegionFormatting(region, 'line1\nline2', mockState)
      expect(formatted).toBe('  line1\n  line2')
    })

    it('should apply prefix when specified in context', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)!
      mockState.formattingContext!.set(region.id, { prefix: '> ' })

      const formatted = applyRegionFormatting(region, 'line1\nline2', mockState)
      expect(formatted).toBe('> line1\n> line2')
    })

    it('should handle empty content', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)!
      const formatted = applyRegionFormatting(region, '', mockState)
      expect(formatted).toBe('')
    })
  })

  describe('streaming Functions', () => {
    describe('getFlushableRegions', () => {
      it('should return completed and flushable regions', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: true,
          depth: 1,
          startChunkId: 0,
          canFlush: true,
          accumulatedContent: ['content'],
          isPartiallyProcessed: false,
          lastProcessedPosition: 0,
          isComplete: true,
        }

        mockStreamingState.streamingRegions = [region]
        const flushable = getFlushableRegions(mockStreamingState)
        expect(flushable).toEqual([region])
      })

      it('should exclude incomplete regions', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: true,
          depth: 1,
          startChunkId: 0,
          canFlush: true,
          accumulatedContent: ['content'],
          isPartiallyProcessed: false,
          lastProcessedPosition: 0,
          isComplete: false,
        }

        mockStreamingState.streamingRegions = [region]
        const flushable = getFlushableRegions(mockStreamingState)
        expect(flushable).toEqual([])
      })
    })

    describe('flushCompletedRegions', () => {
      it('should return content from flushable included regions', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: true,
          depth: 1,
          startChunkId: 0,
          canFlush: true,
          accumulatedContent: ['test', ' content'],
          isPartiallyProcessed: false,
          lastProcessedPosition: 0,
          isComplete: true,
        }

        mockStreamingState.streamingRegions = [region]
        const result = flushCompletedRegions(mockStreamingState)
        expect(result).toBe('test content')
      })

      it('should exclude content from excluded regions', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: false,
          depth: 1,
          startChunkId: 0,
          canFlush: true,
          accumulatedContent: ['excluded content'],
          isPartiallyProcessed: false,
          lastProcessedPosition: 0,
          isComplete: true,
        }

        mockStreamingState.streamingRegions = [region]
        const result = flushCompletedRegions(mockStreamingState)
        expect(result).toBe('')
      })
    })

    describe('cleanupFlushedRegions', () => {
      it('should clear content and remove flushed regions', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: true,
          depth: 1,
          startChunkId: 0,
          endChunkId: 1,
          canFlush: true,
          accumulatedContent: ['test content'],
          isPartiallyProcessed: false,
          lastProcessedPosition: 0,
          isComplete: true,
        }

        mockStreamingState.streamingRegions = [region]
        mockStreamingState.totalBufferedSize = 100

        cleanupFlushedRegions(mockStreamingState)

        expect(mockStreamingState.streamingRegions).toHaveLength(0)
        expect(mockStreamingState.lastFlushedChunkId).toBe(1)
      })
    })

    describe('handlePartialRegions', () => {
      it('should mark incomplete regions as partially processed', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: true,
          depth: 1,
          startChunkId: 0,
          canFlush: true,
          accumulatedContent: ['content'],
          isPartiallyProcessed: false,
          lastProcessedPosition: 5,
          isComplete: false,
        }

        mockStreamingState.streamingRegions = [region]
        handlePartialRegions(mockStreamingState, 10)

        expect(region.isPartiallyProcessed).toBe(true)
        expect(region.canFlush).toBe(false)
      })
    })

    describe('adjustRegionBoundariesForWordBoundaries', () => {
      it('should handle word boundary adjustments', () => {
        const region: StreamingBufferRegion = {
          id: 'test',
          startNode: mockElementNode,
          include: true,
          depth: 1,
          startChunkId: 0,
          canFlush: true,
          accumulatedContent: ['Hello wor'], // Ends mid-word
          isPartiallyProcessed: false,
          lastProcessedPosition: 0,
          isComplete: false,
        }

        mockStreamingState.streamingRegions = [region]

        // Should not throw
        expect(() => adjustRegionBoundariesForWordBoundaries(mockStreamingState)).not.toThrow()
      })
    })
  })

  describe('edge Case Handling', () => {
    describe('preserveFormattingState', () => {
      it('should copy formatting context between regions', () => {
        const region1 = createBufferRegion(mockElementNode, mockState, true)!
        const node2 = { ...mockElementNode, name: 'node2' } as ElementNode
        const region2 = createBufferRegion(node2, mockState, true)!

        mockState.formattingContext!.set(region1.id, { indentation: '  ', prefix: '> ' })

        preserveFormattingState(region1, region2, mockState)

        const copiedContext = mockState.formattingContext!.get(region2.id)
        expect(copiedContext).toEqual({ indentation: '  ', prefix: '> ' })
      })
    })

    describe('resolveRegionConflicts', () => {
      it('should return single region when no conflicts', () => {
        const region = createBufferRegion(mockElementNode, mockState, true)!
        const resolved = resolveRegionConflicts(mockState, [region])
        expect(resolved).toEqual([region])
      })

      it('should return last region when multiple conflicts (last-wins strategy)', () => {
        const region1 = createBufferRegion(mockElementNode, mockState, true)!
        const node2 = { ...mockElementNode, name: 'node2' } as ElementNode
        const region2 = createBufferRegion(node2, mockState, false)!

        const resolved = resolveRegionConflicts(mockState, [region1, region2])
        expect(resolved).toEqual([region2])
      })
    })
  })
})
