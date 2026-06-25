import type { ElementNode, Node, NodeEvent, TagHandler, TextNode, TransformPlugin } from './types'
import {
  ELEMENT_NODE,
  MAX_TAG_ID,
  NodeEventEnter,
  NodeEventExit,
  TAG_A,
  TAG_ADDRESS,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_BASE,
  TAG_BLOCKQUOTE,
  TAG_BUTTON,
  TAG_CAPTION,
  TAG_CENTER,
  TAG_CODE,
  TAG_DD,
  TAG_DETAILS,
  TAG_DIALOG,
  TAG_DIV,
  TAG_DL,
  TAG_DT,
  TAG_FIELDSET,
  TAG_FIGCAPTION,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_FORM,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_HEAD,
  TAG_HEADER,
  TAG_HR,
  TAG_HTML,
  TAG_LI,
  TAG_LINK,
  TAG_MAIN,
  TAG_META,
  TAG_NAV,
  TAG_NOSCRIPT,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_SCRIPT,
  TAG_SECTION,
  TAG_STYLE,
  TAG_SUMMARY,
  TAG_TABLE,
  TAG_TBODY,
  TAG_TD,
  TAG_TEMPLATE,
  TAG_TFOOT,
  TAG_TH,
  TAG_THEAD,
  TAG_TITLE,
  TAG_TR,
  TAG_UL,
  TagIdMap,
  TEXT_NODE,
} from './const'
import { tagHandlers } from './tags'
import { decodeHTMLEntities, traverseUpToFirstBlockNode } from './utils'

// Cache frequently used character codes
const LT_CHAR = 60 // '<'
const GT_CHAR = 62 // '>'
const SLASH_CHAR = 47 // '/'
const EQUALS_CHAR = 61 // '='
const QUOTE_CHAR = 34 // '"'
const APOS_CHAR = 39 // '\''
const EXCLAMATION_CHAR = 33 // '!'
const AMPERSAND_CHAR = 38 // '&'
const BACKSLASH_CHAR = 92 // '\'
const DASH_CHAR = 45 // '-'
const SPACE_CHAR = 32 // ' '
const TAB_CHAR = 9 // '\t'
const NEWLINE_CHAR = 10 // '\n'
const CARRIAGE_RETURN_CHAR = 13 // '\r'
const BACKTICK_CHAR = 96 // '`'
const PIPE_CHAR = 124 // '|'
const OPEN_BRACKET_CHAR = 91 // '['
const CLOSE_BRACKET_CHAR = 93 // ']'

// Tags that are valid inside <head>. Per the HTML parser's "in head" insertion
// mode, any start tag NOT in this set implies the end of <head> and the start of
// the body, so we auto-close an unclosed <head> when one appears (browser
// recovery for malformed pages that never emit </head> or <body>). TAG_HEAD is
// deliberately excluded: a second/nested <head> must close the first rather than
// stack, so malformed `<head><head>...<p>` does not trap body flow under head.
const HEAD_CONTENT_TAGS = new Set<number>([
  TAG_TITLE,
  TAG_META,
  TAG_LINK,
  TAG_BASE,
  TAG_STYLE,
  TAG_SCRIPT,
  TAG_NOSCRIPT,
  TAG_TEMPLATE,
])

// Implied end tags (HTML §13.1.2.4 optional tags + "in body" insertion mode).
// Mirrors the Rust engine's `parse.rs`. Start tags that cannot appear inside a
// `<p>` imply its end; block containers, headings, lists, tables, and the
// list-item/definition tags all close an open `<p>`.
//
// A typed-array lookup, not a Set: this is checked for every start tag opened
// while a `<p>` is on the stack (most inline tags in prose), so the hot path is
// a single indexed load rather than a Set hash.
const CLOSES_P: Uint8Array = (() => {
  const t = new Uint8Array(MAX_TAG_ID)
  const ids = [
    TAG_DIV,
    TAG_P,
    TAG_UL,
    TAG_OL,
    TAG_DL,
    TAG_LI,
    TAG_DD,
    TAG_DT,
    TAG_TABLE,
    TAG_H1,
    TAG_H2,
    TAG_H3,
    TAG_H4,
    TAG_H5,
    TAG_H6,
    TAG_BLOCKQUOTE,
    TAG_SECTION,
    TAG_ARTICLE,
    TAG_HEADER,
    TAG_FOOTER,
    TAG_NAV,
    TAG_ASIDE,
    TAG_PRE,
    TAG_HR,
    TAG_FORM,
    TAG_FIELDSET,
    TAG_FIGURE,
    TAG_FIGCAPTION,
    TAG_ADDRESS,
    TAG_MAIN,
    TAG_CENTER,
    TAG_DETAILS,
    TAG_SUMMARY,
    TAG_DIALOG,
  ]
  for (const id of ids)
    t[id] = 1
  return t
})()

// Start tags that can trigger any implied-end-tag recovery branch. The common
// inline tags (`code`, `em`, `span`, ...) otherwise run the whole dispatch just
// to prove they need no recovery, so gating on a single indexed load lets them
// skip it entirely. Mirrors the Rust engine's `NEEDS_IMPLIED_END_RECOVERY`.
const NEEDS_IMPLIED_END_RECOVERY: Uint8Array = (() => {
  const t = CLOSES_P.slice()
  for (const id of [TAG_A, TAG_TD, TAG_TH, TAG_TR, TAG_THEAD, TAG_TBODY, TAG_TFOOT])
    t[id] = 1
  return t
})()

// "Button scope" terminators for closing a `<p>`. `UL`/`OL`/`DL`/`LI` are added
// (a deviation from the bare spec list) to keep scans short; a `<p>` is always
// closed before any of these can become its ancestor.
const P_SCOPE_BOUNDARY = new Set<number>([
  TAG_BUTTON,
  TAG_TD,
  TAG_TH,
  TAG_CAPTION,
  TAG_TABLE,
  TAG_TEMPLATE,
  TAG_HTML,
  TAG_UL,
  TAG_OL,
  TAG_DL,
  TAG_LI,
])

// "List item scope": a new `<li>` closes the previous one only within the same
// list, never across a nested list or table.
const LI_SCOPE_BOUNDARY = new Set<number>([
  TAG_UL,
  TAG_OL,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_CAPTION,
  TAG_TEMPLATE,
  TAG_HTML,
])

// Scope for `<dt>`/`<dd>`: each closes the other within the same `<dl>`.
const DL_SCOPE_BOUNDARY = new Set<number>([
  TAG_DL,
  TAG_UL,
  TAG_OL,
  TAG_LI,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_CAPTION,
  TAG_TEMPLATE,
  TAG_HTML,
])

// "Table cell scope": a new `<td>`/`<th>` closes the current cell, stopping at
// the row/section.
const CELL_SCOPE_BOUNDARY = new Set<number>([
  TAG_TR,
  TAG_THEAD,
  TAG_TBODY,
  TAG_TFOOT,
  TAG_TABLE,
  TAG_CAPTION,
  TAG_TEMPLATE,
  TAG_HTML,
])

// Block-level terminators for closing an `<a>`: a nested `<a>` closes the open
// one (anchors cannot nest), but only within the same block.
const A_SCOPE_BOUNDARY = new Set<number>([
  TAG_P,
  TAG_DIV,
  TAG_LI,
  TAG_UL,
  TAG_OL,
  TAG_DL,
  TAG_DD,
  TAG_DT,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_TR,
  TAG_CAPTION,
  TAG_BLOCKQUOTE,
  TAG_SECTION,
  TAG_ARTICLE,
  TAG_HEADER,
  TAG_FOOTER,
  TAG_NAV,
  TAG_ASIDE,
  TAG_MAIN,
  TAG_FORM,
  TAG_FIELDSET,
  TAG_FIGURE,
  TAG_BUTTON,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_TEMPLATE,
  TAG_HTML,
])

// Headings (h1–h6) for the "a heading start closes an open heading" check.
const HEADINGS = new Set<number>([TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6])

// Implied-end-tag targets and table-context closeable sets.
const SINGLE_P = new Set<number>([TAG_P])
const SINGLE_LI = new Set<number>([TAG_LI])
const SINGLE_A = new Set<number>([TAG_A])
const DT_DD = new Set<number>([TAG_DT, TAG_DD])
const TD_TH = new Set<number>([TAG_TD, TAG_TH])
const TR_CELLS = new Set<number>([TAG_TD, TAG_TH, TAG_TR])
const SECTION_CELLS = new Set<number>([TAG_TD, TAG_TH, TAG_TR, TAG_THEAD, TAG_TBODY, TAG_TFOOT, TAG_CAPTION])

/**
 * Close open nodes from `currentNode` up to and including the nearest node whose
 * tagId is in `target`, but only if it is found before a `boundary` node (in
 * which case nothing is closed). The intervening unmatched nodes (inline
 * formatting, unknown elements) are closed along the way, mirroring the spec's
 * "generate implied end tags" step.
 */
function closeImpliedTo(
  state: ParseState,
  target: Set<number>,
  boundary: Set<number>,
  handleEvent: (event: NodeEvent) => void,
): void {
  let found = false
  for (let node = state.currentNode; node; node = node.parent) {
    const id = node.tagId
    if (id !== undefined && target.has(id)) {
      found = true
      break
    }
    if (id !== undefined && boundary.has(id)) {
      break
    }
  }
  if (!found) {
    return
  }
  // closeNode always closes the current top and walks to its parent, so close
  // from the top until the matched node has itself been closed.
  while (state.currentNode) {
    const id = state.currentNode.tagId
    const isTarget = id !== undefined && target.has(id)
    closeNode(state.currentNode, state, handleEvent)
    if (isTarget) {
      break
    }
  }
}

/**
 * Close open table-internal nodes (cells, rows, sections) from the top while
 * their tagId is in `closeable`, stopping at the first node that is not (e.g.
 * the enclosing `<table>`). Implements implied end tags for `<tr>` and the
 * table section elements.
 */
function closeTableContext(
  state: ParseState,
  closeable: Set<number>,
  handleEvent: (event: NodeEvent) => void,
): void {
  while (state.currentNode) {
    const id = state.currentNode.tagId
    if (id === undefined || !closeable.has(id)) {
      break
    }
    closeNode(state.currentNode, state, handleEvent)
  }
}

/**
 * Commit end-of-input state: flush trailing buffered text and close any open
 * elements. The streaming parser keeps trailing text and unclosed elements
 * pending (a later chunk might continue them); at true EOF they must be
 * committed so trailing content is not dropped (e.g. `<p>a<p>b`).
 *
 * `leftover` is the residual returned by the final `parseHtmlStream`. Pure
 * trailing text (no leading `<`) is emitted; a residual that is an incomplete
 * start tag (leading `<`) is dropped, matching the browser tokenizer's
 * EOF-in-tag behaviour. The text-buffer flags set while the trailing text was
 * scanned persist on `state`, so `processTextBuffer` commits it as if the next
 * tag had triggered the flush.
 */
export function finalizeParse(
  leftover: string,
  state: ParseState,
  handleEvent: (event: NodeEvent) => void,
): void {
  if (leftover.length > 0 && leftover.charCodeAt(0) !== LT_CHAR) {
    processTextBuffer(leftover, state, handleEvent)
  }
  while (state.currentNode) {
    closeNode(state.currentNode, state, handleEvent)
  }
}

// Pre-allocate arrays and objects to reduce allocations
const EMPTY_ATTRIBUTES: Record<string, string> = Object.freeze({})

export interface ParseOptions {
  resolvedPlugins?: TransformPlugin[]
}

export interface ParseState {
  /** Map of tag names to their current nesting depth - uses TypedArray for performance */
  depthMap: Uint8Array
  /** Current overall nesting depth */
  depth: number
  /** Currently processing element node */
  currentNode?: ElementNode | null
  /** Whether current content contains HTML entities that need decoding */
  hasEncodedHtmlEntity?: boolean
  /** Whether the last processed character was whitespace - for collapsing whitespace */
  lastCharWasWhitespace?: boolean
  /** Whether the last processed buffer has whitespace - optimization flag */
  textBufferContainsWhitespace?: boolean
  /** Whether the last processed buffer contains non-whitespace characters */
  textBufferContainsNonWhitespace?: boolean
  /** Whether a tag was just closed - affects whitespace handling */
  justClosedTag?: boolean
  /** Whether the next text node is the first in its element - for whitespace trimming */
  isFirstTextInElement?: boolean
  /** Reference to the last processed text node - for context tracking */
  lastTextNode?: Node
  /** Quote state tracking for non-nesting tags - avoids backward scanning */
  inSingleQuote?: boolean
  inDoubleQuote?: boolean
  inBacktick?: boolean
  /**
   * Whether the current non-nesting tag is quote-aware rawtext (script/style only).
   * For these, a `</script>`/`</style>` inside a JS/CSS string literal must not close
   * the tag. Other non-nesting tags (template, textarea, ...) hold literal HTML/text
   * where apostrophes are not string delimiters, so their closing tag always wins.
   */
  inRawTextQuoteAware?: boolean
  /** Backslash escaping state tracking - avoids checking previous character */
  lastCharWasBackslash?: boolean
  /** Resolved plugin instances for event processing */
  resolvedPlugins?: TransformPlugin[]
  /** Tag override handlers built from declarative tagOverrides config */
  tagOverrideHandlers?: Map<string, TagHandler>
  /** Whether emitted text should skip Markdown-only escaping */
  plainText?: boolean
}

export interface ParseResult {
  events: NodeEvent[]
  remainingHtml: string
}

// Fast typed array copy for depthMap
function copyDepthMap(depthMap: ElementNode['depthMap']): ElementNode['depthMap'] {
  return new Uint8Array(depthMap)
}

/**
 * Fast whitespace check using direct character code comparison
 */
function isWhitespace(charCode: number): boolean {
  return charCode === SPACE_CHAR
    || charCode === TAB_CHAR
    || charCode === NEWLINE_CHAR
    || charCode === CARRIAGE_RETURN_CHAR
}

/**
 * Pure HTML parser that emits DOM events
 * Completely decoupled from markdown generation
 */
export function parseHtml(html: string, options: ParseOptions = {}): ParseResult {
  const events: NodeEvent[] = []
  const state: ParseState = {
    depthMap: new Uint8Array(MAX_TAG_ID),
    depth: 0,
    resolvedPlugins: options.resolvedPlugins || [],
  }

  const remainingHtml = parseHtmlInternal(html, state, (event) => {
    events.push(event)
  })

  return { events, remainingHtml }
}

/**
 * Streaming HTML parser - calls onEvent for each DOM event
 */
export function parseHtmlStream(
  html: string,
  state: ParseState,
  onEvent: (event: NodeEvent) => void,
): string {
  return parseHtmlInternal(html, state, onEvent)
}

/**
 * Internal parsing function - extracted from original parseHTML
 */
function parseHtmlInternal(
  htmlChunk: string,
  state: ParseState,
  handleEvent: (event: NodeEvent) => void,
): string {
  let textBuffer = '' // Buffer to accumulate text content

  // Initialize state
  state.depthMap ??= new Uint8Array(MAX_TAG_ID)
  state.depth ??= 0
  state.lastCharWasWhitespace ??= true
  state.justClosedTag ??= false
  state.isFirstTextInElement ??= false
  state.lastCharWasBackslash ??= false

  // Process chunk character by character
  let i = 0
  const chunkLength = htmlChunk.length

  while (i < chunkLength) {
    const currentCharCode = htmlChunk.charCodeAt(i)

    // If not starting a tag, add to text buffer and continue
    if (currentCharCode !== LT_CHAR) {
      if (currentCharCode === AMPERSAND_CHAR) {
        state.hasEncodedHtmlEntity = true
      }

      // Whitespace handling optimization
      if (isWhitespace(currentCharCode)) {
        const inPreTag = (state.depthMap[TAG_PRE] || 0) > 0

        // Handle space after a tag
        if (state.justClosedTag) {
          state.justClosedTag = false
          state.lastCharWasWhitespace = false
        }

        // Skip if last character was whitespace and we're not in a pre tag
        if (!inPreTag && state.lastCharWasWhitespace) {
          i++
          continue
        }

        // Preserve original whitespace in pre tags
        if (inPreTag) {
          textBuffer += htmlChunk[i]
        }
        else {
          if (currentCharCode === SPACE_CHAR || !state.lastCharWasWhitespace) {
            textBuffer += ' '
          }
        }
        state.lastCharWasWhitespace = true
        state.textBufferContainsWhitespace = true
        state.lastCharWasBackslash = false
      }
      else {
        state.textBufferContainsNonWhitespace = true
        state.lastCharWasWhitespace = false
        state.justClosedTag = false

        // Handle special characters that need escaping
        if (!state.plainText && currentCharCode === PIPE_CHAR && state.depthMap[TAG_TABLE]) {
          textBuffer += '\\|'
        }
        else if (!state.plainText && currentCharCode === BACKTICK_CHAR && (state.depthMap[TAG_CODE] || state.depthMap[TAG_PRE])) {
          textBuffer += '\\`'
        }
        else if (!state.plainText && currentCharCode === OPEN_BRACKET_CHAR && state.depthMap[TAG_A]) {
          textBuffer += '\\['
        }
        else if (!state.plainText && currentCharCode === CLOSE_BRACKET_CHAR && state.depthMap[TAG_A]) {
          textBuffer += '\\]'
        }
        else if (!state.plainText && currentCharCode === GT_CHAR && state.depthMap[TAG_BLOCKQUOTE]) {
          textBuffer += '\\>'
        }
        else {
          textBuffer += htmlChunk[i]
        }

        // Track quote state for quote-aware rawtext tags (script/style only)
        if (state.inRawTextQuoteAware) {
          if (!state.lastCharWasBackslash) {
            if (currentCharCode === APOS_CHAR && !state.inDoubleQuote && !state.inBacktick) {
              state.inSingleQuote = !state.inSingleQuote
            }
            else if (currentCharCode === QUOTE_CHAR && !state.inSingleQuote && !state.inBacktick) {
              state.inDoubleQuote = !state.inDoubleQuote
            }
            else if (currentCharCode === BACKTICK_CHAR && !state.inSingleQuote && !state.inDoubleQuote) {
              state.inBacktick = !state.inBacktick
            }
          }
        }

        state.lastCharWasBackslash = currentCharCode === BACKSLASH_CHAR && !state.lastCharWasBackslash
      }
      i++
      continue
    }

    // Look ahead to determine tag type
    if (i + 1 >= chunkLength) {
      textBuffer += htmlChunk[i]
      break
    }

    const nextCharCode = htmlChunk.charCodeAt(i + 1)

    // COMMENT, DOCTYPE or CDATA
    if (nextCharCode === EXCLAMATION_CHAR) {
      // Discriminate on the third char: '[' is a CDATA section, anything else
      // is a comment/doctype. Only the rare '[' case pays for the string work.
      if (htmlChunk.charCodeAt(i + 2) === OPEN_BRACKET_CHAR) {
        // CDATA is dropped by default but can be surfaced via
        // tagOverrides['#cdata-section']. Handle it before the generic
        // comment/doctype scan, which would otherwise stop at the first `>`
        // inside `]]>` and discard the content.
        if (htmlChunk.startsWith('<![CDATA[', i)) {
          const end = htmlChunk.indexOf(']]>', i + 9)
          if (end === -1) {
            // Unterminated CDATA: re-parse from '<' in the next chunk.
            textBuffer += htmlChunk.substring(i)
            break
          }
          if (textBuffer.length > 0) {
            processTextBuffer(textBuffer, state, handleEvent)
            textBuffer = ''
          }
          processCdataSection(htmlChunk.substring(i + 9, end), state, handleEvent)
          i = end + 3
          continue
        }
        if (chunkLength - i < 9 && '<![CDATA['.startsWith(htmlChunk.substring(i))) {
          // Chunk boundary fell inside the `<![CDATA[` opener.
          textBuffer += htmlChunk.substring(i)
          break
        }
        // '[' but not a CDATA opener (e.g. `<![if IE]>`): fall through.
      }

      if (textBuffer.length > 0) {
        processTextBuffer(textBuffer, state, handleEvent)
        textBuffer = ''
      }

      const result = processCommentOrDoctype(htmlChunk, i)
      if (result.complete) {
        i = result.newPosition
      }
      else {
        textBuffer += result.remainingText
        break
      }
    }
    // CLOSING TAG
    else if (nextCharCode === SLASH_CHAR) {
      if (state.currentNode?.tagHandler?.isNonNesting) {
        const inQuotes = state.inRawTextQuoteAware && (state.inSingleQuote || state.inDoubleQuote || state.inBacktick)
        if (inQuotes) {
          textBuffer += htmlChunk[i]
          i++
          continue
        }
        // Peek at the closing tag name to check if it matches the non-nesting tag
        let peekEnd = i + 2
        while (peekEnd < chunkLength) {
          const c = htmlChunk.charCodeAt(peekEnd)
          if (c === GT_CHAR || isWhitespace(c))
            break
          peekEnd++
        }
        const peekTagName = htmlChunk.substring(i + 2, peekEnd).toLowerCase() as keyof typeof TagIdMap
        const peekTagId = TagIdMap[peekTagName] ?? -1
        if (peekTagId !== state.currentNode.tagId) {
          textBuffer += htmlChunk[i++]
          continue
        }
      }

      if (textBuffer.length > 0) {
        processTextBuffer(textBuffer, state, handleEvent)
        textBuffer = ''
      }

      const result = processClosingTag(htmlChunk, i, state, handleEvent)
      if (result.complete) {
        i = result.newPosition
      }
      else {
        textBuffer += result.remainingText
        break
      }
    }
    // OPENING TAG
    else {
      let i2 = i + 1
      const tagNameStart = i2

      let tagNameEnd = -1
      while (i2 < chunkLength) {
        const c = htmlChunk.charCodeAt(i2)
        if (isWhitespace(c) || c === SLASH_CHAR || c === GT_CHAR) {
          tagNameEnd = i2
          break
        }
        i2++
      }
      if (tagNameEnd === -1) {
        textBuffer += htmlChunk.substring(i)
        break
      }

      const tagName = htmlChunk.substring(tagNameStart, tagNameEnd).toLowerCase() as keyof typeof TagIdMap

      const tagId = TagIdMap[tagName] ?? -1
      i2 = tagNameEnd

      // Inside a non-nesting element (script/style/title/textarea) no opening
      // tag is a real element; a nested `<script>` is literal text (issue #93).
      if (state.currentNode?.tagHandler?.isNonNesting) {
        textBuffer += htmlChunk[i++]
        continue
      }

      if (!tagName) {
        textBuffer += htmlChunk[i++]
        continue
      }

      if (textBuffer.length > 0) {
        processTextBuffer(textBuffer, state, handleEvent)
        textBuffer = ''
      }

      const result = processOpeningTag(tagName, tagId, htmlChunk, i2, state, handleEvent)

      if (result.skip) {
        textBuffer += htmlChunk[i++]
      }
      else if (result.complete) {
        i = result.newPosition
        if (!result.selfClosing) {
          state.isFirstTextInElement = true
        }
      }
      else {
        textBuffer += result.remainingText
        break
      }
    }
  }

  // Rawtext string-literal state is not carried across chunks. Inside
  // <script>/<style> the body is never committed until the close tag, so a
  // chunk boundary always leaves the whole body as leftover that is re-scanned
  // from the element start, where no string literal is open (issue #93).
  state.inSingleQuote = false
  state.inDoubleQuote = false
  state.inBacktick = false
  state.lastCharWasBackslash = false
  // NB: inRawTextQuoteAware is intentionally not reset here. The non-nesting body
  // is re-scanned from the element start on the next chunk while currentNode is
  // still the script/style element, so quote-awareness must persist across the
  // chunk boundary (issue #93).

  return textBuffer
}

/**
 * Process accumulated text buffer and create text node event
 */
function processTextBuffer(textBuffer: string, state: ParseState, handleEvent: (event: NodeEvent) => void): void {
  const containsNonWhitespace = state.textBufferContainsNonWhitespace
  const containsWhitespace = state.textBufferContainsWhitespace
  state.textBufferContainsNonWhitespace = false
  state.textBufferContainsWhitespace = false

  // Top-level text node with no element parent, e.g. the leading `foo ` in the
  // fragment `foo <sup>bar</sup>`. Emit it rather than dropping it (issue #93).
  if (!state.currentNode) {
    if (!containsNonWhitespace) {
      return
    }
    let rootText = textBuffer
    if (rootText.length === 0) {
      return
    }
    if (state.hasEncodedHtmlEntity) {
      rootText = decodeHTMLEntities(String(rootText))
      state.hasEncodedHtmlEntity = false
    }
    const rootTextNode: TextNode = {
      type: TEXT_NODE,
      value: rootText,
      parent: null,
      index: 0,
      depth: state.depth,
      containsWhitespace,
      excludedFromMarkdown: false,
    }
    handleEvent({ type: NodeEventEnter, node: rootTextNode })
    state.lastTextNode = rootTextNode
    return
  }

  const excludesTextNodes = state.currentNode?.tagHandler?.excludesTextNodes
  const inPreTag = (state.depthMap[TAG_PRE] || 0) > 0

  if (!inPreTag && !containsNonWhitespace && !state.currentNode.childTextNodeIndex) {
    return
  }

  let text = textBuffer
  if (text.length === 0) {
    return
  }

  const parentsToIncrement = traverseUpToFirstBlockNode(state.currentNode)
  const firstBlockParent = parentsToIncrement.at(-1)

  // Handle whitespace trimming
  if (containsWhitespace && !firstBlockParent?.childTextNodeIndex) {
    let start = 0
    while (start < text.length && (inPreTag ? (text.charCodeAt(start) === NEWLINE_CHAR || text.charCodeAt(start) === CARRIAGE_RETURN_CHAR) : isWhitespace(text.charCodeAt(start)))) {
      start++
    }
    if (start > 0) {
      text = text.substring(start)
    }
  }

  if (state.hasEncodedHtmlEntity) {
    text = decodeHTMLEntities(String(text))
    state.hasEncodedHtmlEntity = false
  }

  // Create text node
  const textNode: TextNode = {
    type: TEXT_NODE,
    value: text,
    parent: state.currentNode,
    index: state.currentNode.currentWalkIndex!++,
    depth: state.depth,
    containsWhitespace,
    excludedFromMarkdown: excludesTextNodes,
  }

  for (const parent of parentsToIncrement) {
    parent.childTextNodeIndex = (parent.childTextNodeIndex || 0) + 1
  }

  handleEvent({ type: NodeEventEnter, node: textNode })
  state.lastTextNode = textNode
}

/**
 * Process HTML closing tag
 */
function processClosingTag(
  htmlChunk: string,
  position: number,
  state: ParseState,
  handleEvent: (event: NodeEvent) => void,
): {
  complete: boolean
  newPosition: number
  remainingText: string
} {
  let i = position + 2 // Skip past '</'
  const tagNameStart = i
  const chunkLength = htmlChunk.length

  let foundClose = false
  while (i < chunkLength) {
    const charCode = htmlChunk.charCodeAt(i)
    if (charCode === GT_CHAR) {
      foundClose = true
      break
    }
    i++
  }

  if (!foundClose) {
    return {
      complete: false,
      newPosition: position,
      remainingText: htmlChunk.substring(position),
    }
  }

  const tagName = htmlChunk.substring(tagNameStart, i).toLowerCase() as keyof typeof TagIdMap
  const tagId = TagIdMap[tagName] ?? -1

  if (state.currentNode?.tagHandler?.isNonNesting && tagId !== state.currentNode.tagId) {
    return {
      complete: false,
      newPosition: position,
      remainingText: htmlChunk.substring(position),
    }
  }

  // Find matching parent node
  let curr: ElementNode | null | undefined = state.currentNode
  if (curr) {
    let match = curr.tagId !== tagId
    while (curr && match) {
      closeNode(curr, state, handleEvent)
      curr = curr.parent
      match = curr?.tagId !== tagId
    }
  }

  if (curr) {
    closeNode(curr, state, handleEvent)
  }

  state.justClosedTag = true

  return {
    complete: true,
    newPosition: i + 1,
    remainingText: '',
  }
}

/**
 * Close a node and emit exit event
 */
function closeNode(node: ElementNode | null, state: ParseState, handleEvent: (event: NodeEvent) => void): void {
  if (!node) {
    return
  }

  // Handle empty links
  if (node.tagId === TAG_A && !node.childTextNodeIndex) {
    const prefix = node.attributes?.title || node.attributes?.['aria-label'] || ''
    if (prefix) {
      node.childTextNodeIndex = 1
      const textNode = {
        type: TEXT_NODE,
        value: prefix,
        parent: node,
        index: 0,
        depth: node.depth + 1,
      } as TextNode

      handleEvent({ type: NodeEventEnter, node: textNode })
      for (const parent of traverseUpToFirstBlockNode(node)) {
        parent.childTextNodeIndex = (parent.childTextNodeIndex || 0) + 1
      }
    }
  }

  if (node.tagId) {
    state.depthMap[node.tagId] = Math.max(0, (state.depthMap[node.tagId] || 0) - 1)
  }

  // Clear non-nesting tag state
  if (node.tagHandler?.isNonNesting) {
    state.inSingleQuote = false
    state.inDoubleQuote = false
    state.inBacktick = false
    state.lastCharWasBackslash = false
    state.inRawTextQuoteAware = false
  }

  state.depth--
  handleEvent({ type: NodeEventExit, node })
  state.currentNode = state.currentNode!.parent!
  state.hasEncodedHtmlEntity = false
  state.justClosedTag = true
}

/**
 * Process HTML comment or doctype
 */
function processCommentOrDoctype(htmlChunk: string, position: number): {
  complete: boolean
  newPosition: number
  remainingText: string
} {
  let i = position
  const chunkLength = htmlChunk.length

  // Check for comment start
  if (i + 3 < chunkLength
    && htmlChunk.charCodeAt(i + 2) === DASH_CHAR
    && htmlChunk.charCodeAt(i + 3) === DASH_CHAR) {
    i += 4 // Skip past '<!--'

    // Look for --> sequence
    while (i < chunkLength - 2) {
      if (htmlChunk.charCodeAt(i) === DASH_CHAR
        && htmlChunk.charCodeAt(i + 1) === DASH_CHAR
        && htmlChunk.charCodeAt(i + 2) === GT_CHAR) {
        i += 3
        return {
          complete: true,
          newPosition: i,
          remainingText: '',
        }
      }
      i++
    }

    return {
      complete: false,
      newPosition: position,
      remainingText: htmlChunk.substring(position),
    }
  }
  else {
    i += 2 // Skip past '<!'

    while (i < chunkLength) {
      if (htmlChunk.charCodeAt(i) === GT_CHAR) {
        i++
        return {
          complete: true,
          newPosition: i,
          remainingText: '',
        }
      }
      i++
    }

    return {
      complete: false,
      newPosition: i,
      remainingText: htmlChunk.substring(position, i),
    }
  }
}

/**
 * Handle a CDATA section's inner content.
 *
 * CDATA is discarded by default (matching the HTML spec, where `<![CDATA[`
 * outside foreign content is a bogus comment). Callers opt in by registering a
 * `#cdata-section` entry in `tagOverrides`; the leading `#` makes the pseudo-tag
 * impossible to collide with a real HTML element name. When an override exists
 * the content is emitted as a synthetic `#cdata-section` element whose rendering
 * follows the override handler.
 */
function processCdataSection(
  content: string,
  state: ParseState,
  handleEvent: (event: NodeEvent) => void,
): void {
  if (!state.tagOverrideHandlers?.has('#cdata-section')) {
    return
  }

  // The `'>'` htmlChunk is a deliberate dummy: processTagAttributes hits the
  // `>` at position 0 and exits immediately, so the synthetic tag has no
  // attributes to parse. Mirrors the Rust engine's synthetic-tag handling.
  const open = processOpeningTag('#cdata-section', -1, '>', 0, state, handleEvent)
  if (!open.complete || open.selfClosing) {
    return
  }

  const node = state.currentNode!
  if (content.length > 0 && !node.tagHandler?.excludesTextNodes) {
    const textNode: TextNode = {
      type: TEXT_NODE,
      value: content,
      parent: node,
      index: node.currentWalkIndex!++,
      depth: state.depth,
      containsWhitespace: false,
    }
    for (const parent of traverseUpToFirstBlockNode(node)) {
      parent.childTextNodeIndex = (parent.childTextNodeIndex || 0) + 1
    }
    handleEvent({ type: NodeEventEnter, node: textNode })
    state.lastTextNode = textNode
  }

  closeNode(state.currentNode ?? null, state, handleEvent)
}

/**
 * Process HTML opening tag
 */
function processOpeningTag(
  tagName: string,
  tagId: number,
  htmlChunk: string,
  i: number,
  state: ParseState,
  handleEvent: (event: NodeEvent) => void,
): {
  complete: boolean
  newPosition: number
  remainingText: string
  selfClosing: boolean
  skip?: boolean
} {
  // Check if current element needs closing
  if (state.currentNode?.tagHandler?.isNonNesting) {
    closeNode(state.currentNode, state, handleEvent)
  }

  const tagHandler = state.tagOverrideHandlers?.get(tagName) ?? tagHandlers[tagId]
  const result = processTagAttributes(htmlChunk, i, tagHandler)

  if (!result.complete) {
    return {
      complete: false,
      newPosition: i,
      remainingText: `<${tagName}${result.attrBuffer}`,
      selfClosing: false,
    }
  }

  // Browser recovery: a non-head start tag while <head> is still open means the
  // page never closed its head (no </head>/<body>). Auto-close head (and anything
  // wrongly opened inside it) so body content is parsed as flow content with
  // normal block spacing, instead of inheriting head's whitespace collapsing.
  // Runs only after the tag is confirmed complete so incomplete/chunk-split start
  // tags do not mutate parser state or emit a premature head close.
  if ((state.depthMap[TAG_HEAD] || 0) > 0 && !HEAD_CONTENT_TAGS.has(tagId)) {
    while (state.currentNode && state.currentNode.tagId !== TAG_HEAD) {
      closeNode(state.currentNode, state, handleEvent)
    }
    const headNode = state.currentNode
    if (headNode && headNode.tagId === TAG_HEAD) {
      closeNode(headNode, state, handleEvent)
    }
  }

  // Browser recovery: implied end tags (HTML §13.1.2.4 optional tags +
  // tree-construction). Common malformed-but-valid markup omits end tags
  // (`<p>a<p>b`, `<li>a<li>b`, `<td>a<td>b`, `<dt>t<dd>d`); auto-close the open
  // element so the new sibling is not wrongly nested. Runs after the tag is
  // confirmed complete (above) so a chunk-split start tag never mutates parser
  // state or emits a premature close.
  if (tagId >= 0 && tagId < MAX_TAG_ID && NEEDS_IMPLIED_END_RECOVERY[tagId] === 1) {
    if (tagId === TAG_A) {
      // A nested <a> closes the open one (anchors cannot nest), so the markdown is
      // two adjacent links rather than invalid nested `[..]`. <a> never closes <p>.
      if ((state.depthMap[TAG_A] || 0) > 0) {
        closeImpliedTo(state, SINGLE_A, A_SCOPE_BOUNDARY, handleEvent)
      }
    }
    else if (tagId === TAG_TD || tagId === TAG_TH || tagId === TAG_TR
      || tagId === TAG_THEAD || tagId === TAG_TBODY || tagId === TAG_TFOOT) {
      // Table cells/rows/sections close earlier ones; they never close <p>.
      if ((state.depthMap[TAG_TABLE] || 0) > 0) {
        if (tagId === TAG_TD || tagId === TAG_TH) {
          if ((state.depthMap[TAG_TD] || 0) > 0 || (state.depthMap[TAG_TH] || 0) > 0) {
            closeImpliedTo(state, TD_TH, CELL_SCOPE_BOUNDARY, handleEvent)
          }
        }
        else if (tagId === TAG_TR) {
          if ((state.depthMap[TAG_TR] || 0) > 0) {
            closeTableContext(state, TR_CELLS, handleEvent)
          }
        }
        else {
          closeTableContext(state, SECTION_CELLS, handleEvent)
        }
      }
    }
    else {
      // Remaining recovery tags are all in CLOSES_P, so they close an open <p>
      // first, then any heading/list-item implied end.
      if ((state.depthMap[TAG_P] || 0) > 0) {
        closeImpliedTo(state, SINGLE_P, P_SCOPE_BOUNDARY, handleEvent)
      }
      if (HEADINGS.has(tagId)) {
        // A heading start closes an open heading (they cannot nest); only when one
        // is the current node, matching the spec's "if the current node is an
        // h1–h6 element, pop it" step.
        const top = state.currentNode
        if (top && top.tagId !== undefined && HEADINGS.has(top.tagId)) {
          closeNode(top, state, handleEvent)
        }
      }
      else if (tagId === TAG_LI) {
        if ((state.depthMap[TAG_LI] || 0) > 0) {
          closeImpliedTo(state, SINGLE_LI, LI_SCOPE_BOUNDARY, handleEvent)
        }
      }
      else if (tagId === TAG_DT || tagId === TAG_DD) {
        if ((state.depthMap[TAG_DT] || 0) > 0 || (state.depthMap[TAG_DD] || 0) > 0) {
          closeImpliedTo(state, DT_DD, DL_SCOPE_BOUNDARY, handleEvent)
        }
      }
    }
  }

  // Track global tag occurrence for uniqueness
  const currentTagCount = (result.attributes && result.attributes.id) ? undefined : (state.depthMap[tagId] || 0)
  state.depthMap[tagId] = (currentTagCount || 0) + 1
  state.depth++

  i = result.newPosition

  if (state.currentNode) {
    state.currentNode.currentWalkIndex = state.currentNode.currentWalkIndex || 0
  }

  const currentWalkIndex = state.currentNode ? state.currentNode.currentWalkIndex!++ : 0

  const tag = {
    type: ELEMENT_NODE,
    name: tagName,
    attributes: result.attributes,
    parent: state.currentNode,
    depthMap: copyDepthMap(state.depthMap),
    depth: state.depth,
    index: currentWalkIndex,
    tagId,
    tagHandler,
  } as ElementNode

  state.lastTextNode = tag

  // processAttributes hooks are handled at the processor level

  handleEvent({ type: NodeEventEnter, node: tag })

  const parentNode = tag
  parentNode.currentWalkIndex = 0
  state.currentNode = parentNode
  state.hasEncodedHtmlEntity = false

  // Track content for non-nesting tags
  if (tagHandler?.isNonNesting && !result.selfClosing) {
    state.inSingleQuote = false
    state.inDoubleQuote = false
    state.inBacktick = false
    state.lastCharWasBackslash = false
    // Only script/style hold quote-aware rawtext (JS/CSS string literals).
    state.inRawTextQuoteAware = tag.tagId === TAG_SCRIPT || tag.tagId === TAG_STYLE
  }

  if (result.selfClosing) {
    closeNode(tag, state, handleEvent)
    state.justClosedTag = true
  }
  else {
    state.justClosedTag = false
  }

  return {
    complete: true,
    newPosition: i,
    remainingText: '',
    selfClosing: result.selfClosing,
  }
}

/**
 * Extract and process HTML tag attributes
 */
function processTagAttributes(htmlChunk: string, position: number, tagHandler: Node['tagHandler']): {
  complete: boolean
  newPosition: number
  attributes: Record<string, string>
  selfClosing: boolean
  attrBuffer: string
} {
  let i = position
  const chunkLength = htmlChunk.length

  const selfClosing = tagHandler?.isSelfClosing || false
  const attrStartPos = i
  let insideQuote = false
  let quoteChar = 0

  let prevChar = 0
  while (i < chunkLength) {
    const c = htmlChunk.charCodeAt(i)

    if (insideQuote) {
      if (c === quoteChar && prevChar !== BACKSLASH_CHAR) {
        insideQuote = false
      }
      i++
      continue
    }
    else if (c === QUOTE_CHAR || c === APOS_CHAR) {
      insideQuote = true
      quoteChar = c
    }
    else if (c === SLASH_CHAR && i + 1 < chunkLength
      && htmlChunk.charCodeAt(i + 1) === GT_CHAR) {
      const attrStr = htmlChunk.substring(attrStartPos, i).trim()
      return {
        complete: true,
        newPosition: i + 2,
        attributes: parseAttributes(attrStr),
        selfClosing: true,
        attrBuffer: attrStr,
      }
    }
    else if (c === GT_CHAR) {
      const attrStr = htmlChunk.substring(attrStartPos, i).trim()
      return {
        complete: true,
        newPosition: i + 1,
        attributes: parseAttributes(attrStr),
        selfClosing,
        attrBuffer: attrStr,
      }
    }

    i++
    prevChar = c
  }

  return {
    complete: false,
    newPosition: i,
    attributes: EMPTY_ATTRIBUTES,
    selfClosing: false,
    attrBuffer: htmlChunk.substring(attrStartPos, i),
  }
}

/**
 * Parse HTML attributes string into key-value object
 */
export function parseAttributes(attrStr: string): Record<string, string> {
  if (!attrStr)
    return EMPTY_ATTRIBUTES

  const result: Record<string, string> = {}
  const len = attrStr.length
  let i = 0

  // State machine states
  const WHITESPACE = 0
  const NAME = 1
  const AFTER_NAME = 2
  const BEFORE_VALUE = 3
  const QUOTED_VALUE = 4
  const UNQUOTED_VALUE = 5

  let state = WHITESPACE
  let nameStart = 0
  let nameEnd = 0
  let valueStart = 0
  let quoteChar = 0
  let name = ''

  while (i < len) {
    const charCode = attrStr.charCodeAt(i)
    const isSpace = isWhitespace(charCode)

    switch (state) {
      case WHITESPACE:
        if (!isSpace) {
          state = NAME
          nameStart = i
          nameEnd = 0 // Reset nameEnd when starting a new attribute
        }
        break

      case NAME:
        if (charCode === EQUALS_CHAR || isSpace) {
          nameEnd = i
          name = attrStr.substring(nameStart, nameEnd).toLowerCase()
          state = charCode === EQUALS_CHAR ? BEFORE_VALUE : AFTER_NAME
        }
        break

      case AFTER_NAME:
        if (charCode === EQUALS_CHAR) {
          state = BEFORE_VALUE
        }
        else if (!isSpace) {
          result[name] = ''
          state = NAME
          nameStart = i
          nameEnd = 0 // Reset nameEnd when starting a new attribute
        }
        break

      case BEFORE_VALUE:
        if (charCode === QUOTE_CHAR || charCode === APOS_CHAR) {
          quoteChar = charCode
          state = QUOTED_VALUE
          valueStart = i + 1
        }
        else if (!isSpace) {
          state = UNQUOTED_VALUE
          valueStart = i
        }
        break

      case QUOTED_VALUE:
        if (charCode === BACKSLASH_CHAR && i + 1 < len) {
          i++
        }
        else if (charCode === quoteChar) {
          const raw = attrStr.substring(valueStart, i)
          result[name] = raw.includes('&') ? decodeHTMLEntities(raw) : raw
          state = WHITESPACE
        }
        break

      case UNQUOTED_VALUE:
        if (isSpace || charCode === GT_CHAR) {
          const raw = attrStr.substring(valueStart, i)
          result[name] = raw.includes('&') ? decodeHTMLEntities(raw) : raw
          state = WHITESPACE
        }
        break
    }

    i++
  }

  // Handle the last attribute
  if (state === QUOTED_VALUE || state === UNQUOTED_VALUE) {
    if (name) {
      const raw = attrStr.substring(valueStart, i)
      result[name] = raw.includes('&') ? decodeHTMLEntities(raw) : raw
    }
  }
  else if (state === NAME || state === AFTER_NAME || state === BEFORE_VALUE) {
    nameEnd = nameEnd || i
    const currentName = attrStr.substring(nameStart, nameEnd).toLowerCase()
    if (currentName) {
      result[currentName] = ''
    }
  }

  return result
}
