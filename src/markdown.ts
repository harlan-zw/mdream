import type { ElementNode, HandlerContext, MdreamRuntimeState, NodeEvent, TextNode } from './types'

/**
 * Determines if spacing is needed between two characters
 */
function needsSpacing(lastChar: string, firstChar: string): boolean {
  const noSpaceLastChars = new Set(['\n', ' ', '[', '>', '_', '*', '`', '|', '#', '<', '('])
  const noSpaceFirstChars = new Set([' ', '\n', '\t', '_', '*', '`', '|', '>', '#'])
  
  return !noSpaceLastChars.has(lastChar) && !noSpaceFirstChars.has(firstChar)
}

/**
 * Determines if spacing should be added before text content
 */
function shouldAddSpacingBeforeText(lastChar: string, lastNode: any, textNode: TextNode): boolean {
  return lastChar && 
         lastChar !== '\n' && 
         lastChar !== ' ' && 
         lastChar !== '[' && 
         lastChar !== '>' && 
         !lastNode?.tagHandler?.isInline && 
         textNode.value[0] !== ' '
}
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
  const lastNode = state.lastNode
  state.lastNode = event.node
  const buff = state.regionContentBuffers.get(node.regionId || 0) || []
  const lastBuffEntry = buff[buff.length - 1]
  const lastChar = lastBuffEntry?.charAt(lastBuffEntry.length - 1) || ''
  // we need to see if it exists within buff[lastIndex] or buff[lastIndex - 1]
  let secondLastChar
  if (lastBuffEntry?.length > 1) {
    secondLastChar = lastBuffEntry.charAt(lastBuffEntry.length - 2)
  }
  else {
    secondLastChar = buff[buff.length - 2]?.charAt(buff[buff.length - 2].length - 1)
  }
  // Handle text nodes
  if (node.type === TEXT_NODE && eventType === NodeEventEnter) {
    const textNode = node as TextNode

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
      // Skip leading spaces after newlines
      if (textNode.value === ' ' && lastChar === '\n') {
        return
      }
      
      // Add spacing before text if needed
      if (shouldAddSpacingBeforeText(lastChar, lastNode, textNode)) {
        textNode.value = ` ${textNode.value}`
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

  let lastNewLines = 0
  if (lastChar === '\n') {
    lastNewLines++
  }
  if (secondLastChar === '\n') {
    lastNewLines++
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

  // Handle newlines
  const newLineConfig = calculateNewLineConfig(node as ElementNode)
  const newLines = Math.max(0, (newLineConfig[eventType] || 0) - lastNewLines)

  if (newLines > 0) {
    // if the region has no content, add the current content (without new lines)
    if (!buff.length) {
      for (const fragment of output) {
        collectNodeContent(node, fragment, state)
      }
      return
    }

    // Add newlines
    const newlinesStr = '\n'.repeat(newLines)
    // trim only whitespace
    if (lastChar === ' ' && buff?.length) {
      buff[buff.length - 1] = buff[buff.length - 1].substring(0, buff[buff.length - 1].length - 1)
    }

    if (eventType === NodeEventEnter) {
      output.unshift(newlinesStr)
    }
    else {
      output.push(newlinesStr)
    }
  }
  else {
    // trim whitespaced between inline output
    // Trim trailing whitespace from the last text node
    if (lastFragment && state.lastTextNode?.containsWhitespace && !!node.parent && 'value' in state.lastTextNode && typeof state.lastTextNode.value === 'string') {
      if (!node.parent.depthMap[TAG_PRE] || node.parent.tagId === TAG_PRE) {
        const originalLength = lastFragment.length
        const trimmed = lastFragment.trimEnd()
        const trimmedChars = originalLength - trimmed.length

        // Update the last content in buffer regions with trimmed content
        if (trimmedChars > 0) {
          if (buff?.length && buff[buff.length - 1] === lastFragment) {
            buff[buff.length - 1] = trimmed
          }
        }

        state.lastTextNode = undefined
      }
    }
  }

  // Add spacing between inline elements if needed
  if (output[0]?.[0] && eventType === NodeEventEnter && lastChar && needsSpacing(lastChar, output[0][0])) {
    collectNodeContent(node, ' ', state)
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
