import type { ParseState } from './parse'
import type { ElementNode, MarkdownChunk, NodeEvent, SplitterOptions, TextNode } from './types'
import {
  ELEMENT_NODE,
  NodeEventEnter,
  NodeEventExit,
  TAG_CODE,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_HR,
  TAG_PRE,
  TEXT_NODE,
} from './const.ts'
import { createMarkdownProcessor } from './markdown-processor.ts'
import { parseHtmlStream } from './parse.ts'
import { processPluginsForEvent } from './plugin-processor.ts'

const DEFAULT_HEADERS_TO_SPLIT_ON: number[] = [
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
]

function createOptions(options: SplitterOptions) {
  return {
    headersToSplitOn: options.headersToSplitOn ?? DEFAULT_HEADERS_TO_SPLIT_ON,
    returnEachLine: options.returnEachLine ?? false,
    stripHeaders: options.stripHeaders ?? true,
    chunkSize: options.chunkSize ?? 1000,
    chunkOverlap: options.chunkOverlap ?? 200,
    lengthFunction: options.lengthFunction ?? ((text: string) => text.length),
    keepSeparator: options.keepSeparator ?? false,
    origin: options.origin,
    plugins: options.plugins ?? [],
  }
}

function getCodeLanguage(node: ElementNode): string {
  const className = node.attributes?.class
  if (!className)
    return ''

  const langParts = className
    .split(' ')
    .map(c => c.split('language-')[1])
    .filter(Boolean)

  return langParts.length > 0 ? langParts[0].trim() : ''
}

function shouldSplitOnHeader(tagId: number, options: ReturnType<typeof createOptions>): boolean {
  return options.headersToSplitOn.includes(tagId)
}

/**
 * Get current markdown content WITHOUT clearing buffers
 */
function getCurrentMarkdown(state: { regionContentBuffers: Map<number, string[]>, regionToggles: Map<number, boolean> }): string {
  const fragments: string[] = []
  for (const [regionId, content] of state.regionContentBuffers.entries()) {
    const include = state.regionToggles.get(regionId)
    if (include) {
      fragments.push(...content)
    }
  }
  return fragments.join('').trimStart()
}

/**
 * Convert HTML to Markdown and split into chunks in single pass
 * Chunks are created during HTML event processing
 */
export function htmlToMarkdownSplitChunks(
  html: string,
  options: SplitterOptions = {},
): MarkdownChunk[] {
  const opts = createOptions(options)

  if (opts.chunkOverlap >= opts.chunkSize) {
    throw new Error('chunkOverlap must be less than chunkSize')
  }

  // Create processor
  const processor = createMarkdownProcessor({
    origin: opts.origin,
    plugins: opts.plugins,
  })

  // Chunking state
  const chunks: MarkdownChunk[] = []
  const headerHierarchy = new Map<number, string>()
  const seenSplitHeaders = new Set<number>()
  let currentChunkCodeLanguage = ''
  let collectingHeaderText = false
  let currentHeaderTagId: number | null = null
  let currentHeaderText = ''
  let lineNumber = 1
  let lastChunkEndPosition = 0
  let lastSplitPosition = 0 // Track where we last split to avoid re-splitting

  function flushChunk(endPosition?: number, applyOverlap = false) {
    const currentMd = getCurrentMarkdown(processor.state)
    const chunkEnd = endPosition ?? currentMd.length
    const chunkContent = currentMd.slice(lastChunkEndPosition, chunkEnd)

    if (!chunkContent.trim()) {
      // Still update position to avoid infinite loop
      lastChunkEndPosition = chunkEnd
      return
    }

    const chunk: MarkdownChunk = {
      content: chunkContent.trimEnd(),
      metadata: {
        loc: {
          lines: {
            from: lineNumber,
            to: lineNumber + (chunkContent.match(/\n/g) || []).length,
          },
        },
      },
    }

    // Add headers
    if (headerHierarchy.size > 0) {
      chunk.metadata.headers = {}
      for (const [tagId, text] of headerHierarchy.entries()) {
        const level = `h${tagId - TAG_H1 + 1}`
        chunk.metadata.headers[level] = text
      }
    }

    // Add code language
    if (currentChunkCodeLanguage) {
      chunk.metadata.code = currentChunkCodeLanguage
    }

    chunks.push(chunk)

    // Reset code language for next chunk
    currentChunkCodeLanguage = ''

    // Track where we split (before applying overlap)
    lastSplitPosition = chunkEnd

    // Handle overlap - only for size-based splits, not structural splits
    if (applyOverlap && opts.chunkOverlap > 0) {
      // Cap overlap to (chunkContent.length - 1) to ensure forward progress
      const maxOverlap = Math.max(0, chunkContent.length - 1)
      const actualOverlap = Math.min(opts.chunkOverlap, maxOverlap)
      lastChunkEndPosition = chunkEnd - actualOverlap
    }
    else {
      lastChunkEndPosition = chunkEnd
    }

    lineNumber += (chunkContent.match(/\n/g) || []).length
  }

  // Process HTML with event interception
  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    plugins: opts.plugins,
  }

  parseHtmlStream(html, parseState, (event: NodeEvent) => {
    const { type: eventType, node } = event

    // Track metadata before processing
    if (node.type === ELEMENT_NODE) {
      const element = node as ElementNode
      const tagId = element.tagId

      // Track headers
      if (tagId && tagId >= TAG_H1 && tagId <= TAG_H6) {
        if (eventType === NodeEventEnter) {
          collectingHeaderText = true
          currentHeaderTagId = tagId
          currentHeaderText = ''

          // Check if should split BEFORE processing this header
          if (shouldSplitOnHeader(tagId, opts)) {
            // Only flush if we've seen this header level before (not the first occurrence)
            if (seenSplitHeaders.has(tagId)) {
              flushChunk()
              // Clear lower-level headers
              for (let i = tagId; i <= TAG_H6; i++) {
                headerHierarchy.delete(i)
              }
            }
            seenSplitHeaders.add(tagId)
          }
        }
        else if (eventType === NodeEventExit && currentHeaderTagId === tagId) {
          headerHierarchy.set(tagId, currentHeaderText.trim())
          collectingHeaderText = false
          currentHeaderTagId = null
        }
      }

      // Track code blocks
      if (tagId === TAG_CODE && element.depthMap[TAG_PRE] > 0) {
        if (eventType === NodeEventEnter) {
          const lang = getCodeLanguage(element)
          if (lang && !currentChunkCodeLanguage) {
            currentChunkCodeLanguage = lang
          }
        }
      }

      // Split on HR BEFORE processing it
      if (tagId === TAG_HR && eventType === NodeEventEnter) {
        flushChunk()
      }
    }

    // Collect header text
    if (collectingHeaderText && node.type === TEXT_NODE) {
      const textNode = node as TextNode
      currentHeaderText += textNode.value
    }

    // Process event (generates markdown)
    processPluginsForEvent(event, opts.plugins, processor.state, processor.processEvent)

    // Check size-based splitting AFTER processing
    if (!opts.returnEachLine) {
      const currentMd = getCurrentMarkdown(processor.state)
      const currentChunkSize = opts.lengthFunction(currentMd.slice(lastChunkEndPosition))

      if (currentChunkSize > opts.chunkSize) {
        // Find optimal split point using hierarchy of separators (like RecursiveCharacterTextSplitter)
        const idealSplitPos = lastChunkEndPosition + opts.chunkSize

        // Ordered by preference: paragraph > code block > line > word
        const separators = ['\n\n', '```\n', '\n', ' ']
        let splitPosition = -1

        for (const sep of separators) {
          // Find last occurrence of separator before/at ideal position
          const idx = currentMd.lastIndexOf(sep, idealSplitPos)
          const candidateSplitPos = idx + sep.length

          if (idx >= 0) {
            // Check if we're inside a code block at this position
            const beforeSplit = currentMd.slice(0, candidateSplitPos)
            // Count occurrences of ``` without regex (better perf)
            let backtickCount = 0
            let pos = 0
            while ((pos = beforeSplit.indexOf('```', pos)) !== -1) {
              backtickCount++
              pos += 3
            }
            // If odd number of backticks, we're inside a code block - skip
            if (backtickCount % 2 === 1) {
              continue
            }
          }

          // Only use separator if split position would be beyond our last split
          if (idx >= 0 && candidateSplitPos > lastSplitPosition) {
            splitPosition = candidateSplitPos
            break
          }
        }

        // If no separator found before ideal position, use current length (split now)
        if (splitPosition === -1 || splitPosition <= lastChunkEndPosition) {
          splitPosition = currentMd.length
        }

        flushChunk(splitPosition, true)
      }
    }
  })

  // Flush final chunk
  flushChunk()

  // Handle returnEachLine mode - split chunks into individual lines
  if (opts.returnEachLine && chunks.length > 0) {
    const lineChunks: MarkdownChunk[] = []

    for (const chunk of chunks) {
      const lines = chunk.content.split('\n')
      const chunkStartLine = chunk.metadata.loc?.lines.from || 1

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim()) {
          lineChunks.push({
            content: line,
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

  // Strip headers if requested
  if (opts.stripHeaders) {
    for (const chunk of chunks) {
      chunk.content = chunk.content
        .split('\n')
        .filter(line => !line.match(/^#{1,6}\s+/))
        .join('\n')
        .trim()
    }
  }

  // Filter out empty chunks (can happen after header stripping)
  return chunks.filter(chunk => chunk.content.length > 0)
}

export type { MarkdownChunk, SplitterOptions } from './types'
