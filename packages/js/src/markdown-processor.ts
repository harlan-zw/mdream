import type { ParseState } from './parse'
import type { ElementNode, EngineOptions, GfmAction, Node, NodeEvent, PluginContext, TagHandler, TextNode, TransformPlugin } from './types'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  isInsideRawHtmlBlock,
  MARKDOWN_CODE_BLOCK,
  MARKDOWN_INLINE_CODE,
  MAX_TAG_ID,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
  TAG_A,
  TAG_B,
  TAG_BLOCKQUOTE,
  TAG_BR,
  TAG_CITE,
  TAG_CODE,
  TAG_DEL,
  TAG_DFN,
  TAG_DIV,
  TAG_EM,
  TAG_FIGCAPTION,
  TAG_H1,
  TAG_H6,
  TAG_HR,
  TAG_I,
  TAG_IMG,
  TAG_KBD,
  TAG_LI,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_Q,
  TAG_S,
  TAG_SAMP,
  TAG_SPAN,
  TAG_STRIKE,
  TAG_STRONG,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_VAR,
  TEXT_NODE,
} from './const'
import { finalizeParse, parseHtmlStream } from './parse'
import { processPluginsForEvent } from './plugin-processor'
import { breakHandler, renderBreak, resolveUrl } from './tags'
import { continuationPrefix } from './utils'

export interface MarkdownState {
  /** Configuration options for conversion */
  options?: EngineOptions
  /** Content buffer for markdown output */
  buffer: string[]
  /** Performance cache for last content to avoid iteration */
  lastContentCache?: string
  /** Reference to the last processed node */
  lastNode?: ElementNode | TextNode
  /** Reference to the last processed text node - for context tracking */
  lastTextNode?: TextNode
  /** Deferred separator trimmed from the end of an inline element */
  pendingInlineWhitespace?: boolean
  /** Table processing state - specialized for Markdown tables */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]
  /** Map of tag names to their current nesting depth */
  depthMap: Uint8Array
  /** Current depth for plugin access */
  depth?: number
  /** Context for additional data */
  context?: PluginContext
  /**
   * Cumulative indent for list-item continuation. Grows by each ancestor
   * `<li>`'s marker width (`"- "` = 2, `"N. "` = digits(N) + 2) so code blocks
   * and continuation paragraphs land in the content column CommonMark requires.
   * Pushed on `<li>` enter, popped on `<li>` exit.
   */
  listIndent: string
  /** Per-`<li>` contribution widths, parallel stack to listIndent. */
  listIndentWidths: number[]
  /**
   * <pre> fenced-code deferral (issue #97). A bare <pre> (no <code> child)
   * becomes a fenced code block, but the opening fence is deferred until the
   * first non-whitespace content so empty/whitespace-only blocks emit nothing.
   * `preFencePending`: inside a <pre> whose fence is not yet decided.
   * `preFenceLang`: language resolved from the <pre>'s own class.
   * `preOwnFence`: the <pre> opened its own fence (so a nested <code> must not).
   */
  preFencePending?: boolean
  preFenceLang?: string
  preOwnFence?: boolean
  /** Open fenced block whose delimiter is finalized after its content is known. */
  codeFence?: CodeFence
  /** Open blockquotes buffered until every child line can receive its prefix. */
  blockquotes: BlockquoteFrame[]
  /** Public runtime view used by tag handlers without exposing frame internals. */
  bufferedBlockquoteDepth: number
  /** Whether output should omit Markdown/HTML markup */
  plainText?: boolean
}

interface CodeSpan {
  fragment: number
  prefix: string
}

interface CodeFence {
  fragment: number
  markerOffset: number
  indent: string
  language: string
}

interface BlockquoteFrame {
  fragment: number
  listIndent: string
}

interface GfmLifecycleState {
  openCodeSpans: CodeSpan[]
}

// Marker kind per tag id for inline tags that wrap content in a symmetric
// delimiter (0 = none); indexed like depthMap for O(1) lookup on emitted tags.
const INLINE_MARKER_TYPE = new Uint8Array(MAX_TAG_ID)
INLINE_MARKER_TYPE[TAG_STRONG] = 1 // **
INLINE_MARKER_TYPE[TAG_B] = 1 // **
INLINE_MARKER_TYPE[TAG_DFN] = 1 // **
INLINE_MARKER_TYPE[TAG_EM] = 2 // _
INLINE_MARKER_TYPE[TAG_I] = 2 // _
INLINE_MARKER_TYPE[TAG_FIGCAPTION] = 2 // _
INLINE_MARKER_TYPE[TAG_DEL] = 3 // ~~
INLINE_MARKER_TYPE[TAG_S] = 3 // ~~
INLINE_MARKER_TYPE[TAG_STRIKE] = 3 // ~~
INLINE_MARKER_TYPE[TAG_CITE] = 4 // *
INLINE_MARKER_TYPE[TAG_KBD] = 5 // `
INLINE_MARKER_TYPE[TAG_CODE] = 5 // `
INLINE_MARKER_TYPE[TAG_SAMP] = 5 // `
INLINE_MARKER_TYPE[TAG_VAR] = 5 // `
INLINE_MARKER_TYPE[TAG_Q] = 6 // "

/**
 * Maintain the list-item indent stack. On `<li>` enter, push this item's
 * marker-width of spaces so subsequent continuation content (code blocks,
 * paragraphs, nested lists) lands in the correct column. On exit, pop.
 * Skip when the list item is rendered as literal `<li>` inside a table cell.
 */
function updateListIndent(state: MarkdownState, element: ElementNode, eventType: number): void {
  if (element.tagId !== TAG_LI)
    return
  if ((state.depthMap[TAG_TD] || 0) > 0 || (state.depthMap[TAG_TH] || 0) > 0)
    return
  if (eventType === NodeEventEnter) {
    const isOrdered = element.parent?.tagId === TAG_OL
    const width = state.plainText ? 0 : (isOrdered ? String(element.index + 1).length + 2 : 2)
    state.listIndentWidths.push(width)
    state.listIndent += ' '.repeat(width)
  }
  else if (eventType === NodeEventExit) {
    const width = state.listIndentWidths.pop() ?? 0
    state.listIndent = state.listIndent.slice(0, state.listIndent.length - width)
  }
}

/**
 * Determines if spacing is needed between two characters
 */
function needsSpacing(lastChar: string, firstChar: string, state?: MarkdownState): boolean {
  // Don't add space if last char is already a space or newline
  if (lastChar === ' ' || lastChar === '\n' || lastChar === '\t') {
    return false
  }

  // Don't add space if first char is a space or newline
  if (firstChar === ' ' || firstChar === '\n' || firstChar === '\t') {
    return false
  }

  // Special cases where we don't want spacing
  const noSpaceAfter = new Set(['[', '(', '>', '*', '_', '`'])
  const noSpaceBefore = new Set([']', ')', '<', '.', ',', '!', '?', ':', ';', '*', '_', '`'])

  // Special case: Allow spacing between pipe and HTML tags in table cells
  if (lastChar === '|' && firstChar === '<' && state && (state.depthMap[TAG_TABLE] || 0) > 0) {
    return true
  }

  if (noSpaceAfter.has(lastChar) || noSpaceBefore.has(firstChar)) {
    return false
  }

  // For everything else, add spacing
  return true
}

/**
 * Determines if spacing should be added before text content
 */
function shouldAddSpacingBeforeText(lastChar: string, lastNode: ElementNode | TextNode | undefined, textNode: TextNode): boolean {
  if (!lastChar || lastChar === '\n' || lastChar === ' ' || lastChar === '\t' || lastChar === '[' || lastChar === '>') {
    return false
  }
  if (lastNode?.tagHandler?.isInline) {
    return false
  }
  const firstChar = textNode.value[0]
  if (firstChar === ' ') {
    return false
  }
  // Skip spacing before punctuation (parity with Rust engine)
  if (firstChar === '.' || firstChar === ',' || firstChar === '!' || firstChar === '?'
    || firstChar === ':' || firstChar === ';' || firstChar === '_' || firstChar === '*'
    || firstChar === '`' || firstChar === ')' || firstChar === ']') {
    return false
  }
  return true
}

/**
 * Whether prose at the current position may be hard-wrapped. Code blocks
 * (`<pre>`/`<code>`), table cells, and headings are emitted verbatim so wrapping
 * never corrupts fences, table rows, or heading lines. Parity with the Rust
 * engine's `can_wrap_here`.
 */
function canWrapHere(depthMap: Uint8Array): boolean {
  if (depthMap[TAG_PRE] || depthMap[TAG_CODE] || depthMap[TAG_TD] || depthMap[TAG_TH]) {
    return false
  }
  for (let h = TAG_H1; h <= TAG_H6; h++) {
    if (depthMap[h])
      return false
  }
  return true
}

/**
 * Prepare `<pre>` content for raw-HTML emission inside a GFM table cell
 * (issue #147): fold literal line breaks into `<br>` so the value stays on one
 * row, encode `|`, and HTML-escape `&`, `<`, `>` so decoded source (e.g.
 * `<script>`) is not evaluated as live HTML by downstream renderers. Leading
 * and trailing breaks are dropped; a `\r\n` pair counts as one break.
 */
function foldPreLinesToBr(value: string): string {
  let start = 0
  while (start < value.length) {
    const c = value.charCodeAt(start)
    if (c !== 10 && c !== 13)
      break
    start++
  }
  let end = value.length
  while (end > start) {
    const c = value.charCodeAt(end - 1)
    if (c !== 10 && c !== 13)
      break
    end--
  }
  let out = ''
  for (let i = start; i < end; i++) {
    const c = value.charCodeAt(i)
    if (c === 13) {
      out += '<br>'
      if (i + 1 < end && value.charCodeAt(i + 1) === 10)
        i++
    }
    else if (c === 10) {
      out += '<br>'
    }
    else if (c === 38) {
      out += '&amp;'
    }
    else if (c === 60) {
      out += '&lt;'
    }
    else if (c === 62) {
      out += '&gt;'
    }
    else if (c === 124) {
      out += '&#124;'
    }
    else {
      out += value[i]
    }
  }
  return out
}

function escapeRawHtmlText(value: string, depthMap: Uint8Array): string {
  const inTable = Boolean(depthMap[TAG_TABLE])
  const inLink = Boolean(depthMap[TAG_A])
  let escaped = ''
  let copiedUntil = 0

  let index = 0
  while (index < value.length) {
    const code = value.charCodeAt(index)
    let replacement: string | undefined
    if (code === 38)
      replacement = '&amp;'
    else if (code === 60)
      replacement = '&lt;'
    else if (code === 62)
      replacement = '&gt;'
    else if (code === 10)
      replacement = '&#10;'
    else if (code === 13)
      replacement = '&#13;'
    else if (inTable && code === 124)
      replacement = '&#124;'
    else if (inLink && code === 91)
      replacement = '&#91;'
    else if (inLink && code === 93)
      replacement = '&#93;'

    if (replacement) {
      escaped += value.slice(copiedUntil, index) + replacement
      copiedUntil = index + 1
    }
    index++
  }

  return copiedUntil === 0 ? value : escaped + value.slice(copiedUntil)
}

/**
 * Return the current GFM line indent when a block marker may still start at
 * this position. A non-space byte, or more than three leading spaces, makes
 * the position ordinary inline text.
 */
function markdownLineIndent(buffer: string[]): number {
  let spaces = 0
  for (let fragmentIndex = buffer.length - 1; fragmentIndex >= 0; fragmentIndex--) {
    const fragment = buffer[fragmentIndex]!
    for (let index = fragment.length - 1; index >= 0; index--) {
      const code = fragment.charCodeAt(index)
      if (code === 10)
        return spaces <= 3 ? spaces : -1
      if (code !== 32)
        return -1
      if (++spaces > 3)
        return -1
    }
  }
  return spaces <= 3 ? spaces : -1
}

function isMarkdownMarkerWhitespace(code: number): boolean {
  return code === 0 || code === 9 || code === 10 || code === 13 || code === 32
}

function canStartGfmAngleConstruct(code: number): boolean {
  return (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || code === 33 // !
    || code === 47 // /
    || code === 63 // ?
}

function isThematicBreak(value: string, start: number, marker: number): boolean {
  let count = 0
  for (let index = start; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code === marker) {
      count++
    }
    else if (code === 10 || code === 13) {
      break
    }
    else if (code !== 32 && code !== 9) {
      return false
    }
  }
  return count >= 3
}

function isEntityReferenceAfterAmpersand(value: string, ampersand: number): boolean {
  let index = ampersand + 1
  if (value.charCodeAt(index) === 35) {
    index++
    const hex = value.charCodeAt(index) === 120 || value.charCodeAt(index) === 88
    if (hex)
      index++
    const start = index
    while (index < value.length) {
      const code = value.charCodeAt(index)
      if (!((code >= 48 && code <= 57)
        || (hex && ((code >= 65 && code <= 70) || (code >= 97 && code <= 102))))) {
        break
      }
      index++
    }
    return index > start && value.charCodeAt(index) === 59
  }
  const start = index
  while (index < value.length) {
    const code = value.charCodeAt(index)
    if (!((code >= 48 && code <= 57)
      || (code >= 65 && code <= 90)
      || (code >= 97 && code <= 122))) {
      break
    }
    index++
  }
  return index > start && value.charCodeAt(index) === 59
}

const GFM_TEXT_NATIVE_TRIGGER = /[\\*_~`[<\r\n]/

/**
 * Reject ordinary prose through the native string search before entering the
 * precise JavaScript scanner. A block marker can only begin within the first
 * four characters here; later lines are covered by the newline trigger.
 */
function mayNeedGfmTextEscape(value: string, buffer: string[], depthMap: Uint8Array): boolean {
  if (value.search(GFM_TEXT_NATIVE_TRIGGER) !== -1)
    return true
  if ((depthMap[TAG_TABLE] && value.includes('|'))
    || (depthMap[TAG_A] && value.includes(']'))
    || (depthMap[TAG_BLOCKQUOTE] && value.includes('>'))) {
    return true
  }

  let lineIndent = markdownLineIndent(buffer)
  if (lineIndent < 0)
    return false

  let index = 0
  while (index < value.length && lineIndent < 3 && value.charCodeAt(index) === 32) {
    index++
    lineIndent++
  }
  if (index >= value.length)
    return false

  const code = value.charCodeAt(index)
  return code === 35 // #
    || code === 43 // +
    || code === 45 // -
    || code === 62 // >
    || (code >= 48 && code <= 57)
}

/**
 * Escape Markdown syntax originating in HTML text nodes. Generated tag
 * markers never pass through here, while code and raw-HTML contexts bypass it.
 * The common plain-text path returns the original string without allocation.
 */
function escapeGfmText(value: string, buffer: string[], depthMap: Uint8Array): string {
  const inTable = Boolean(depthMap[TAG_TABLE])
  const inLink = Boolean(depthMap[TAG_A])
  const inBlockquote = Boolean(depthMap[TAG_BLOCKQUOTE])
  let lineIndent = markdownLineIndent(buffer)
  let orderedDigits = 0
  let copiedUntil = 0
  let escaped = ''

  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)

    // A `\&` guarding a decoded entity reference is emitted by the entity
    // decoder; preserve the pair verbatim so this pass never doubles the slash.
    const next = index + 1 < value.length ? value.charCodeAt(index + 1) : 0
    if (code === 92 && next === 38 && isEntityReferenceAfterAmpersand(value, index + 1)) {
      lineIndent = -1
      orderedDigits = 0
      index++
      continue
    }

    if (inTable && (code === 10 || code === 13)) {
      escaped += value.slice(copiedUntil, index)
      escaped += code === 10 ? '&#10;' : '&#13;'
      copiedUntil = index + 1
      continue
    }

    let shouldEscape = code === 92 // \
      || code === 42 // *
      || code === 95 // _
      || code === 126 // ~
      || code === 96 // `
      || code === 91 // [
      || (code === 93 && inLink) // ]
      || (code === 124 && inTable) // |
      || (code === 62 && inBlockquote) // >
      || (code === 60 && canStartGfmAngleConstruct(value.charCodeAt(index + 1))) // <

    if (!shouldEscape && lineIndent >= 0) {
      if (code === 35) { // ATX heading: 1-6 hashes, then whitespace or EOL.
        let end = index + 1
        while (end < value.length && value.charCodeAt(end) === 35)
          end++
        shouldEscape = end - index <= 6
          && (end === value.length || isMarkdownMarkerWhitespace(value.charCodeAt(end)))
      }
      else if (code === 45 || code === 43) { // unordered list marker
        shouldEscape = index + 1 === value.length
          || isMarkdownMarkerWhitespace(value.charCodeAt(index + 1))
          || (code === 45 && isThematicBreak(value, index, code))
      }
      else if (code === 62) { // blockquote marker
        shouldEscape = true
      }
    }
    else if (!shouldEscape && orderedDigits > 0 && (code === 46 || code === 41)) {
      shouldEscape = index + 1 === value.length
        || isMarkdownMarkerWhitespace(value.charCodeAt(index + 1))
    }

    if (shouldEscape) {
      escaped += value.slice(copiedUntil, index)
      escaped += `\\${value[index]}`
      copiedUntil = index + 1
    }

    if (code === 10) {
      lineIndent = 0
      orderedDigits = 0
    }
    else if (lineIndent >= 0) {
      if (code === 32 && lineIndent < 3) {
        lineIndent++
      }
      else {
        orderedDigits = code >= 48 && code <= 57 ? 1 : 0
        lineIndent = -1
      }
    }
    else if (orderedDigits > 0) {
      if (code >= 48 && code <= 57 && orderedDigits < 9)
        orderedDigits++
      else
        orderedDigits = 0
    }
  }

  return copiedUntil === 0 ? value : escaped + value.slice(copiedUntil)
}

/**
 * Character count (code points) of the current unterminated output line, i.e.
 * since the last newline across the buffer chunks. Includes any block prefix
 * (`> `, list indent) already written for the line.
 */
function currentColumn(buffer: string[]): number {
  let col = 0
  for (let i = buffer.length - 1; i >= 0; i--) {
    const s = buffer[i]!
    const nl = s.lastIndexOf('\n')
    if (nl >= 0) {
      return col + [...s.slice(nl + 1)].length
    }
    col += [...s].length
  }
  return col
}

/**
 * Hard-wrap `value` on spaces so no output line exceeds `width` code points.
 * Words are never split, so an oversized token (e.g. a URL) overflows rather
 * than breaking, and a break only ever replaces an inter-word space. `value`
 * already carries any significant leading/trailing space (added upstream), so
 * those boundary spaces are preserved. Parity with the Rust `push_text_wrapped`.
 */
function wrapText(value: string, col: number, width: number, prefix: string): string {
  const leading = value.charCodeAt(0) === 32
  const trailing = value.charCodeAt(value.length - 1) === 32
  const prefixLen = [...prefix].length
  let out = ''
  let first = true
  let i = 0
  const len = value.length
  while (i < len) {
    // Manual split on single spaces to avoid an intermediate array allocation.
    let next = value.indexOf(' ', i)
    if (next === -1)
      next = len
    if (next > i) {
      const word = value.slice(i, next)
      const wordLen = [...word].length
      const needSpace = first ? leading : true
      if (needSpace && col > prefixLen && col + 1 + wordLen > width) {
        out += `\n${prefix}`
        col = prefixLen
      }
      else if (needSpace) {
        out += ' '
        col += 1
      }
      out += word
      col += wordLen
      first = false
    }
    i = next + 1
  }
  if (trailing && out !== '' && !out.endsWith(' ') && !out.endsWith('\n')) {
    out += ' '
  }
  // Whitespace-only value collapses to a single separator space.
  if (out === '' && (leading || trailing)) {
    out = ' '
  }
  return out
}

/**
 * Calculate newline configuration based on tag handler spacing config
 */
function calculateNewLineConfig(node: ElementNode, depthMap: Uint8Array, plainText: boolean): readonly [number, number] {
  const tagId = node.tagId

  // List-item descendants own their structural indentation. Markdown
  // blockquotes are buffered and prefixed after their children serialize, so
  // their normal block spacing must remain intact.
  if ((tagId !== TAG_LI && (depthMap[TAG_LI] || 0) > 0)
    || (plainText && tagId !== TAG_BLOCKQUOTE && (depthMap[TAG_BLOCKQUOTE] || 0) > 0)) {
    // Markdown suppresses nested block spacing because the surrounding list or
    // quote handler owns its prefixes. Plain text has no such prefixes, so a
    // nested <pre> still needs a line boundary around its literal contents.
    if (plainText && tagId === TAG_PRE)
      return [1, 1]
    return NO_SPACING
  }

  // Adjust for inline elements
  // Block elements preserve spacing even inside span elements (presentational containers)
  // because spans shouldn't affect block-level semantics of their children
  const isBlockElement = tagId !== undefined && ((tagId >= TAG_H1 && tagId <= TAG_H6) || tagId === TAG_P || tagId === TAG_DIV)
  let currParent = node.parent
  while (currParent) {
    if (currParent.tagHandler?.collapsesInnerWhiteSpace) {
      // Exception: preserve block spacing when inside span (presentational wrapper)
      if (isBlockElement && currParent.tagId === TAG_SPAN) {
        currParent = currParent.parent
        continue
      }
      return NO_SPACING
    }
    currParent = currParent.parent
  }
  if (node.tagHandler?.spacing) {
    return node.tagHandler?.spacing
  }
  // Truly unknown tags (no dictionary entry) default to inline zero spacing so
  // they don't fragment surrounding paragraphs. Built-in tags without a handler
  // (e.g. caption) keep block-default. Applies whether or not an override
  // handler is attached — overrides set isInline but inherit zero spacing.
  if (tagId === -1) {
    return NO_SPACING
  }
  return DEFAULT_BLOCK_SPACING
}

/**
 * Whether a string contains any non-whitespace character (space, tab, CR, LF).
 * Used to decide if a <pre>'s content warrants opening a fenced code block.
 */
function hasNonWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) {
      return true
    }
  }
  return false
}

function isAsciiWhitespace(code: number): boolean {
  return code === 32 || (code >= 9 && code <= 13)
}

function trimAsciiWhitespaceEnd(value: string): string {
  let end = value.length
  while (end > 0 && isAsciiWhitespace(value.charCodeAt(end - 1)))
    end--
  return end === value.length ? value : value.slice(0, end)
}

function fragmentPosition(buffer: string[], fragment: number): number {
  let position = 0
  for (let index = 0; index < fragment; index++)
    position += buffer[index]!.length
  return position
}

function trimBufferedWhitespacePosition(content: string, position: number): number {
  let end = Math.max(0, position)
  while (end > 0) {
    const code = content.charCodeAt(end - 1)
    if (code !== 32 && code !== 10)
      break
    end--
  }
  return end
}

/** Drop the top marker when every following fragment is whitespace. */
function dropEmptyMarker(buffer: string[], packed: number, markerType: number): number {
  const idx = packed >> 3
  if ((packed & 7) === markerType && idx < buffer.length) {
    for (let i = idx + 1; i < buffer.length; i++) {
      const fragment = buffer[i]!
      if (fragment && hasNonWhitespace(fragment))
        return -1
    }
    buffer.length = idx
    return idx
  }
  return -1
}

function maxBacktickRun(value: string): number {
  let max = 0
  let run = 0
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) === 96) {
      run++
      if (run > max)
        max = run
    }
    else {
      run = 0
    }
  }
  return max
}

function maxLineLeadingRun(value: string, marker: number, indent: string): number {
  let max = 0
  let lineStart = 0
  while (lineStart <= value.length) {
    let index = lineStart
    if (indent && value.startsWith(indent, index))
      index += indent.length
    let spaces = 0
    while (spaces < 3 && value.charCodeAt(index) === 32) {
      spaces++
      index++
    }
    let run = 0
    while (value.charCodeAt(index + run) === marker)
      run++
    if (run > max)
      max = run
    const newline = value.indexOf('\n', lineStart)
    if (newline === -1)
      break
    lineStart = newline + 1
  }
  return max
}

function finalizeCodeSpan(state: MarkdownState, span: CodeSpan): string {
  const content = state.buffer.slice(span.fragment + 1).join('')
  const delimiter = '`'.repeat(Math.max(1, maxBacktickRun(content) + 1))
  const padded = content.startsWith('`') || content.endsWith('`')
  state.buffer[span.fragment] = `${span.prefix}${delimiter}${padded ? ' ' : ''}`
  return `${padded ? ' ' : ''}${delimiter}`
}

function startCodeFence(state: MarkdownState, fragment: number, language: string, indent: string): void {
  const markerOffset = state.buffer[fragment]!.lastIndexOf(MARKDOWN_CODE_BLOCK)
  state.codeFence = { fragment, markerOffset, indent, language }
}

function finalizeCodeFence(state: MarkdownState): string | undefined {
  const fence = state.codeFence
  if (!fence)
    return
  state.codeFence = undefined
  const marker = fence.language.includes('`') ? '~' : '`'
  const markerCode = marker.charCodeAt(0)
  const content = state.buffer.slice(fence.fragment + 1).join('')
  const delimiter = marker.repeat(Math.max(3, maxLineLeadingRun(content, markerCode, fence.indent) + 1))
  const opening = state.buffer[fence.fragment]!
  state.buffer[fence.fragment] = `${opening.slice(0, fence.markerOffset)}${delimiter}${opening.slice(fence.markerOffset + MARKDOWN_CODE_BLOCK.length)}`
  return delimiter
}

function stripBlockquoteListIndent(line: string, listIndent: string): string {
  return listIndent && line.startsWith(listIndent)
    ? line.slice(listIndent.length)
    : line
}

function finalizeBlockquote(state: MarkdownState): void {
  const frame = state.blockquotes.pop()
  if (!frame)
    return
  state.bufferedBlockquoteDepth = state.blockquotes.length

  const content = state.buffer.slice(frame.fragment).join('').replace(/[ \t\r\n]+$/, '')
  const prefix = `${frame.listIndent}>`
  const quoted = content
    .split('\n')
    .map((line) => {
      const unindented = stripBlockquoteListIndent(line, frame.listIndent)
      return unindented ? `${prefix} ${unindented}` : prefix
    })
    .join('\n')

  state.buffer.splice(frame.fragment, state.buffer.length - frame.fragment, quoted)
  state.lastContentCache = quoted
}

function collapseNestedBlockquoteSeparator(buffer: string[]): void {
  let trailingNewlines = 0
  for (let fragmentIndex = buffer.length - 1; fragmentIndex >= 0 && trailingNewlines < 2; fragmentIndex--) {
    const fragment = buffer[fragmentIndex]!
    for (let index = fragment.length - 1; index >= 0 && fragment.charCodeAt(index) === 10; index--)
      trailingNewlines++
  }
  if (trailingNewlines < 2)
    return

  const last = buffer.at(-1)!
  if (last.length === 1)
    buffer.pop()
  else
    buffer[buffer.length - 1] = last.slice(0, -1)
}

/**
 * Emit a bare <pre>'s opening code fence (issue #97). Mirrors the <code>-in-<pre>
 * enter formatting in tags.ts: indented and newline-padded inside a list item,
 * otherwise a plain ```lang opener. Marks the <pre> as owning the fence so a
 * nested <code> does not double up and the <pre> exit emits the closing fence.
 */
function flushPreFence(state: MarkdownState): void {
  if (state.plainText) {
    state.preFencePending = false
    state.preOwnFence = false
    return
  }
  state.preFencePending = false
  state.preOwnFence = true
  const lang = state.preFenceLang || ''
  const liDepth = state.depthMap[TAG_LI] || 0
  const fence = liDepth > 0
    ? `\n\n${state.listIndent}${MARKDOWN_CODE_BLOCK}${lang}\n${state.listIndent}`
    : `${MARKDOWN_CODE_BLOCK}${lang}\n`
  state.buffer.push(fence)
  startCodeFence(state, state.buffer.length - 1, lang, state.listIndent)
  state.lastContentCache = fence
}

function consumePendingPreChild(state: MarkdownState, node: Node, eventType: number): boolean {
  if (eventType !== NodeEventEnter)
    return false
  if (node.type === ELEMENT_NODE) {
    const element = node as ElementNode
    if (element.tagId === TAG_CODE && element.parent?.tagId === TAG_PRE)
      state.preFencePending = false
    else if (element.tagId !== TAG_PRE)
      flushPreFence(state)
    return false
  }
  if (hasNonWhitespace((node as TextNode).value)) {
    flushPreFence(state)
    return false
  }
  return true
}

function consumeGfmAction(action: GfmAction, state: MarkdownState, lifecycle: GfmLifecycleState): string | undefined {
  switch (action._tag) {
    case 'BlockquoteEnter':
      return action.output
    case 'BlockquoteExit':
      finalizeBlockquote(state)
      return undefined
    case 'PreEnter':
      state.preFencePending = true
      state.preOwnFence = false
      state.preFenceLang = action.language
      return undefined
    case 'PreExit': {
      const ownFence = state.preOwnFence
      state.preFencePending = false
      state.preOwnFence = false
      if (!ownFence)
        return undefined
      const indent = state.listIndent
      const output = (state.depthMap[TAG_LI] || 0) > 0
        ? `\n${indent}${MARKDOWN_CODE_BLOCK}\n\n${indent}`
        : `\n${MARKDOWN_CODE_BLOCK}`
      const delimiter = finalizeCodeFence(state)
      return delimiter ? output.replace(MARKDOWN_CODE_BLOCK, delimiter) : output
    }
    case 'CodeSpanEnter':
      return action.output
    case 'CodeSpanExit': {
      const span = lifecycle.openCodeSpans.pop()
      return span ? finalizeCodeSpan(state, span) : MARKDOWN_INLINE_CODE
    }
    case 'CodeFenceEnter':
      state.preFencePending = false
      return action.output
    case 'CodeFenceExit': {
      const delimiter = finalizeCodeFence(state)
      return delimiter ? action.output.replace(MARKDOWN_CODE_BLOCK, delimiter) : action.output
    }
  }
}

function commitGfmAction(
  action: GfmAction,
  state: MarkdownState,
  lifecycle: GfmLifecycleState,
  outputStart: number,
): void {
  switch (action._tag) {
    case 'BlockquoteEnter':
      if (state.blockquotes.length > 0)
        collapseNestedBlockquoteSeparator(state.buffer)
      state.blockquotes.push({
        fragment: state.buffer.length,
        listIndent: state.listIndent,
      })
      state.bufferedBlockquoteDepth = state.blockquotes.length
      break
    case 'CodeSpanEnter':
      lifecycle.openCodeSpans.push({
        fragment: outputStart,
        prefix: action.output.slice(0, -MARKDOWN_INLINE_CODE.length),
      })
      break
    case 'CodeFenceEnter': {
      const fenceFragment = state.buffer.findIndex(
        (fragment, index) => index >= outputStart && fragment.includes(MARKDOWN_CODE_BLOCK),
      )
      if (fenceFragment < 0)
        throw new Error('code fence opener missing from output')
      startCodeFence(state, fenceFragment, action.language, state.listIndent)
      break
    }
  }
}

function getPlainTextOutput(node: ElementNode, eventType: number, state: MarkdownState): string | undefined {
  const override = state.options?.plugins?.tagOverrides?.[node.name]
  if (override && typeof override !== 'string') {
    const explicitOutput = eventType === NodeEventEnter ? override.enter : override.exit
    if (explicitOutput !== undefined)
      return explicitOutput
  }

  const tagId = node.tagId
  const depthMap = state.depthMap
  if (eventType === NodeEventEnter) {
    if (tagId === TAG_BR)
      return '\n'
    if (tagId === TAG_P && ((depthMap[TAG_BLOCKQUOTE] || 0) > 0 || ((depthMap[TAG_LI] || 0) > 0 && !(depthMap[TAG_TD] || 0) && !(depthMap[TAG_TH] || 0)))) {
      const lastEntry = state.buffer.at(-1)
      const lastChar = lastEntry?.charAt(lastEntry.length - 1) || ''
      if (lastChar && lastChar !== ' ' && lastChar !== '\n')
        return '\n\n'
    }
    if (tagId === TAG_TD || tagId === TAG_TH)
      return (depthMap[TAG_TABLE] || 0) > 1 || node.index === 0 ? '' : '\t'
    if (tagId === TAG_IMG) {
      const alt = node.attributes?.alt
      if (alt !== undefined)
        return alt || undefined
      return node.attributes?.title || resolveUrl(node.attributes?.src || '', state.options?.origin, state.options?.clean) || undefined
    }
    if (tagId === TAG_Q)
      return '"'
    return undefined
  }
  if (tagId === TAG_Q)
    return '"'
  return undefined
}

/**
 * Creates a markdown processor that consumes DOM events and generates markdown
 */
export function createMarkdownProcessor(options: EngineOptions = {}, resolvedPlugins: TransformPlugin[] = [], tagOverrideHandlers?: Map<string, TagHandler>) {
  const state: MarkdownState = {
    options,
    buffer: [],
    depthMap: new Uint8Array(MAX_TAG_ID),
    listIndent: '',
    listIndentWidths: [],
    blockquotes: [],
    bufferedBlockquoteDepth: 0,
    plainText: options.format === 'text',
  }
  // Open inline-marker enter positions, packed as (buffer fragment index << 3 | kind).
  const openMarkers: number[] = []
  let openMarkerCount = 0
  const gfmLifecycle: GfmLifecycleState = { openCodeSpans: [] }
  let openLinkFragment = -1

  let lastYieldedLength = 0
  let hasYieldedContent = false
  let preserveLeadingWhitespace = false

  function processTextNode(textNode: TextNode, lastNode: ElementNode | TextNode | undefined, lastChar: string): void {
    if (textNode.value) {
      if (textNode.excludedFromMarkdown)
        return

      if (state.pendingInlineWhitespace) {
        if (!textNode.value.trim())
          return
        if (lastChar && !' \n\t\r'.includes(lastChar) && !' \n\t\r'.includes(textNode.value[0] || ''))
          textNode.value = ` ${textNode.value}`
        state.pendingInlineWhitespace = false
      }

      if (state.plainText && state.depthMap[TAG_PRE] && state.buffer.length === 0)
        preserveLeadingWhitespace = true

      if (textNode.value === ' ' && (lastChar === ' ' || lastChar === '\n' || lastChar === '\t' || lastChar === '\r'))
        return

      if (!(state.plainText && state.depthMap[TAG_PRE]) && shouldAddSpacingBeforeText(lastChar, lastNode, textNode))
        textNode.value = ` ${textNode.value}`

      if ((state.depthMap[TAG_PRE] || 0) > 0 && (state.depthMap[TAG_LI] || 0) > 0) {
        const indent = state.listIndent
        let value = textNode.value.replace(/\n(?!\n|$)/g, `\n${indent}`)
        if (lastChar === '\n' && value[0] && value[0] !== '\n')
          value = indent + value
        textNode.value = value
      }

      if (state.depthMap[TAG_PRE]! > 0
        && (state.depthMap[TAG_TD]! > 0 || state.depthMap[TAG_TH]! > 0)) {
        textNode.value = foldPreLinesToBr(textNode.value)
      }

      const insideRawHtmlBlock = isInsideRawHtmlBlock(state.depthMap)
      if (!state.plainText
        && !state.depthMap[TAG_PRE]
        && insideRawHtmlBlock) {
        textNode.value = escapeRawHtmlText(textNode.value, state.depthMap)
      }

      if (!state.plainText
        && !state.depthMap[TAG_PRE]
        && !state.depthMap[TAG_CODE]
        && !insideRawHtmlBlock
        && mayNeedGfmTextEscape(textNode.value, state.buffer, state.depthMap)) {
        textNode.value = escapeGfmText(textNode.value, state.buffer, state.depthMap)
      }

      if (textNode.generatedMarkdown && textNode.value)
        textNode.value = `${textNode.generatedMarkdown.prefix}${textNode.value}${textNode.generatedMarkdown.suffix}`

      const wrapWidth = state.options?.wrapWidth
      if (wrapWidth && canWrapHere(state.depthMap)) {
        const wrapped = wrapText(
          textNode.value,
          currentColumn(state.buffer),
          wrapWidth,
          continuationPrefix(textNode, state.listIndentWidths, state.blockquotes.length === 0),
        )
        state.buffer.push(wrapped)
        state.lastContentCache = wrapped
      }
      else {
        state.buffer.push(textNode.value)
        state.lastContentCache = textNode.value
      }

      if (openMarkerCount && hasNonWhitespace(textNode.value))
        openMarkerCount = 0
    }
    state.lastTextNode = textNode
  }

  /**
   * Process a DOM event and generate markdown
   */
  function processEvent(event: NodeEvent): void {
    const { type: eventType, node } = event
    // Update depth for plugin access
    state.depth = node.depth

    // Template nodes are parsed and exposed to plugins/extraction, but are
    // inert for output. Exclusion is copied to element descendants at open;
    // text checks only its immediate parent, never the ancestor chain.
    const inTemplate = node.type === ELEMENT_NODE
      ? node.excludedFromMarkdown
      : node.parent?.excludedFromMarkdown
    if (inTemplate)
      return

    const lastNode = state.lastNode
    state.lastNode = event.node as ElementNode | TextNode
    const buff = state.buffer

    // Deferred <pre> code fence (issue #97). A bare <pre> opens its fence right
    // before its first non-whitespace child so empty/whitespace-only blocks emit
    // nothing. A direct <code> child keeps fence ownership (handled in tags.ts).
    // Runs before lastChar is read so the fence is reflected in spacing checks.
    if (!state.plainText && state.preFencePending && consumePendingPreChild(state, node, eventType))
      return

    let lastBuffEntry = buff.at(-1)!
    let lastChar = lastBuffEntry?.charAt(lastBuffEntry.length - 1) || ''

    if (node.type === TEXT_NODE && eventType === NodeEventEnter) {
      processTextNode(node as TextNode, lastNode, lastChar)
      return
    }

    if (node.type !== ELEMENT_NODE) {
      return
    }

    const element = node as ElementNode
    const handler = node.tagHandler

    // The built-in break has zero structural spacing and no exit event. Keep it
    // out of the generic element pipeline, which otherwise scans ancestry and
    // allocates an output array for every hard break.
    if (eventType === NodeEventEnter
      && handler === breakHandler
      && !element.pluginOutput?.length) {
      const inPre = state.depthMap[TAG_PRE] !== 0
      let breakOutput: string | undefined = state.plainText ? '\n' : renderBreak(element, state)

      // Plain-text breaks normalize at three consecutive newlines. Markdown
      // hard breaks and literal pre newlines remain exact.
      if (state.plainText && !inPre && lastChar === '\n') {
        const previousChar = lastBuffEntry.length > 1
          ? lastBuffEntry.charAt(lastBuffEntry.length - 2)
          : buff.length > 1
            ? buff[buff.length - 2]?.at(-1)
            : undefined
        if (previousChar === '\n')
          breakOutput = undefined
      }

      if (state.pendingInlineWhitespace)
        state.pendingInlineWhitespace = false

      const lastFragment = state.lastContentCache
      const lastTextNode = state.lastTextNode
      if (lastFragment && lastTextNode?.containsWhitespace && typeof lastTextNode.value === 'string') {
        let parent = element.parent
        let parentInPre = false
        while (parent) {
          if (parent.tagId === TAG_PRE) {
            parentInPre = true
            break
          }
          parent = parent.parent
        }
        if (!parentInPre || element.parent?.tagId === TAG_PRE) {
          if (breakOutput?.endsWith('\n') && !parentInPre) {
            const trimmed = trimAsciiWhitespaceEnd(lastFragment)
            if (trimmed.length !== lastFragment.length && buff.at(-1) === lastFragment)
              buff[buff.length - 1] = trimmed
          }
          state.lastTextNode = undefined
        }
      }

      if (breakOutput) {
        buff.push(breakOutput)
        state.lastContentCache = breakOutput
        if (openMarkerCount && hasNonWhitespace(breakOutput))
          openMarkerCount = 0
      }
      return
    }

    // The generic element pipeline needs two trailing characters for newline
    // normalization. Text nodes and built-in breaks return before this work.
    let secondLastChar
    if (lastBuffEntry && lastBuffEntry.length > 1) {
      secondLastChar = lastBuffEntry.charAt(lastBuffEntry.length - 2)
    }
    else if (buff.length > 1) {
      const prevBuff = buff[buff.length - 2]
      if (prevBuff)
        secondLastChar = prevBuff.charAt(prevBuff.length - 1)
    }

    // Keep the common no-output path allocation-free. Most structural and
    // unknown elements only affect spacing, so allocating an empty array for
    // every enter/exit event adds pure GC pressure.
    let output: string[] | undefined
    if (element.pluginOutput?.length) {
      output = element.pluginOutput
      element.pluginOutput = undefined
    }

    // Get last content from buffer regions
    let lastFragment = state.lastContentCache

    const eventFn = eventType === NodeEventEnter ? 'enter' : 'exit'
    const isInlineElement = handler?.isInline === true
    let gfmAction: GfmAction | undefined
    let handlerOutput: string | undefined
    if (!output && handler?.[eventFn]) {
      const res = state.plainText
        ? getPlainTextOutput(element, eventType, state)
        : handler[eventFn]({ node: element, state })
      if (typeof res === 'string') {
        if (res) {
          output = [res]
          handlerOutput = res
        }
      }
      else if (res) {
        gfmAction = res
        handlerOutput = consumeGfmAction(res, state, gfmLifecycle)
        if (handlerOutput)
          output = [handlerOutput]
        if (res._tag === 'BlockquoteExit') {
          lastFragment = state.lastContentCache
          lastBuffEntry = buff.at(-1)!
          lastChar = lastBuffEntry?.charAt(lastBuffEntry.length - 1) || ''
          secondLastChar = lastBuffEntry && lastBuffEntry.length > 1
            ? lastBuffEntry.charAt(lastBuffEntry.length - 2)
            : buff.length > 1
              ? buff[buff.length - 2]?.at(-1)
              : undefined
        }
      }
    }

    let lastNewLines = 0
    if (lastChar === '\n')
      lastNewLines++
    if (secondLastChar === '\n')
      lastNewLines++

    if (eventType === NodeEventExit && openMarkerCount) {
      // Empty pair: only the enter marker was written, so drop it instead of emitting a close.
      const markerType = handlerOutput === undefined ? 0 : INLINE_MARKER_TYPE[element.tagId!]!
      if (markerType
        && (element.tagId !== TAG_CODE
          || (!state.depthMap[TAG_PRE] && !isInsideRawHtmlBlock(state.depthMap)))
        && !handler?.literalExit) {
        const idx = dropEmptyMarker(buff, openMarkers[--openMarkerCount]!, markerType)
        if (idx >= 0) {
          state.lastContentCache = idx > 0 ? buff[idx - 1] : undefined
          return
        }
        openMarkerCount = 0
      }
    }

    // A <br> can introduce one blank line, but never needs 3+ consecutive
    // newlines in normalized prose. Preserve every newline inside <pre>.
    if (element.tagId === TAG_BR && !state.depthMap[TAG_PRE]
      && output?.length === 1 && output[0] === '\n'
      && lastChar === '\n' && secondLastChar === '\n') {
      output = undefined
    }

    // Handle newlines
    const newLineConfig = calculateNewLineConfig(node as ElementNode, state.depthMap, state.plainText === true)
    const quoteAtStart = eventType === NodeEventEnter
      && state.blockquotes.at(-1)?.fragment === state.buffer.length
    const configuredNewLines = quoteAtStart
      ? 0
      : eventType === NodeEventExit && element.tagId === TAG_HR && state.blockquotes.length > 0
        ? Math.min(1, newLineConfig[eventType] || 0)
        : newLineConfig[eventType] || 0
    // A closing code fence's block-spacing newlines are appended AFTER the
    // backtick or tilde delimiter, so
    // any trailing newlines already in the buffer (blank lines inside <pre>)
    // sit BEFORE the fence and no longer separate this block from the next
    // sibling — leaving ```<sibling> on one line, an invalid fence that never
    // closes. Measure the trailing-newline run from the fence's own tail (#148,
    // parity with Rust core). Scoped to the fence: other block closers
    // (raw-HTML </dd>/</dl>, etc.) intentionally glue.
    let effectiveLastNewLines = lastNewLines
    if (eventType === NodeEventExit && output) {
      for (let i = output.length - 1; i >= 0; i--) {
        const frag = output[i]
        if (frag) {
          if (frag.endsWith('```') || frag.endsWith('~~~'))
            effectiveLastNewLines = 0
          break
        }
      }
    }
    const newLines = Math.max(0, configuredNewLines - effectiveLastNewLines)

    if (state.pendingInlineWhitespace) {
      const firstOutput = output?.[0]?.[0] || ''
      if (eventType === NodeEventEnter) {
        if (!isInlineElement || element.tagId === TAG_BR || newLines > 0 || firstOutput === '\n' || firstOutput === '\r') {
          state.pendingInlineWhitespace = false
        }
        else if (firstOutput) {
          if (lastChar && !' \n\t\r'.includes(lastChar) && !' \n\t\r'.includes(firstOutput))
            state.buffer.push(' ')
          state.pendingInlineWhitespace = false
        }
      }
      else if (!isInlineElement || newLines > 0) {
        state.pendingInlineWhitespace = false
      }
    }

    if (newLines > 0) {
      // If the buffer has no content, add the current content (without new lines)
      if (!buff.length) {
        if (output) {
          for (const fragment of output) {
            if (fragment) {
              state.buffer.push(fragment)
              state.lastContentCache = fragment
            }
          }
        }
        if (gfmAction)
          commitGfmAction(gfmAction, state, gfmLifecycle, state.buffer.length)
        updateListIndent(state, element, eventType)
        return
      }

      // Add newlines
      const newlinesStr = '\n'.repeat(newLines)
      // Trim only whitespace
      if (lastChar === ' ' && buff?.length) {
        buff[buff.length - 1] = buff.at(-1)!.substring(0, buff.at(-1)!.length - 1)
        // This source whitespace was consumed by the block boundary; do not
        // let its state leak into a later inline event and trim that output.
        state.lastTextNode = undefined
      }

      if (eventType === NodeEventEnter) {
        if (output)
          output.unshift(newlinesStr)
        else
          output = [newlinesStr]
      }
      else {
        if (output)
          output.push(newlinesStr)
        else
          output = [newlinesStr]
      }
    }
    else {
      // Only trim whitespace in specific cases where it's safe
      // Don't trim if we're about to add inline content that needs spacing
      // Don't trim before block elements that need their own spacing
      if (lastFragment && state.lastTextNode?.containsWhitespace && (!!node.parent || isInlineElement) && 'value' in state.lastTextNode && typeof state.lastTextNode.value === 'string') {
        let parent = node.parent
        let parentInPre = false
        while (parent) {
          if (parent.tagId === TAG_PRE) {
            parentInPre = true
            break
          }
          parent = parent.parent
        }
        if (!parentInPre || node.parent?.tagId === TAG_PRE) {
          // Only trim if the next element is not an inline element that needs spacing
          // or if we're at the end of a block
          const collapsesWhiteSpace = node.tagHandler?.collapsesInnerWhiteSpace
          const hasSpacing = node.tagHandler?.spacing && Array.isArray(node.tagHandler.spacing)
          const isBlockElement = !isInlineElement && !collapsesWhiteSpace && configuredNewLines > 0
          // Don't trim before elements that have collapsesInnerWhiteSpace on enter
          // Also don't trim before block elements that have their own spacing configuration
          // At a quote's content start the last fragment is the sibling separator,
          // not trailing whitespace; trimming it would glue adjacent quotes.
          const shouldTrim = !quoteAtStart
            && ((element.tagId === TAG_BR && output?.[0]?.endsWith('\n') && !parentInPre)
              || ((!isInlineElement || eventType === NodeEventExit) && !isBlockElement && !(collapsesWhiteSpace && eventType === NodeEventEnter) && !(hasSpacing && eventType === NodeEventEnter)))

          if (shouldTrim) {
            const originalLength = lastFragment.length
            const trimmed = trimAsciiWhitespaceEnd(lastFragment)
            const trimmedChars = originalLength - trimmed.length

            // Update the last content in buffer regions with trimmed content
            if (trimmedChars > 0) {
              if (buff?.length && buff.at(-1) === lastFragment) {
                buff[buff.length - 1] = trimmed
              }
              if (eventType === NodeEventExit && isInlineElement)
                state.pendingInlineWhitespace = true
            }
          }

          state.lastTextNode = undefined
        }
      }
    }

    // Add spacing between inline elements if needed
    if (element.tagId !== TAG_BR && output?.[0]?.[0] && eventType === NodeEventEnter && !node.tagHandler?.literalEnter && lastChar && needsSpacing(lastChar, output[0][0], state)) {
      state.buffer.push(' ')
      state.lastContentCache = ' '
    }

    // Add all output fragments
    let outputStart = state.buffer.length
    if (output) {
      outputStart = state.buffer.length
      for (const fragment of output) {
        if (fragment) {
          state.buffer.push(fragment)
          state.lastContentCache = fragment
        }
      }
    }

    if (gfmAction)
      commitGfmAction(gfmAction, state, gfmLifecycle, outputStart)

    if (eventType === NodeEventEnter && element.tagId === TAG_A && handlerOutput === '[' && buff.at(-1) === '[')
      openLinkFragment = buff.length - 1

    // Track open inline markers for empty pair detection. Inline code in a
    // list may own a leading separator (" `"), so retain the whole output
    // fragment as the drop boundary.
    if (eventType === NodeEventEnter && handlerOutput !== undefined && isInlineElement && !handler?.literalEnter) {
      const markerType = INLINE_MARKER_TYPE[element.tagId!]!
      if (markerType
        && (element.tagId !== TAG_CODE
          || (!state.depthMap[TAG_PRE] && !isInsideRawHtmlBlock(state.depthMap)))
        && buff[buff.length - 1] === handlerOutput) {
        openMarkers[openMarkerCount++] = (buff.length - 1) << 3 | markerType
      }
      else if (openMarkerCount && hasNonWhitespace(handlerOutput)) {
        openMarkerCount = 0
      }
    }
    else if (openMarkerCount && (handler?.literalExit || (element.tagId !== -1 && !isInlineElement) || output?.some(hasNonWhitespace))) {
      // Literal overrides, plugin output, and block boundaries make all open
      // markers permanent, allowing streaming to release buffered content.
      openMarkerCount = 0
    }

    if (eventType === NodeEventExit && element.tagId === TAG_A)
      openLinkFragment = -1

    updateListIndent(state, element, eventType)
  }

  /**
   * Process HTML string and generate events
   */
  function processHtml(html: string): void {
    const parseState: ParseState = {
      depthMap: state.depthMap,
      depth: 0,
      resolvedPlugins,
      tagOverrideHandlers,
      plainText: state.plainText,
    }

    const handleEvent: (event: NodeEvent) => void = resolvedPlugins.length
      ? event => processPluginsForEvent(event, resolvedPlugins, state, processEvent)
      : processEvent
    const leftover = parseHtmlStream(html, parseState, handleEvent)
    // Commit trailing text and close unclosed elements at end of input.
    finalizeParse(leftover, parseState, handleEvent)
  }

  /**
   * Get the final markdown output
   */
  function getMarkdown(): string {
    const content = state.buffer.join('')
    const result = state.plainText && preserveLeadingWhitespace ? content : content.trimStart()
    state.buffer.length = 0
    preserveLeadingWhitespace = false
    return result.trimEnd()
  }

  /**
   * Get new markdown content since the last call (for streaming)
   */
  function getMarkdownChunk(): string {
    const content = state.buffer.join('')
    const currentContent = hasYieldedContent || (state.plainText && preserveLeadingWhitespace)
      ? content
      : content.trimStart()
    const inPre = state.depthMap[TAG_PRE] !== 0
    const trailingCode = currentContent.charCodeAt(currentContent.length - 1)
    let trailingSpaceEnd = currentContent.length
    while (trailingSpaceEnd > 0 && currentContent.charCodeAt(trailingSpaceEnd - 1) === 32)
      trailingSpaceEnd--
    let stableLength = trailingSpaceEnd
    let retainMutableFragments = stableLength < currentContent.length
    if (inPre) {
      if (state.lastTextNode?.containsWhitespace && isAsciiWhitespace(trailingCode)) {
        stableLength = trimAsciiWhitespaceEnd(currentContent).length
        retainMutableFragments = stableLength < currentContent.length
      }
      else if (stableLength < currentContent.length) {
        const lineLeading = stableLength === 0 || currentContent.charCodeAt(stableLength - 1) === 10
        if (!lineLeading) {
          stableLength = currentContent.length
          retainMutableFragments = false
        }
      }
    }
    else {
      // Block spacing and trailing spaces can still be trimmed by a later
      // element close or by finalization. Keep them buffered until following
      // content makes them stable.
      while (stableLength > 0 && (currentContent[stableLength - 1] === ' ' || currentContent[stableLength - 1] === '\n'))
        stableLength--
      retainMutableFragments = stableLength < currentContent.length
    }

    const leadingTrimmed = content.length - currentContent.length

    // An open inline marker may still be dropped if its element closes empty in a later chunk;
    // hold the buffer at the earliest such marker so already-yielded output is never rewritten.
    const markerHeld = openMarkerCount > 0
    if (markerHeld) {
      const openFragment = openMarkers[0]! >> 3
      const markerPos = Math.max(
        lastYieldedLength,
        trimBufferedWhitespacePosition(currentContent, fragmentPosition(state.buffer, openFragment) - leadingTrimmed),
      )
      if (markerPos < stableLength)
        stableLength = markerPos
    }
    const codeSpanHeld = gfmLifecycle.openCodeSpans.length > 0
    if (codeSpanHeld) {
      const spanPos = Math.max(
        lastYieldedLength,
        trimBufferedWhitespacePosition(currentContent, fragmentPosition(state.buffer, gfmLifecycle.openCodeSpans[0]!.fragment) - leadingTrimmed),
      )
      if (spanPos < stableLength)
        stableLength = spanPos
    }
    const codeFenceHeld = state.codeFence !== undefined
    if (codeFenceHeld) {
      const fencePos = Math.max(
        lastYieldedLength,
        trimBufferedWhitespacePosition(currentContent, fragmentPosition(state.buffer, state.codeFence!.fragment) - leadingTrimmed),
      )
      if (fencePos < stableLength)
        stableLength = fencePos
    }
    const blockquoteHeld = state.blockquotes.length > 0
    if (blockquoteHeld) {
      const blockquotePos = Math.max(
        lastYieldedLength,
        trimBufferedWhitespacePosition(
          currentContent,
          fragmentPosition(state.buffer, state.blockquotes[0]!.fragment) - leadingTrimmed,
        ),
      )
      if (blockquotePos < stableLength)
        stableLength = blockquotePos
    }

    // An open link can rewrite its opening bracket and all link text when it
    // closes as a GFM autolink. Hold that region until the close is final.
    const linkHeld = openLinkFragment >= 0
    if (linkHeld) {
      const linkPos = Math.max(
        lastYieldedLength,
        trimBufferedWhitespacePosition(currentContent, fragmentPosition(state.buffer, openLinkFragment) - leadingTrimmed),
      )
      if (linkPos < stableLength)
        stableLength = linkPos
    }

    // A later mutable tail can move the stable boundary behind bytes already
    // returned to the caller. Keep the cursor monotonic so those bytes are not
    // emitted a second time once following content makes the tail stable.
    if (stableLength < lastYieldedLength)
      stableLength = lastYieldedLength

    const newContent = currentContent.slice(lastYieldedLength, stableLength)
    lastYieldedLength = stableLength
    if (newContent)
      hasYieldedContent = true

    // Keep only enough emitted context for spacing/newline decisions, plus any
    // trailing spaces that are still mutable. This prevents every stream chunk
    // from joining and slicing the entire cumulative output. Plugin, wrapping,
    // and open-link paths retain the full buffer because they can inspect or
    // rewrite earlier content.
    if (!markerHeld && !codeSpanHeld && !codeFenceHeld && !blockquoteHeld && !linkHeld && (!retainMutableFragments || !inPre)) {
      if (!resolvedPlugins.length && !options.wrapWidth && !state.depthMap[TAG_A]) {
        if (retainMutableFragments && leadingTrimmed === 0) {
          // Preserve the final fragment as a separate value: close handlers
          // identify and trim it by reference equality with lastContentCache.
          const lastFragment = state.buffer.at(-1)!
          const fragmentStart = currentContent.length - lastFragment.length
          const tailStart = Math.max(0, Math.min(stableLength - 2, fragmentStart))
          const emittedTail = currentContent.slice(tailStart, fragmentStart)
          state.buffer.length = 0
          if (emittedTail)
            state.buffer.push(emittedTail)
          state.buffer.push(lastFragment)
          lastYieldedLength = stableLength - tailStart
        }
        else if (!retainMutableFragments) {
          const tailStart = Math.max(0, stableLength - 2)
          const emittedTail = currentContent.slice(tailStart, stableLength)
          state.buffer.length = 0
          if (emittedTail)
            state.buffer.push(emittedTail)
          lastYieldedLength = emittedTail.length
        }
      }
      else if (!retainMutableFragments && state.buffer.length > 1) {
        state.buffer.length = 0
        state.buffer.push(currentContent)
      }
    }
    return newContent
  }

  return {
    processEvent,
    processHtml,
    getMarkdown,
    getMarkdownChunk,
    state,
  }
}
