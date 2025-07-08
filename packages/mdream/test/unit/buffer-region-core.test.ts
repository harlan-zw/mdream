import type {
  ElementNode,
  MdreamRuntimeState,
} from '../../src/types'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  assembleBufferedContent,
  collectNodeContent,
  createBufferRegion,
  isNodeIncluded,
} from '../../src/buffer-region'

describe('buffer Region Core Functions', () => {
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
      defaultIncludeNodes: true,
      regionToggles: new Map(),
      regionContentBuffers: new Map(),
      fragments: [],
      currentMdPosition: 0,
    }
  })

  describe('createBufferRegion', () => {
    it('should return null if node already has a region', () => {
      // Create first region
      const firstRegion = createBufferRegion(mockElementNode, mockState, true)
      expect(firstRegion).not.toBeNull()

      // Try to create second region for same node
      const secondRegion = createBufferRegion(mockElementNode, mockState, false)
      expect(secondRegion).toBeNull()
    })
  })

  describe('isNodeIncluded', () => {
    it('should return region inclusion state for nodes in regions', () => {
      const excludedNode = { ...mockElementNode, name: 'span' } as ElementNode
      createBufferRegion(mockElementNode, mockState, true)
      expect(isNodeIncluded(mockElementNode, mockState)).toBe(true)

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
  })

  describe('collectNodeContent', () => {
    it('should collect content into region buffers', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, 'test content', mockState)

      const buffer = mockState.regionContentBuffers!.get(region)
      expect(buffer).toEqual(['test content'])
    })

    it('should handle nodes without regions gracefully', () => {
      expect(() => collectNodeContent(mockElementNode, 'test', mockState)).not.toThrow()
    })

    it('should handle empty content gracefully', () => {
      const region = createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, '', mockState)

      const buffer = mockState.regionContentBuffers!.get(region)
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
      childNode.regionId = parentNode.regionId
      collectNodeContent(childNode, 'child content', mockState)

      const buffer = mockState.regionContentBuffers!.get(region)
      expect(buffer).toEqual(['child content'])
    })
  })

  describe('assembleBufferedContent', () => {
    it('should assemble content from included regions only', () => {
      const excludedNode = { ...mockElementNode, name: 'excluded' } as ElementNode
      createBufferRegion(mockElementNode, mockState, true)
      createBufferRegion(excludedNode, mockState, false)

      collectNodeContent(mockElementNode, 'included content', mockState)
      collectNodeContent(excludedNode, 'excluded content', mockState)

      const result = assembleBufferedContent(mockState)
      expect(result).toBe('included content')
    })

    it('should handle multiple content fragments in regions', () => {
      createBufferRegion(mockElementNode, mockState, true)
      collectNodeContent(mockElementNode, 'first ', mockState)
      collectNodeContent(mockElementNode, 'second', mockState)

      const result = assembleBufferedContent(mockState)
      expect(result).toBe('first second')
    })
  })
})
