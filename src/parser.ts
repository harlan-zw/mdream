import type { DownstreamState, Node, NodeEvent } from './types.ts'
import {
  COMMENT_NODE,
  ELEMENT_NODE,
  MINIMAL_EXCLUDE_ELEMENTS,
  NON_SUPPORTED_NODES,
  TEXT_NODE,
  VOID_TAGS,
} from './const.ts'
import { processNodeEventToMarkdown } from './markdown.ts'
import { findFirstOf } from './utils.ts'

// Tags that don't support nested tags - they should be automatically closed when a new tag opens
const NON_NESTING_TAGS = new Set([
  'title',
  'textarea',
  'style',
  'script',
  'noscript',
  'iframe',
  'noframes',
  'xmp',
  'plaintext',
  'option',
])

/**
 * Checks if a node is hidden based on common hiding techniques:
 * - aria-hidden="true"
 * - class containing "hidden"
 * - style containing "display: none"
 */
function isNodeHidden(node: Node): boolean {
  if (node.type !== ELEMENT_NODE || !node.attributes) {
    return false
  }

  // Check aria-hidden attribute
  if (node.attributes['aria-hidden'] === 'true') {
    return true
  }

  // Check for "hidden" class
  if (node.attributes.class
    && node.attributes.class.split(/\s+/).includes('hidden')) {
    return true
  }

  // Check for display:none in style attribute
  if (node.attributes.style
    && /display\s*:\s*none/i.test(node.attributes.style)) {
    return true
  }

  return false
}

/**
 * Parses a HTML chunk and returns a list of node events for traversal and any remaining unparsed HTML.
 * This allows handling partial HTML chunks in streaming scenarios.
 */
export function parseHTML(htmlChunk: string, prevEvents: Node[] = []): {
  events: NodeEvent[]
  partialHTML: string
} {
  const startNewEventsIdx = prevEvents.length
  const events: NodeEvent[] = prevEvents.map(event => ({ type: 'enter', node: event }))
  // find the LAST "enter" parent event
  let parentNode: Node | null = null

  // Check if we're currently inside a pre tag by examining previous events
  let insidePre = false
  for (let i = 0; i < prevEvents.length; i++) {
    const node = prevEvents[i]
    if (node.type === ELEMENT_NODE
      && node.name?.toLowerCase() === 'pre') {
      insidePre = true
    }
  }

  for (let i = prevEvents.length - 1; i >= 0; i--) {
    if (prevEvents[i] && prevEvents[i].type === ELEMENT_NODE) {
      parentNode = prevEvents[i]
      break
    }
  }
  let lastIndex = 0

  // Process chunk character by character
  let i = 0
  while (i < htmlChunk.length) {
    const currentChar = htmlChunk[i]

    // START or END TAG - process anything before it as text
    if (currentChar === '<') {
      // Process any text content before this tag
      if (lastIndex < i) {
        const text = htmlChunk.substring(lastIndex, i)
        // Check if parent is a <pre> tag to handle whitespace properly
        const isPreTag = insidePre || (parentNode && parentNode.name && parentNode.name.toLowerCase() === 'pre')
        // Only create text nodes for non-whitespace content or if inside a pre tag
        if ((text.trim().length || isPreTag) && parentNode) {
          const textNode: Node = {
            type: TEXT_NODE,
            value: text,
            parentNode,
            pre: isPreTag,
            complete: true,
          }
          if (parentNode?.children) {
            parentNode.children.push(textNode)
          }
          // Generate enter/exit events for text node
          events.push({ type: 'enter', node: textNode })
          events.push({ type: 'exit', node: textNode })
        }
        lastIndex = i // Update lastIndex to current position
      }

      // Look ahead to determine tag type
      if (i + 1 >= htmlChunk.length) {
        // Partial '<' at end of chunk
        break
      }

      const nextChar = htmlChunk[i + 1]

      // COMMENT or DOCTYPE
      if (nextChar === '!') {
        if (i + 3 < htmlChunk.length && htmlChunk.substring(i + 2, i + 4) === '--') {
          // Handle comment
          const commentEndIndex = htmlChunk.indexOf('-->', i + 4)
          if (commentEndIndex !== -1) {
            const commentText = htmlChunk.substring(i + 4, commentEndIndex)
            const commentNode: Node = {
              type: COMMENT_NODE,
              value: commentText,
              parentNode,
              pre: insidePre,
              complete: true,
            }

            if (parentNode?.children) {
              parentNode.children.push(commentNode)
            }

            // Generate enter/exit events for comment node
            events.push({ type: 'enter', node: commentNode })
            events.push({ type: 'exit', node: commentNode })

            i = commentEndIndex + 2
            lastIndex = i + 1
          }
          else {
            // Incomplete comment, keep what we've processed so far
            break
          }
        }
        else {
          // Handle doctype
          const doctypeEndIndex = htmlChunk.indexOf('>', i + 1)
          if (doctypeEndIndex !== -1) {
            i = doctypeEndIndex
            lastIndex = i + 1
          }
          else {
            // Incomplete doctype, keep what we've processed so far
            break
          }
        }
      }

      // CLOSING TAG
      else if (nextChar === '/') {
        const tagNameEndIndex = findFirstOf(htmlChunk, i + 2, ' >')
        if (tagNameEndIndex === -1) {
          // Incomplete closing tag, keep what we've processed so far
          break
        }

        const tagName = htmlChunk.substring(i + 2, tagNameEndIndex).toLowerCase() // Make case-insensitive
        const tagEndIndex = htmlChunk.indexOf('>', tagNameEndIndex)

        if (tagEndIndex === -1) {
          // Incomplete closing tag, keep what we've processed so far
          break
        }

        // Handle the closing tag - find matching parent
        let matchFound = false

        // Check if we're exiting a pre tag
        const isPre = tagName === 'pre'

        // First check if this closing tag matches our current parent
        if (parentNode && tagName === parentNode.name.toLowerCase()) {
          parentNode.complete = true
          // Generate exit event for the closing parent node
          events.push({ type: 'exit', node: parentNode })

          // Update insidePre flag if we're exiting a pre tag
          if (isPre) {
            insidePre = false
          }

          parentNode = parentNode.parentNode!
          matchFound = true
        }
        else if (parentNode) {
          // If not matching current parent, look up the parent chain
          // This helps handle malformed HTML properly
          let currentParent = parentNode
          const parentsToClose = []

          while (currentParent && !matchFound) {
            if (currentParent.name && currentParent.name.toLowerCase() === tagName) {
              matchFound = true

              // Close all intermediate nodes up to the matching parent
              for (let j = 0; j < parentsToClose.length; j++) {
                const parentToClose = parentsToClose[j]
                parentToClose.complete = true
                events.push({ type: 'exit', node: parentToClose })
              }

              // Close the matching parent
              currentParent.complete = true
              events.push({ type: 'exit', node: currentParent })

              // Update insidePre flag if we're exiting a pre tag
              if (isPre) {
                insidePre = false
              }

              // Set new parent to be the parent's parent
              parentNode = currentParent.parentNode || null
            }
            else {
              parentsToClose.push(currentParent)
              currentParent = currentParent.parentNode || null
            }
          }
        }

        // If no matching parent found, check existing events
        if (!matchFound) {
          // Look for a matching enter event in our current events
          for (let j = events.length - 1; j >= 0; j--) {
            const event = events[j]
            if (event && event.type === 'enter'
              && event.node.type === ELEMENT_NODE
              && event.node.name.toLowerCase() === tagName) {
              // Check if this node hasn't been closed yet
              let alreadyClosed = false
              for (let k = j + 1; k < events.length; k++) {
                if (events[k] && events[k].type === 'exit' && events[k].node === event.node) {
                  alreadyClosed = true
                  break
                }
              }

              if (!alreadyClosed) {
                // Found matching open tag that hasn't been closed, close it
                event.node.complete = true
                events.push({ type: 'exit', node: event.node })

                // Update insidePre flag if we're exiting a pre tag
                if (isPre) {
                  insidePre = false
                }

                matchFound = true
                break
              }
            }
          }
        }

        i = tagEndIndex
        lastIndex = i + 1
      }

      // OPENING TAG
      else {
        const tagNameEndIndex = findFirstOf(htmlChunk, i + 1, ' />')
        if (tagNameEndIndex === -1) {
          // Incomplete opening tag, keep what we've processed so far
          break
        }

        const tagName = htmlChunk.substring(i + 1, tagNameEndIndex).toLowerCase() // Make case-insensitive
        const tagEndIndex = htmlChunk.indexOf('>', tagNameEndIndex)

        if (tagEndIndex === -1) {
          // Incomplete opening tag, keep what we've processed so far
          break
        }

        // Check if the current parent is a non-nesting tag and needs to be closed
        if (parentNode && parentNode.name && NON_NESTING_TAGS.has(parentNode.name.toLowerCase())) {
          parentNode.complete = true
          // Auto-close the current parent before processing the new tag
          events.push({ type: 'exit', node: parentNode })
          parentNode = parentNode.parentNode || null
        }

        // Check if this is a pre tag
        const isPre = tagName === 'pre'

        // Update insidePre state if entering a pre tag
        if (isPre) {
          insidePre = true
        }

        // Process attributes and check for self-closing tag
        let attributes = {}
        let selfClosing = false

        // Improved self-closing tag detection to handle whitespace
        const contentBeforeEnd = htmlChunk.substring(tagNameEndIndex, tagEndIndex).trim()
        if (contentBeforeEnd.endsWith('/')) {
          selfClosing = true
        }

        // Also check if it's a known void tag
        if (VOID_TAGS.has(tagName)) {
          selfClosing = true
        }

        // Extract attributes if there are any
        if (tagEndIndex > tagNameEndIndex + 1) {
          let attrStr = htmlChunk.substring(tagNameEndIndex + 1, tagEndIndex).trim()
          // Remove trailing slash for self-closing tags
          if (attrStr.endsWith('/')) {
            attrStr = attrStr.slice(0, -1).trim()
          }
          attributes = parseAttributes(attrStr)
        }

        // Create the tag node
        const tag: Node = {
          type: ELEMENT_NODE,
          name: tagName.trim(),
          attributes,
          parentNode,
          children: [],
          pre: insidePre || isPre, // Set pre flag if this is a pre tag or we're inside one
          complete: false, // not complete until exit
        }

        if (parentNode?.children && !NON_SUPPORTED_NODES.has(tagName)) {
          parentNode.children.push(tag)
        }

        // Generate enter event for new tag
        events.push({ type: 'enter', node: tag })

        // If self-closing or void tag, immediately generate exit event
        if (selfClosing) {
          tag.complete = true
          events.push({ type: 'exit', node: tag })

          // If this is a self-closing pre tag, reset insidePre
          if (isPre) {
            insidePre = false
          }
        }
        else {
          // Make the new tag the parent
          parentNode = tag
        }

        i = tagEndIndex
        lastIndex = i + 1
      }
    }
    else {
      // Regular character, continue
      i++
    }
  }

  // Return the remaining unprocessed HTML and any state information
  // This will be used in the next chunk processing
  const partialHTML = lastIndex < htmlChunk.length ? htmlChunk.substring(lastIndex) : ''

  return {
    events: events.slice(startNewEventsIdx),
    partialHTML,
  }
}

/**
 * Parse HTML attributes string into a key-value object
 * Optimized version that avoids unnecessary regex calls in a loop
 */
export function parseAttributes(attrStr: string): Record<string, string> {
  if (!attrStr)
    return {}

  const result: Record<string, string> = {}
  let i = 0

  // Skip leading whitespace
  while (i < attrStr.length && /\s/.test(attrStr[i])) i++

  while (i < attrStr.length) {
    // Find attribute name
    const nameStart = i

    // Read until we hit a space, equals, or end
    while (
      i < attrStr.length
      && attrStr[i] !== '='
      && attrStr[i] !== ' '
      && attrStr[i] !== '\t'
      && attrStr[i] !== '\n'
    ) {
      i++
    }

    // If we found a name
    if (i > nameStart) {
      const name = attrStr.substring(nameStart, i).toLowerCase() // Make attribute names case-insensitive
      let value = ''

      // Skip whitespace
      while (i < attrStr.length && /\s/.test(attrStr[i])) i++

      // If we have an equals sign, parse the value
      if (i < attrStr.length && attrStr[i] === '=') {
        i++ // Skip equals

        // Skip whitespace
        while (i < attrStr.length && /\s/.test(attrStr[i])) i++

        // Check for quoted value
        if (i < attrStr.length && (attrStr[i] === '"' || attrStr[i] === '\'')) {
          const quote = attrStr[i]
          const valueStart = ++i // Skip opening quote

          // Find closing quote - improved handling of escaped quotes
          let escaped = false
          while (i < attrStr.length) {
            if (escaped) {
              escaped = false
            }
            else if (attrStr[i] === '\\') {
              escaped = true
            }
            else if (attrStr[i] === quote) {
              break
            }
            i++
          }

          if (i < attrStr.length) {
            value = attrStr.substring(valueStart, i)
            i++ // Skip closing quote
          }
        }
        // Unquoted value
        else {
          const valueStart = i

          // Read until whitespace or end
          while (
            i < attrStr.length
            && !/\s/.test(attrStr[i])
            && attrStr[i] !== '>'
          ) {
            i++
          }

          value = attrStr.substring(valueStart, i)
        }
      }

      // Store the attribute
      result[name] = value
    }

    // Skip whitespace to the next attribute
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++
  }

  return result
}

/**
 * Stream HTML to Markdown conversion
 */
export function processPartialHTMLToMarkdown(
  partialHtml: string,
  state: Partial<DownstreamState> = {},
): { chunk: string, remainingHTML: string } {
  const chunkSize = state?.options?.chunkSize || 4096

  // Initialize state if not already present
  state.nodeStack = state.nodeStack || []
  state.buffer = state.buffer || ''
  if (!state.buffer && partialHtml.startsWith('<!')) {
    // If the first chunk is a DOCTYPE, we need to skip it
    state.processingHTMLDocument = true
    // Initialize flag for tracking if we've seen a header tag
    state.hasSeenHeader = false
    // Initialize flag for tracking if we're inside the body tag
    state.isInBody = false
  }
  state.options = state.options || {
    chunkSize,
  }

  // Parse HTML into a DOM tree with events
  const { events, partialHTML } = parseHTML(partialHtml, state.nodeStack || [])

  // Process events from the parser
  state.isInSupportedNode = typeof state.isInSupportedNode === 'boolean' ? state.isInSupportedNode : true

  let chunk = ''
  for (const event of events) {
    let fragment: string | undefined
    if (state.isInSupportedNode) {
      if (event.type === 'enter' && event.node.type === ELEMENT_NODE) {
        const tagName = event.node.name.toLowerCase()

        // Track when we enter the body tag
        if (state.processingHTMLDocument && tagName === 'body') {
          state.isInBody = true
        }

        // Check if this is a header tag inside body and we're processing an HTML document
        if (state.processingHTMLDocument && state.isInBody && !state.hasSeenHeader) {
          if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3'
            || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
            state.hasSeenHeader = true
          }
        }

        // Check if the node is hidden and mark it
        event.node.hidden = isNodeHidden(event.node)

        const supported = !NON_SUPPORTED_NODES.has(event.node.name) && (
          !state.processingHTMLDocument || !MINIMAL_EXCLUDE_ELEMENTS.has(event.node.name)
        )

        // For element nodes, track the depth by pushing onto the stack
        if (supported) {
          // Store the current depth on the node for reference when exiting
          event.node.depth = state.nodeStack.length
        }
        else {
          // Mark as unsupported
          state.isInSupportedNode = false
          // Store the unsupported node for precise exit matching
          state.unsupportedNode = event.node
        }

        // If this node is hidden, treat it like an unsupported node
        if (event.node.hidden) {
          state.isInSupportedNode = false
          state.unsupportedNode = event.node
        }

        state.nodeStack.push(event.node)

        if (!state.isInSupportedNode) {
          continue
        }

        fragment = processNodeEventToMarkdown(event, state)
      }
      else if (event.type === 'exit' && event.node.type === ELEMENT_NODE) {
        // Track when we exit the body tag
        if (state.processingHTMLDocument && event.node.name.toLowerCase() === 'body') {
          state.isInBody = false
        }

        // When exiting a node, check if it's in our stack
        if (typeof event.node.depth === 'number') {
          // Pop all nodes from the stack until we reach the right depth
          while (state.nodeStack.length > event.node.depth) {
            state.nodeStack.pop()
          }

          fragment = processNodeEventToMarkdown(event, state)
        }
      }
      else {
        // Handle text nodes and other non-element nodes
        fragment = processNodeEventToMarkdown(event, state)
      }
    }
    else if (!state.isInSupportedNode
      && event.type === 'exit'
      && event.node.type === ELEMENT_NODE
      && event.node === state.unsupportedNode) {
      // We're exiting the exact unsupported/hidden node that disabled processing
      state.isInSupportedNode = true
      state.unsupportedNode = undefined
      state.nodeStack.pop()
    }

    if (fragment) {
      // Only add fragment to the output if:
      // - We're not processing an HTML document, or
      // - We are processing an HTML document but have seen a header tag
      const shouldAddToOutput = !state.processingHTMLDocument || state.hasSeenHeader

      if (shouldAddToOutput) {
        chunk += fragment
        state.buffer += fragment
      }
    }
  }

  // Yield any remaining content
  return { chunk, remainingHTML: partialHTML }
}
