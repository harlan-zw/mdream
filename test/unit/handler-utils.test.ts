import type { ElementNode, MdreamRuntimeState, TagHandler } from '../../src/types'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCollectingContext,
  createHandlerContext,
  getOutputMethod,
  handleNodeContent,
  outputContent,
  shouldCollectContent,
} from '../../src/handler-utils'

describe('handler Utils', () => {
  let mockElementNode: ElementNode
  let mockState: MdreamRuntimeState

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
      fragments: [],
      bufferRegions: [],
      nodeRegionMap: new WeakMap(),
      regionContentBuffers: new Map(),
    }
  })

  describe('createHandlerContext', () => {
    it('should create handler context with content collection function', () => {
      const context = createHandlerContext(mockElementNode, mockState)

      expect(context.node).toBe(mockElementNode)
      expect(context.state).toBe(mockState)
      expect(typeof context.collectContent).toBe('function')
    })

    it('should handle parent node correctly', () => {
      const parentNode = { ...mockElementNode, name: 'parent' } as ElementNode
      mockElementNode.parent = parentNode

      const context = createHandlerContext(mockElementNode, mockState)
      expect(context.parent).toBe(parentNode)
    })

    it('should handle undefined parent correctly', () => {
      mockElementNode.parent = undefined

      const context = createHandlerContext(mockElementNode, mockState)
      expect(context.parent).toBeUndefined()
    })
  })

  describe('handleNodeContent', () => {
    it('should use collectContent when available', () => {
      let collectedContent = ''
      const context = createHandlerContext(mockElementNode, mockState)
      context.collectContent = (content) => { collectedContent = content }

      handleNodeContent(context, 'test content')
      expect(collectedContent).toBe('test content')
    })

    it('should fallback to fragments when collectContent not available', () => {
      const context = createHandlerContext(mockElementNode, mockState)
      delete context.collectContent

      handleNodeContent(context, 'test content')
      expect(mockState.fragments).toEqual(['test content'])
    })

    it('should handle missing fragments gracefully', () => {
      const context = createHandlerContext(mockElementNode, mockState)
      delete context.collectContent
      delete mockState.fragments

      expect(() => handleNodeContent(context, 'test content')).not.toThrow()
    })
  })

  describe('shouldCollectContent', () => {
    it('should return true when tag handler supports content collection', () => {
      const tagHandler: TagHandler = { collectsContent: true }
      mockElementNode.tagHandler = tagHandler

      expect(shouldCollectContent(mockElementNode, mockState)).toBe(true)
    })

    it('should return true when buffer regions are active', () => {
      mockState.bufferRegions = []
      mockState.nodeRegionMap = new WeakMap()

      expect(shouldCollectContent(mockElementNode, mockState)).toBe(true)
    })

    it('should return false when neither condition is met', () => {
      delete mockState.bufferRegions
      delete mockState.nodeRegionMap

      expect(shouldCollectContent(mockElementNode, mockState)).toBe(false)
    })
  })

  describe('getOutputMethod', () => {
    it('should return collect when buffer regions are active', () => {
      mockState.bufferRegions = []
      mockState.nodeRegionMap = new WeakMap()

      expect(getOutputMethod(mockElementNode, mockState)).toBe('collect')
    })

    it('should return fragment when fragments are available but no regions', () => {
      delete mockState.bufferRegions
      delete mockState.nodeRegionMap
      mockState.fragments = []

      expect(getOutputMethod(mockElementNode, mockState)).toBe('fragment')
    })

    it('should return none when neither system is available', () => {
      delete mockState.bufferRegions
      delete mockState.nodeRegionMap
      delete mockState.fragments

      expect(getOutputMethod(mockElementNode, mockState)).toBe('none')
    })
  })

  describe('outputContent', () => {
    it('should collect content when regions are active', () => {
      mockState.bufferRegions = []
      mockState.nodeRegionMap = new WeakMap()
      mockState.regionContentBuffers = new Map()

      outputContent('test content', mockElementNode, mockState)
      // Content collection is tested in buffer-region tests
    })

    it('should add to fragments when using fragment method', () => {
      delete mockState.bufferRegions
      delete mockState.nodeRegionMap
      mockState.fragments = []

      outputContent('test content', mockElementNode, mockState)
      expect(mockState.fragments).toEqual(['test content'])
    })

    it('should do nothing when no output method available', () => {
      delete mockState.bufferRegions
      delete mockState.nodeRegionMap
      delete mockState.fragments

      expect(() => outputContent('test content', mockElementNode, mockState)).not.toThrow()
    })
  })

  describe('createCollectingContext', () => {
    it('should create context and mark tag handler as collecting', () => {
      const tagHandler: TagHandler = {}
      mockElementNode.tagHandler = tagHandler

      const context = createCollectingContext(mockElementNode, mockState)

      expect(context.node).toBe(mockElementNode)
      expect(tagHandler.collectsContent).toBe(true)
      expect(typeof context.collectContent).toBe('function')
    })

    it('should handle missing tag handler gracefully', () => {
      mockElementNode.tagHandler = undefined

      expect(() => createCollectingContext(mockElementNode, mockState)).not.toThrow()
    })
  })
})
