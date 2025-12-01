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
 * Yields chunks during HTML event processing for better memory efficiency
 */
export function* htmlToMarkdownSplitChunksStream(
  html: string,
  options: SplitterOptions = {},
): Generator<MarkdownChunk, void, undefined> {
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
  const headerHierarchy = new Map<number, string>()
  const seenSplitHeaders = new Set<number>()
  let currentChunkCodeLanguage = ''
  let collectingHeaderText = false
  let currentHeaderTagId: number | null = null
  let currentHeaderText = ''
  let lineNumber = 1
  let lastChunkEndPosition = 0
  let lastSplitPosition = 0

  function* flushChunk(endPosition?: number, applyOverlap = false): Generator<MarkdownChunk, void, undefined> {
    const currentMd = getCurrentMarkdown(processor.state)
    const chunkEnd = endPosition ?? currentMd.length
    const chunkContent = currentMd.slice(lastChunkEndPosition, chunkEnd)

    if (!chunkContent.trim()) {
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

    if (headerHierarchy.size > 0) {
      chunk.metadata.headers = {}
      for (const [tagId, text] of headerHierarchy.entries()) {
        const level = `h${tagId - TAG_H1 + 1}`
        chunk.metadata.headers[level] = text
      }
    }

    if (currentChunkCodeLanguage) {
      chunk.metadata.code = currentChunkCodeLanguage
    }

    yield chunk

    currentChunkCodeLanguage = ''
    lastSplitPosition = chunkEnd

    if (applyOverlap && opts.chunkOverlap > 0) {
      const maxOverlap = Math.max(0, chunkContent.length - 1)
      const actualOverlap = Math.min(opts.chunkOverlap, maxOverlap)
      lastChunkEndPosition = chunkEnd - actualOverlap
    }
    else {
      lastChunkEndPosition = chunkEnd
    }

    lineNumber += (chunkContent.match(/\n/g) || []).length
  }

  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    plugins: opts.plugins,
  }

  const eventBuffer: NodeEvent[] = []

  parseHtmlStream(html, parseState, (event: NodeEvent) => {
    eventBuffer.push(event)
  })

  for (const event of eventBuffer) {
    const { type: eventType, node } = event

    if (node.type === ELEMENT_NODE) {
      const element = node as ElementNode
      const tagId = element.tagId

      if (tagId && tagId >= TAG_H1 && tagId <= TAG_H6) {
        if (eventType === NodeEventEnter) {
          collectingHeaderText = true
          currentHeaderTagId = tagId
          currentHeaderText = ''

          if (shouldSplitOnHeader(tagId, opts)) {
            if (seenSplitHeaders.has(tagId)) {
              yield* flushChunk()
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

      if (tagId === TAG_CODE && element.depthMap[TAG_PRE] > 0) {
        if (eventType === NodeEventEnter) {
          const lang = getCodeLanguage(element)
          if (lang && !currentChunkCodeLanguage) {
            currentChunkCodeLanguage = lang
          }
        }
      }

      if (tagId === TAG_HR && eventType === NodeEventEnter) {
        yield* flushChunk()
      }
    }

    if (collectingHeaderText && node.type === TEXT_NODE) {
      const textNode = node as TextNode
      currentHeaderText += textNode.value
    }

    processPluginsForEvent(event, opts.plugins, processor.state, processor.processEvent)

    if (!opts.returnEachLine) {
      const currentMd = getCurrentMarkdown(processor.state)
      const currentChunkSize = opts.lengthFunction(currentMd.slice(lastChunkEndPosition))

      if (currentChunkSize > opts.chunkSize) {
        const idealSplitPos = lastChunkEndPosition + opts.chunkSize
        const separators = ['\n\n', '```\n', '\n', ' ']
        let splitPosition = -1

        for (const sep of separators) {
          const idx = currentMd.lastIndexOf(sep, idealSplitPos)
          const candidateSplitPos = idx + sep.length

          if (idx >= 0) {
            const beforeSplit = currentMd.slice(0, candidateSplitPos)
            let backtickCount = 0
            let pos = 0
            while ((pos = beforeSplit.indexOf('```', pos)) !== -1) {
              backtickCount++
              pos += 3
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
          splitPosition = currentMd.length
        }

        yield* flushChunk(splitPosition, true)
      }
    }
  }

  yield* flushChunk()
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
  const chunks: MarkdownChunk[] = []

  for (const chunk of htmlToMarkdownSplitChunksStream(html, options)) {
    chunks.push(chunk)
  }

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

  return chunks.filter(chunk => chunk.content.length > 0)
}

export type { MarkdownChunk, SplitterOptions } from './types'
