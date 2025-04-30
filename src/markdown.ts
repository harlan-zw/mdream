import type { DownstreamState, HandlerContext, NodeEvent } from './types.ts'
import { ELEMENT_NODE, INLINE_ELEMENTS, NEW_LINE_CONFIG, TEXT_NODE } from './const.ts'
import { tagHandlers } from './tags.ts'
import { decodeHTMLEntities, escapeMarkdownCodeBlock, isNodeInStack, trimNewLines, trimWhitespace } from './utils.ts'

/**
 * Process a node event and generate markdown
 */
export function processNodeEventToMarkdown(
  event: NodeEvent,
  state: DownstreamState,
): string | undefined {
  const { type: eventType, node } = event
  const elementName = node.name || ''

  if (node.type === TEXT_NODE && eventType === 'enter') {
    const parent = node.parentNode
    // don't start emitting until we have a valid parent
    if (!parent || ['style', 'script', 'noscript'].includes(parent!.name || '')) {
      return
    }

    let v = decodeHTMLEntities(node.value || '')

    // some elements don't support new lines
    if (isNodeInStack(state, 'a')) {
      // strip all new lines
      v = trimWhitespace(v.replace(/\n/g, ''))
    }
    const inPre = isNodeInStack(state, 'pre')

    if (!inPre) {
      // Trim whitespace for block elements
      v = trimNewLines(v)
    }
    // if its the first children trim start
    if (parent.children && parent.children[0] === node) {
      v = v.trimStart()
    }
    // we can't know this, we'd need to do it in the exit event of the parent
    else if (parent.complete && parent.children && parent.children[parent.children.length - 1] === node) {
      v = v.trimEnd()
    }

    // Special handling for code blocks
    const inCodeBlock = isNodeInStack(state, 'code') && inPre

    if (inCodeBlock) {
      // Escape backticks in code blocks
      v = escapeMarkdownCodeBlock(v)
    }

    // Handle list structure
    if (parent?.type === ELEMENT_NODE && parent.name === 'li' && parent.children) {
      // Check if we need to add newline before nested list
      const nodeIndex = parent.children.findIndex(child => child === node)
      const nextSibling = nodeIndex < parent.children.length - 1 ? parent.children[nodeIndex + 1] : null

      if (nextSibling?.type === ELEMENT_NODE && (nextSibling.name === 'ul' || nextSibling.name === 'ol')) {
        return `${v.trimEnd()}\n`
      }
    }

    return v
  }

  if (node.type !== ELEMENT_NODE) {
    return
  }

  const context: HandlerContext = { node, state }
  // Get spacing config and adjust for nesting
  const newLineConfig = node.name in NEW_LINE_CONFIG ? NEW_LINE_CONFIG[node.name as keyof typeof NEW_LINE_CONFIG] : { enter: 2, exit: 2 }
  if (node.name !== 'li' && isNodeInStack(state, 'li')) {
    newLineConfig.enter = 0
    newLineConfig.exit = 0
  }
  else if (node.name !== 'blockquote' && isNodeInStack(state, 'blockquote')) {
    newLineConfig.enter = 0
    newLineConfig.exit = 0
  }
  else {
    for (const el of INLINE_ELEMENTS) {
      if (node.name === el || isNodeInStack(state, el)) {
        // No extra spacing inside links
        newLineConfig.enter = 0
        newLineConfig.exit = 0
        break
      }
    }
  }
  let v = tagHandlers[elementName]?.[eventType]?.(context) || ''
  const newLines = newLineConfig[eventType] || 0
  for (let i = 0; i < newLines; i++) {
    // if we're missing last chars we're at the start
    if (state.buffer && state.buffer[state.buffer.length - 1 - i] !== '\n') {
      v = eventType === 'enter' ? `\n${v}` : `${v}\n`
    }
  }
  return v
}
