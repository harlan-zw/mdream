import type { Plugin, ViteDevServer } from 'vite'
import { htmlToMarkdown } from 'mdream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

// Mock mdream
vi.mock('mdream', () => ({
  htmlToMarkdown: vi.fn((html: string) => `# Converted\n\n${html.replace(/<[^>]*>/g, '')}`),
}))

const mockHtmlToMarkdown = htmlToMarkdown as ReturnType<typeof vi.fn>

describe('viteHtmlToMarkdownPlugin - Dev Server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHtmlToMarkdown.mockClear()
  })

  it('should handle .md requests in dev server', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }
    
    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body><h1>Test Page</h1></body></html>'
    })
    
    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: {
        use: vi.fn()
      }
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    
    // Get the middleware function
    const middlewareCall = mockServer.middlewares.use as ReturnType<typeof vi.fn>
    expect(middlewareCall).toHaveBeenCalledWith(expect.any(Function))
    
    const middleware = middlewareCall.mock.calls[0][0]
    
    // Mock request/response objects
    const mockReq = { url: '/test.md' }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    }
    const mockNext = vi.fn()
    
    await middleware(mockReq, mockRes, mockNext)
    
    expect(mockTransformRequest).toHaveBeenCalledWith('/test.html')
    expect(mockHtmlToMarkdown).toHaveBeenCalledWith('<html><body><h1>Test Page</h1></body></html>', {})
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Source', 'dev')
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Cached', 'false')
    expect(mockRes.end).toHaveBeenCalledWith('# Converted\n\nTest Page')
  })

  it('should handle index.md mapping to root', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }
    
    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body><h1>Home Page</h1></body></html>'
    })
    
    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() }
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]
    
    const mockReq = { url: '/index.md' }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    }
    const mockNext = vi.fn()
    
    await middleware(mockReq, mockRes, mockNext)
    
    // Should try to transform root path
    expect(mockTransformRequest).toHaveBeenCalledWith('/.html')
  })

  it('should try fallback paths when primary path fails', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }
    
    const mockTransformRequest = vi.fn()
      .mockRejectedValueOnce(new Error('Not found'))
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce({
        code: '<html><body><h1>Fallback</h1></body></html>'
      })
    
    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() }
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]
    
    const mockReq = { url: '/about.md' }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    }
    const mockNext = vi.fn()
    
    await middleware(mockReq, mockRes, mockNext)
    
    // Should try multiple paths
    expect(mockTransformRequest).toHaveBeenCalledWith('/about.html')
    expect(mockTransformRequest).toHaveBeenCalledWith('/about')
    expect(mockTransformRequest).toHaveBeenCalledWith('/index.html')
    expect(mockRes.end).toHaveBeenCalledWith('# Converted\n\nFallback')
  })

  it('should handle errors gracefully', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }
    
    const mockTransformRequest = vi.fn().mockRejectedValue(new Error('Transform failed'))
    
    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() }
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]
    
    const mockReq = { url: '/missing.md' }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    }
    const mockNext = vi.fn()
    
    await middleware(mockReq, mockRes, mockNext)
    
    expect(mockRes.statusCode).toBe(404)
    expect(mockRes.end).toHaveBeenCalledWith('HTML content not found for /missing.md')
  })

  it('should skip non-.md requests', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }
    
    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() }
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]
    
    const mockReq = { url: '/test.html' }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()
    
    await middleware(mockReq, mockRes, mockNext)
    
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should use cache when enabled', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ 
      verbose: false, 
      cacheEnabled: true 
    }) as Plugin & { configureServer: Function }
    
    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body><h1>Cached Content</h1></body></html>'
    })
    
    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() }
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]
    
    const mockReq = { url: '/cached.md' }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    }
    const mockNext = vi.fn()
    
    // First request
    await middleware(mockReq, mockRes, mockNext)
    
    expect(mockTransformRequest).toHaveBeenCalledTimes(1)
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Cached', 'false')
    
    // Reset mocks for second request
    vi.clearAllMocks()
    mockRes.setHeader = vi.fn()
    mockRes.end = vi.fn()
    
    // Second request should use cache
    await middleware(mockReq, mockRes, mockNext)
    
    expect(mockTransformRequest).not.toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Cached', 'true')
    expect(mockRes.end).toHaveBeenCalledWith('# Converted\n\nCached Content')
  })
})