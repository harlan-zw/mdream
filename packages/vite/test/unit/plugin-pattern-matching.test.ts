import { describe, expect, it, vi } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

describe('viteHtmlToMarkdownPlugin - Pattern Matching', () => {
  it.each([undefined, ['**/*.html']])('matches root and nested HTML with include %j', (include) => {
    const plugin = viteHtmlToMarkdownPlugin(include ? { include } : {}) as any
    const mockBundle = Object.fromEntries([
      'index.html',
      'docs/guide.html',
      'docs/api/page.html',
      'node_modules/example/index.html',
      'docs/node_modules/example/nested/page.html',
    ].map(fileName => [fileName, { type: 'asset', source: '<h1>Page</h1>' }]))
    const emitFile = vi.fn()

    plugin.generateBundle.call({ emitFile }, {}, mockBundle)

    expect(emitFile.mock.calls.map(([file]) => file.fileName)).toEqual([
      'index.md',
      'docs/guide.md',
      'docs/api/page.md',
    ])
  })

  it('matches zero or more directories in include and exclude patterns', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['docs/**/*.html'],
      exclude: ['docs/**/private/**'],
    }) as any
    const mockBundle = Object.fromEntries([
      'index.html',
      'docs/guide.html',
      'docs/api/page.html',
      'docs/api/v2/page.html',
      'docs/private/page.html',
      'docs/api/private/nested/page.html',
    ].map(fileName => [fileName, { type: 'asset', source: '<h1>Page</h1>' }]))
    const emitFile = vi.fn()

    plugin.generateBundle.call({ emitFile }, {}, mockBundle)

    expect(emitFile.mock.calls.map(([file]) => file.fileName)).toEqual([
      'docs/guide.md',
      'docs/api/page.md',
      'docs/api/v2/page.md',
    ])
  })

  it('should match simple glob patterns with *', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
    }) as any

    const mockBundle = {
      'test.html': { type: 'asset', source: '<html><body>Test</body></html>' },
      'index.html': { type: 'asset', source: '<html><body>Index</body></html>' },
      'sub/page.html': { type: 'asset', source: '<html><body>Sub</body></html>' },
      'test.js': { type: 'chunk', code: 'console.log()' },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should match root level HTML files only (not sub/)
    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'test.md' }))
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'index.md' }))
  })

  it('should match all HTML files with *.html pattern', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: [],
    }) as any

    const mockBundle = {
      'test.html': { type: 'asset', source: '<html><body>Test</body></html>' },
      'page.html': { type: 'asset', source: '<html><body>Page</body></html>' },
      'about.html': { type: 'asset', source: '<html><body>About</body></html>' },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should match all HTML files at root level
    expect(mockEmitFile).toHaveBeenCalledTimes(3)
  })

  it('should match single character with ?', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['page?.html'],
      exclude: [],
    }) as any

    const mockBundle = {
      'page1.html': { type: 'asset', source: '<html><body>Page1</body></html>' },
      'page2.html': { type: 'asset', source: '<html><body>Page2</body></html>' },
      'pageAB.html': { type: 'asset', source: '<html><body>PageAB</body></html>' },
      'page.html': { type: 'asset', source: '<html><body>Page</body></html>' },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should match only single character after 'page'
    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'page1.md' }))
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'page2.md' }))
  })

  it('should respect exclude patterns', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['*.html'],
      exclude: ['test-*.html'],
    }) as any

    const mockBundle = {
      'index.html': { type: 'asset', source: '<html><body>Index</body></html>' },
      'test-page.html': { type: 'asset', source: '<html><body>Test</body></html>' },
      'about.html': { type: 'asset', source: '<html><body>About</body></html>' },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should match index.html and about.html, exclude test-page.html
    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'index.md' }))
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'about.md' }))
  })

  it('should handle multiple include patterns', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['pages/*.html', 'docs/*.html'],
      exclude: [],
    }) as any

    const mockBundle = {
      'pages/about.html': { type: 'asset', source: '<html><body>About</body></html>' },
      'docs/guide.html': { type: 'asset', source: '<html><body>Guide</body></html>' },
      'other/file.html': { type: 'asset', source: '<html><body>Other</body></html>' },
    }

    const mockEmitFile = vi.fn()
    const mockThis = { emitFile: mockEmitFile }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(mockEmitFile).toHaveBeenCalledTimes(2)
    // Structure should be preserved
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'pages/about.md' }))
    expect(mockEmitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'docs/guide.md' }))
  })
})
