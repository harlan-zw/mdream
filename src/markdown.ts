import type { ElementNode, HandlerContext, MdreamRuntimeState, NodeEvent, TextNode } from './types'
import { collectNodeContent } from './buffer-region'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  NO_SPACING,
  NodeEventEnter,
  TAG_BLOCKQUOTE,
  TAG_LI,
  TAG_PRE,
  TEXT_NODE,
} from './const'

/**
 * Process text node with plugin hooks
 */
function processTextNodeWithPlugins(node: TextNode, state: MdreamRuntimeState): { content: string, skip: boolean } | undefined {
  if (!state.plugins?.length)
    return undefined

  for (const plugin of state.plugins) {
    if (!plugin.processTextNode)
      continue

    const result = plugin.processTextNode(node, state)
    if (result) {
      if (result.skip)
        return result
      return { content: result.content, skip: false }
    }
  }

  return undefined
}

/**
 * Process a node event and generate markdown
 */
export function processHtmlEventToMarkdown(
  event: NodeEvent,
  state: MdreamRuntimeState,
): void {
  const { type: eventType, node } = event

  // Handle text nodes
  if (node.type === TEXT_NODE && eventType === NodeEventEnter) {
    const textNode = node as TextNode
    state.lastNewLines = 0
    if (textNode.value) {
      // Process text node with plugins
      if (state.plugins?.length) {
        const pluginResult = processTextNodeWithPlugins(textNode, state)

        if (pluginResult) {
          if (pluginResult.skip) {
            return
          }
          textNode.value = pluginResult.content
        }
      }
      collectNodeContent(textNode, textNode.value, state)
    }
    state.lastTextNode = textNode
    return
  }

  if (node.type !== ELEMENT_NODE) {
    return
  }

  // Handle element nodes
  const context: HandlerContext = { node: node as ElementNode, state }
  const output = []
  // Get last content from buffer regions
  const lastFragment = state.lastContentCache

  // Run plugin hooks for node events
  if (state.plugins?.length) {
    const results = []
    const fn = eventType === NodeEventEnter ? 'onNodeEnter' : 'onNodeExit'
    for (const plugin of state.plugins) {
      if (!plugin[fn])
        continue
      const result = plugin[fn](event.node as ElementNode, state)
      if (result) {
        results.push(result)
      }
    }
    output.push(...results)
  }

  const eventFn = eventType === NodeEventEnter ? 'enter' : 'exit'
  // Use the cached tag handler directly from the node
  const handler = node.tagHandler
  if (!output.length && handler?.[eventFn]) {
    const res = handler[eventFn](context)
    if (res) {
      output.push(res)
    }
  }

  // Trim trailing whitespace from the last text node
  if (!state.lastNewLines && lastFragment && state.lastTextNode?.containsWhitespace && !!node.parent && 'value' in state.lastTextNode && typeof state.lastTextNode.value === 'string') {
    if (!node.parent.depthMap[TAG_PRE] || node.parent.tagId === TAG_PRE) {
      const originalLength = lastFragment.length
      const trimmed = lastFragment.trimEnd()
      const trimmedChars = originalLength - trimmed.length

      // Update the last content in buffer regions with trimmed content
      if (trimmedChars > 0) {
        for (const buffer of Array.from(state.regionContentBuffers.values())) {
          if (buffer.length > 0 && buffer[buffer.length - 1] === lastFragment) {
            buffer[buffer.length - 1] = trimmed
            break
          }
        }
      }

      state.lastTextNode = undefined
    }
  }

  // Handle newlines
  const newLineConfig = calculateNewLineConfig(node as ElementNode)
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
      if (!state.regionContentBuffers.get(event.node.regionId || 0)?.length) {
        for (const fragment of output) {
          collectNodeContent(node, fragment, state)
        }
        return
      }
      // Update state for non-enter events
      if (eventType !== NodeEventEnter || !output.length) {
        state.lastNewLines = newLines
      }

      // Add newlines
      const newlinesStr = '\n'.repeat(newLines)
      // trim only whitespace
      if (lastFragment && typeof lastFragment === 'string' && lastFragment.length > 0) {
        const lastChar = lastFragment.charAt(lastFragment.length - 1)
        if (lastChar === ' ') {
          // Update the last content in buffer regions with trimmed content
          for (const buffer of Array.from(state.regionContentBuffers.values())) {
            if (buffer.length > 0 && buffer[buffer.length - 1] === lastFragment) {
              buffer[buffer.length - 1] = lastFragment.substring(0, lastFragment.length - 1)
              break
            }
          }
        }
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

  // Calculate total length of output fragments before adding to the main fragments
  for (const fragment of output) {
    collectNodeContent(node, fragment, state)
  }
}

/**
 * Calculate newline configuration based on tag handler spacing config
 */
function calculateNewLineConfig(node: ElementNode): readonly [number, number] {
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
