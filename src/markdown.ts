import type { HandlerContext, MdreamRuntimeState, Node, NodeEvent } from './types.ts'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  NO_SPACING,
  NodeEventEnter,
  TAG_BLOCKQUOTE,
  TAG_LI,
  TAG_PRE,
  TEXT_NODE,
} from './const.ts'

/**
 * Process a node event and generate markdown
 */
export function processHtmlEventToMarkdown(
  event: NodeEvent,
  state: MdreamRuntimeState,
): void {
  const fragments = state.fragments
  const totalFragments = fragments.length + state.fragmentCount
  const { type: eventType, node } = event

  // Handle text nodes
  if (node.type === TEXT_NODE && eventType === NodeEventEnter && node.value) {
    state.lastNewLines = 0
    if (node.value) {
      state.currentLine++
      fragments.push(node.value)
    }
    state.lastTextNode = node
    return
  }

  if (node.type !== ELEMENT_NODE) {
    return
  }

  // Handle element nodes
  const context: HandlerContext = { node, state }
  const output = []
  const lastFragment = fragments.length ? fragments[fragments.length - 1] : ''

  // TODO find a solution
  // if (!node.parentNode?.depthMap.pre && !state.lastNewLines && node.parentNode?.childTextNodeIndex > 0) {
  //   // if we're closing an element which had text content, we need to add a space
  //   if (eventType === NodeEventEnter && node.parentNode && elementName === 'a') {
  //     if (lastFragment && lastFragment.at(-1) !== ' ') {
  //       output.push(' ')
  //       console.log('adding space for node', node)
  //     }
  //   }
  // }

  const eventFn = eventType === NodeEventEnter ? 'enter' : 'exit'
  // Use the cached tag handler directly from the node
  const handler = node.tagHandler
  if (handler?.[eventFn]) {
    const res = handler[eventFn](context)
    if (res) {
      output.push(res)
    }
  }

  // Trim trailing whitespace from the last text node
  if (!state.lastNewLines && fragments.length && state.lastTextNode?.containsWhitespace && !!node.parent && typeof state.lastTextNode?.value === 'string') {
    if (!node.parent.depthMap[TAG_PRE] || node.parent.tagId === TAG_PRE) {
      fragments[fragments.length - 1] = lastFragment!.trimEnd()
      state.lastTextNode = undefined
    }
  }

  // Handle newlines
  const newLineConfig = calculateNewLineConfig(node)
  let newLines = newLineConfig[eventType] || 0

  if (newLines > 0) {
    // Initialize lastNewLines if undefined
    state.lastNewLines ??= 0

    // Adjust count based on existing newlines
    newLines = Math.max(0, newLines - state.lastNewLines)

    // Handle enter events with content
    if (eventType === NodeEventEnter && output.length) {
      state.lastNewLines = 0
    }
    if (newLines > 0) {
      if (!totalFragments) {
        fragments.push(...output)
        return
      }
      // Update state for non-enter events
      if (eventType !== NodeEventEnter || !output.length) {
        state.lastNewLines = newLines
      }

      // Add newlines
      const newlinesStr = '\n'.repeat(newLines)
      // trim only whitespace
      if (lastFragment.at(-1) === ' ') {
        fragments[fragments.length - 1] = lastFragment.substring(0, lastFragment.length - 1)
      }
      if (eventType === NodeEventEnter) {
        output.unshift(newlinesStr)
      }
      else {
        output.push(newlinesStr)
      }
    }
  }
  else {
    state.lastNewLines = 0
  }

  fragments.push(...output)
}

/**
 * Calculate newline configuration based on tag handler spacing config
 */
function calculateNewLineConfig(node: Node): readonly [number, number] {
  const tagId = node.tagId
  const depthMap = node.depthMap

  // Adjust for list items and blockquotes
  if ((tagId !== TAG_LI && depthMap[TAG_LI] > 0)
    || (tagId !== TAG_BLOCKQUOTE && depthMap[TAG_BLOCKQUOTE] > 0)) {
    return NO_SPACING
  }

  // Adjust for inline elements
  let currParent = node.parent
  while (currParent) {
    if (currParent.tagHandler?.collapsesInnerWhiteSpace) {
      return NO_SPACING
    }
    currParent = currParent.parent
  }
  if (node.tagHandler?.spacing) {
    return node.tagHandler?.spacing
  }
  return DEFAULT_BLOCK_SPACING
}
