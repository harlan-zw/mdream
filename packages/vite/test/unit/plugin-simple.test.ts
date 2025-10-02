import type { Plugin } from 'vite'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

describe('viteHtmlToMarkdownPlugin - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a plugin with correct name', () => {
    const plugin = viteHtmlToMarkdownPlugin()

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('vite-html-to-markdown')
    expect(typeof plugin.configureServer).toBe('function')
    expect(typeof plugin.generateBundle).toBe('function')
    expect(typeof plugin.configurePreviewServer).toBe('function')
  })

  it('should process HTML files in generateBundle', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'], // Simple pattern
      outputDir: 'test-md',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'test.html': {
        type: 'asset',
        source: '<html><body><h1>Test</h1></body></html>',
      },
      'script.js': {
        type: 'chunk',
        code: 'console.log("test")',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should process HTML file and emit markdown
    expect(mockEmitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'test-md/test.md',
      source: expect.stringContaining('# Test'),
    })
  })

  it('should exclude non-HTML files', () => {
    const plugin = viteHtmlToMarkdownPlugin() as Plugin & { generateBundle: Function }

    const mockBundle = {
      'script.js': {
        type: 'chunk',
        code: 'console.log("test")',
      },
      'style.css': {
        type: 'asset',
        source: 'body { color: red; }',
      },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should not process non-HTML files
    expect(mockEmitFile).not.toHaveBeenCalled()
  })
})
