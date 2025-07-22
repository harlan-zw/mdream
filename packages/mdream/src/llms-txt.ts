import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, sep } from 'pathe'
import { glob } from 'tinyglobby'
import { htmlToMarkdown } from './index.ts'
import { extractionPlugin } from './plugins/extraction.ts'

export interface LlmsTxtArtifactsOptions {
  patterns?: string | string[]
  files?: ProcessedFile[]
  siteName?: string
  description?: string
  origin?: string
  generateFull?: boolean
  generateMarkdown?: boolean
  outputDir?: string
}

export interface ProcessedFile {
  filePath?: string
  title: string
  content: string
  url: string
  metadata?: {
    title?: string
    description?: string
    keywords?: string
    author?: string
  }
}

export interface LlmsTxtArtifactsResult {
  llmsTxt: string
  llmsFullTxt?: string
  markdownFiles?: { path: string, content: string }[]
  processedFiles: ProcessedFile[]
}

/**
 * Extract metadata from HTML content using mdream's extraction plugin
 */
function extractMetadata(html: string, url: string): ProcessedFile['metadata'] {
  let title = ''
  let description = ''
  let keywords = ''
  let author = ''

  const extractionPluginInstance = extractionPlugin({
    'title': (element) => {
      if (!title && element.textContent) {
        title = element.textContent.trim()
      }
    },
    'meta[name="description"]': (element) => {
      if (!description && element.attributes?.content) {
        description = element.attributes.content.trim()
      }
    },
    'meta[property="og:description"]': (element) => {
      if (!description && element.attributes?.content) {
        description = element.attributes.content.trim()
      }
    },
    'meta[name="keywords"]': (element) => {
      if (!keywords && element.attributes?.content) {
        keywords = element.attributes.content.trim()
      }
    },
    'meta[name="author"]': (element) => {
      if (!author && element.attributes?.content) {
        author = element.attributes.content.trim()
      }
    },
    'meta[property="og:title"]': (element) => {
      if (!title && element.attributes?.content) {
        title = element.attributes.content.trim()
      }
    },
  })

  htmlToMarkdown(html, {
    plugins: [extractionPluginInstance],
    origin: url,
  })

  return {
    title: title || undefined,
    description: description || undefined,
    keywords: keywords || undefined,
    author: author || undefined,
  }
}

/**
 * Convert file path to URL path
 */
function pathToUrl(filePath: string, baseDir: string): string {
  let url = relative(baseDir, filePath)

  // Convert Windows backslashes to forward slashes for URLs
  url = url.split(sep).join('/')

  // Remove .html extension and convert to URL path
  if (url.endsWith('.html')) {
    url = url.slice(0, -5)
  }

  // Convert index files to directory paths
  if (url.endsWith('/index')) {
    url = url.slice(0, -6)
  }

  // Handle root index file
  if (url === 'index') {
    return '/'
  }

  // Ensure leading slash
  if (!url.startsWith('/')) {
    url = `/${url}`
  }

  return url
}

/**
 * Process HTML files from glob patterns
 */
async function processHtmlFiles(patterns: string | string[], origin?: string): Promise<ProcessedFile[]> {
  const allPatterns = Array.isArray(patterns) ? patterns : [patterns]
  const allFiles: string[] = []

  for (const pattern of allPatterns) {
    const files = await glob(pattern)
    allFiles.push(...files)
  }

  // Remove duplicates
  const uniqueFiles = [...new Set(allFiles)]
  const results: ProcessedFile[] = []

  // Find common base directory
  const baseDir = uniqueFiles.length > 0 ? dirname(uniqueFiles[0]) : '.'

  for (const filePath of uniqueFiles) {
    try {
      const html = await readFile(filePath, 'utf-8')
      const metadata = extractMetadata(html, origin || filePath)
      const content = htmlToMarkdown(html, { origin })
      const url = pathToUrl(filePath, baseDir)

      results.push({
        filePath,
        title: metadata?.title || basename(filePath, '.html'),
        content,
        url,
        metadata,
      })
    }
    catch (error) {
      console.error(`Error processing ${filePath}:`, error)
    }
  }

  return results
}

/**
 * Generate llms.txt content
 */
function generateLlmsTxtContent(files: ProcessedFile[], options: Pick<LlmsTxtArtifactsOptions, 'siteName' | 'description' | 'origin' | 'outputDir'>): string {
  const { siteName = 'Site', description, origin = '' } = options

  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  if (files.length > 0) {
    content += `## Pages\n\n`

    for (const file of files) {
      const desc = file.metadata?.description
      const descText = desc ? `: ${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}` : ''

      // Use relative file paths for generated markdown files (from crawl), URLs for everything else
      if (file.filePath && options.outputDir && file.filePath.endsWith('.md')) {
        // Crawl context with generated markdown files - use relative file path
        const relativePath = relative(options.outputDir, file.filePath)
        content += `- [${file.title}](${relativePath})${descText}\n`
      }
      else {
        // CLI context or no markdown files - use URL
        const url = file.url.startsWith('http://') || file.url.startsWith('https://')
          ? file.url
          : origin + file.url
        content += `- [${file.title}](${url})${descText}\n`
      }
    }
  }

  return content
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any> | null, body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: null, body: content }
  }

  const frontmatterContent = match[1]
  const body = match[2]

  const frontmatter: Record<string, any> = {}
  const lines = frontmatterContent.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()
      frontmatter[key] = value
    }
  }

  return { frontmatter, body }
}

/**
 * Serialize frontmatter object to YAML-like format
 */
function serializeFrontmatter(data: Record<string, any>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  return lines.join('\n')
}

/**
 * Generate llms-full.txt content with complete page content
 */
function generateLlmsFullTxtContent(files: ProcessedFile[], options: Pick<LlmsTxtArtifactsOptions, 'siteName' | 'description' | 'origin' | 'outputDir'>): string {
  const { siteName = 'Site', description, origin = '' } = options

  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  if (files.length > 0) {
    content += `## Table of Contents\n\n`

    for (const file of files) {
      const anchor = file.title.toLowerCase().replace(/[^a-z0-9]/g, '-')
      content += `- [${file.title}](#${anchor})\n`
    }

    content += `\n---\n\n`

    for (const file of files) {
      // If file.url is already a full URL, use it directly; otherwise prepend origin
      const url = file.url.startsWith('http://') || file.url.startsWith('https://')
        ? file.url
        : (origin ? origin + file.url : file.url)

      // Parse existing frontmatter from content
      const { frontmatter, body } = parseFrontmatter(file.content)

      // Prepare metadata to add
      const metadata: Record<string, any> = {
        title: file.title,
        url,
      }

      if (file.filePath && options.outputDir) {
        metadata.file = relative(options.outputDir, file.filePath)
      }
      else if (file.filePath) {
        metadata.file = file.filePath
      }

      // Add any additional metadata from the file
      if (file.metadata) {
        if (file.metadata.description)
          metadata.description = file.metadata.description
        if (file.metadata.keywords)
          metadata.keywords = file.metadata.keywords
        if (file.metadata.author)
          metadata.author = file.metadata.author
      }

      // Always include frontmatter for uniform formatting
      const mergedFrontmatter = frontmatter ? { ...frontmatter, ...metadata } : metadata
      const frontmatterString = serializeFrontmatter(mergedFrontmatter)
      let contentBody = frontmatter ? body : file.content

      // Remove duplicate title from the beginning of content if it exists
      const titleLine = contentBody.trim().split('\n')[0]
      if (titleLine === file.title || titleLine === `# ${file.title}`) {
        // Remove the first line (title) and any following empty lines
        contentBody = contentBody.trim().split('\n').slice(1).join('\n').trimStart()
      }

      content += `---\n${frontmatterString}\n---\n\n${contentBody}\n\n---\n\n`
    }
  }

  return content
}

/**
 * Generate individual markdown files structure
 */
function generateMarkdownFilesContent(files: ProcessedFile[]): { path: string, content: string }[] {
  const markdownFiles: { path: string, content: string }[] = []

  for (const file of files) {
    // Convert URL to file path segments
    const urlPath = file.url === '/' ? 'index' : file.url.replace(/^\//, '').replace(/\/$/, '')
    // Use forward slashes for the path structure, they'll be converted to OS-specific separators when written
    const mdPath = `md/${urlPath}.md`
    markdownFiles.push({
      path: mdPath,
      content: file.content,
    })
  }

  return markdownFiles
}

/**
 * Main function to process files and generate llms.txt artifacts
 */
export async function generateLlmsTxtArtifacts(options: LlmsTxtArtifactsOptions): Promise<LlmsTxtArtifactsResult> {
  // Get files either from patterns or directly passed
  let files: ProcessedFile[]
  if (options.files) {
    files = options.files
  }
  else if (options.patterns) {
    files = await processHtmlFiles(options.patterns, options.origin)
  }
  else {
    throw new Error('Either patterns or files must be provided')
  }

  // Generate llms.txt content
  const llmsTxt = generateLlmsTxtContent(files, options)

  // Generate llms-full.txt content if requested
  let llmsFullTxt: string | undefined
  if (options.generateFull) {
    llmsFullTxt = generateLlmsFullTxtContent(files, options)
  }

  // Generate individual markdown files content if requested
  let markdownFiles: { path: string, content: string }[] | undefined
  if (options.generateMarkdown) {
    markdownFiles = generateMarkdownFilesContent(files)
  }

  return {
    llmsTxt,
    llmsFullTxt,
    markdownFiles,
    processedFiles: files,
  }
}
