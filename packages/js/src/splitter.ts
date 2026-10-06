import type { OutputPosition } from './output-positions'
import type { ParseState } from './parse'
import type { ElementNode, MarkdownChunk, NodeEvent, SplitterOptions, TextNode } from './types'
import {
  ELEMENT_NODE,
  NodeEventEnter,
  NodeEventExit,
  TAG_H1,
  TAG_H6,
  TAG_HR,
  TEXT_NODE,
} from './const'
import { createMarkdownProcessor, trimAsciiWhitespaceEnd } from './markdown-processor'
import { assertEngineOptions, checkClean } from './option-shape'
import { createOutputPositions } from './output-positions'
import { finalizeParse, parseHtmlStream } from './parse'
import { resolvePlugins } from './pluggable/plugin'
import { endPlugins, processPluginsForEvent } from './plugin-processor'
import { buildTagOverrideHandlers } from './tag-overrides'
import { tagHandlers } from './tags'
import { trimOutputStart } from './utils'

const MARKDOWN_HEADER_LINE_RE = /^#{1,6}\s+/

// Bit `level - 1` is set for each heading level that starts a new chunk.
// TAG_H1 to TAG_H6 are consecutive, so bit `tagId - TAG_H1` is the same bit.
const DEFAULT_SPLIT_HEADINGS = 0b111110

const HEADING_LEVELS_ERROR = 'headersToSplitOn takes heading levels from 1 to 6, such as [2, 3]. '
  + '@mdream/js no longer exports the TAG_H* constants.'

/** Parse heading levels once, so a stale TAG_H* id fails before conversion. */
function headingSplitMask(levels: unknown): number {
  if (levels == null)
    return DEFAULT_SPLIT_HEADINGS
  if (!Array.isArray(levels))
    throw new TypeError(HEADING_LEVELS_ERROR)
  let mask = 0
  for (let index = 0; index < levels.length; index++) {
    const level = levels[index]
    if (!Number.isInteger(level) || level < 1 || level > 6)
      throw new TypeError(HEADING_LEVELS_ERROR)
    mask |= 1 << (level - 1)
  }
  return mask
}

function createOptions(options: SplitterOptions) {
  return {
    // Parsed first, so a bad level throws before any plugin setup runs.
    splitHeadings: headingSplitMask(options.headersToSplitOn),
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

/** `tagId` is a heading tag id, from TAG_H1 to TAG_H6. */
function shouldSplitOnHeader(tagId: number, options: ReturnType<typeof createOptions>): boolean {
  return (options.splitHeadings & (1 << (tagId - TAG_H1))) !== 0
}

/** Whether `code` is whitespace the converter writes between blocks. */
function isOutputWhitespace(code: number): boolean {
  return code === 32 || (code >= 9 && code <= 13)
}

/** Separators a size cut prefers, best first. */
const SEPARATORS = ['\n\n', '```\n', '\n', ' ']

/**
 * Where content starts at or after `start`. Blank lines are skipped, and a
 * line that starts in range keeps its indent. Returns `end` for whitespace.
 */
function contentStart(markdown: string, start: number, end: number): number {
  let lineStart = start === 0 || markdown.charCodeAt(start - 1) === 10 ? start : -1
  for (let index = start; index < end; index++) {
    const code = markdown.charCodeAt(index)
    if (code === 10)
      lineStart = index + 1
    else if (!isOutputWhitespace(code))
      return lineStart === -1 ? index : lineStart
  }
  return end
}

/** Where content ends before `end`, not before `start`. */
function contentEnd(markdown: string, start: number, end: number): number {
  while (end > start && isOutputWhitespace(markdown.charCodeAt(end - 1)))
    end--
  return end
}

/** `markdown.lastIndexOf(separator, from)`, without matches that start before `floor`. */
function lastIndexBetween(markdown: string, separator: string, floor: number, from: number): number {
  if (from < floor)
    return -1
  // The slice bounds the scan. An unbounded search can walk back to the
  // document start for every cut.
  const index = markdown.slice(floor, from + separator.length).lastIndexOf(separator)
  return index === -1 ? -1 : floor + index
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
 * Convert HTML to Markdown and split it into chunks.
 *
 * The whole document converts before the first chunk. Open writers, such as
 * a blockquote or fragment cleanup, can rewrite earlier output until the
 * document ends. The generator then yields one chunk at a time, so a caller
 * that stops early skips the remaining chunk work.
 *
 * Chunks drop the separators between them. A chunk's `content` has no blank
 * first or last line, and `metadata.loc` gives the lines it spans in the
 * converted Markdown.
 *
 * **JavaScript engine only** — uses the JS engine's internal processing pipeline.
 * Not compatible with the Rust engine.
 */
export function* htmlToMarkdownSplitChunksStream(
  html: string,
  options: SplitterOptions = {},
): Generator<MarkdownChunk, void, undefined> {
  assertEngineOptions(options, 'splitter')
  checkClean(options)
  const opts = createOptions(options)

  if (opts.chunkOverlap >= opts.chunkSize) {
    throw new Error('chunkOverlap must be less than chunkSize')
  }

  const processor = createMarkdownProcessor(options)
  // Writers rewrite earlier fragments, so cut points are buffer positions
  // that follow each rewrite, resolved once the document is finished.
  const positions = createOutputPositions(processor.state.buffer)
  processor.state.outputPositions = positions
  const codePositions: { position: OutputPosition, language: string }[] = []
  processor.state.onCodeFenceOpen = (language) => {
    if (language) {
      const fence = processor.state.codeFence!
      codePositions.push({ position: positions.capture(fence.fragment, fence.markerOffset, 'content'), language })
    }
  }

  const headerHierarchy = new Map<number, string>()
  const seenSplitHeaders = new Set<number>()
  let collectingHeaderText = false
  let currentHeaderTagId: number | null = null
  let currentHeaderText = ''
  // Section ends are recorded before a split heading updates the hierarchy.
  const sectionEnds: { position: OutputPosition, headers: Map<number, string> }[] = []
  const endSection = () => {
    sectionEnds.push({ position: positions.capture(), headers: new Map(headerHierarchy) })
  }

  const processResolvedEvent: (event: NodeEvent) => void = opts.resolvedPlugins?.length
    ? event => processPluginsForEvent(event, opts.resolvedPlugins, processor.state, processor.processEvent)
    : processor.processEvent

  const handleEvent = (event: NodeEvent) => {
    const { type: eventType, node } = event
    if (node.type === ELEMENT_NODE) {
      const tagId = (node as ElementNode).tagId

      if (tagId && tagId >= TAG_H1 && tagId <= TAG_H6) {
        if (eventType === NodeEventEnter) {
          collectingHeaderText = true
          currentHeaderTagId = tagId
          currentHeaderText = ''

          if (shouldSplitOnHeader(tagId, opts)) {
            if (seenSplitHeaders.has(tagId)) {
              endSection()
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

      if (tagId === TAG_HR && eventType === NodeEventEnter)
        endSection()
    }
    else if (collectingHeaderText && node.type === TEXT_NODE) {
      currentHeaderText += (node as TextNode).value
    }

    processResolvedEvent(event)
  }

  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    resolvedPlugins: opts.resolvedPlugins,
    tagHandlers,
    tagOverrideHandlers: opts.tagOverrideHandlers,
  }
  const leftover = parseHtmlStream(html, parseState, handleEvent)
  finalizeParse(leftover, parseState, handleEvent)
  endPlugins(opts.resolvedPlugins, processor.state)
  endSection()

  // Trim and finish the buffer as `htmlToMarkdown` does, so chunks are
  // slices of the same document.
  const positionOffset = positions.finish()
  const joined = processor.state.buffer.join('')
  const started = trimOutputStart(joined)
  const leadingTrim = joined.length - started.length
  const raw = trimAsciiWhitespaceEnd(started)
  const view = processor.finishOutput?.(raw)
  const markdown = view ? view.markdown : raw
  const mapPosition = view
    ? view.mapPosition ?? ((position: number) => processor.finishOutput!(raw.slice(0, position)).markdown.length)
    : undefined
  const offsetOf = (position: OutputPosition): number => {
    const offset = Math.min(Math.max(0, positionOffset(position) - leadingTrim), raw.length)
    return offset === raw.length ? markdown.length : mapPosition ? mapPosition(offset) : offset
  }

  const sections: Section[] = []
  for (const { position, headers } of sectionEnds)
    sections.push({ end: offsetOf(position), headers })
  const codes: CodeStart[] = []
  for (const { position, language } of codePositions)
    codes.push({ start: offsetOf(position), language })
  codes.sort((a, b) => a.start - b.start)

  const lengthFunction = options.lengthFunction
  const measure = lengthFunction
    ? (start: number, end: number) => lengthFunction(markdown.slice(start, end))
    : (start: number, end: number) => end - start
  yield* chunkSections(markdown, sections, codes, opts, measure)
}

/** Content between two split points, with the heading hierarchy that owns it. */
interface Section {
  /** Offset in the finished Markdown where the section ends. */
  end: number
  headers: Map<number, string>
}

/** A code fence opener in the finished Markdown. */
interface CodeStart {
  start: number
  language: string
}

/**
 * Split finished Markdown at every section end, and inside a section where
 * its rest is longer than `chunkSize`. Every cut is a position in this one
 * document, so a chunk is always a slice of it.
 */
function* chunkSections(
  markdown: string,
  sections: Section[],
  codes: CodeStart[],
  opts: ReturnType<typeof createOptions>,
  measure: (start: number, end: number) => number,
): Generator<MarkdownChunk, void, undefined> {
  const regions = codeRegions(markdown)
  const newlines: number[] = []
  for (let index = markdown.indexOf('\n'); index !== -1; index = markdown.indexOf('\n', index + 1))
    newlines.push(index)
  // Where the next chunk starts. It always sits at content, so a chunk has
  // no leading blank line.
  let chunkStart = 0
  // Where the last chunk's content ends. A chunk must end past it, so an
  // overlap never yields text the previous chunk already holds.
  let lastEnd = 0
  let codeIndex = 0
  let headers = new Map<number, string>()

  function lineAt(offset: number): number {
    let lower = 0
    let upper = newlines.length
    while (lower < upper) {
      const middle = (lower + upper) >>> 1
      if (newlines[middle]! < offset)
        lower = middle + 1
      else
        upper = middle
    }
    return lower + 1
  }

  function codeRegionAt(position: number): { start: number, end: number } | undefined {
    let lower = 0
    let upper = regions.length
    while (lower < upper) {
      const middle = (lower + upper) >>> 1
      if (regions[middle]!.start < position)
        lower = middle + 1
      else
        upper = middle
    }
    const region = lower > 0 ? regions[lower - 1] : undefined
    return region && position < region.end ? region : undefined
  }

  function advanceTo(position: number): void {
    const next = contentStart(markdown, position, markdown.length)
    if (next > chunkStart)
      chunkStart = next
  }

  function splitPosition(sectionEnd: number): number {
    const idealSplitPos = Math.min(sectionEnd, chunkStart + opts.chunkSize)
    const floor = Math.max(chunkStart, lastEnd)
    let heldRegion: { start: number, end: number } | undefined
    for (const separator of SEPARATORS) {
      // A cut must hold content past the previous one, so search no further back.
      const index = lastIndexBetween(markdown, separator, Math.max(0, floor - separator.length + 1), idealSplitPos)
      const candidate = index + separator.length
      if (index < 0 || candidate > sectionEnd || contentEnd(markdown, floor, candidate) <= floor)
        continue
      const region = codeRegionAt(candidate)
      if (!region)
        return candidate
      heldRegion = region
    }
    heldRegion ??= codeRegionAt(idealSplitPos)
    if (heldRegion)
      return Math.min(heldRegion.end, sectionEnd)
    // An oversized word stays whole. Release it at the next separator rather
    // than folding the rest of the section into the same chunk.
    let next = idealSplitPos
    while (next < sectionEnd) {
      const code = markdown.charCodeAt(next)
      if (code === 32 || code === 10)
        break
      next++
    }
    return next > chunkStart ? next : sectionEnd
  }

  function* flush(endPosition: number, applyOverlap: boolean): Generator<MarkdownChunk, void, undefined> {
    const chunkEnd = Math.min(endPosition, markdown.length)
    const start = chunkStart
    const end = contentEnd(markdown, start, chunkEnd)
    if (end <= start || end <= lastEnd) {
      // Whitespace only, or overlap text the previous chunk holds already.
      advanceTo(chunkEnd)
      return
    }

    let content = markdown.slice(start, end)
    let contentFrom = start
    let contentTo = end
    if (opts.stripHeaders && (content.charCodeAt(0) === 35 || content.includes('\n#'))) {
      const kept: string[] = []
      let firstKept = -1
      let lastKept = -1
      let offset = 0
      for (const line of content.split('\n')) {
        if (line.charCodeAt(0) !== 35 || !MARKDOWN_HEADER_LINE_RE.test(line)) {
          const lineEnd = contentEnd(line, 0, line.length)
          if (lineEnd > 0) {
            if (firstKept === -1) {
              firstKept = kept.length
              contentFrom = start + offset
            }
            lastKept = kept.length
            contentTo = start + offset + lineEnd
          }
          kept.push(line)
        }
        offset += line.length + 1
      }
      if (firstKept === -1) {
        lastEnd = end
        advanceTo(chunkEnd)
        return
      }
      const lastLine = kept[lastKept]!
      kept[lastKept] = lastLine.slice(0, contentEnd(lastLine, 0, lastLine.length))
      content = kept.slice(firstKept, lastKept + 1).join('\n')
    }

    const chunk: MarkdownChunk = {
      content,
      metadata: {
        loc: {
          lines: {
            from: lineAt(contentFrom),
            to: lineAt(contentTo - 1),
          },
        },
      },
    }

    if (headers.size > 0) {
      chunk.metadata.headers = {}
      for (const [tagId, text] of headers.entries()) {
        const level = `h${tagId - TAG_H1 + 1}`
        chunk.metadata.headers[level] = text
      }
    }

    while (codeIndex < codes.length && codes[codeIndex]!.start < start)
      codeIndex++
    if (codeIndex < codes.length && codes[codeIndex]!.start < end)
      chunk.metadata.code = codes[codeIndex]!.language

    yield chunk

    lastEnd = end
    let next = chunkEnd
    if (applyOverlap && opts.chunkOverlap > 0) {
      let overlapStart = end - Math.min(opts.chunkOverlap, end - start - 1)
      while (overlapStart > start + 1 && !isOutputWhitespace(markdown.charCodeAt(overlapStart - 1)))
        overlapStart--
      const region = codeRegionAt(overlapStart)
      if (region)
        overlapStart = Math.min(region.end, end)
      // A word longer than the overlap leaves no word start to overlap from.
      // Restarting one character later would yield a chunk per character.
      if (overlapStart > start + 1)
        next = overlapStart
    }
    advanceTo(next)
  }

  for (const section of sections) {
    headers = section.headers
    if (!opts.returnEachLine) {
      while (measure(chunkStart, section.end) > opts.chunkSize) {
        const previousStart = chunkStart
        yield* flush(splitPosition(section.end), true)
        if (chunkStart <= previousStart)
          break
      }
    }
    yield* flush(section.end, false)
  }
}

/**
 * Convert HTML to Markdown and split it into chunks.
 * See `htmlToMarkdownSplitChunksStream` for the chunk contract.
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
