import type { HandlerContext, MdreamRuntimeState, Node, NodeEvent } from './types.ts'
import { ELEMENT_NODE, INLINE_ELEMENTS, NEW_LINE_CONFIG, TEXT_NODE } from './const.ts'
import { tagHandlers } from './tags.ts'

/**
 * Process a node event and generate markdown
 */
export function processHtmlEventToMarkdown(
  event: NodeEvent,
  state: MdreamRuntimeState,
): string | undefined {
  const { type: eventType, node } = event

  // Early return for nodes we should skip
  if (shouldSkipNode(node, state)) {
    return undefined
  }

  // Handle text nodes
  if (node.type === TEXT_NODE && eventType === 'enter') {
    return processTextNode(node, state)
  }

  // Handle element nodes
  if (node.type === ELEMENT_NODE) {
    return processElementNode(node, state, eventType)
  }

  return undefined
}

/**
 * Determine if a node should be skipped from processing
 */
function shouldSkipNode(node: Node, state: MdreamRuntimeState): boolean {
  return Boolean(node.unsupported)
    || Boolean(node.excluded && state.processingHTMLDocument && state.enteredBody)
    || Boolean(state.processingHTMLDocument && state.enteredBody && !state.hasSeenHeader)
}

/**
 * Process text nodes
 */
function processTextNode(node: Node, state: MdreamRuntimeState): string {
  state.lastNewLines = 0

  // Return text value directly for now
  // Additional processing can be added here when needed
  return node.value || ''
}

/**
 * Process element nodes
 */
function processElementNode(
  node: Node,
  state: MdreamRuntimeState,
  eventType: NodeEvent['type'],
): string {
  const elementName = node.name || ''
  const context: HandlerContext = { node, state }

  // Get handler output
  const handlerTable = tagHandlers[elementName]
  const handler = handlerTable?.[eventType]
  const handlerOutput = handler ? handler(context) || '' : ''

  // Handle newlines
  const newLineConfig = calculateNewLineConfig(node, elementName)
  const newLines = newLineConfig[eventType] || 0

  if (newLines > 0) {
    return addNewLines(handlerOutput, newLines, state, eventType)
  }

  state.lastNewLines = 0
  return handlerOutput
}

/**
 * Calculate newline configuration based on element context
 */
function calculateNewLineConfig(node: Node, elementName: string): { enter: number, exit: number } {
  // Start with default or element-specific config
  const config = elementName in NEW_LINE_CONFIG
    ? { ...NEW_LINE_CONFIG[elementName as keyof typeof NEW_LINE_CONFIG] }
    : { enter: 2, exit: 2 }

  const depthMap = node.depthMap

  // Adjust for list items and blockquotes
  if ((node.name !== 'li' && depthMap.li > 0)
    || (node.name !== 'blockquote' && depthMap.blockquote > 0)) {
    config.enter = 0
    config.exit = 0
    return config
  }

  // Adjust for inline elements
  if (INLINE_ELEMENTS.includes(node.name || '')
    || INLINE_ELEMENTS.some(el => depthMap[el] > 0)) {
    config.enter = 0
    config.exit = 0
  }

  return config
}

/**
 * Add newlines to string
 */
function addNewLines(
  content: string,
  count: number,
  state: MdreamRuntimeState,
  eventType: 'enter' | 'exit',
): string {
  // Early return if buffer is empty or no newlines needed
  if (!state.buffer.length) {
    return content
  }

  // Initialize lastNewLines if undefined
  state.lastNewLines ??= 0

  // Adjust count based on existing newlines
  count = Math.max(0, count - state.lastNewLines)

  // Handle enter events with content
  if (eventType === 'enter' && content) {
    state.lastNewLines = 0
  }

  // Return early if no newlines needed
  if (count <= 0) {
    return content
  }

  // Update state for non-enter events
  if (eventType !== 'enter' || !content) {
    state.lastNewLines = count
  }

  // Add newlines
  const newlines = '\n'.repeat(count)
  return eventType === 'enter' ? newlines + content : content + newlines
}
