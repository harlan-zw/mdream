import type { ElementNode, MdreamProcessingState, MdreamRuntimeState, Node, NodeEvent, TextNode } from './types.ts'
import {
  ELEMENT_NODE,
  MAX_TAG_ID,
  NodeEventEnter,
  NodeEventExit,
  TAG_A,
  TAG_BLOCKQUOTE,
  TAG_BODY,
  TAG_CODE,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_PRE,
  TAG_TABLE,
  TagIdMap,
  TEXT_NODE,
} from './const.ts'
import { processHtmlEventToMarkdown } from './markdown.ts'
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

// Pre-allocate arrays and objects to reduce allocations
const EMPTY_ATTRIBUTES: Record<string, string> = Object.freeze({})

// Fast typed array copy for depthMap
function copyDepthMap(depthMap: Node['depthMap']): Node['depthMap'] {
  return new Uint8Array(depthMap)
}

/**
 * Fast whitespace check using direct character code comparison
 * Uses direct integer comparison instead of regex or Set for performance
 */
function isWhitespace(charCode: number): boolean {
  return charCode === SPACE_CHAR
    || charCode === TAB_CHAR
    || charCode === NEWLINE_CHAR
    || charCode === CARRIAGE_RETURN_CHAR
}

/**
 * Initialize plugin instances and add them to state
 */
// Tag handlers are already imported from './tags.ts' at the top of the file

function initializePlugins(state: MdreamRuntimeState): void {
  // If plugins are already initialized or no plugins provided, exit
  if (!state.options?.plugins?.length || state.plugins) {
    return
  }

  // Initialize the plugins array (copy from options to avoid mutations)
  state.plugins = [...state.options.plugins]

  // Run init for each plugin
  for (const plugin of state.plugins) {
    if (plugin.init) {
      plugin.init(state.options, tagHandlers)
    }
  }
}

/**
 * Run the beforeNodeProcess hook for all plugins
 */
function runBeforeNodeProcessHooks(node: Node, state: MdreamRuntimeState): boolean {
  if (!state.plugins?.length)
    return true

  for (const plugin of state.plugins) {
    if (plugin.beforeNodeProcess && plugin.beforeNodeProcess(node, state) === false) {
      return false
    }
  }
  return true
}

/**
 * Run the processAttributes hook for all plugins
 */
function runProcessAttributesHooks(node: ElementNode, state: MdreamRuntimeState): void {
  if (!state.plugins?.length)
    return

  for (const plugin of state.plugins) {
    if (plugin.processAttributes) {
      plugin.processAttributes(node, state)
    }
  }
}

/**
 * Main parsing function that processes HTML incrementally
 * Designed for streaming - can handle partial chunks and resume parsing
 * Returns any unprocessed HTML that should be included in the next chunk
 */
export function parseHTML(htmlChunk: string, state: MdreamProcessingState, handleEvent: (event: NodeEvent) => void): string {
  let textBuffer = '' // Buffer to accumulate text content

  // Initialize state
  state.depthMap ??= new Uint8Array(MAX_TAG_ID) // Initialize using typed array
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
        const inPreTag = state.depthMap[TAG_PRE] > 0

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

        // Preserve original whitespace in pre tags
        if (inPreTag) {
          textBuffer += htmlChunk[i]
        }
        else {
          // only preserve explicit spaces
          if (currentCharCode === SPACE_CHAR || !state.lastCharWasWhitespace) {
            textBuffer += ' '
          }
        }
        state.lastCharWasWhitespace = true
        state.textBufferContainsWhitespace = true
      }
      else {
        state.textBufferContainsNonWhitespace = true
        state.lastCharWasWhitespace = false
        state.justClosedTag = false
        // pipe character
        if (currentCharCode === 124 && state.depthMap[TAG_TABLE]) {
          // replace with encoded pipe character
          textBuffer += '\\|'
        }
        // if in header we need to encode #
        else if (currentCharCode === 35 && (state.depthMap[TAG_H1] || state.depthMap[TAG_H2] || state.depthMap[TAG_H3] || state.depthMap[TAG_H4] || state.depthMap[TAG_H5] || state.depthMap[TAG_H6])) {
          // replace with encoded #
          textBuffer += '\\#'
        }
        // if in code block we need to encode `
        else if (currentCharCode === 96 && (state.depthMap[TAG_CODE] || state.depthMap[TAG_PRE])) {
          // replace with encoded `
          textBuffer += '\\`'
        }
        // link open
        else if (currentCharCode === 91 && state.depthMap[TAG_A]) {
          // replace with encoded [
          textBuffer += '\\['
        }
        // link close
        else if (currentCharCode === 93 && state.depthMap[TAG_A]) {
          // replace with encoded ]
          textBuffer += '\\]'
        }
        // blockquote
        else if (currentCharCode === 62 && state.depthMap[TAG_BLOCKQUOTE]) {
          // replace with encoded >
          textBuffer += '\\>'
        }
        else {
          textBuffer += htmlChunk[i]
        }
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
        processTextBuffer(textBuffer, state, handleEvent)
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
        processTextBuffer(textBuffer, state, handleEvent)
        textBuffer = ''
      }

      const result = processClosingTag(htmlChunk, i, state, handleEvent)
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
      let i2 = i + 1 // Skip past '<'
      const tagNameStart = i2

      // Fast path for finding tag name end
      let tagNameEnd = -1
      const chunkLength = htmlChunk.length

      while (i2 < chunkLength) {
        const c = htmlChunk.charCodeAt(i2)
        if (isWhitespace(c) || c === SLASH_CHAR || c === GT_CHAR) {
          tagNameEnd = i2
          break
        }
        i2++
      }
      if (tagNameEnd === -1) {
        // Incomplete tag
        textBuffer += htmlChunk.substring(i)
        break
      }
      const tagName = htmlChunk.substring(tagNameStart, tagNameEnd).toLowerCase()
      if (!tagName) {
        i = tagNameEnd
        break
      }
      const tagId = TagIdMap[tagName] || -1
      i2 = tagNameEnd
      // avoid tag opens inside of script tags
      if (state.currentNode?.tagHandler?.isNonNesting) {
        // if current tag is a script, then we need to keep walking
        if (tagId !== state.currentNode?.tagId) {
          textBuffer += htmlChunk[i++]
          continue
        }
      }

      // Process any text content before this tag
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

  return textBuffer
}

/**
 * Process accumulated text buffer and create a text node
 * Handles whitespace trimming and HTML entity decoding
 * Skips empty text nodes and manages text context for parent elements
 */
function processTextBuffer(textBuffer: string, state: MdreamProcessingState, handleEvent: (event: NodeEvent) => void): void {
  const containsNonWhitespace = state.textBufferContainsNonWhitespace
  const containsWhitespace = state.textBufferContainsWhitespace
  state.textBufferContainsNonWhitespace = false
  state.textBufferContainsWhitespace = false
  if (!state.currentNode || state.currentNode?.tagHandler?.excludesTextNodes) {
    return
  }

  // Check if parent is a <pre> tag to handle whitespace properly
  const inPreTag = state.depthMap[TAG_PRE] > 0

  // For non-pre tags, we want to preserve the text but collapse whitespace
  if (!inPreTag && !containsNonWhitespace && !state.currentNode.childTextNodeIndex) {
    return
  }

  let text = textBuffer
  // Early exit for empty text
  if (text.length === 0) {
    return
  }
  const parentsToIncrement = traverseUpToFirstBlockNode(state.currentNode)
  const firstBlockParent = parentsToIncrement[parentsToIncrement.length - 1]

  // Handle whitespace trimming
  if (containsWhitespace && !firstBlockParent?.childTextNodeIndex) {
    // Trim leading whitespace if this is the first text node after an opening tag
    let start = 0
    while (start < text.length && (inPreTag ? (text.charCodeAt(start) === 10 || text.charCodeAt(start) === 13) : isWhitespace(text.charCodeAt(start)))) {
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
  }

  for (const parent of parentsToIncrement) {
    parent.childTextNodeIndex = (parent.childTextNodeIndex || 0) + 1
  }

  handleEvent({ type: NodeEventEnter, node: textNode })
  // Note: no exit event for text nodes, as they are not closed

  // Keep track of the last text node for trailing whitespace trimming
  state.lastTextNode = textNode
}

/**
 * Process HTML closing tag with optimized string operations
 * Handles malformed HTML by attempting to find matching parent tags
 * Returns result indicating if tag was completely processed
 */
function processClosingTag(
  htmlChunk: string,
  position: number,
  state: MdreamProcessingState,
  handleEvent: (event: NodeEvent) => void,
): {
    complete: boolean
    newPosition: number
    remainingText: string
  } {
  let i = position + 2 // Skip past '</'
  const tagNameStart = i
  const chunkLength = htmlChunk.length

  //  Fast scan for end of tag name
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
    // Incomplete closing tag - process in next chunk
    return {
      complete: false,
      newPosition: position,
      remainingText: htmlChunk.substring(position),
    }
  }
  // try and recover from malformed HTML
  const tagName = htmlChunk.substring(tagNameStart, i).toLowerCase()
  const tagId = TagIdMap[tagName] || -1 // match only unsupported tags

  if (state.currentNode?.tagHandler?.isNonNesting && tagId !== state.currentNode.tagId) {
    return {
      complete: false,
      newPosition: position,
      remainingText: htmlChunk.substring(position),
    }
  }

  // need to do a while loop to find the parent node that we're closing as we may have malformed html
  let curr: ElementNode | null | undefined = state.currentNode // <span>
  if (curr) {
    let match = curr.tagId !== tagId
    while (curr && match) { // closing <h2>
      closeNode(curr, state, handleEvent)
      curr = curr.parent
      match = curr?.tagId !== tagId
    }
  }

  // Process the closing tag
  if (curr) {
    // we need to close all of the parent nodes we walked
    closeNode(state.currentNode, state, handleEvent)
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
 * Special handling for empty links to ensure they render properly
 * Updates depth map and state tracking for minimal/unsupported nodes
 */
function closeNode(node: ElementNode | null, state: MdreamProcessingState, handleEvent: (event: NodeEvent) => void): void {
  if (!node) {
    return
  }
  if (node.tagId === TAG_A && !node.childTextNodeIndex) {
    // maybe emit a text node if we found no content
    const prefix = node.attributes?.title || node.attributes?.['aria-label'] || ''
    if (prefix) {
      node.childTextNodeIndex = 1
      const textNode = {
        type: TEXT_NODE,
        value: prefix,
        parent: node,
        index: 0,
        depth: node.depth + 1,
      }
      // @ts-expect-error untyped
      handleEvent({ type: NodeEventEnter, node: textNode })
      for (const parent of traverseUpToFirstBlockNode(node)) {
        parent.childTextNodeIndex = (parent.childTextNodeIndex || 0) + 1
      }
    }
    else {
      // TODO maybe can remove the fragment
    }
  }

  if (node.tagId) {
    state.depthMap[node.tagId] = Math.max(0, state.depthMap[node.tagId] - 1)
  }

  // Depth handling now managed by plugins

  state.depth--
  handleEvent({ type: NodeEventExit, node })
  state.currentNode = state.currentNode!.parent!
  state.hasEncodedHtmlEntity = false
  state.justClosedTag = true
}

/**
 * Process HTML comment or doctype declarations
 * Efficiently skips these elements as they don't appear in markdown output
 * Returns completion status and position information
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
 * Process HTML opening tag and create node events
 * Handles tag attributes, self-closing tags, and nested element tracking
 * Implements special processing for minimal mode and unsupported tags
 */
function processOpeningTag(
  tagName: string,
  tagId: number,
  htmlChunk: string,
  i: number,
  state: MdreamProcessingState,
  handleEvent: (event: NodeEvent) => void,
): {
    complete: boolean
    newPosition: number
    remainingText: string
    selfClosing: boolean
    skip?: boolean
  } {
  // Check if the current element is a non-nesting tag that needs closing
  if (state.currentNode?.tagHandler?.isNonNesting) {
    closeNode(state.currentNode, state, handleEvent)
  }

  // Get tag handler for this tag
  const tagHandler = tagHandlers[tagId]

  // Process attributes and tag properties
  const result = processTagAttributes(htmlChunk, i, tagHandler)

  if (!result.complete) {
    return {
      complete: false,
      newPosition: i,
      remainingText: `<${tagName}${result.attrBuffer}`,
      selfClosing: false,
    }
  }

  // Fast increment depth tracking with Uint8Array
  const currentTagCount = state.depthMap[tagId]
  state.depthMap[tagId] = currentTagCount + 1
  state.depth++

  i = result.newPosition

  // Node flags now managed by plugins

  if (state.currentNode) {
    state.currentNode.currentWalkIndex = state.currentNode.currentWalkIndex || 0
  }
  // Create the node with pre-computed values
  const currentWalkIndex = state.currentNode ? state.currentNode.currentWalkIndex!++ : 0

  const tag: Node = {
    type: ELEMENT_NODE,
    name: tagName,
    attributes: result.attributes,
    parent: state.currentNode,
    depthMap: copyDepthMap(state.depthMap),
    depth: state.depth,
    index: currentWalkIndex,
    tagId,
    tagHandler,
  }
  state.lastTextNode = tag

  // Run process attributes hooks for tag if it's an ElementNode
  if (state.options?.plugins) {
    runProcessAttributesHooks(tag as ElementNode, state as MdreamRuntimeState)
  }

  handleEvent({ type: NodeEventEnter, node: tag })

  // Directly set as parent node
  const parentNode = tag as ElementNode
  parentNode.currentWalkIndex = 0
  state.currentNode = parentNode
  state.hasEncodedHtmlEntity = false

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
 * Optimized for performance with minimal string operations
 * Handles both quoted and unquoted attribute values
 */
function processTagAttributes(htmlChunk: string, position: number, tagHandler: Node['tagHandler']): {
  complete: boolean
  newPosition: number
  attributes: Record<string, string>
  selfClosing: boolean
  attrBuffer: string
} {
  // For tags that use attributes, do full processing
  let i = position
  const chunkLength = htmlChunk.length

  const selfClosing = tagHandler?.isSelfClosing || false
  const attrStartPos = i
  let insideQuote = false
  let quoteChar = 0

  // Find the end of tag
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
  state.fragmentCount = 0
  state.depthMap ??= new Uint8Array(MAX_TAG_ID)

  // Initialize plugins if available
  initializePlugins(state as MdreamRuntimeState)

  state.fragments = []
  function handleEvent(event: NodeEvent) {
    if (event.type === NodeEventEnter) {
      // Track when we enter the body tag
      if (!state.enteredBody && event.node.tagId === TAG_BODY) {
        state.enteredBody = true
      }
    }

    runBeforeNodeProcessHooks(event.node, state)

    // Fast path for text nodes
    if (event.node.type === TEXT_NODE) {
      // @ts-expect-error untyped
      processHtmlEventToMarkdown(event, state)
      return
    }

    // @ts-expect-error untyped
    processHtmlEventToMarkdown(event, state)
  }
  // Parse HTML into a DOM tree with events
  // @ts-expect-error untyped
  const unprocessedHtml = parseHTML(partialHtml, state, handleEvent)

  state.fragmentCount += state.fragments.length

  // Run finish hooks for all plugins if there's no more unprocessed HTML
  // This indicates we're done with the document
  if (!unprocessedHtml && state.plugins?.length) {
    const result: Record<string, any> = {}

    for (const plugin of state.plugins) {
      if (plugin.finish) {
        const finishResult = plugin.finish(state as MdreamRuntimeState)
        if (finishResult) {
          Object.assign(result, finishResult)
        }
      }
    }

    if (Object.keys(result).length) {
      // Apply finish results to state
      Object.assign(state, result)
    }
  }

  return { chunk: state.fragments.join(''), remainingHTML: unprocessedHtml }
}
