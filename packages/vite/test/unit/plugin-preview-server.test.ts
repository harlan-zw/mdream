import type { Plugin, PreviewServer } from 'vite'
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}))

const mockFs = fs as { existsSync: ReturnType<typeof vi.fn>, readFileSync: ReturnType<typeof vi.fn> }

describe('viteHtmlToMarkdownPlugin - Preview Server', () => {
  it('should serve markdown from built files in preview mode', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configurePreviewServer: Function }

    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('<html><body><h1>Preview Page</h1></body></html>')

    const mockServer = {
      config: {
        build: { outDir: 'dist' },
      },
      middlewares: { use: vi.fn() },
    } as unknown as PreviewServer

    plugin.configurePreviewServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = { url: '/test.md', headers: {} }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockFs.existsSync).toHaveBeenCalled()
    expect(mockFs.readFileSync).toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8')
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600')
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Source', 'preview')
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Preview Page'))
  })

  it('should try fallback paths in preview mode', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configurePreviewServer: Function }

    mockFs.existsSync
      .mockReturnValueOnce(false) // dist/about.html
      .mockReturnValueOnce(true) // dist/about/index.html

    mockFs.readFileSync.mockReturnValue('<html><body>About</body></html>')

    const mockServer = {
      config: { build: { outDir: 'dist' } },
      middlewares: { use: vi.fn() },
    } as unknown as PreviewServer

    plugin.configurePreviewServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = { url: '/about.md', headers: {} }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    // The path.join uses basePath which comes from URL pathname
    expect(mockFs.existsSync).toHaveBeenCalled()
    expect(mockFs.readFileSync).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalled()
  })

  it('should return 404 when file not found in preview mode', async () => {
    const plugin = viteHtmlToMarkdownPlugin({ verbose: false }) as Plugin & { configurePreviewServer: Function }

    mockFs.existsSync.mockReturnValue(false)

    const mockServer = {
      config: { build: { outDir: 'dist' } },
      middlewares: { use: vi.fn() },
    } as unknown as PreviewServer

    plugin.configurePreviewServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = { url: '/missing.md', headers: {} }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.statusCode).toBe(404)
    expect(mockRes.end).toHaveBeenCalledWith('HTML content not found for /missing.md')
  })

  it('should use cache in preview mode', async () => {
    const plugin = viteHtmlToMarkdownPlugin({
      verbose: false,
      cacheEnabled: true,
    }) as Plugin & { configurePreviewServer: Function }

    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('<html><body>Cached</body></html>')

    const mockServer = {
      config: { build: { outDir: 'dist' } },
      middlewares: { use: vi.fn() },
    } as unknown as PreviewServer

    plugin.configurePreviewServer(mockServer)
    const middleware = (mockServer.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0][0]

    const mockReq = { url: '/cached.md', headers: {} }
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
    }
    const mockNext = vi.fn()

    // First request
    await middleware(mockReq, mockRes, mockNext)
    // readFileSync tries 3 paths: /cached.html, /cached/index.html, /index.html
    expect(mockFs.readFileSync).toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Cached', 'false')

    // Reset mocks
    vi.clearAllMocks()
    mockRes.setHeader = vi.fn()
    mockRes.end = vi.fn()

    // Second request should use cache
    await middleware(mockReq, mockRes, mockNext)
    expect(mockFs.readFileSync).not.toHaveBeenCalled()
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Markdown-Cached', 'true')
  })
})
