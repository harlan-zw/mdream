import type { HandlerContext, MdreamRuntimeState, Node, NodeEvent } from './types.ts'
import { ELEMENT_NODE, INLINE_ELEMENTS, NodeEventEnter, TEXT_NODE } from './const.ts'
import { tagHandlers } from './tags.ts'

/**
 * Process a node event and generate markdown
 */
export function processHtmlEventToMarkdown(
  event: NodeEvent,
  state: MdreamRuntimeState,
  fragments: string[],
): void {
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
  const elementName = node.name || ''
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
  if ((elementName in tagHandlers) && tagHandlers[elementName]![eventFn]) {
    const res = tagHandlers[elementName][eventFn](context)
    if (res) {
      output.push(res)
    }
  }

  // Trim trailing whitespace from the last text node
  if (!state.lastNewLines && fragments.length && state.lastTextNode?.containsWhitespace && !!node.parentNode && typeof state.lastTextNode?.value === 'string') {
    if (!node.parentNode.depthMap.pre || node.parentNode.name === 'pre') {
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

const NoSpaces = [0, 0] as const
const DefaultBlockSpaces = [2, 2] as const

/**
 * Calculate newline configuration based on element context
 */
function calculateNewLineConfig(node: Node): readonly [number, number] {
  const elementName = node.name || ''
  if (elementName === 'head' || elementName === 'html' || elementName === 'body' || elementName === 'code') {
    return NoSpaces
  }

  const depthMap = node.depthMap

  // Adjust for list items and blockquotes
  if ((elementName !== 'li' && depthMap.li > 0)
    || (elementName !== 'blockquote' && depthMap.blockquote > 0)) {
    return NoSpaces
  }

  // Adjust for inline elements
  if (INLINE_ELEMENTS.includes(elementName)
    || INLINE_ELEMENTS.some(el => depthMap[el] > 0)) {
    return NoSpaces
  }

  switch (elementName) {
    case 'blockquote':
      return [1, 1]
    case 'li':
      return [1, 0]
    case 'tr':
    case 'thead':
    case 'tbody':
      return [0, 1]
  }
  return DefaultBlockSpaces
}
