import type { Plugin, ViteDevServer } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

describe('viteHtmlToMarkdownPlugin - Route Filtering', () => {
  it('should skip /api routes', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/api/users',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should skip /api routes even with .md extension', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/api/docs.md',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should skip /_ internal routes', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/_vite/client',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should skip /@ Vite internal routes', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/@vite/client',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should skip explicit .html requests', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/page.html',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should allow non-api routes starting with /a', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body>About</body></html>',
    })

    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/about.md',
      headers: {},
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockTransformRequest).toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should skip .js files', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/app.js',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should skip .css files', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/styles.css',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should skip .json files', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockServer = {
      transformRequest: vi.fn(),
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/data.json',
      headers: { accept: '*/*' },
    }
    const mockRes = { setHeader: vi.fn(), end: vi.fn() }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.setHeader).not.toHaveBeenCalled()
  })

  it('should allow routes with no extension when client prefers markdown', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configureServer: Function }

    const mockTransformRequest = vi.fn().mockResolvedValue({
      code: '<html><body>Content</body></html>',
    })

    const mockServer = {
      transformRequest: mockTransformRequest,
      middlewares: { use: vi.fn() },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = {
      url: '/about',
      headers: { accept: '*/*' },
    }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockTransformRequest).toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockNext).not.toHaveBeenCalled()
  })
})
