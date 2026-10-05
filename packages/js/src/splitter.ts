import type { MarkdownState } from './markdown-processor'
import type { ParseState } from './parse'
import type { CleanView, ElementNode, MarkdownChunk, NodeEvent, SplitterOptions, TextNode } from './types'
import {
  ELEMENT_NODE,
  NodeEventEnter,
  NodeEventExit,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_HR,
  TEXT_NODE,
} from './const'
import { createMarkdownProcessor } from './markdown-processor'
import { assertEngineOptions } from './option-shape'
import { finalizeParse, parseHtmlStream } from './parse'
import { resolvePlugins } from './pluggable/plugin'
import { endPlugins, processPluginsForEvent } from './plugin-processor'
import { buildTagOverrideHandlers } from './tag-overrides'
import { tagHandlers } from './tags'
import { isInsideHeading } from './utils'

const MARKDOWN_HEADER_LINE_RE = /^#{1,6}\s+/
const NEWLINE_RE = /\n/g

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
    resolvedPlugins: resolvePlugins(options.plugins),
    tagOverrideHandlers: options.tagOverrides
      ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
      : undefined,
  }
}

function shouldSplitOnHeader(tagId: number, options: ReturnType<typeof createOptions>): boolean {
  return options.headersToSplitOn.includes(tagId)
}

/** Whether `code` is whitespace the converter writes between blocks. */
function isOutputWhitespace(code: number): boolean {
  return code === 32 || (code >= 9 && code <= 13)
}

/** Match complete fences by their line prefix, marker, and opening run. */
function codeRegions(markdown: string): { start: number, end: number, markerStart: number }[] {
  const regions: { start: number, end: number, markerStart: number }[] = []
  let open: { start: number, markerStart: number, marker: number, run: number, prefix: string } | undefined
  let lineStart = 0
  while (lineStart < markdown.length) {
    const newline = markdown.indexOf('\n', lineStart)
    const lineEnd = newline === -1 ? markdown.length : newline
    let markerStart = lineStart
    let prefixStart = lineStart
    let prefix = ''
    while (true) {
      while (markdown.charCodeAt(markerStart) === 32 || markdown.charCodeAt(markerStart) === 62)
        markerStart++
      let listEnd = markerStart
      const first = markdown.charCodeAt(markerStart)
      if ((first === 45 || first === 43 || first === 42) && markdown.charCodeAt(markerStart + 1) === 32) {
        listEnd++
      }
      else if (first >= 48 && first <= 57) {
        let end = markerStart + 1
        while (markdown.charCodeAt(end) >= 48 && markdown.charCodeAt(end) <= 57)
          end++
        const delimiter = markdown.charCodeAt(end)
        if ((delimiter === 46 || delimiter === 41) && markdown.charCodeAt(end + 1) === 32)
          listEnd = end + 1
      }
      if (listEnd === markerStart)
        break
      // List openers use a marker where later fence lines use indentation.
      prefix += markdown.slice(prefixStart, markerStart) + ' '.repeat(listEnd - markerStart)
      markerStart = listEnd
      prefixStart = listEnd
    }
    prefix += markdown.slice(prefixStart, markerStart)
    const marker = markdown.charCodeAt(markerStart)
    if (marker === 96 || marker === 126) {
      let markerEnd = markerStart + 1
      while (markdown.charCodeAt(markerEnd) === marker)
        markerEnd++
      const run = markerEnd - markerStart
      if (!open && run >= 3) {
        open = { start: lineStart, markerStart, marker, run, prefix }
      }
      else if (open && marker === open.marker && run >= open.run
        && prefix === open.prefix) {
        let tail = markerEnd
        while (tail < lineEnd && isOutputWhitespace(markdown.charCodeAt(tail)))
          tail++
        if (tail === lineEnd) {
          regions.push({ start: open.start, end: lineEnd, markerStart: open.markerStart })
          open = undefined
        }
      }
    }
    lineStart = lineEnd + 1
  }
  if (open)
    regions.push({ start: open.start, end: markdown.length, markerStart: open.markerStart })
  return regions
}

/**
 * Get current markdown content WITHOUT clearing buffers. A held clean pass
 * finishes the view so its fragment-link markers never reach a chunk.
 */
function getCurrentMarkdown(state: MarkdownState, finishOutput?: (markdown: string) => CleanView, heldFragment = Infinity, holdHeadingTail = false): CleanView {
  // Join only the stable prefix. Open writers can retract or replace every
  // later fragment, even after the link that triggered cleanup has closed.
  let markdown = heldFragment === Infinity
    ? state.buffer.join('')
    : state.buffer.slice(0, heldFragment).join('')
  markdown = markdown.trimStart()
  if (holdHeadingTail && isInsideHeading(state.depthMap)) {
    let end = markdown.length
    while (end > 0) {
      const code = markdown.charCodeAt(end - 1)
      if (code !== 35 && code !== 32 && code !== 9)
        break
      end--
    }
    markdown = markdown.slice(0, end)
  }
  return finishOutput ? finishOutput(markdown) : { markdown, settled: -1 }
}

/**
 * Convert HTML to Markdown and split into chunks in single pass.
 * Yields chunks during HTML event processing for better memory efficiency.
 * Fragment cleanup waits until all headings are known.
 *
 * **JavaScript engine only** — uses the JS engine's internal processing pipeline.
 * Not compatible with the Rust engine.
 */
export function* htmlToMarkdownSplitChunksStream(
  html: string,
  options: SplitterOptions = {},
): Generator<MarkdownChunk, void, undefined> {
  assertEngineOptions(options)
  const opts = createOptions(options)

  if (opts.chunkOverlap >= opts.chunkSize) {
    throw new Error('chunkOverlap must be less than chunkSize')
  }

  let currentChunkCodeLanguage = ''
  const deferredCodes: { rawStart: number, language: string }[] = []
  const finishedCodes: { start: number, language: string }[] = []

  // Create processor
  const processor = createMarkdownProcessor(options)
  processor.state.onCodeFenceOpen = (language) => {
    if (language && !currentChunkCodeLanguage)
      currentChunkCodeLanguage = language
    if (language && processor.finishOutput)
      deferredCodes.push({ rawStart: getCurrentMarkdown(processor.state).markdown.length, language })
  }

  // Chunking state
  const headerHierarchy = new Map<number, string>()
  const seenSplitHeaders = new Set<number>()
  let collectingHeaderText = false
  let currentHeaderTagId: number | null = null
  let currentHeaderText = ''
  let lineNumber = 1
  let lastChunkEndPosition = 0
  let lastSplitPosition = 0
  // The last flush runs against the finished document, where the clean pass
  // has resolved every fragment link, so no position can go stale.
  let outputFinal = false
  let finishedMarkdown: string | undefined
  let finishedCodeRegions: { start: number, end: number }[] = []
  const deferredSections: { rawEnd: number, headers: Map<number, string>, language: string }[] = []

  function codeRegionAt(position: number): { start: number, end: number } | undefined {
    let lower = 0
    let upper = finishedCodeRegions.length
    while (lower < upper) {
      const middle = (lower + upper) >>> 1
      if (finishedCodeRegions[middle]!.start < position)
        lower = middle + 1
      else
        upper = middle
    }
    const region = lower > 0 ? finishedCodeRegions[lower - 1] : undefined
    return region && position < region.end ? region : undefined
  }

  function splitPosition(currentMd: string, end: number): number {
    const idealSplitPos = Math.min(end, lastChunkEndPosition + opts.chunkSize)
    let heldRegion: { start: number, end: number } | undefined
    for (const separator of ['\n\n', '```\n', '\n', ' ']) {
      const index = currentMd.lastIndexOf(separator, idealSplitPos)
      const candidate = index + separator.length
      if (index < 0 || candidate <= lastSplitPosition || candidate <= lastChunkEndPosition || candidate > end)
        continue
      let contentEnd = candidate
      while (contentEnd > lastChunkEndPosition && isOutputWhitespace(currentMd.charCodeAt(contentEnd - 1)))
        contentEnd--
      if (contentEnd <= lastChunkEndPosition || contentEnd <= lastSplitPosition)
        continue
      const region = codeRegionAt(candidate)
      if (!region)
        return candidate
      heldRegion = region
    }
    heldRegion ??= codeRegionAt(idealSplitPos)
    if (heldRegion)
      return Math.min(heldRegion.end, end)
    // An oversized word stays whole. Release it at the next separator rather
    // than folding the rest of the document into the same chunk.
    const space = currentMd.indexOf(' ', idealSplitPos)
    const newline = currentMd.indexOf('\n', idealSplitPos)
    const next = Math.min(space < 0 ? end : space, newline < 0 ? end : newline)
    return next > lastChunkEndPosition ? next : end
  }

  function getStableMarkdown(): CleanView {
    return getCurrentMarkdown(
      processor.state,
      processor.finishOutput,
      outputFinal ? Infinity : processor.getHeldOutputFragment?.(),
      !outputFinal && !!processor.getHeldOutputFragment,
    )
  }

  function* flushChunk(endPosition?: number, applyOverlap = false): Generator<MarkdownChunk, void, undefined> {
    if (processor.finishOutput && !outputFinal) {
      deferredSections.push({
        rawEnd: getCurrentMarkdown(processor.state).markdown.length,
        headers: new Map(headerHierarchy),
        language: currentChunkCodeLanguage,
      })
      currentChunkCodeLanguage = ''
      return
    }
    const view = finishedMarkdown === undefined
      ? getStableMarkdown()
      : { markdown: finishedMarkdown, settled: -1 }
    const currentMd = view.markdown
    let chunkEnd = Math.min(endPosition ?? currentMd.length, currentMd.length)
    // Keep separator whitespace at the next chunk's start. Cleanup resolves
    // once, so these cuts must not remove bytes from the finished document.
    if (finishedMarkdown !== undefined) {
      while (chunkEnd > lastChunkEndPosition && isOutputWhitespace(currentMd.charCodeAt(chunkEnd - 1)))
        chunkEnd--
    }
    const originalChunkContent = currentMd.slice(lastChunkEndPosition, chunkEnd)

    if (!originalChunkContent.trim()) {
      // Leave whitespace-only output unconsumed: consuming it would drop it
      // from the chunks' join, while the next flush yields it with content.
      return
    }

    // Strip headers if requested
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
        const level = `h${tagId - TAG_H1 + 1}`
        chunk.metadata.headers[level] = text
      }
    }

    if (finishedMarkdown !== undefined) {
      const code = finishedCodes.find(code => code.start >= lastChunkEndPosition && code.start < chunkEnd)
      if (code)
        chunk.metadata.code = code.language
    }
    else if (currentChunkCodeLanguage
      && (!processor.getHeldOutputFragment
        || codeRegions(currentMd).some(region => region.markerStart >= lastChunkEndPosition && region.markerStart < chunkEnd))) {
      chunk.metadata.code = currentChunkCodeLanguage
    }

    yield chunk

    if (!processor.getHeldOutputFragment || chunk.metadata.code)
      currentChunkCodeLanguage = ''
    lastSplitPosition = chunkEnd

    if (applyOverlap && opts.chunkOverlap > 0) {
      const maxOverlap = Math.max(0, originalChunkContent.length - 1)
      const actualOverlap = Math.min(opts.chunkOverlap, maxOverlap)
      let overlapStart = chunkEnd - actualOverlap
      if (finishedMarkdown !== undefined) {
        while (overlapStart > lastChunkEndPosition + 1 && !isOutputWhitespace(currentMd.charCodeAt(overlapStart - 1)))
          overlapStart--
        const region = codeRegionAt(overlapStart)
        if (region)
          overlapStart = Math.min(region.end, chunkEnd)
      }
      lastChunkEndPosition = overlapStart
    }
    else {
      lastChunkEndPosition = chunkEnd
    }

    lineNumber += (originalChunkContent.match(NEWLINE_RE) || []).length
  }

  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    resolvedPlugins: opts.resolvedPlugins,
    tagHandlers,
    tagOverrideHandlers: opts.tagOverrideHandlers,
  }

  const eventBuffer: NodeEvent[] = []
  const processResolvedEvent: (event: NodeEvent) => void = opts.resolvedPlugins?.length
    ? event => processPluginsForEvent(event, opts.resolvedPlugins, processor.state, processor.processEvent)
    : processor.processEvent

  const collectEvent = (event: NodeEvent) => {
    eventBuffer.push(event)
  }
  const leftover = parseHtmlStream(html, parseState, collectEvent)
  finalizeParse(leftover, parseState, collectEvent)

  for (const event of eventBuffer) {
    const { type: eventType, node } = event

    // Parsing finishes before this generator replays its buffered events, so
    // the shared parser depth map is back at zero here. Restore the live depth
    // for each event from its parent chain; exit handlers observe the element
    // after its own depth has been decremented, matching the streaming parser.
    const eventDepthMap = node.type === ELEMENT_NODE
      ? (node as ElementNode).depthMap
      : node.parent?.depthMap
    if (eventDepthMap)
      processor.state.depthMap.set(eventDepthMap)
    else
      processor.state.depthMap.fill(0)
    if (eventType === NodeEventExit && node.type === ELEMENT_NODE) {
      const tagId = (node as ElementNode).tagId
      if (tagId !== undefined && tagId >= 0 && tagId < processor.state.depthMap.length)
        processor.state.depthMap[tagId] = Math.max(0, processor.state.depthMap[tagId]! - 1)
    }

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

      if (tagId === TAG_HR && eventType === NodeEventEnter) {
        yield* flushChunk()
      }
    }

    if (collectingHeaderText && node.type === TEXT_NODE) {
      const textNode = node as TextNode
      currentHeaderText += textNode.value
    }

    processResolvedEvent(event)

    // Final parser whitespace adds no chunk content. It must not trigger an
    // extra overlap split of the preceding text.
    if (!opts.returnEachLine && !processor.finishOutput
      && (node.type !== TEXT_NODE || (node as TextNode).value.trim())) {
      const currentMd = getStableMarkdown().markdown
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
            let pos = beforeSplit.indexOf('```', 0)
            while (pos !== -1) {
              backtickCount++
              pos = beforeSplit.indexOf('```', pos + 3)
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

  endPlugins(opts.resolvedPlugins, processor.state)
  outputFinal = true
  if (processor.finishOutput) {
    const raw = getCurrentMarkdown(processor.state).markdown
    const view = processor.finishOutput(raw)
    finishedMarkdown = view.markdown
    const mapPosition = view.mapPosition ?? ((position: number) => processor.finishOutput!(raw.slice(0, position)).markdown.length)
    for (const code of deferredCodes) {
      finishedCodes.push({
        start: mapPosition(code.rawStart),
        language: code.language,
      })
    }
    finishedCodeRegions = codeRegions(finishedMarkdown)
    deferredSections.push({ rawEnd: raw.length, headers: new Map(headerHierarchy), language: currentChunkCodeLanguage })
    // Section checkpoints are recorded before headings update the hierarchy.
    // Resolve their offsets with the same pass after every heading is known.
    for (const section of deferredSections) {
      const sectionEnd = section.rawEnd === raw.length
        ? finishedMarkdown.length
        : mapPosition(section.rawEnd)
      headerHierarchy.clear()
      for (const [tagId, text] of section.headers)
        headerHierarchy.set(tagId, text)
      currentChunkCodeLanguage = section.language
      if (!opts.returnEachLine) {
        while (opts.lengthFunction(finishedMarkdown.slice(lastChunkEndPosition, sectionEnd)) > opts.chunkSize) {
          const previousEnd = lastChunkEndPosition
          yield* flushChunk(splitPosition(finishedMarkdown, sectionEnd), true)
          if (lastChunkEndPosition <= previousEnd)
            break
        }
      }
      yield* flushChunk(sectionEnd)
    }
    return
  }
  yield* flushChunk()
}

/**
 * Convert HTML to Markdown and split into chunks in single pass.
 * Chunks are created during HTML event processing.
 *
 * **JavaScript engine only** — uses the JS engine's internal processing pipeline.
 * Not compatible with the Rust engine.
 */
export function htmlToMarkdownSplitChunks(
  html: string,
  options: SplitterOptions = {},
): MarkdownChunk[] {
  const chunks: MarkdownChunk[] = []

  for (const chunk of htmlToMarkdownSplitChunksStream(html, options)) {
    chunks.push(chunk)
  }

  // Handle returnEachLine mode - split chunks into individual lines
  if (options.returnEachLine && chunks.length > 0) {
    const lineChunks: MarkdownChunk[] = []

    for (const chunk of chunks) {
      const lines = chunk.content.split('\n')
      const chunkStartLine = chunk.metadata.loc?.lines.from || 1

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line && line.trim()) {
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

  return chunks
}

export type { MarkdownChunk, SplitterOptions } from './types'
