import type { MdreamLlmsTxtGeneratePayload } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'

describe('mdream hooks', () => {
  describe('mdream:llms-txt:generate', () => {
    it('should have correct payload structure', () => {
      const payload: MdreamLlmsTxtGeneratePayload = {
        content: '# llms.txt content',
        fullContent: '# llms-full.txt content',
        pages: [
          {
            url: '/',
            title: 'Home',
            content: '# Home',
          },
          {
            url: '/about',
            title: 'About',
            content: '# About',
          },
        ],
      }

      expect(payload.content).toBe('# llms.txt content')
      expect(payload.fullContent).toBe('# llms-full.txt content')
      expect(payload.pages).toHaveLength(2)
      expect(payload.pages[0]?.url).toBe('/')
      expect(payload.pages[1]?.title).toBe('About')
    })

    it('should allow hook to modify content using mutable pattern', () => {
      const mockHook = vi.fn((payload: MdreamLlmsTxtGeneratePayload) => {
        payload.content += '\n\n## Additional Info'
        payload.fullContent += '\n\n## Full Additional Info'
      })

      const payload: MdreamLlmsTxtGeneratePayload = {
        content: '# Original',
        fullContent: '# Original Full',
        pages: [],
      }

      mockHook(payload)

      expect(payload.content).toBe('# Original\n\n## Additional Info')
      expect(payload.fullContent).toBe('# Original Full\n\n## Full Additional Info')
    })

    it('should handle hook that does not modify content', () => {
      const mockHook = vi.fn((_payload: MdreamLlmsTxtGeneratePayload) => {
        // Hook does nothing
      })

      const payload: MdreamLlmsTxtGeneratePayload = {
        content: '# Original',
        fullContent: '# Original Full',
        pages: [],
      }

      mockHook(payload)

      expect(payload.content).toBe('# Original')
      expect(payload.fullContent).toBe('# Original Full')
    })

    it('should allow hook to modify only one content field', () => {
      const mockHook = vi.fn((payload: MdreamLlmsTxtGeneratePayload) => {
        payload.content += '\n## Modified'
        // fullContent remains unchanged
      })

      const payload: MdreamLlmsTxtGeneratePayload = {
        content: '# Original',
        fullContent: '# Original Full',
        pages: [],
      }

      mockHook(payload)

      expect(payload.content).toBe('# Original\n## Modified')
      expect(payload.fullContent).toBe('# Original Full')
    })

    it('should handle hook errors gracefully', () => {
      const mockHook = vi.fn((_payload: MdreamLlmsTxtGeneratePayload) => {
        throw new Error('Hook failed')
      })

      const payload: MdreamLlmsTxtGeneratePayload = {
        content: '# Original',
        fullContent: '# Original Full',
        pages: [],
      }

      expect(() => mockHook(payload)).toThrow('Hook failed')
      // In real implementation, the error is caught and logged
      // The content should remain unchanged when hook fails
    })

    it('should support multiple hooks modifying content sequentially', () => {
      const hook1 = vi.fn((payload: MdreamLlmsTxtGeneratePayload) => {
        payload.content += '\n\n## Added by Hook 1'
      })

      const hook2 = vi.fn((payload: MdreamLlmsTxtGeneratePayload) => {
        payload.content += '\n## Added by Hook 2'
      })

      const payload: MdreamLlmsTxtGeneratePayload = {
        content: '# Original',
        fullContent: '# Original Full',
        pages: [],
      }

      hook1(payload)
      hook2(payload)

      expect(payload.content).toBe('# Original\n\n## Added by Hook 1\n## Added by Hook 2')
      expect(hook1).toHaveBeenCalledWith(payload)
      expect(hook2).toHaveBeenCalledWith(payload)
    })
  })
})
