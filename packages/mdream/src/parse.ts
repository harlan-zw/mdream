import type { ElementNode, Node, NodeEvent, Plugin, TextNode } from './types'
import {
  ELEMENT_NODE,
  MAX_TAG_ID,
  NodeEventEnter,
  NodeEventExit,
  TAG_A,
  TAG_BLOCKQUOTE,
  TAG_CODE,
  TAG_PRE,
  TAG_TABLE,
  TagIdMap,
  TEXT_NODE,
} from './const.ts'
import { tagHandlers } from './tags.ts'
import { decodeHTMLEntities, traverseUpToFirstBlockNode } from './utils.ts'

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

// Pre-allocate arrays and objects to reduce allocations
const EMPTY_ATTRIBUTES: Record<string, string> = Object.freeze({})

export interface ParseOptions {
  plugins?: Plugin[]
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
  /** Backslash escaping state tracking - avoids checking previous character */
  lastCharWasBackslash?: boolean
  /** Plugin instances for event processing */
  plugins?: Plugin[]
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
    plugins: options.plugins || [],
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
        const inPreTag = state.depthMap[TAG_PRE] > 0

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
        if (currentCharCode === PIPE_CHAR && state.depthMap[TAG_TABLE]) {
          textBuffer += '\\|'
        }
        else if (currentCharCode === BACKTICK_CHAR && (state.depthMap[TAG_CODE] || state.depthMap[TAG_PRE])) {
          textBuffer += '\\`'
        }
        else if (currentCharCode === OPEN_BRACKET_CHAR && state.depthMap[TAG_A]) {
          textBuffer += '\\['
        }
        else if (currentCharCode === CLOSE_BRACKET_CHAR && state.depthMap[TAG_A]) {
          textBuffer += '\\]'
        }
        else if (currentCharCode === GT_CHAR && state.depthMap[TAG_BLOCKQUOTE]) {
          textBuffer += '\\>'
        }
        else {
          textBuffer += htmlChunk[i]
        }

        // Track quote state for non-nesting tags
        if (state.currentNode?.tagHandler?.isNonNesting) {
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

        state.lastCharWasBackslash = currentCharCode === BACKSLASH_CHAR
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

    // COMMENT or DOCTYPE
    if (nextCharCode === EXCLAMATION_CHAR) {
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
      const inQuotes = state.inSingleQuote || state.inDoubleQuote || state.inBacktick
      if (state.currentNode?.tagHandler?.isNonNesting && inQuotes) {
        textBuffer += htmlChunk[i]
        i++
        continue
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

      const tagName = htmlChunk.substring(tagNameStart, tagNameEnd).toLowerCase()
      if (!tagName) {
        i = tagNameEnd
        break
      }

      const tagId = TagIdMap[tagName] ?? -1
      i2 = tagNameEnd

      if (state.currentNode?.tagHandler?.isNonNesting) {
        if (tagId !== state.currentNode?.tagId) {
          textBuffer += htmlChunk[i++]
          continue
        }
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

  if (!state.currentNode) {
    return
  }

  const excludesTextNodes = state.currentNode?.tagHandler?.excludesTextNodes
  const inPreTag = state.depthMap[TAG_PRE] > 0

  if (!inPreTag && !containsNonWhitespace && !state.currentNode.childTextNodeIndex) {
    return
  }

  let text = textBuffer
  if (text.length === 0) {
    return
  }

  const parentsToIncrement = traverseUpToFirstBlockNode(state.currentNode)
  const firstBlockParent = parentsToIncrement[parentsToIncrement.length - 1]

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
    regionId: state.currentNode?.regionId,
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

  const tagName = htmlChunk.substring(tagNameStart, i).toLowerCase()
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
    state.depthMap[node.tagId] = Math.max(0, state.depthMap[node.tagId] - 1)
  }

  // Clear non-nesting tag state
  if (node.tagHandler?.isNonNesting) {
    state.inSingleQuote = false
    state.inDoubleQuote = false
    state.inBacktick = false
    state.lastCharWasBackslash = false
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

  const tagHandler = tagHandlers[tagId]
  const result = processTagAttributes(htmlChunk, i, tagHandler)

  if (!result.complete) {
    return {
      complete: false,
      newPosition: i,
      remainingText: `<${tagName}${result.attrBuffer}`,
      selfClosing: false,
    }
  }

  // Update depth tracking
  const currentTagCount = state.depthMap[tagId]
  state.depthMap[tagId] = currentTagCount + 1
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
    regionId: state.currentNode?.regionId,
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
          nameEnd = 0  // Reset nameEnd when starting a new attribute
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
          nameEnd = 0  // Reset nameEnd when starting a new attribute
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
          result[name] = attrStr.substring(valueStart, i)
          state = WHITESPACE
        }
        break

      case UNQUOTED_VALUE:
        if (isSpace || charCode === GT_CHAR) {
          result[name] = attrStr.substring(valueStart, i)
          state = WHITESPACE
        }
        break
    }

    i++
  }

  // Handle the last attribute
  if (state === QUOTED_VALUE || state === UNQUOTED_VALUE) {
    if (name) {
      result[name] = attrStr.substring(valueStart, i)
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
