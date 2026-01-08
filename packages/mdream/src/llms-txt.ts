import type { FileHandle } from 'node:fs/promises'
import { mkdir, open, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'pathe'
import { glob } from 'tinyglobby'
import { htmlToMarkdown } from './index.ts'
import { extractionPlugin } from './plugins/extraction.ts'

/**
 * Link in llms.txt section
 */
export interface LlmsTxtLink {
  /** The title of the link */
  title: string
  /** The description of the link */
  description?: string
  /** The href of the link */
  href: string
}

/**
 * Section in llms.txt
 */
export interface LlmsTxtSection {
  /** The title of the section */
  title: string
  /** The description of the section (can be array for multiple paragraphs) */
  description?: string | string[]
  /** The links of the section */
  links?: LlmsTxtLink[]
}

export interface LlmsTxtArtifactsOptions {
  patterns?: string | string[]
  files?: ProcessedFile[]
  siteName?: string
  description?: string
  origin?: string
  generateFull?: boolean
  generateMarkdown?: boolean
  outputDir?: string
  /** The sections to write before pages */
  sections?: LlmsTxtSection[]
  /** Notes to write at the end */
  notes?: string | string[]
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
function generateLlmsTxtContent(files: ProcessedFile[], options: Pick<LlmsTxtArtifactsOptions, 'siteName' | 'description' | 'origin' | 'outputDir' | 'sections' | 'notes'>): string {
  const { siteName = 'Site', description, origin = '', sections, notes } = options

  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  if (origin) {
    content += `Canonical Origin: ${origin}\n\n`
  }

  if (sections) {
    for (const section of sections) {
      content += formatSection(section)
    }
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
          : (origin ? origin + file.url : file.url)
        content += `- [${file.title}](${url})${descText}\n`
      }
    }
  }

  if (notes) {
    content += `\n${formatNotes(notes)}`
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
function generateLlmsFullTxtContent(files: ProcessedFile[], options: Pick<LlmsTxtArtifactsOptions, 'siteName' | 'description' | 'origin' | 'outputDir' | 'sections' | 'notes'>): string {
  const { siteName = 'Site', description, origin = '', sections, notes } = options

  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  if (origin) {
    content += `Canonical Origin: ${origin}\n\n`
  }

  if (sections) {
    for (const section of sections) {
      content += formatSection(section)
    }
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

  if (notes) {
    content += `\n${formatNotes(notes)}`
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

/**
 * Format a section with title, description, and links
 */
function formatSection(section: LlmsTxtSection): string {
  let content = `## ${section.title}\n\n`

  if (section.description) {
    const descriptions = Array.isArray(section.description) ? section.description : [section.description]
    for (const desc of descriptions) {
      content += `${desc}\n\n`
    }
  }

  if (section.links?.length) {
    for (const link of section.links) {
      const desc = link.description ? `: ${link.description}` : ''
      content += `- [${link.title}](${link.href})${desc}\n`
    }
    content += '\n'
  }

  return content
}

/**
 * Format notes section
 */
function formatNotes(notes: string | string[]): string {
  const noteLines = Array.isArray(notes) ? notes : [notes]
  let content = ''
  for (const note of noteLines) {
    content += `${note}\n\n`
  }
  return content
}

/**
 * Options for creating an llms.txt stream
 */
export interface CreateLlmsTxtStreamOptions extends Omit<LlmsTxtArtifactsOptions, 'patterns' | 'files' | 'outputDir' | 'generateMarkdown'> {
  /** Directory to write files to (defaults to process.cwd()) */
  outputDir?: string
  /** Site name for the header (defaults to 'Site') */
  siteName?: string
  /** Site description for the header */
  description?: string
  /** Origin URL to prepend to relative URLs */
  origin?: string
  /** Generate llms-full.txt with complete page content (defaults to false) */
  generateFull?: boolean
  /** The sections to write before pages */
  sections?: LlmsTxtSection[]
  /** Notes to write at the end */
  notes?: string | string[]
}

/**
 * Create a WritableStream that generates llms.txt artifacts by streaming pages to disk
 *
 * Writes llms.txt (and optionally llms-full.txt) incrementally as pages are written,
 * never keeping full content in memory. Creates outputDir recursively if needed.
 *
 * @example
 * ```typescript
 * const stream = createLlmsTxtStream({
 *   siteName: 'My Docs',
 *   description: 'Documentation site',
 *   origin: 'https://example.com',
 *   generateFull: true,
 *   outputDir: './dist',
 *   sections: [
 *     {
 *       title: 'Getting Started',
 *       description: 'Quick start guide',
 *       links: [
 *         { title: 'Installation', href: '/install', description: 'How to install' },
 *         { title: 'Quick Start', href: '/quickstart' },
 *       ],
 *     },
 *   ],
 *   notes: ['Generated by mdream', 'Last updated: 2024'],
 * })
 *
 * const writer = stream.getWriter()
 * await writer.write({
 *   title: 'Home',
 *   content: '# Welcome\n\nHome page content.',
 *   url: '/',
 * })
 * await writer.close()
 * ```
 *
 * @param options - Configuration options
 * @returns WritableStream that accepts ProcessedFile objects
 */
/**
 * Get group prefix for a URL (up to 2 segments)
 */
function getGroupPrefix(url: string, depth: 1 | 2): string {
  const segments = url.split('/').filter(Boolean)
  if (segments.length === 0)
    return '/'
  if (depth === 1 || segments.length === 1)
    return `/${segments[0]}`
  return `/${segments[0]}/${segments[1]}`
}

/**
 * Sort pages by URL path in hierarchical order (directory tree structure)
 * Groups by up to 2 segments, with root-level pages without nesting grouped together
 */
function sortPagesByPath(pages: { url: string, title: string, description?: string, filePath?: string }[]): typeof pages {
  // Count URLs per 2-segment prefix
  const twoSegmentCount = new Map<string, number>()
  for (const page of pages) {
    const prefix = getGroupPrefix(page.url, 2)
    twoSegmentCount.set(prefix, (twoSegmentCount.get(prefix) || 0) + 1)
  }

  // Analyze which first segments have nested paths
  const segmentHasNested = new Map<string, boolean>()
  for (const page of pages) {
    const segments = page.url.split('/').filter(Boolean)
    const firstSegment = segments.length > 0 ? segments[0] : ''

    if (!segmentHasNested.has(firstSegment)) {
      segmentHasNested.set(firstSegment, false)
    }

    if (segments.length > 1) {
      segmentHasNested.set(firstSegment, true)
    }
  }

  return pages.sort((a, b) => {
    const segmentsA = a.url.split('/').filter(Boolean)
    const segmentsB = b.url.split('/').filter(Boolean)

    const firstSegmentA = segmentsA.length > 0 ? segmentsA[0] : ''
    const firstSegmentB = segmentsB.length > 0 ? segmentsB[0] : ''

    // Determine group key: try 2-segment prefix first
    const twoSegPrefixA = getGroupPrefix(a.url, 2)
    const twoSegPrefixB = getGroupPrefix(b.url, 2)
    const twoSegCountA = twoSegmentCount.get(twoSegPrefixA) || 0
    const twoSegCountB = twoSegmentCount.get(twoSegPrefixB) || 0

    // Use 2-segment prefix if it has > 1 URL, otherwise fall back to 1-segment
    let groupKeyA = twoSegCountA > 1 ? twoSegPrefixA : `/${firstSegmentA}`
    let groupKeyB = twoSegCountB > 1 ? twoSegPrefixB : `/${firstSegmentB}`

    // Root-level pages without nested paths go in root group
    const isRootLevelA = segmentsA.length <= 1
    const isRootLevelB = segmentsB.length <= 1
    const hasNestedA = segmentHasNested.get(firstSegmentA)
    const hasNestedB = segmentHasNested.get(firstSegmentB)

    if (isRootLevelA && !hasNestedA)
      groupKeyA = ''
    if (isRootLevelB && !hasNestedB)
      groupKeyB = ''

    // Root group (empty string) comes first
    if (groupKeyA === '' && groupKeyB !== '')
      return -1
    if (groupKeyA !== '' && groupKeyB === '')
      return 1

    // If in different groups, sort by group key
    if (groupKeyA !== groupKeyB)
      return groupKeyA.localeCompare(groupKeyB)

    // Within same group, sort by full URL path
    // Root (/) always comes first within root group
    if (segmentsA.length === 0)
      return -1
    if (segmentsB.length === 0)
      return 1

    // Compare segment by segment
    const minLen = Math.min(segmentsA.length, segmentsB.length)
    for (let i = 0; i < minLen; i++) {
      const cmp = segmentsA[i].localeCompare(segmentsB[i])
      if (cmp !== 0)
        return cmp
    }

    // If all compared segments are equal, shorter path comes first
    return segmentsA.length - segmentsB.length
  })
}

export function createLlmsTxtStream(options: CreateLlmsTxtStreamOptions = {}): WritableStream<ProcessedFile> {
  const { siteName = 'Site', description, origin = '', generateFull, outputDir = process.cwd(), sections, notes } = options
  let llmsTxtHandle: FileHandle | undefined
  let llmsFullTxtHandle: FileHandle | undefined
  const bufferedPages: { url: string, title: string, description?: string, filePath?: string }[] = []

  return new WritableStream<ProcessedFile>({
    async start() {
      // Create output directory if it doesn't exist
      await mkdir(outputDir, { recursive: true })

      // Create llms.txt but only write header sections
      llmsTxtHandle = await open(join(outputDir, 'llms.txt'), 'w')
      let header = `# ${siteName}\n\n`
      if (description) {
        header += `> ${description}\n\n`
      }

      if (origin) {
        header += `Canonical Origin: ${origin}\n\n`
      }

      // Write sections if provided
      if (sections) {
        for (const section of sections) {
          header += formatSection(section)
        }
      }

      await llmsTxtHandle.write(header)

      // Create and write headers to llms-full.txt if requested
      if (generateFull) {
        llmsFullTxtHandle = await open(join(outputDir, 'llms-full.txt'), 'w')
        let fullHeader = `# ${siteName}\n\n`
        if (description) {
          fullHeader += `> ${description}\n\n`
        }

        if (origin) {
          fullHeader += `Canonical Origin: ${origin}\n\n`
        }

        // Write sections to full version too
        if (sections) {
          for (const section of sections) {
            fullHeader += formatSection(section)
          }
        }

        await llmsFullTxtHandle.write(fullHeader)
      }
    },

    async write(file) {
      // Buffer page metadata for llms.txt (to sort later)
      const desc = file.metadata?.description
      bufferedPages.push({
        url: file.url,
        title: file.title,
        description: desc,
        filePath: file.filePath,
      })

      // Write to llms-full.txt immediately (streaming)
      if (generateFull && llmsFullTxtHandle) {
        const url = file.url.startsWith('http://') || file.url.startsWith('https://')
          ? file.url
          : (origin ? origin + file.url : file.url)

        const { frontmatter, body } = parseFrontmatter(file.content)

        const metadata: Record<string, any> = {
          title: file.title,
          url,
        }

        if (file.filePath) {
          metadata.file = relative(outputDir, file.filePath)
        }

        if (file.metadata) {
          if (file.metadata.description)
            metadata.description = file.metadata.description
          if (file.metadata.keywords)
            metadata.keywords = file.metadata.keywords
          if (file.metadata.author)
            metadata.author = file.metadata.author
        }

        const mergedFrontmatter = frontmatter ? { ...frontmatter, ...metadata } : metadata
        const frontmatterString = serializeFrontmatter(mergedFrontmatter)
        let contentBody = frontmatter ? body : file.content

        const titleLine = contentBody.trim().split('\n')[0]
        if (titleLine === file.title || titleLine === `# ${file.title}`) {
          contentBody = contentBody.trim().split('\n').slice(1).join('\n').trimStart()
        }

        const fullChunk = `---\n${frontmatterString}\n---\n\n${contentBody}\n\n---\n\n`
        await llmsFullTxtHandle.write(fullChunk)
      }
    },

    async close() {
      // Sort buffered pages by path hierarchy and write to llms.txt
      const sortedPages = sortPagesByPath(bufferedPages)

      // Count URLs per 2-segment prefix
      const twoSegmentCount = new Map<string, number>()
      for (const page of sortedPages) {
        const prefix = getGroupPrefix(page.url, 2)
        twoSegmentCount.set(prefix, (twoSegmentCount.get(prefix) || 0) + 1)
      }

      // Analyze which first segments have nested paths
      const segmentHasNested = new Map<string, boolean>()
      for (const page of sortedPages) {
        const segments = page.url.split('/').filter(Boolean)
        const firstSegment = segments.length > 0 ? segments[0] : ''

        if (!segmentHasNested.has(firstSegment)) {
          segmentHasNested.set(firstSegment, false)
        }

        if (segments.length > 1) {
          segmentHasNested.set(firstSegment, true)
        }
      }

      await llmsTxtHandle?.write(`## Pages\n\n`)

      let currentGroup = ''
      let segmentGroupIndex = 0
      let urlsInCurrentGroup = 0

      for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i]
        const segments = page.url.split('/').filter(Boolean)
        const firstSegment = segments.length > 0 ? segments[0] : ''

        // Determine group key using same logic as sortPagesByPath
        const twoSegPrefix = getGroupPrefix(page.url, 2)
        const twoSegCount = twoSegmentCount.get(twoSegPrefix) || 0
        let groupKey = twoSegCount > 1 ? twoSegPrefix : `/${firstSegment}`

        // Root-level pages without nested paths go in root group
        const isRootLevel = segments.length <= 1
        const hasNested = segmentHasNested.get(firstSegment)
        if (isRootLevel && !hasNested) {
          groupKey = ''
        }

        // Detect segment group change
        if (groupKey !== currentGroup) {
          // Add blank line after previous group based on rules
          // Only add if we've written at least one URL
          if (urlsInCurrentGroup > 0) {
            const shouldAddBlankLine = segmentGroupIndex === 0 // Always after first group (index 0)
              || (segmentGroupIndex >= 1 && segmentGroupIndex <= 2 && urlsInCurrentGroup > 1) // Groups 2-3 (index 1-2) if > 1 URL

            if (shouldAddBlankLine) {
              await llmsTxtHandle?.write('\n')
            }
          }

          currentGroup = groupKey
          segmentGroupIndex++
          urlsInCurrentGroup = 0
        }

        urlsInCurrentGroup++

        const descText = page.description ? `: ${page.description.substring(0, 160)}${page.description.length > 160 ? '...' : ''}` : ''

        let chunk = ''
        if (page.filePath && page.filePath.endsWith('.md')) {
          const relativePath = relative(outputDir, page.filePath)
          chunk = `- [${page.title}](${relativePath})${descText}\n`
        }
        else {
          const url = page.url.startsWith('http://') || page.url.startsWith('https://')
            ? page.url
            : (origin ? origin + page.url : page.url)
          chunk = `- [${page.title}](${url})${descText}\n`
        }
        await llmsTxtHandle?.write(chunk)
      }

      // Write notes section if provided
      if (notes) {
        const notesContent = formatNotes(notes)
        await llmsTxtHandle?.write(`\n${notesContent}`)
        if (generateFull && llmsFullTxtHandle) {
          await llmsFullTxtHandle.write(`\n${notesContent}`)
        }
      }

      await llmsTxtHandle?.close()
      await llmsFullTxtHandle?.close()
    },

    async abort(_reason) {
      await llmsTxtHandle?.close()
      await llmsFullTxtHandle?.close()
    },
  })
}
