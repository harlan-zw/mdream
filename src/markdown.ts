import type { ElementNode, HandlerContext, MdreamRuntimeState, NodeEvent, TextNode } from './types'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
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
  const fragments = state.fragments
  const totalFragments = fragments.length + state.fragmentCount
  const { type: eventType, node } = event

  // On node enter, set the starting Markdown position
  if (eventType === NodeEventEnter) {
    node.mdStart = state.currentMdPosition
  }

  // Handle text nodes
  if (node.type === TEXT_NODE && eventType === NodeEventEnter) {
    const textNode = node as TextNode
    state.lastNewLines = 0
    if (textNode.value) {
      state.currentLine++

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
      // Legacy tailwind formatting is handled by the plugin now
      // No need to add tailwindPrefix/Suffix here as the plugin already does it

      // Set mdLength for text nodes before adding to fragments
      textNode.mdExit = textNode.value.length

      // Update the running position counter
      state.currentMdPosition += textNode.value.length

      fragments.push(textNode.value)
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
  const lastFragment = fragments.length ? fragments[fragments.length - 1] : ''

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

  // Tailwind attributes are now handled by the tailwind plugin

  // if (!node.parentNode?.depthMap.pre && !state.lastNewLines && node.parentNode?.childTextNodeIndex > 0) {
  //   // if we're closing an element which had text content, we need to add a space
  //   if (eventType === NodeEventEnter && node.parentNode && elementName === 'a') {
  //     if (lastFragment && lastFragment.at(-1) !== ' ') {
  //       output.push(' ')
  //     }
  //   }
  // }

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
  if (!state.lastNewLines && fragments.length && state.lastTextNode?.containsWhitespace && !!node.parent && 'value' in state.lastTextNode && typeof state.lastTextNode.value === 'string') {
    if (!node.parent.depthMap[TAG_PRE] || node.parent.tagId === TAG_PRE) {
      const originalLength = lastFragment!.length
      const trimmed = lastFragment!.trimEnd()
      const trimmedChars = originalLength - trimmed.length

      // Update the fragment with trimmed content
      fragments[fragments.length - 1] = trimmed

      // Update position counters to reflect the trimmed characters
      if (trimmedChars > 0) {
        const currentPosition = state.currentMdPosition
        state.currentMdPosition -= trimmedChars

        if (state.lastTextNode && 'mdExit' in state.lastTextNode) {
          state.lastTextNode.mdExit -= trimmedChars
        }

        // Adjust all buffer markers if they exist
        if (state.bufferMarkers?.length) {
          for (let i = 0; i < state.bufferMarkers.length; i++) {
            // If the marker is at or beyond the trim point, adjust it
            // Markers exactly at the trim point should stay at the new position (after trim)
            // Markers beyond the trim point should move back by the trimmed amount
            if (state.bufferMarkers[i].position > currentPosition - trimmedChars) {
              state.bufferMarkers[i].position = Math.max(
                state.currentMdPosition,
                state.bufferMarkers[i].position - trimmedChars,
              )
            }
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
      if (!totalFragments) {
        // Calculate and add output length to position counter
        let outputLength = 0
        for (const fragment of output) {
          outputLength += fragment.length
        }
        state.currentMdPosition += outputLength

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
      if (lastFragment && typeof lastFragment === 'string' && lastFragment.length > 0) {
        const lastChar = lastFragment.charAt(lastFragment.length - 1)
        if (lastChar === ' ') {
          fragments[fragments.length - 1] = lastFragment.substring(0, lastFragment.length - 1)
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
  let outputLength = 0
  for (const fragment of output) {
    outputLength += fragment.length
    fragments.push(fragment)
  }

  // Update running position counter
  state.currentMdPosition += outputLength

  // On node exit, calculate the Markdown length using the running position counter
  if (eventType === NodeEventExit && node.mdStart !== undefined) {
    node.mdExit = state.currentMdPosition - node.mdStart
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
