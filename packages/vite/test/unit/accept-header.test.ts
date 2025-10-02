import type { Plugin, ViteDevServer } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

describe('viteHtmlToMarkdownPlugin - Accept Header Detection', () => {
  vi.clearAllMocks()

  it('should serve markdown when Accept header contains */* but not text/html (Claude Code)', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body><h1>Test Page</h1></body></html>',
    })

    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/test',
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    // Should convert to markdown
    expect(mockTransformRequest).toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockRes.end).toHaveBeenCalledWith('# Test Page')
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should serve markdown when Accept explicitly requests text/markdown', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body><h1>Test</h1></body></html>',
    })

    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/about',
      headers: {
        accept: 'text/markdown',
      },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should NOT serve markdown when Accept contains text/html (browser)', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/test',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    // Should pass through to next middleware
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.end).not.toHaveBeenCalled()
  })

  it('should NOT serve markdown when sec-fetch-dest is document (browser)', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/test',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'sec-fetch-dest': 'document',
      },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    // Should pass through to next middleware
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.end).not.toHaveBeenCalled()
  })

  it('should NOT serve markdown when Accept has only application/json (no */* or text/markdown)', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/test',
      headers: {
        accept: 'application/json',
      },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    // Should pass through to next middleware
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.end).not.toHaveBeenCalled()
  })

  it('should still serve markdown for .md extension requests regardless of Accept header', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body><h1>Test</h1></body></html>',
    })

    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/test.md',
      headers: {
        accept: 'text/html', // Even with text/html, .md extension takes precedence
      },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockNext).not.toHaveBeenCalled()
  })
})
