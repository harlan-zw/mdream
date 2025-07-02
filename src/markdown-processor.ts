import type { ParseState } from './parse'
import type { ElementNode, HandlerContext, HTMLToMarkdownOptions, NodeEvent, TextNode } from './types'
import { assembleBufferedContent, collectNodeContent } from './buffer-region'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  MAX_TAG_ID,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
  TAG_BLOCKQUOTE,
  TAG_LI,
  TAG_PRE,
  TAG_TABLE,
  TEXT_NODE,
} from './const'
import { parseHtmlStream } from './parse'

export interface MarkdownState {
  /** Configuration options for conversion */
  options?: HTMLToMarkdownOptions
  /** Map of region IDs to buffer regions for O(1) lookups */
  regionToggles: Map<number, boolean>
  /** Content buffers for regions */
  regionContentBuffers: Map<number, string[]>
  /** Performance cache for last content to avoid iteration */
  lastContentCache?: string
  /** Reference to the last processed node */
  lastNode?: ElementNode | TextNode
  /** Reference to the last processed text node - for context tracking */
  lastTextNode?: TextNode
  /** Table processing state - specialized for Markdown tables */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]
  /** Map of tag names to their current nesting depth */
  depthMap: Uint8Array
  /** Current depth for plugin access */
  depth?: number
  /** Context for additional data */
  context?: Record<string, any>
}

/**
 * Determines if spacing is needed between two characters
 */
function needsSpacing(lastChar: string, firstChar: string, state?: MarkdownState): boolean {
  // Don't add space if last char is already a space or newline
  if (lastChar === ' ' || lastChar === '\n' || lastChar === '\t') {
    return false
  }

  // Don't add space if first char is a space or newline
  if (firstChar === ' ' || firstChar === '\n' || firstChar === '\t') {
    return false
  }

  // Special cases where we don't want spacing
  const noSpaceAfter = new Set(['[', '(', '>', '*', '_', '`'])
  const noSpaceBefore = new Set([']', ')', '<', '.', ',', '!', '?', ':', ';', '*', '_', '`'])

  // Special case: Allow spacing between pipe and HTML tags in table cells
  if (lastChar === '|' && firstChar === '<' && state && state.depthMap[TAG_TABLE] > 0) {
    return true
  }

  if (noSpaceAfter.has(lastChar) || noSpaceBefore.has(firstChar)) {
    return false
  }

  // For everything else, add spacing
  return true
}

/**
 * Determines if spacing should be added before text content
 */
function shouldAddSpacingBeforeText(lastChar: string, lastNode: any, textNode: TextNode): boolean {
  return lastChar
    && lastChar !== '\n'
    && lastChar !== ' '
    && lastChar !== '['
    && lastChar !== '>'
    && !lastNode?.tagHandler?.isInline
    && textNode.value[0] !== ' '
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

/**
 * Creates a markdown processor that consumes DOM events and generates markdown
 */
export function createMarkdownProcessor(options: HTMLToMarkdownOptions = {}) {
  const state: MarkdownState = {
    options,
    regionToggles: new Map(),
    regionContentBuffers: new Map(),
    depthMap: new Uint8Array(MAX_TAG_ID),
  }

  // Initialize default region
  state.regionToggles.set(0, true)
  state.regionContentBuffers.set(0, [])

  let lastYieldedLength = 0

  /**
   * Process a DOM event and generate markdown
   */
  function processEvent(event: NodeEvent): void {
    const { type: eventType, node } = event
    const lastNode = state.lastNode
    state.lastNode = event.node as ElementNode | TextNode

    // Update depth for plugin access
    state.depth = node.depth
    const buff = state.regionContentBuffers.get(node.regionId || 0) || []
    const lastBuffEntry = buff[buff.length - 1]
    const lastChar = lastBuffEntry?.charAt(lastBuffEntry.length - 1) || ''

    // Get second last character
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
        // Skip text nodes that are excluded from markdown output
        if (textNode.excludedFromMarkdown) {
          return
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

    // Add plugin outputs first
    const element = node as ElementNode
    if (element.pluginOutput?.length) {
      output.push(...element.pluginOutput)
      // Clear plugin outputs after using them
      element.pluginOutput = []
    }

    // Get last content from buffer regions
    const lastFragment = state.lastContentCache

    let lastNewLines = 0
    if (lastChar === '\n') {
      lastNewLines++
    }
    if (secondLastChar === '\n') {
      lastNewLines++
    }

    const eventFn = eventType === NodeEventEnter ? 'enter' : 'exit'
    const handler = node.tagHandler
    if (!output.length && handler?.[eventFn]) {
      const res = handler[eventFn](context)
      if (res) {
        output.push(res)
      }
    }

    // Handle newlines
    const newLineConfig = calculateNewLineConfig(node as ElementNode)
    const configuredNewLines = newLineConfig[eventType] || 0
    const newLines = Math.max(0, configuredNewLines - lastNewLines)

    if (newLines > 0) {
      // If the region has no content, add the current content (without new lines)
      if (!buff.length) {
        for (const fragment of output) {
          collectNodeContent(node, fragment, state)
        }
        return
      }

      // Add newlines
      const newlinesStr = '\n'.repeat(newLines)
      // Trim only whitespace
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
      // Only trim whitespace in specific cases where it's safe
      // Don't trim if we're about to add inline content that needs spacing
      // Don't trim before block elements that need their own spacing
      if (lastFragment && state.lastTextNode?.containsWhitespace && !!node.parent && 'value' in state.lastTextNode && typeof state.lastTextNode.value === 'string') {
        if (!node.parent.depthMap[TAG_PRE] || node.parent.tagId === TAG_PRE) {
          // Only trim if the next element is not an inline element that needs spacing
          // or if we're at the end of a block
          const isInlineElement = node.tagHandler?.isInline
          const collapsesWhiteSpace = node.tagHandler?.collapsesInnerWhiteSpace
          const hasSpacing = node.tagHandler?.spacing && Array.isArray(node.tagHandler.spacing)
          const isBlockElement = !isInlineElement && !collapsesWhiteSpace && configuredNewLines > 0
          // Don't trim before elements that have collapsesInnerWhiteSpace on enter
          // Also don't trim before block elements that have their own spacing configuration
          const shouldTrim = (!isInlineElement || eventType === NodeEventExit) && !isBlockElement && !(collapsesWhiteSpace && eventType === NodeEventEnter) && !(hasSpacing && eventType === NodeEventEnter)

          if (shouldTrim) {
            const originalLength = lastFragment.length
            const trimmed = lastFragment.trimEnd()
            const trimmedChars = originalLength - trimmed.length

            // Update the last content in buffer regions with trimmed content
            if (trimmedChars > 0) {
              if (buff?.length && buff[buff.length - 1] === lastFragment) {
                buff[buff.length - 1] = trimmed
              }
            }
          }

          state.lastTextNode = undefined
        }
      }
    }

    // Add spacing between inline elements if needed
    if (output[0]?.[0] && eventType === NodeEventEnter && lastChar && needsSpacing(lastChar, output[0][0], state)) {
      collectNodeContent(node, ' ', state)
    }

    // Add all output fragments
    for (const fragment of output) {
      collectNodeContent(node, fragment, state)
    }
  }

  /**
   * Process HTML string and generate events
   */
  function processHtml(html: string): void {
    const parseState: ParseState = {
      depthMap: state.depthMap,
      depth: 0,
      plugins: state.options?.plugins || [],
    }

    parseHtmlStream(html, parseState, (event) => {
      // Process plugins with full state access
      if (state.options?.plugins?.length) {
        for (const plugin of state.options.plugins) {
          const res = plugin.beforeNodeProcess?.(event, state)
          if (typeof res === 'object' && res.skip) {
            return
          }
        }

        // Run plugin hooks
        if (event.node.type === ELEMENT_NODE) {
          const element = event.node as ElementNode

          // Run processAttributes hook on element enter
          if (event.type === NodeEventEnter) {
            for (const plugin of state.options.plugins) {
              if (plugin.processAttributes) {
                plugin.processAttributes(element, state)
              }
            }
          }

          // Collect plugin hook outputs
          const fn = event.type === NodeEventEnter ? 'onNodeEnter' : 'onNodeExit'
          const pluginOutputs: string[] = []
          for (const plugin of state.options.plugins) {
            if (plugin[fn]) {
              const result = plugin[fn]!(element, state)
              if (result) {
                pluginOutputs.push(result)
              }
            }
          }

          // Store plugin outputs on the element for processing in processEvent
          if (pluginOutputs.length > 0) {
            element.pluginOutput = (element.pluginOutput || []).concat(pluginOutputs)
          }
        }
        else if (event.node.type === TEXT_NODE && event.type === NodeEventEnter) {
          const textNode = event.node as TextNode
          for (const plugin of state.options.plugins) {
            if (plugin.processTextNode) {
              const result = plugin.processTextNode(textNode, state)
              if (result) {
                if (result.skip) {
                  return // Skip this text node
                }
                if (result.content) {
                  textNode.value = result.content
                }
              }
            }
          }
        }
      }

      processEvent(event)
    })
  }

  /**
   * Get the final markdown output
   */
  function getMarkdown(): string {
    const assembledContent = assembleBufferedContent(state)
    return assembledContent.trimEnd()
  }

  /**
   * Get new markdown content since the last call (for streaming)
   */
  function getMarkdownChunk(): string {
    const fragments: string[] = []

    // Process all regions without clearing them
    for (const [regionId, content] of Array.from(state.regionContentBuffers.entries())) {
      const include = state.regionToggles.get(regionId)
      if (include) {
        fragments.push(...content)
      }
    }

    const currentContent = fragments.join('').trimStart()
    const newContent = currentContent.slice(lastYieldedLength)
    lastYieldedLength = currentContent.length

    return newContent
  }

  return {
    processEvent,
    processHtml,
    getMarkdown,
    getMarkdownChunk,
  }
}

// Keep backward compatibility with class-like interface
export const MarkdownProcessor = createMarkdownProcessor
