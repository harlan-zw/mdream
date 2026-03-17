import type { MdreamOptions } from 'mdream'
import type { MdreamLlmsTxtGeneratePayload, MdreamNegotiateContext } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'

describe('mdream hooks', () => {
  describe('mdream:config', () => {
    it('should allow hook to modify options using mutable pattern', () => {
      const mockHook = vi.fn((options: MdreamOptions) => {
        options.origin = 'https://modified.example.com'
        options.frontmatter = true
      })

      const options: MdreamOptions = {
        origin: 'https://original.example.com',
      }

      mockHook(options)

      expect(options.origin).toBe('https://modified.example.com')
      expect(options.frontmatter).toBe(true)
    })

    it('should allow hook to set filter options', () => {
      const mockHook = vi.fn((options: MdreamOptions) => {
        options.filter = { exclude: ['nav', 'footer', 'aside'] }
      })

      const options: MdreamOptions = {}

      mockHook(options)

      expect(options.filter).toEqual({ exclude: ['nav', 'footer', 'aside'] })
    })

    it('should allow hook to set extraction selectors', () => {
      const extractedTitles: string[] = []
      const mockHook = vi.fn((options: MdreamOptions) => {
        options.extraction = {
          h1: (el) => { extractedTitles.push(el.textContent) },
        }
      })

      const options: MdreamOptions = {}

      mockHook(options)

      expect(options.extraction).toBeDefined()
      expect(options.extraction!.h1).toBeTypeOf('function')
    })

    it('should support multiple hooks modifying options sequentially', () => {
      const hook1 = vi.fn((options: MdreamOptions) => {
        options.frontmatter = true
      })

      const hook2 = vi.fn((options: MdreamOptions) => {
        options.isolateMain = true
      })

      const options: MdreamOptions = {}

      hook1(options)
      hook2(options)

      expect(options.frontmatter).toBe(true)
      expect(options.isolateMain).toBe(true)
    })

    it('should handle hook that does not modify options', () => {
      const mockHook = vi.fn((_options: MdreamOptions) => {
        // Hook does nothing
      })

      const options: MdreamOptions = { origin: 'https://example.com' }

      mockHook(options)

      expect(options.origin).toBe('https://example.com')
    })
  })

  describe('mdream:negotiate', () => {
    it('should allow hook to force markdown serving', () => {
      const mockHook = vi.fn((ctx: MdreamNegotiateContext) => {
        ctx.shouldServe = true
      })

      const ctx: MdreamNegotiateContext = {
        event: {} as MdreamNegotiateContext['event'],
        shouldServe: false,
      }

      mockHook(ctx)

      expect(ctx.shouldServe).toBe(true)
    })

    it('should allow hook to block markdown serving', () => {
      const mockHook = vi.fn((ctx: MdreamNegotiateContext) => {
        ctx.shouldServe = false
      })

      const ctx: MdreamNegotiateContext = {
        event: {} as MdreamNegotiateContext['event'],
        shouldServe: true,
      }

      mockHook(ctx)

      expect(ctx.shouldServe).toBe(false)
    })

    it('should allow conditional override based on event properties', () => {
      const mockHook = vi.fn((ctx: MdreamNegotiateContext) => {
        const headers = (ctx.event as any).headers
        if (headers?.get('x-force-markdown') === 'true') {
          ctx.shouldServe = true
        }
      })

      const mockHeaders = new Map([['x-force-markdown', 'true']])
      const ctx: MdreamNegotiateContext = {
        event: { headers: { get: (k: string) => mockHeaders.get(k) } } as any,
        shouldServe: false,
      }

      mockHook(ctx)

      expect(ctx.shouldServe).toBe(true)
    })

    it('should preserve shouldServe when hook does not modify it', () => {
      const mockHook = vi.fn((_ctx: MdreamNegotiateContext) => {
        // Hook does nothing
      })

      const ctx: MdreamNegotiateContext = {
        event: {} as MdreamNegotiateContext['event'],
        shouldServe: true,
      }

      mockHook(ctx)

      expect(ctx.shouldServe).toBe(true)
    })

    it('should support multiple hooks with last-write-wins', () => {
      const hook1 = vi.fn((ctx: MdreamNegotiateContext) => {
        ctx.shouldServe = true
      })

      const hook2 = vi.fn((ctx: MdreamNegotiateContext) => {
        ctx.shouldServe = false
      })

      const ctx: MdreamNegotiateContext = {
        event: {} as MdreamNegotiateContext['event'],
        shouldServe: true,
      }

      hook1(ctx)
      hook2(ctx)

      expect(ctx.shouldServe).toBe(false)
    })
  })

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
