import type { MarkdownChunk, MdreamOptions, SplitterOptions } from './types'
import { TAG_H1, TAG_H6 } from './const'
import { htmlToMarkdown } from './pipeline'

export type { MarkdownChunk, SplitterOptions } from './types'

const HEADER_RE = /^(#{1,6})\s+(.+)$/
const NEWLINE_RE = /\n/g
const MARKDOWN_HEADER_LINE_RE = /^#{1,6}\s+/
// Order matters: *** before **, ** before *, etc.
const MARKDOWN_FORMAT_RE = /\*\*\*|___|\*\*|__|[*_`]/g

const DEFAULT_HEADERS_TO_SPLIT_ON = [8, 9, 10, 11, 12] // TAG_H2..TAG_H6

function stripMarkdownFormatting(text: string): string {
  return text.replace(MARKDOWN_FORMAT_RE, '').trim()
}

function createOpts(options: SplitterOptions) {
  return {
    headersToSplitOn: options.headersToSplitOn ?? DEFAULT_HEADERS_TO_SPLIT_ON,
    returnEachLine: options.returnEachLine ?? false,
    stripHeaders: options.stripHeaders ?? true,
    chunkSize: options.chunkSize ?? 1000,
    chunkOverlap: options.chunkOverlap ?? 200,
    lengthFunction: options.lengthFunction ?? ((text: string) => text.length),
    keepSeparator: options.keepSeparator ?? false,
  }
}

/**
 * Convert HTML to Markdown and split into chunks.
 * Requires `engine` in options (or use package-specific re-exports that inject a default).
 */
export function* htmlToMarkdownSplitChunksStream(
  html: string,
  options: SplitterOptions & MdreamOptions,
): Generator<MarkdownChunk, void, undefined> {
  const opts = createOpts(options)
  if (opts.chunkOverlap >= opts.chunkSize) {
    throw new Error('chunkOverlap must be less than chunkSize')
  }

  const result = htmlToMarkdown(html, options)
  const markdown = result.markdown.trimStart()
  if (!markdown.trim())
    return

  const lines = markdown.split('\n')
  // Build line start position index
  const lineStarts: number[] = []
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    lineStarts.push(pos)
    pos += lines[i]!.length + 1
  }

  // Detect frontmatter block (--- ... ---)
  let frontmatterEndIdx = -1
  if (lines.length > 0 && lines[0]!.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]!.trim() === '---') {
        frontmatterEndIdx = i
        break
      }
    }
  }

  // State
  const headerHierarchy = new Map<number, string>()
  const seenSplitHeaders = new Set<number>()
  let currentChunkCodeLanguage = ''
  let inCodeBlock = false
  let lineNumber = 1
  let lastChunkEndPosition = 0
  let lastSplitPosition = 0

  function* flushChunk(endPosition?: number, applyOverlap = false): Generator<MarkdownChunk, void, undefined> {
    const chunkEnd = endPosition ?? markdown.length
    const originalChunkContent = markdown.slice(lastChunkEndPosition, chunkEnd)

    if (!originalChunkContent.trim()) {
      lastChunkEndPosition = chunkEnd
      return
    }

    let chunkContent = originalChunkContent
    if (opts.stripHeaders) {
      chunkContent = chunkContent
        .split('\n')
        .filter(line => !MARKDOWN_HEADER_LINE_RE.test(line))
        .join('\n')
        .trim()

      if (!chunkContent) {
        lastChunkEndPosition = chunkEnd
        return
      }
    }

    const chunk: MarkdownChunk = {
      content: chunkContent.trimEnd(),
      metadata: {
        loc: {
          lines: {
            from: lineNumber,
            to: lineNumber + (originalChunkContent.match(NEWLINE_RE) || []).length,
          },
        },
      },
    }

    if (headerHierarchy.size > 0) {
      chunk.metadata.headers = {}
      for (const [tagId, text] of headerHierarchy.entries()) {
        chunk.metadata.headers[`h${tagId - TAG_H1 + 1}`] = text
      }
    }

    if (currentChunkCodeLanguage) {
      chunk.metadata.code = currentChunkCodeLanguage
    }

    yield chunk

    currentChunkCodeLanguage = ''
    lastSplitPosition = chunkEnd

    if (applyOverlap && opts.chunkOverlap > 0) {
      const maxOverlap = Math.max(0, originalChunkContent.length - 1)
      const actualOverlap = Math.min(opts.chunkOverlap, maxOverlap)
      lastChunkEndPosition = chunkEnd - actualOverlap
    }
    else {
      lastChunkEndPosition = chunkEnd
    }

    lineNumber += (originalChunkContent.match(NEWLINE_RE) || []).length
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const linePos = lineStarts[i]!
    const isFrontmatter = frontmatterEndIdx >= 0 && (i === 0 || i === frontmatterEndIdx)

    // Code block tracking
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        const lang = line.slice(3).trim()
        if (lang && !currentChunkCodeLanguage) {
          currentChunkCodeLanguage = lang
        }
      }
      else {
        inCodeBlock = false
      }
    }

    if (!inCodeBlock && !line.startsWith('```')) {
      // Header detection
      const headerMatch = !isFrontmatter && line.match(HEADER_RE)
      if (headerMatch) {
        const level = headerMatch[1]!.length
        const tagId = TAG_H1 + level - 1
        const headerText = stripMarkdownFormatting(headerMatch[2]!)

        if (opts.headersToSplitOn.includes(tagId)) {
          if (seenSplitHeaders.has(tagId)) {
            yield* flushChunk(linePos)
            for (let j = tagId; j <= TAG_H6; j++) {
              headerHierarchy.delete(j)
            }
          }
          seenSplitHeaders.add(tagId)
        }
        headerHierarchy.set(tagId, headerText)
      }

      // HR detection (skip frontmatter markers)
      if (!isFrontmatter && !headerMatch && (line === '---' || line === '***' || line === '___')) {
        yield* flushChunk(linePos)
      }
    }

    // Size-based splitting
    if (!opts.returnEachLine) {
      const lineEnd = linePos + line.length + 1
      const currentChunkSize = opts.lengthFunction(markdown.slice(lastChunkEndPosition, lineEnd))

      if (currentChunkSize > opts.chunkSize) {
        const idealSplitPos = lastChunkEndPosition + opts.chunkSize
        const currentMd = markdown.slice(0, lineEnd)
        const separators = ['\n\n', '```\n', '\n', ' ']
        let splitPosition = -1

        for (const sep of separators) {
          const idx = currentMd.lastIndexOf(sep, idealSplitPos)
          const candidateSplitPos = idx + sep.length

          if (idx >= 0) {
            // Don't split inside code blocks (odd backtick count)
            const beforeSplit = currentMd.slice(0, candidateSplitPos)
            let backtickCount = 0
            let bpos = beforeSplit.indexOf('```', 0)
            while (bpos !== -1) {
              backtickCount++
              bpos = beforeSplit.indexOf('```', bpos + 3)
            }
            if (backtickCount % 2 === 1) {
              continue
            }
          }

          if (idx >= 0 && candidateSplitPos > lastSplitPosition) {
            splitPosition = candidateSplitPos
            break
          }
        }

        if (splitPosition === -1 || splitPosition <= lastChunkEndPosition) {
          splitPosition = lineEnd
        }

        yield* flushChunk(splitPosition, true)
      }
    }
  }

  yield* flushChunk()
}

/**
 * Convert HTML to Markdown and split into chunks.
 * Requires `engine` in options (or use package-specific re-exports that inject a default).
 */
export function htmlToMarkdownSplitChunks(
  html: string,
  options: SplitterOptions & MdreamOptions,
): MarkdownChunk[] {
  const opts = createOpts(options)
  const chunks: MarkdownChunk[] = []

  for (const chunk of htmlToMarkdownSplitChunksStream(html, options)) {
    chunks.push(chunk)
  }

  if (opts.returnEachLine && chunks.length > 0) {
    const lineChunks: MarkdownChunk[] = []

    for (const chunk of chunks) {
      const chunkLines = chunk.content.split('\n')
      const chunkStartLine = chunk.metadata.loc?.lines.from || 1

      for (let i = 0; i < chunkLines.length; i++) {
        const chunkLine = chunkLines[i]!
        if (chunkLine.trim()) {
          lineChunks.push({
            content: chunkLine,
            metadata: {
              ...chunk.metadata,
              loc: {
                lines: {
                  from: chunkStartLine + i,
                  to: chunkStartLine + i,
                },
              },
            },
          })
        }
      }
    }

    return lineChunks
  }

  return chunks
}
