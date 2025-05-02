import type { MdreamProcessingState, MdreamRuntimeState, Node, NodeEvent, ParentNode } from './types.ts'
import {
  ELEMENT_NODE,
  MINIMAL_EXCLUDE_ELEMENTS,
  NON_NESTING_TAGS,
  NON_SUPPORTED_NODES,
  TEXT_NODE,
  USES_ATTRIBUTES,
  VOID_TAGS,
} from './const.ts'
import { processHtmlEventToMarkdown } from './markdown.ts'
import { decodeHTMLEntities } from './utils.ts'

// Whitespace character code lookup for faster checks
const WHITESPACE_CHARS = new Set([32, 9, 10, 13]) // space, tab, newline, carriage return

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

// Pre-allocate arrays to reduce allocations
const EMPTY_ATTRIBUTES: Record<string, string> = Object.freeze({})

// Fast object copy for small objects like depthMap
function fastCopyDepthMap(depthMap: Record<string, number>): Record<string, number> {
  const copy: Record<string, number> = {}
  for (const key in depthMap) {
    if (depthMap[key] > 0) { // Only copy non-zero values
      copy[key] = depthMap[key]
    }
  }
  return copy
}

/**
 * Fast whitespace check using character codes
 */
function isWhitespace(charCode: number): boolean {
  return WHITESPACE_CHARS.has(charCode)
}

/**
 * Parses a HTML chunk and returns a list of node events for traversal and any remaining unparsed HTML.
 * This allows handling partial HTML chunks in streaming scenarios.
 * Integrated with fast whitespace removal logic.
 */
export function parseHTML(htmlChunk: string, state: MdreamProcessingState): {
  events: NodeEvent[]
  unprocessedHtml: string
} {
  const events: NodeEvent[] = []
  let textBuffer = '' // Buffer to accumulate text content

  // Initialize state
  state.depthMap ??= {}
  state.depth ??= 0
  state.lastCharWasWhitespace ??= true // don't allow subsequent whitespace at start
  state.justClosedTag ??= false
  state.isFirstTextInElement ??= false

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
        const inPreTag = state.depthMap.pre > 0

        // Handle space after a tag
        if (state.justClosedTag) {
          state.justClosedTag = false
          state.lastCharWasWhitespace = false // Allow this space
        }

        // Skip if last character was whitespace and we're not in a pre tag
        if (!inPreTag && state.lastCharWasWhitespace) {
          i++
          continue
        }

        state.lastCharWasWhitespace = true

        // Preserve original whitespace in pre tags
        if (inPreTag) {
          textBuffer += htmlChunk[i]
        }
        else {
          textBuffer += ' '
        }
      }
      else {
        state.lastCharWasWhitespace = false
        state.justClosedTag = false
        textBuffer += htmlChunk[i]
      }

      i++
      continue
    }

    // Look ahead to determine tag type
    if (i + 1 >= chunkLength) {
      // Partial '<' at end of chunk, add to buffer
      textBuffer += htmlChunk[i]
      break
    }

    const nextCharCode = htmlChunk.charCodeAt(i + 1)

    // COMMENT or DOCTYPE
    if (nextCharCode === EXCLAMATION_CHAR) {
      // Process any text content before this tag
      if (textBuffer.length > 0) {
        processTextBuffer(textBuffer, state, events)
        textBuffer = ''
      }

      const result = processCommentOrDoctype(htmlChunk, i)
      if (result.complete) {
        i = result.newPosition
      }
      else {
        // Incomplete comment/doctype, add remaining content to buffer
        textBuffer += result.remainingText
        break
      }
    }
    // CLOSING TAG
    else if (nextCharCode === SLASH_CHAR) {
      // Process any text content before this tag
      if (textBuffer.length > 0) {
        processTextBuffer(textBuffer, state, events)
        textBuffer = ''
      }

      const result = processClosingTag(htmlChunk, i, state, events)
      if (result.complete) {
        i = result.newPosition
      }
      else {
        // Incomplete closing tag
        textBuffer += result.remainingText
        break
      }
    }
    // OPENING TAG
    else {
      // Process any text content before this tag
      if (textBuffer.length > 0) {
        processTextBuffer(textBuffer, state, events)
        textBuffer = ''
      }

      const result = processOpeningTag(htmlChunk, i, state, events)
      if (result.complete) {
        i = result.newPosition
        // Only mark the next text node as first if this isn't a self-closing tag
        if (!result.selfClosing) {
          state.isFirstTextInElement = true
        }
      }
      else {
        // Incomplete opening tag
        textBuffer += result.remainingText
        break
      }
    }
  }

  return {
    events,
    unprocessedHtml: textBuffer,
  }
}

/**
 * Process accumulated text buffer and create a text node if needed
 * Optimized to handle whitespace trimming
 */
function processTextBuffer(textBuffer: string, state: MdreamProcessingState, events: NodeEvent[]): void {
  if (!state.currentElementNode)
    return

  // Check if parent is a <pre> tag to handle whitespace properly
  const inPreTag = state.depthMap.pre > 0
  const inCodeTag = state.depthMap.code > 0

  // For non-pre tags, we want to preserve the text but collapse whitespace
  if (!inPreTag && !textBuffer.trim().length) {
    return
  }

  let finalText = textBuffer

  // Handle whitespace trimming
  if (!inPreTag) {
    // Trim leading whitespace if this is the first text node after an opening tag
    if (state.isFirstTextInElement) {
      let start = 0
      while (start < finalText.length && isWhitespace(finalText.charCodeAt(start))) {
        start++
      }
      if (start > 0) {
        finalText = finalText.substring(start)
      }
      state.isFirstTextInElement = false
    }
  }
  else {
    // For pre tags, only trim leading newlines from the first text node
    if (state.isFirstTextInElement) {
      let start = 0
      while (start < finalText.length
        && (finalText.charCodeAt(start) === 10 || finalText.charCodeAt(start) === 13)) {
        start++
      }
      if (start > 0) {
        finalText = finalText.substring(start)
      }
      state.isFirstTextInElement = false
    }
  }

  // Early exit for empty text
  if (finalText.length === 0) {
    return
  }

  // Escape triple backticks inside <pre><code> blocks
  if (inPreTag && inCodeTag && finalText.includes('```')) {
    finalText = finalText.replace(/```/g, '\\`\\`\\`')
  }

  // Create text node
  const textNode: Node = {
    type: TEXT_NODE,
    value: finalText,
    parentNode: state.currentElementNode,
    complete: true,
    index: state.currentElementNode.currentWalkIndex++,
    unsupported: state.inUnsupportedNodeDepth !== undefined,
    excluded: state.isExcludedNodeDepth !== undefined,
    depth: state.depth,
  }

  if (state.hasEncodedHtmlEntity && textNode.value && textNode.value.includes('&')) {
    textNode.value = decodeHTMLEntities(String(textNode.value))
    state.hasEncodedHtmlEntity = false
  }

  events.push({ type: 'enter', node: textNode })
  events.push({ type: 'exit', node: textNode })

  // Keep track of the last text node for trailing whitespace trimming
  state.lastTextNode = textNode
}

/**
 * Process HTML closing tag with optimized string operations
 */
function processClosingTag(
  htmlChunk: string,
  position: number,
  state: MdreamProcessingState,
  events: NodeEvent[],
): {
    complete: boolean
    newPosition: number
    remainingText: string
  } {
  let i = position + 2 // Skip past '</'
  const tagNameStart = i
  const chunkLength = htmlChunk.length

  // Fast scan for end of tag name
  while (i < chunkLength) {
    const charCode = htmlChunk.charCodeAt(i)
    if (isWhitespace(charCode) || charCode === GT_CHAR) {
      break
    }
    i++
  }

  const tagName = htmlChunk.substring(tagNameStart, i).toLowerCase()

  // Skip any whitespace
  while (i < chunkLength && isWhitespace(htmlChunk.charCodeAt(i))) {
    i++
  }

  // Check for closing '>'
  if (i >= chunkLength || htmlChunk.charCodeAt(i) !== GT_CHAR) {
    // Incomplete closing tag
    return {
      complete: false,
      newPosition: i,
      remainingText: `</${tagName}`,
    }
  }

  // Trim trailing whitespace from the last text node
  if (state.lastTextNode) {
    const inPreTag = state.depthMap.pre > 0
    const value = String(state.lastTextNode.value)
    let end = value.length

    if (inPreTag) {
      // For pre tags, only trim trailing newlines
      while (end > 0
        && (value.charCodeAt(end - 1) === 10 || value.charCodeAt(end - 1) === 13)) {
        end--
      }
    }
    else {
      // For non-pre tags, trim all trailing whitespace
      while (end > 0 && isWhitespace(value.charCodeAt(end - 1))) {
        end--
      }
    }

    if (end < value.length) {
      state.lastTextNode.value = value.substring(0, end)
    }
  }

  // Process the closing tag
  if (state.currentElementNode && tagName === state.currentElementNode.name?.toLowerCase()) {
    closeNode(state.currentElementNode, state, events)
  }

  state.justClosedTag = true // Mark that we just processed a closing tag

  return {
    complete: true,
    newPosition: i + 1, // Skip past '>'
    remainingText: '',
  }
}

/**
 * Close a node and update state accordingly
 */
function closeNode(node: Node, state: MdreamProcessingState, events: NodeEvent[]): void {
  node.complete = true

  if (node.name) {
    state.depthMap[node.name] = Math.max(0, (state.depthMap[node.name] || 0) - 1)
  }

  if (state.inUnsupportedNodeDepth === state.depth) {
    state.inUnsupportedNodeDepth = undefined
  }

  if (state.isExcludedNodeDepth === state.depth) {
    state.isExcludedNodeDepth = undefined
  }

  state.depth--
  events.push({ type: 'exit', node })
  state.currentElementNode = state.currentElementNode!.parentNode!
  state.hasEncodedHtmlEntity = false
  state.justClosedTag = true
  state.lastTextNode = undefined
}

/**
 * Process HTML comment or doctype with optimized scanning
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
    // Handle comment
    i += 4 // Skip past '<!--'

    // Look for --> sequence
    while (i < chunkLength - 2) {
      if (htmlChunk.charCodeAt(i) === DASH_CHAR
        && htmlChunk.charCodeAt(i + 1) === DASH_CHAR
        && htmlChunk.charCodeAt(i + 2) === GT_CHAR) {
        i += 3 // Skip past '-->'
        return {
          complete: true,
          newPosition: i,
          remainingText: '',
        }
      }
      i++
    }

    // Incomplete comment
    return {
      complete: false,
      newPosition: position,
      remainingText: htmlChunk.substring(position),
    }
  }
  else {
    // Handle doctype or other directive
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

    // Incomplete doctype
    return {
      complete: false,
      newPosition: i,
      remainingText: htmlChunk.substring(position, i),
    }
  }
}

/**
 * Process HTML opening tag with performance optimizations
 */
function processOpeningTag(
  htmlChunk: string,
  position: number,
  state: MdreamProcessingState,
  events: NodeEvent[],
): {
    complete: boolean
    newPosition: number
    remainingText: string
    selfClosing: boolean
  } {
  let i = position + 1 // Skip past '<'
  const tagNameStart = i

  // Fast path for finding tag name end
  let tagNameEnd = -1
  const chunkLength = htmlChunk.length

  while (i < chunkLength) {
    const c = htmlChunk.charCodeAt(i)
    if (isWhitespace(c) || c === SLASH_CHAR || c === GT_CHAR) {
      tagNameEnd = i
      break
    }
    i++
  }

  if (tagNameEnd === -1) {
    // Incomplete tag
    return {
      complete: false,
      newPosition: i,
      remainingText: htmlChunk.substring(position),
      selfClosing: false,
    }
  }

  // Extract and convert to lowercase once
  const tagName = htmlChunk.substring(tagNameStart, tagNameEnd).toLowerCase()
  i = tagNameEnd

  if (!tagName) {
    return {
      complete: false,
      newPosition: i,
      remainingText: '<',
      selfClosing: false,
    }
  }

  // Check if the current element is a non-nesting tag that needs closing
  if (state.currentElementNode?.name && NON_NESTING_TAGS.has(state.currentElementNode.name)) {
    closeNode(state.currentElementNode, state, events)
  }

  // Fast increment depth tracking
  const currentTagCount = state.depthMap[tagName] || 0
  state.depthMap[tagName] = currentTagCount + 1
  state.depth++

  // Process attributes and tag properties
  const result = processTagAttributes(htmlChunk, i, tagName)

  if (!result.complete) {
    // Roll back depth changes
    state.depthMap[tagName] = currentTagCount
    state.depth--

    return {
      complete: false,
      newPosition: i,
      remainingText: `<${tagName}${result.attrBuffer}`,
      selfClosing: false,
    }
  }

  i = result.newPosition

  // Pre-compute flags
  const isUnsupported = !state.inUnsupportedNodeDepth && NON_SUPPORTED_NODES.has(tagName)
  const isExcluded = state.processingHTMLDocument && MINIMAL_EXCLUDE_ELEMENTS.has(tagName)

  if (isUnsupported) {
    state.inUnsupportedNodeDepth = state.depth
  }
  if (isExcluded) {
    state.isExcludedNodeDepth = state.depth
  }

  // Create the node with pre-computed values
  const currentWalkIndex = state.currentElementNode ? state.currentElementNode.currentWalkIndex++ : 0

  const tag: Node = {
    type: ELEMENT_NODE,
    name: tagName,
    attributes: result.attributes,
    parentNode: state.currentElementNode,
    depthMap: fastCopyDepthMap({ ...state.depthMap }),
    depth: state.depth,
    unsupported: isUnsupported || !!state.inUnsupportedNodeDepth,
    excluded: isExcluded || !!state.isExcludedNodeDepth,
    complete: false,
    index: currentWalkIndex,
  }

  events.push({ type: 'enter', node: tag })

  // Directly set as parent node
  const parentNode = tag as ParentNode
  parentNode.currentWalkIndex = 0
  state.currentElementNode = parentNode
  state.hasEncodedHtmlEntity = false

  if (result.selfClosing) {
    closeNode(tag, state, events)
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
 * Process tag attributes and determine if tag is self-closing
 */
function processTagAttributes(htmlChunk: string, position: number, tagName: string): {
  complete: boolean
  newPosition: number
  attributes: Record<string, string>
  selfClosing: boolean
  attrBuffer: string
} {
  // Fast path: if not using attributes, don't bother parsing them
  if (!USES_ATTRIBUTES.has(tagName)) {
    // Scan quickly for the end of the tag
    let i = position
    const chunkLength = htmlChunk.length
    const selfClosing = VOID_TAGS.has(tagName)

    while (i < chunkLength) {
      const c = htmlChunk.charCodeAt(i)
      if (c === GT_CHAR) {
        return {
          complete: true,
          newPosition: i + 1,
          attributes: EMPTY_ATTRIBUTES,
          selfClosing,
          attrBuffer: '',
        }
      }
      else if (c === SLASH_CHAR && i + 1 < chunkLength
        && htmlChunk.charCodeAt(i + 1) === GT_CHAR) {
        return {
          complete: true,
          newPosition: i + 2,
          attributes: EMPTY_ATTRIBUTES,
          selfClosing: true,
          attrBuffer: '',
        }
      }
      i++
    }

    return {
      complete: false,
      newPosition: position,
      attributes: EMPTY_ATTRIBUTES,
      selfClosing: false,
      attrBuffer: htmlChunk.substring(position),
    }
  }

  // For tags that use attributes, do full processing
  let i = position
  const chunkLength = htmlChunk.length
  const selfClosing = VOID_TAGS.has(tagName)
  const attrStartPos = i
  let insideQuote = false
  let quoteChar = 0

  // Find the end of tag
  while (i < chunkLength) {
    const c = htmlChunk.charCodeAt(i)

    if (insideQuote) {
      if (c === quoteChar && htmlChunk.charCodeAt(i - 1) !== BACKSLASH_CHAR) {
        insideQuote = false
      }
    }
    else if (c === QUOTE_CHAR || c === APOS_CHAR) {
      insideQuote = true
      quoteChar = c
    }
    else if (c === SLASH_CHAR && i + 1 < chunkLength
      && htmlChunk.charCodeAt(i + 1) === GT_CHAR) {
      const attrStr = htmlChunk.substring(attrStartPos, i).trim()
      const attributes = attrStr ? parseAttributes(attrStr) : EMPTY_ATTRIBUTES
      return {
        complete: true,
        newPosition: i + 2,
        attributes,
        selfClosing: true,
        attrBuffer: attrStr,
      }
    }
    else if (c === GT_CHAR) {
      const attrStr = htmlChunk.substring(attrStartPos, i).trim()
      const attributes = attrStr ? parseAttributes(attrStr) : EMPTY_ATTRIBUTES
      return {
        complete: true,
        newPosition: i + 1,
        attributes,
        selfClosing,
        attrBuffer: attrStr,
      }
    }

    i++
  }

  // Incomplete tag
  return {
    complete: false,
    newPosition: i,
    attributes: EMPTY_ATTRIBUTES,
    selfClosing: false,
    attrBuffer: htmlChunk.substring(attrStartPos, i),
  }
}

/**
 * Parse HTML attributes string into a key-value object
 * Optimized version using substring operations instead of char-by-char concatenation
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
          // Start of a new attribute without value
          result[name] = ''
          state = NAME
          nameStart = i
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
          // Skip escaped character
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

  // Handle the last attribute if we're still processing it
  if (name) {
    if (state === QUOTED_VALUE || state === UNQUOTED_VALUE) {
      result[name] = attrStr.substring(valueStart, i)
    }
    else if (state === NAME || state === AFTER_NAME || state === BEFORE_VALUE) {
      nameEnd = nameEnd || i
      name = name || attrStr.substring(nameStart, nameEnd).toLowerCase()
      result[name] = ''
    }
  }

  return result
}

/**
 * Stream HTML to Markdown conversion
 */
export function processPartialHTMLToMarkdown(
  partialHtml: string,
  state: Partial<MdreamRuntimeState> = {},
): { chunk: string, remainingHTML: string } {
  const chunkSize = state?.options?.chunkSize || 4096

  // Initialize state if not already present
  state.buffer ??= ''

  // Check for DOCTYPE at the beginning (optimized)
  if (!state.buffer) {
    partialHtml = partialHtml.trimStart()
    if (partialHtml.charCodeAt(0) === LT_CHAR && partialHtml.charCodeAt(1) === EXCLAMATION_CHAR) {
      state.processingHTMLDocument = true
    }
  }

  state.options ??= { chunkSize }

  // Parse HTML into a DOM tree with events
  // @ts-expect-error untyped
  const { events, unprocessedHtml } = parseHTML(partialHtml, state)

  // Process events from the parser
  let chunk = ''
  for (const event of events) {
    let fragment: string | undefined

    // Fast path for text nodes
    if (event.node.type === TEXT_NODE) {
      // @ts-expect-error untyped
      fragment = processHtmlEventToMarkdown(event, state)
      if (fragment) {
        chunk += fragment
        state.buffer += fragment
      }
      continue
    }

    const tagName = String(event.node.name)

    if (event.type === 'enter') {
      // Track when we enter the body tag
      if (state.processingHTMLDocument && tagName === 'body') {
        state.enteredBody = true
      }

      // Check if this is a header tag inside body and we're processing an HTML document
      if (state.processingHTMLDocument && state.enteredBody && !state.hasSeenHeader) {
        if (tagName.charCodeAt(0) === 104 // 'h'
          && (tagName.charCodeAt(1) === 49 || tagName.charCodeAt(1) === 50)) { // '1' or '2'
          state.hasSeenHeader = true
        }
      }
    }

    // @ts-expect-error untyped
    fragment = processHtmlEventToMarkdown(event, state)
    if (fragment) {
      chunk += fragment
      state.buffer += fragment
    }
  }

  return { chunk, remainingHTML: unprocessedHtml }
}
