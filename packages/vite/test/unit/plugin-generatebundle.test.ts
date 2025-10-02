import type { Plugin } from 'vite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

describe('viteHtmlToMarkdownPlugin - generateBundle Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should preserve directory structure in output', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
      outputDir: 'markdown',
      verbose: false,
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'about.html': {
        type: 'asset',
        source: '<html><body>About</body></html>',
      },
      'contact.html': {
        type: 'asset',
        source: '<html><body>Contact</body></html>',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    expect(mockEmitFile).toHaveBeenNthCalledWith(1, {
      type: 'asset',
      fileName: 'markdown/about.md',
      source: expect.stringContaining('About'),
    })
    expect(mockEmitFile).toHaveBeenNthCalledWith(2, {
      type: 'asset',
      fileName: 'markdown/contact.md',
      source: expect.stringContaining('Contact'),
    })
  })

  it('should output files to specified directory', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
      outputDir: 'markdown',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'about.html': {
        type: 'asset',
        source: '<html><body>About</body></html>',
      },
      'contact.html': {
        type: 'asset',
        source: '<html><body>Contact</body></html>',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    expect(mockEmitFile).toHaveBeenNthCalledWith(1, {
      type: 'asset',
      fileName: 'markdown/about.md',
      source: expect.stringContaining('About'),
    })
    expect(mockEmitFile).toHaveBeenNthCalledWith(2, {
      type: 'asset',
      fileName: 'markdown/contact.md',
      source: expect.stringContaining('Contact'),
    })
  })

  it('should handle conversion errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'error.html': {
        type: 'asset',
        source: '<malformed>Bad HTML with no closing tag',
      },
      'good.html': {
        type: 'asset',
        source: '<html><body>Good HTML</body></html>',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Both files should be processed (mdream handles malformed HTML gracefully)
    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('should pass mdreamOptions to htmlToMarkdown', () => {
    const customOptions = {
      origin: 'https://example.com',
    }

    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
      mdreamOptions: customOptions,
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'test.html': {
        type: 'asset',
        source: '<html><body><a href="/test">Test</a></body></html>',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should use mdreamOptions with origin
    expect(mockEmitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'test.md',
      source: expect.stringContaining('[Test]'),
    })
  })

  it('should skip non-asset bundle entries', () => {
    const plugin = viteHtmlToMarkdownPlugin() as Plugin & { generateBundle: Function }

    const mockBundle = {
      'chunk.js': {
        type: 'chunk',
        code: 'console.log("test")',
      },
      'missing-source.html': {
        type: 'asset',
        // No source property
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(mockEmitFile).not.toHaveBeenCalled()
  })

  it('should handle empty outputDir', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
      outputDir: '',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'test.html': {
        type: 'asset',
        source: '<html><body>Test</body></html>',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(mockEmitFile).toHaveBeenCalled()
    const call = mockEmitFile.mock.calls[0][0]
    expect(call.fileName).toContain('test.md')
  })
})
