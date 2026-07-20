import type { Plugin } from 'vite'
import { describe, expect, it } from 'vitest'
import { viteHtmlToMarkdownPlugin } from '../../src/plugin.js'

describe('viteHtmlToMarkdownPlugin - HTML to Markdown Conversion', () => {
  it('should convert HTML to markdown in generateBundle', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      outputDir: 'md',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'test.html': {
        type: 'asset' as const,
        source: '<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>',
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(emittedFiles).toHaveLength(1)
    const emitted = emittedFiles[0]

    expect(emitted.type).toBe('asset')
    expect(emitted.fileName).toBe('md/test.md')

    // Test actual markdown conversion output
    expect(emitted.source).toContain('# Hello World')
    expect(emitted.source).toContain('This is a test.')
  })

  it('should convert complex HTML with links and formatting', () => {
    const plugin = viteHtmlToMarkdownPlugin() as Plugin & { generateBundle: Function }

    const mockBundle = {
      'page.html': {
        type: 'asset' as const,
        source: `
          <html>
            <body>
              <h2>Features</h2>
              <ul>
                <li><strong>Fast</strong> processing</li>
                <li><em>Easy</em> to use</li>
              </ul>
              <p>Visit <a href="https://example.com">our site</a> for more info.</p>
            </body>
          </html>
        `,
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    const emitted = emittedFiles[0]

    expect(emitted.source).toContain('## Features')
    expect(emitted.source).toContain('**Fast**')
    expect(emitted.source).toContain('_Easy_')
    expect(emitted.source).toContain('[our site](https://example.com)')
  })

  it('should handle multiple HTML files', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      outputDir: 'docs',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'index.html': {
        type: 'asset' as const,
        source: '<html><body><h1>Home</h1></body></html>',
      },
      'about.html': {
        type: 'asset' as const,
        source: '<html><body><h1>About</h1></body></html>',
      },
      'pages/contact.html': {
        type: 'asset' as const,
        source: '<html><body><h1>Contact</h1></body></html>',
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(emittedFiles).toHaveLength(3)

    const fileNames = emittedFiles.map(f => f.fileName)
    expect(fileNames).toContain('docs/index.md')
    expect(fileNames).toContain('docs/about.md')
    expect(fileNames).toContain('docs/pages/contact.md')

    // Verify content
    const homeFile = emittedFiles.find(f => f.fileName === 'docs/index.md')
    const aboutFile = emittedFiles.find(f => f.fileName === 'docs/about.md')
    const contactFile = emittedFiles.find(f => f.fileName === 'docs/pages/contact.md')

    expect(homeFile?.source).toContain('# Home')
    expect(aboutFile?.source).toContain('# About')
    expect(contactFile?.source).toContain('# Contact')
  })

  it('should respect include/exclude patterns', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['pages/*.html'],
      exclude: ['pages/draft-*.html'],
      outputDir: 'md',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'index.html': {
        type: 'asset' as const,
        source: '<html><body>Index</body></html>',
      },
      'pages/about.html': {
        type: 'asset' as const,
        source: '<html><body>About</body></html>',
      },
      'pages/draft-new.html': {
        type: 'asset' as const,
        source: '<html><body>Draft</body></html>',
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // Should only process pages/about.html (not index.html or draft)
    expect(emittedFiles).toHaveLength(1)
    expect(emittedFiles[0].fileName).toBe('md/pages/about.md')
  })

  it('should preserve directory structure in output', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      include: ['pages/docs/*.html'],
      outputDir: 'markdown',
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'pages/docs/guide.html': {
        type: 'asset' as const,
        source: '<html><body>Guide</body></html>',
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    expect(emittedFiles).toHaveLength(1)
    // Directory structure is preserved
    expect(emittedFiles[0].fileName).toBe('markdown/pages/docs/guide.md')
  })

  it('should pass mdreamOptions to conversion', () => {
    const plugin = viteHtmlToMarkdownPlugin({
      mdreamOptions: {
        origin: 'https://example.com',
      },
    }) as Plugin & { generateBundle: Function }

    const mockBundle = {
      'test.html': {
        type: 'asset' as const,
        source: '<html><body><a href="/docs">Docs</a></body></html>',
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    plugin.generateBundle.call(mockThis, {}, mockBundle)

    // With origin set, relative links should be resolved
    expect(emittedFiles[0].source).toContain('[Docs](https://example.com/docs)')
  })

  it('should handle malformed HTML gracefully', () => {
    const plugin = viteHtmlToMarkdownPlugin() as Plugin & { generateBundle: Function }

    const mockBundle = {
      'bad.html': {
        type: 'asset' as const,
        source: '<div>Unclosed div with <strong>bold text',
      },
    }

    const emittedFiles: Array<{ type: string, fileName: string, source: string }> = []
    const mockThis = {
      emitFile: (file: any) => emittedFiles.push(file),
    }

    // Should not throw
    expect(() => {
      plugin.generateBundle.call(mockThis, {}, mockBundle)
    }).not.toThrow()

    // Should still emit something
    expect(emittedFiles.length).toBeGreaterThan(0)
  })
})
