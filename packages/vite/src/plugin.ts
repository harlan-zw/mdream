import type { Plugin, ViteDevServer } from 'vite'
import type { CacheEntry, MarkdownConversionResult, ViteHtmlToMarkdownOptions } from './types.js'
import fs from 'node:fs'
import path from 'node:path'
import { htmlToMarkdown } from 'mdream'

const DEFAULT_OPTIONS: Required<ViteHtmlToMarkdownOptions> = {
  include: ['**/*.html'],
  exclude: ['**/node_modules/**'],
  outputDir: '', // Output in same directory as HTML files by default
  cacheEnabled: true,
  mdreamOptions: {},
  preserveStructure: true,
  cacheTTL: 3600000, // 1 hour
  verbose: true,
}

export function viteHtmlToMarkdownPlugin(userOptions: ViteHtmlToMarkdownOptions = {}): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...userOptions }
  const markdownCache = new Map<string, CacheEntry>()

  function log(message: string) {
    if (options.verbose) {
      console.log(`[vite-html-to-markdown] ${message}`)
    }
  }

  function isValidCache(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl
  }

  function getCachedMarkdown(key: string): string | null {
    if (!options.cacheEnabled)
      return null

    const entry = markdownCache.get(key)
    if (entry && isValidCache(entry)) {
      return entry.content
    }

    if (entry) {
      markdownCache.delete(key)
    }

    return null
  }

  function setCachedMarkdown(key: string, content: string, ttl: number = options.cacheTTL): void {
    if (!options.cacheEnabled)
      return

    markdownCache.set(key, {
      content,
      timestamp: Date.now(),
      ttl,
    })
  }

  async function convertHtmlToMarkdown(htmlContent: string, source: string): Promise<string> {
    try {
      const markdownContent = htmlToMarkdown(htmlContent, options.mdreamOptions)
      log(`Converted ${source} to markdown (${markdownContent.length} chars)`)
      return markdownContent
    }
    catch (error) {
      throw new Error(`Failed to convert HTML to markdown: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function handleMarkdownRequest(
    url: string,
    server: ViteDevServer | null = null,
    outDir?: string,
  ): Promise<MarkdownConversionResult> {
    let basePath = url.slice(0, -3) // Remove .md extension

    // Handle index.md -> / mapping
    if (basePath === '/index') {
      basePath = '/'
    }

    const source = server ? 'dev' : (outDir ? 'preview' : 'build')
    const cacheKey = `${source}:${basePath}`

    // Check cache first
    const cached = getCachedMarkdown(cacheKey)
    if (cached) {
      log(`Cache hit for ${url}`)
      return { content: cached, cached: true, source: source as any }
    }

    let htmlContent: string | null = null

    if (server) {
      // Development mode - use Vite's transform pipeline
      const possiblePaths = [
        basePath.endsWith('.html') ? basePath : `${basePath}.html`,
        basePath,
        '/index.html', // SPA fallback
      ]

      for (const htmlPath of possiblePaths) {
        try {
          const result = await server.transformRequest(htmlPath)
          if (result?.code) {
            htmlContent = result.code
            log(`Found HTML content for ${htmlPath}`)
            break
          }
        }
        catch {
          continue
        }
      }
    }
    else if (outDir) {
      // Preview mode - read from built files
      const possiblePaths = [
        path.join(outDir, `${basePath}.html`),
        path.join(outDir, basePath, 'index.html'),
        path.join(outDir, 'index.html'), // SPA fallback
      ]

      for (const htmlPath of possiblePaths) {
        if (fs.existsSync(htmlPath)) {
          htmlContent = fs.readFileSync(htmlPath, 'utf-8')
          log(`Read HTML file from ${htmlPath}`)
          break
        }
      }
    }

    if (!htmlContent) {
      throw new Error(`No HTML content found for ${url}`)
    }

    const markdownContent = await convertHtmlToMarkdown(htmlContent, url)

    // Cache the result
    setCachedMarkdown(cacheKey, markdownContent)

    return { content: markdownContent, cached: false, source: source as any }
  }

  function matchesPattern(fileName: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      // Simple glob pattern matching - convert to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.') // Escape literal dots first
        .replace(/\*\*/g, '.*') // ** matches anything including /
        .replace(/\*/g, '[^/]*') // * matches filename chars except /
        .replace(/\?/g, '.') // ? matches any single char

      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(fileName)
    })
  }

  return {
    name: 'vite-html-to-markdown',

    // Development server integration - intercept .md requests
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.endsWith('.md')) {
          return next()
        }

        try {
          const result = await handleMarkdownRequest(req.url, server)

          res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('X-Markdown-Source', result.source)
          res.setHeader('X-Markdown-Cached', result.cached.toString())

          res.end(result.content)
          log(`Served ${req.url} from ${result.source} (cached: ${result.cached})`)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          log(`Error serving ${req.url}: ${message}`)
          res.statusCode = 404
          res.end(`HTML content not found for ${req.url}`)
        }
      })
    },

    // Build-time processing - generate static markdown files
    generateBundle(outputOptions, bundle) {
      const htmlFiles = Object.entries(bundle).filter(([fileName, file]) => {
        return (
          fileName.endsWith('.html')
          && file.type === 'asset'
          && matchesPattern(fileName, options.include)
          && !matchesPattern(fileName, options.exclude)
        )
      })

      log(`Processing ${htmlFiles.length} HTML files for markdown generation`)

      for (const [fileName, htmlFile] of htmlFiles) {
        try {
          // Type guard to ensure we have an asset with source
          if (htmlFile.type !== 'asset' || !('source' in htmlFile)) {
            continue
          }
          const htmlContent = htmlFile.source as string
          const markdownContent = htmlToMarkdown(htmlContent, options.mdreamOptions)

          // Generate corresponding .md filename
          const markdownFileName = fileName.replace('.html', '.md')
          const outputPath = options.preserveStructure
            ? `${options.outputDir}/${markdownFileName}`
            : `${options.outputDir}/${path.basename(markdownFileName)}`

          // Emit markdown file to bundle
          this.emitFile({
            type: 'asset',
            fileName: outputPath,
            source: markdownContent,
          })

          log(`Generated markdown: ${outputPath}`)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`[vite-html-to-markdown] Failed to convert ${fileName}: ${message}`)
        }
      }
    },

    // Preview server integration (for production preview)
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.endsWith('.md')) {
          return next()
        }

        try {
          const outDir = server.config.build?.outDir || 'dist'
          const result = await handleMarkdownRequest(req.url, null, outDir)

          res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          res.setHeader('X-Markdown-Source', result.source)
          res.setHeader('X-Markdown-Cached', result.cached.toString())

          res.end(result.content)
          log(`Served ${req.url} from ${result.source} (cached: ${result.cached})`)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          log(`Error in preview server for ${req.url}: ${message}`)
          res.statusCode = 404
          res.end(`HTML content not found for ${req.url}`)
        }
      })
    },
  }
}
