import type { OutputProcessor } from './output-runner'
import type { ElementNode, EngineOptions, MdreamRuntimeState, NodeEvent, TextNode } from './types'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  MAX_TAG_ID,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
  TAG_BLOCKQUOTE,
  TAG_BR,
  TAG_CODE,
  TAG_DIV,
  TAG_FIGCAPTION,
  TAG_H1,
  TAG_H6,
  TAG_IMG,
  TAG_LI,
  TAG_P,
  TAG_PRE,
  TAG_Q,
  TAG_SPAN,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TEXT_NODE,
} from './const'
import { resolveUrl } from './url'
import { figcaptionOwnsBlockSpacing, isDataUrl, isInsideHeading, isInsideTableCell, lastOutputChar, markRenderedChildContent, trimOutputStart, trimTextAtLineStart } from './utils'

interface TextState extends MdreamRuntimeState {
  options: EngineOptions
  buffer: string[]
  depthMap: Uint16Array
  lastNode?: ElementNode | TextNode
  lastTextNode?: TextNode
  pendingInlineWhitespace?: boolean
}

function trimAsciiWhitespaceEnd(value: string): string {
  let end = value.length
  while (end > 0) {
    const code = value.charCodeAt(end - 1)
    if (code !== 32 && (code < 9 || code > 13))
      break
    end--
  }
  return end === value.length ? value : value.slice(0, end)
}

function shouldAddSpacingBeforeText(lastChar: string, lastNode: ElementNode | TextNode | undefined, textNode: TextNode): boolean {
  // Parity with the Rust engine's `should_add_spacing_before_text`.
  if (!lastChar || '\n \t[>'.includes(lastChar) || textNode.value[0] === ' ')
    return false
  // Unknown tags are inline, as in the Rust engine; an end tag that closed
  // nothing is no boundary.
  if (textNode.joinsPrevious || (lastNode && (lastNode.tagHandler ? lastNode.tagHandler.isInline : (lastNode as ElementNode).tagId === -1)))
    return false
  const firstChar = textNode.value[0]
  return Boolean(firstChar && !'.,!?:;_*`)]'.includes(firstChar))
}

/** `base` is the column the first fragment starts at. */
function currentColumn(buffer: string[], base: number, scan: [fragments: number, column: number]): number {
  if (scan[0] >= buffer.length) {
    scan[0] = 0
    scan[1] = base
  }
  for (; scan[0] < buffer.length - 1; scan[0]++) {
    const value = buffer[scan[0]]!
    scan[1] = columnAt(value, value.length, scan[1])
  }
  const tail = buffer.at(-1)
  return tail ? columnAt(tail, tail.length, scan[1]) : base
}

/**
 * Column at `end` in `value`, counted in code points like `currentColumn`.
 * `column` is the column `value` starts at.
 */
function columnAt(value: string, end: number, column: number): number {
  const newline = end > 0 ? value.lastIndexOf('\n', end - 1) : -1
  let index = 0
  if (newline >= 0) {
    index = newline + 1
    column = 0
  }
  for (; index < end; index++) {
    const code = value.charCodeAt(index)
    // A surrogate pair is one code point.
    if (code >= 0xD800 && code <= 0xDBFF && index + 1 < end) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xDC00 && next <= 0xDFFF)
        index++
    }
    column++
  }
  return column
}

/** Yielded characters a stream keeps before its unstable tail, for `trailingNewlines` and `lastOutputChar`. */
const YIELDED_CONTEXT = 2

function wrapText(value: string, column: number, width: number): string {
  const leading = value.charCodeAt(0) === 32
  const trailing = value.charCodeAt(value.length - 1) === 32
  let output = ''
  let first = true
  let index = 0
  while (index < value.length) {
    let next = value.indexOf(' ', index)
    if (next === -1)
      next = value.length
    if (next > index) {
      const word = value.slice(index, next)
      const wordLength = columnAt(word, word.length, 0)
      const needsSpace = first ? leading : true
      if (needsSpace && column > 0 && column + 1 + wordLength > width) {
        output += '\n'
        column = 0
      }
      else if (needsSpace) {
        output += ' '
        column++
      }
      output += word
      column += wordLength
      first = false
    }
    index = next + 1
  }
  if (trailing && output && !output.endsWith(' ') && !output.endsWith('\n'))
    output += ' '
  return output || (leading || trailing ? ' ' : '')
}

/** Blank line a caption opens and closes with, when nothing overrides it. */
const CAPTION_SPACING = 2

/** Drops a trailing space and tab run, stopping at a newline. */
function trimSpacesEnd(value: string, keepTabs = false): string {
  let end = value.length
  while (end > 0) {
    const code = value.charCodeAt(end - 1)
    if (code !== 32 && (keepTabs || code !== 9))
      break
    end--
  }
  return end === value.length ? value : value.slice(0, end)
}

function trimAsciiWhitespaceStart(value: string): string {
  let start = 0
  while (start < value.length && value.charCodeAt(start) <= 32)
    start++
  return start === 0 ? value : value.slice(start)
}

function hasVisibleContent(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 32)
      return true
  }
  return false
}

/** Whether `value` holds anything but HTML whitespace. */
function hasNonWhitespace(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code !== 32 && code !== 10 && code !== 9 && code !== 13 && code !== 12)
      return true
  }
  return false
}

/** Last emitted character, skipping fragments a trim emptied. */
function charOf(code: number): string {
  return code === -1 ? '' : String.fromCharCode(code)
}

function canWrapHere(depthMap: Uint16Array): boolean {
  if (depthMap[TAG_PRE] || depthMap[TAG_CODE] || depthMap[TAG_TD] || depthMap[TAG_TH])
    return false
  return !isInsideHeading(depthMap)
}

function newlineConfig(node: ElementNode, depthMap: Uint16Array): readonly [number, number] {
  const tagId = node.tagId
  // A caption's boundary is deferred until it emits content, so its own
  // enter and exit spacing stay at zero.
  if (tagId === TAG_FIGCAPTION)
    return NO_SPACING
  if ((tagId !== TAG_LI && depthMap[TAG_LI])
    || (tagId !== TAG_BLOCKQUOTE && depthMap[TAG_BLOCKQUOTE])) {
    return tagId === TAG_PRE ? [1, 1] : NO_SPACING
  }

  const block = tagId !== undefined
    && ((tagId >= TAG_H1 && tagId <= TAG_H6) || tagId === TAG_P || tagId === TAG_DIV || tagId === TAG_LI)
  let parent = node.parent
  while (parent) {
    if (parent.tagHandler?.collapsesInnerWhiteSpace) {
      if (block && parent.tagId === TAG_SPAN) {
        parent = parent.parent
        continue
      }
      return NO_SPACING
    }
    parent = parent.parent
  }
  if (node.tagHandler?.spacing)
    return node.tagHandler.spacing
  return tagId === -1 ? NO_SPACING : DEFAULT_BLOCK_SPACING
}

function elementOutput(node: ElementNode, eventType: number, state: TextState): string | undefined {
  const override = state.options.tagOverrides?.[node.name]
  if (override && typeof override !== 'string') {
    const output = eventType === NodeEventEnter ? override.enter : override.exit
    if (output !== undefined)
      return output
  }

  if (eventType === NodeEventEnter) {
    if (node.tagId === TAG_BR)
      return '\n'
    if (node.tagId === TAG_P && (state.depthMap[TAG_BLOCKQUOTE] || (state.depthMap[TAG_LI] && !isInsideTableCell(state)))) {
      const lastCode = lastOutputChar(state.buffer)
      if (lastCode !== -1 && lastCode !== 32 && lastCode !== 10)
        return '\n\n'
    }
    if (node.tagId === TAG_TD || node.tagId === TAG_TH)
      return state.depthMap[TAG_TABLE]! > 1 || node.index === 0 ? undefined : '\t'
    if (node.tagId === TAG_IMG) {
      const alt = node.attributes.alt
      const clean = state.options.clean
      const stripsEmptyImage = clean === true || (clean != null && clean !== false && clean.emptyImages === true)
      if (stripsEmptyImage && !(alt !== undefined && alt.trim().length > 0))
        return undefined
      const src = node.attributes.src || ''
      // A data URL carries no readable text, so it never becomes the fallback.
      const output = alt !== undefined
        ? alt || undefined
        : node.attributes.title
          || resolveUrl(isDataUrl(src) ? '' : src, state.options.origin, state.options.clean)
          || undefined
      if (output && hasVisibleContent(output)) {
        markRenderedChildContent(node)
        // Alt text reads as its own word, so it never runs into the text before it.
        if (lastOutputChar(state.buffer) > 32)
          return ` ${output}`
      }
      return output
    }
    if (node.tagId === TAG_Q)
      return lastOutputChar(state.buffer) > 32 ? ' "' : '"'
  }
  else if (node.tagId === TAG_Q) {
    return '"'
  }
}

function trailingNewlines(buffer: string[]): number {
  let count = 0
  for (let index = buffer.length - 1; index >= 0 && count < 2; index--) {
    const value = buffer[index]!
    for (let offset = value.length - 1; offset >= 0 && count < 2; offset--) {
      if (value.charCodeAt(offset) !== 10)
        return count
      count++
    }
  }
  return count
}

function appendOutput(state: TextState, element: ElementNode, eventType: number, output: string | undefined): void {
  const buffer = state.buffer
  const config = newlineConfig(element, state.depthMap)
  const wantedNewlines = config[eventType] || 0
  // An empty inline element between the text and a block boundary clears
  // `lastTextNode`, so the boundary itself drops the space it sits on.
  if (wantedNewlines > 0 && buffer.length > 0 && !(state.depthMap[TAG_PRE]! > 0 && element.tagId !== TAG_PRE)) {
    const tail = buffer[buffer.length - 1]!
    // A row keeps the tab that separates an empty trailing cell.
    const trimmed = trimSpacesEnd(tail, state.depthMap[TAG_TABLE]! > 0)
    if (trimmed.length !== tail.length)
      buffer[buffer.length - 1] = trimmed
  }
  const missingNewlines = Math.max(0, wantedNewlines - trailingNewlines(buffer))
  // An unknown tag with no handler is inline, as in the Rust engine.
  const isInline = element.tagHandler ? element.tagHandler.isInline === true : element.tagId === -1

  if (buffer.length === 0) {
    if (output)
      buffer.push(output)
    return
  }

  if (state.pendingInlineWhitespace) {
    const firstOutput = output?.[0] || ''
    if (eventType === NodeEventEnter) {
      if (!isInline || element.tagId === TAG_BR || missingNewlines > 0 || firstOutput === '\n' || firstOutput === '\r') {
        state.pendingInlineWhitespace = false
      }
      else if (firstOutput) {
        const last = charOf(lastOutputChar(buffer))
        if (last && !' \n\t\r'.includes(last) && !' \n\t\r'.includes(firstOutput))
          buffer.push(' ')
        state.pendingInlineWhitespace = false
      }
    }
    else if (!isInline || missingNewlines > 0) {
      state.pendingInlineWhitespace = false
    }
  }

  // Preformatted content keeps its trailing bytes. Closing the block drops a
  // trailing space run, but never the newlines the block ends on.
  const closesPre = element.tagId === TAG_PRE
  const inPre = state.depthMap[TAG_PRE]! > 0 && !closesPre
  if (buffer.length && state.lastTextNode?.containsWhitespace && !inPre) {
    const isBlock = !isInline && missingNewlines > 0
    const collapses = element.tagHandler?.collapsesInnerWhiteSpace
    const hasSpacing = Array.isArray(element.tagHandler?.spacing)
    // A block boundary owns the line, so the space before it goes too.
    const trim = (element.tagId === TAG_BR && output?.endsWith('\n'))
      || isBlock
      || ((!isInline || eventType === NodeEventExit) && !(collapses && eventType === NodeEventEnter) && !(hasSpacing && eventType === NodeEventEnter))
    if (trim) {
      const last = buffer.at(-1)!
      const trimmed = closesPre ? trimSpacesEnd(last) : trimAsciiWhitespaceEnd(last)
      if (trimmed.length !== last.length) {
        buffer[buffer.length - 1] = trimmed
        if (eventType === NodeEventExit && isInline)
          state.pendingInlineWhitespace = true
      }
    }
    state.lastTextNode = undefined
  }

  const newline = missingNewlines ? '\n'.repeat(missingNewlines) : ''
  if (eventType === NodeEventEnter && newline)
    buffer.push(newline)
  if (output)
    buffer.push(output)
  if (eventType === NodeEventExit && newline)
    buffer.push(newline)
}

export function createTextOutputProcessor(options: EngineOptions, hasPlugins = false): OutputProcessor {
  const state: TextState = {
    options,
    outputFormat: 'text',
    buffer: [],
    depthMap: new Uint16Array(MAX_TAG_ID),
    plainText: true,
  }
  let preserveLeadingWhitespace = false
  // Offset in the joined buffer up to which output is yielded, once started.
  let yieldedLength = 0
  // Leading whitespace drops only until the first yield.
  let started = false
  // Column the first buffer fragment starts at, once yielded output is dropped.
  let bufferColumn = 0
  const columnScan: [fragments: number, column: number] = [0, 0]
  // A caption only earns its blank-line boundary once it emits visible
  // content, so an empty `<figcaption>` leaves the text unchanged.
  let captionOpen = 0
  let captionContent = false
  let captionBreakRun = 0
  let captionEnterSpacing = CAPTION_SPACING
  let captionExitSpacing = CAPTION_SPACING
  let captionClosedSpacing = 0
  // A caption that held only breaks owns the next line start.
  let captionBreakOwnsLine = false
  // Buffer indexes of quotation openers whose quotation has no content yet,
  // and their elements at the same positions. The exit retracts such an
  // opener, so a stream holds it back. Parity with the Rust engine's open
  // inline markers. A plugin can skip an enter or an exit, so an exit
  // matches its own element, and the final output drops the hold.
  const openQuotes: number[] = []
  const openQuoteNodes: ElementNode[] = []

  function pushCaptionBoundary(newlines: number): boolean {
    if (state.buffer.length === 0 || newlines === 0)
      return false
    const tail = state.buffer[state.buffer.length - 1]!
    const trimmed = trimSpacesEnd(tail)
    if (trimmed.length !== tail.length)
      state.buffer[state.buffer.length - 1] = trimmed
    const missing = newlines - trailingNewlines(state.buffer)
    if (missing > 0)
      state.buffer.push('\n'.repeat(missing))
    return true
  }

  /** True when a boundary was emitted, so the content drops its own leading space. */
  function openCaptionBoundary(): boolean {
    let emitted = false
    if (captionClosedSpacing !== 0) {
      emitted = pushCaptionBoundary(captionClosedSpacing)
      captionClosedSpacing = 0
    }
    if (captionOpen > 0 && !captionContent) {
      captionContent = true
      if (captionBreakRun === 0)
        emitted = pushCaptionBoundary(captionEnterSpacing) || emitted
    }
    return emitted
  }

  function processTextNode(node: TextNode, lastNode: ElementNode | TextNode | undefined): void {
    if (node.trimsAtLineStart)
      trimTextAtLineStart(node, state.buffer)
    if (node.excludedFromMarkdown || !node.value)
      return
    if (hasVisibleContent(node.value) && openCaptionBoundary()) {
      node.value = trimAsciiWhitespaceStart(node.value)
      state.pendingInlineWhitespace = false
    }
    const last = charOf(lastOutputChar(state.buffer))
    if (state.pendingInlineWhitespace) {
      if (!node.value.trim())
        return
      if (last && !' \n\t\r'.includes(last) && !' \n\t\r'.includes(node.value[0] || ''))
        node.value = ` ${node.value}`
      state.pendingInlineWhitespace = false
    }
    if (state.depthMap[TAG_PRE] && state.buffer.length === 0)
      preserveLeadingWhitespace = true
    if (node.value === ' ' && last !== '' && ' \n\t\r'.includes(last))
      return
    if (captionBreakOwnsLine) {
      captionBreakOwnsLine = false
      if (last === '\n' && !state.depthMap[TAG_PRE])
        node.value = trimAsciiWhitespaceStart(node.value)
    }
    if (!state.depthMap[TAG_PRE] && shouldAddSpacingBeforeText(last, lastNode, node))
      node.value = ` ${node.value}`

    const width = state.options.wrapWidth
    if (hasPlugins) {
      columnScan[0] = 0
      columnScan[1] = bufferColumn
    }
    const value = width && canWrapHere(state.depthMap)
      ? wrapText(node.value, currentColumn(state.buffer, bufferColumn, columnScan), width)
      : node.value
    state.buffer.push(value)
    state.lastContentCache = value
    state.lastTextNode = node
    if (openQuotes.length !== 0 && hasNonWhitespace(value)) {
      openQuotes.length = 0
      openQuoteNodes.length = 0
    }
  }

  function processEvent(event: NodeEvent): void {
    state.depth = event.node.depth
    const inTemplate = event.node.type === ELEMENT_NODE
      ? event.node.excludedFromMarkdown
      : event.node.parent?.excludedFromMarkdown
    if (inTemplate)
      return

    const lastNode = state.lastNode
    state.lastNode = event.node as ElementNode | TextNode
    if (event.node.type === TEXT_NODE && event.type === NodeEventEnter) {
      processTextNode(event.node as TextNode, lastNode)
      return
    }
    if (event.node.type !== ELEMENT_NODE)
      return

    const element = event.node as ElementNode
    let output: string | undefined
    // A quotation with only whitespace since its opener emits nothing, but
    // keeps the space its opener added. Openers above this one belong to
    // quotations inside it whose exit never came.
    if (element.tagId === TAG_Q && event.type === NodeEventExit && openQuotes.length !== 0) {
      let record = openQuoteNodes.length - 1
      while (record >= 0 && openQuoteNodes[record] !== element)
        record--
      if (record >= 0) {
        const opener = openQuotes[record]!
        openQuotes.length = record
        openQuoteNodes.length = record
        // Output a plugin writes for the exit keeps the opener.
        if (!element.pluginOutput?.length) {
          const buffer = state.buffer
          let empty = true
          for (let index = opener + 1; index < buffer.length; index++) {
            if (hasNonWhitespace(buffer[index]!)) {
              empty = false
              break
            }
          }
          if (empty) {
            const openerOutput = buffer[opener]
            buffer.length = opener
            if (openerOutput === ' "')
              buffer.push(' ')
            state.lastNode = element
            return
          }
          openQuotes.length = 0
          openQuoteNodes.length = 0
        }
      }
    }
    if (element.pluginOutput?.length) {
      output = element.pluginOutput.join('')
      element.pluginOutput = undefined
    }
    else {
      output = elementOutput(element, event.type, state)
    }

    if (element.tagId === TAG_BR && event.type === NodeEventEnter && output) {
      const currentNewlines = trailingNewlines(state.buffer)
      if (!state.depthMap[TAG_PRE] && currentNewlines >= 2)
        output = undefined
      state.pendingInlineWhitespace = false
      // The break owns the line end, so the space before it goes too.
      if (output && !state.depthMap[TAG_PRE] && state.buffer.length > 0) {
        const tail = state.buffer[state.buffer.length - 1]!
        const trimmed = trimSpacesEnd(tail)
        if (trimmed.length !== tail.length)
          state.buffer[state.buffer.length - 1] = trimmed
      }
      // A break inside an unopened caption serves as its boundary.
      if (output && captionOpen > 0 && !captionContent)
        captionBreakRun++
    }

    const ownsCaptionSpace = element.tagId === TAG_FIGCAPTION
      && !state.depthMap[TAG_PRE]
      && figcaptionOwnsBlockSpacing(element, true)
    if (ownsCaptionSpace && event.type === NodeEventEnter) {
      // An override owns the caption spacing; otherwise a caption opens a block.
      // Read the resolved handler, so a string alias override counts too.
      const spacing = element.tagHandler?.spacing
      captionEnterSpacing = spacing ? spacing[0] : CAPTION_SPACING
      captionExitSpacing = spacing ? spacing[1] : CAPTION_SPACING
      captionOpen++
      captionContent = false
      captionBreakRun = 0
    }
    // A caption's own output is caption content, so it lands after the boundary.
    if (output && hasVisibleContent(output) && openCaptionBoundary()) {
      output = trimAsciiWhitespaceStart(output)
      state.pendingInlineWhitespace = false
    }

    appendOutput(state, element, event.type, output)
    if (element.tagId === TAG_Q && event.type === NodeEventEnter && (output === '"' || output === ' "') && state.buffer.at(-1) === output) {
      openQuotes.push(state.buffer.length - 1)
      openQuoteNodes.push(element)
    }
    else if (openQuotes.length !== 0) {
      // Content, or a block boundary, makes every open quotation permanent.
      const isInline = element.tagHandler ? element.tagHandler.isInline === true : element.tagId === -1
      if ((output && hasNonWhitespace(output)) || (element.tagId !== -1 && !isInline)) {
        openQuotes.length = 0
        openQuoteNodes.length = 0
      }
    }

    if (ownsCaptionSpace && event.type === NodeEventExit) {
      captionOpen--
      if (captionContent)
        captionClosedSpacing = captionExitSpacing
      else if (captionBreakRun > 0)
        captionBreakOwnsLine = true
      captionContent = false
      captionBreakRun = 0
    }
    state.lastNode = element
  }

  /**
   * Drops yielded fragments, so a stream holds only its unstable tail. Later
   * events trim only the last fragment and retract only from an open
   * quotation opener, which sits at or after `stableEnd`, so every fragment
   * from the one that holds `stableEnd` stays intact. Backward scans read at
   * most `YIELDED_CONTEXT` characters before it, and `bufferColumn` stands in
   * for the dropped part of the line.
   */
  function dropYielded(content: string, stableEnd: number): void {
    const buffer = state.buffer
    // Walk back over the unstable tail, which is only a few fragments. The
    // walk stops at the fragment that holds `stableEnd` and keeps it whole.
    let keepFrom = buffer.length
    let keptStart = content.length
    while (keepFrom > 0 && keptStart > stableEnd) {
      keepFrom--
      keptStart -= buffer[keepFrom]!.length
    }
    let contextStart = keptStart > YIELDED_CONTEXT ? keptStart - YIELDED_CONTEXT : 0
    // Never split a surrogate pair, so the column count stays the same.
    const first = content.charCodeAt(contextStart)
    if (contextStart > 0 && first >= 0xDC00 && first <= 0xDFFF)
      contextStart--
    if (contextStart === 0)
      return
    if (state.options.wrapWidth)
      bufferColumn = columnAt(content, contextStart, bufferColumn)
    const kept = buffer.slice(keepFrom)
    buffer.length = 0
    buffer.push(content.slice(contextStart, keptStart))
    for (let index = 0; index < kept.length; index++)
      buffer.push(kept[index]!)
    columnScan[0] = 0
    columnScan[1] = bufferColumn
    // The context fragment replaces fragments `0..keepFrom`.
    const shift = keepFrom - 1
    for (let index = 0; index < openQuotes.length; index++)
      openQuotes[index]! -= shift
    yieldedLength = stableEnd - contextStart
  }

  return {
    state,
    processEvent,
    takeOutput(final) {
      const content = state.buffer.join('')
      const leading = started || preserveLeadingWhitespace ? 0 : content.length - trimOutputStart(content).length
      // Hold back the tail a later event may still trim: trailing whitespace,
      // and a quotation opener that an empty quotation retracts. With an open
      // quotation the hold starts at the opener, and the whitespace before a
      // retractable opener stays mutable too. No event follows the final
      // call, so an opener whose exit a plugin skipped is output.
      let stableEnd = content.length
      if (openQuotes.length !== 0 && !final) {
        stableEnd = 0
        for (let index = 0; index < openQuotes[0]!; index++)
          stableEnd += state.buffer[index]!.length
      }
      while (stableEnd > leading) {
        const code = content.charCodeAt(stableEnd - 1)
        if (code !== 32 && (code < 9 || code > 13))
          break
        stableEnd--
      }
      const yieldedEnd = started ? yieldedLength : leading
      if (stableEnd < yieldedEnd)
        stableEnd = yieldedEnd
      const output = content.slice(yieldedEnd, stableEnd)
      if (output) {
        started = true
        yieldedLength = stableEnd
        dropYielded(content, stableEnd)
      }
      return output
    },
  }
}
