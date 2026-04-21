import type { ParseState } from './parse'
import type { ElementNode, EngineOptions, HandlerContext, NodeEvent, PluginContext, TagHandler, TextNode, TransformPlugin } from './types'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  MAX_TAG_ID,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
  TAG_BLOCKQUOTE,
  TAG_DIV,
  TAG_H1,
  TAG_H6,
  TAG_LI,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_SPAN,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TEXT_NODE,
} from './const'
import { parseHtmlStream } from './parse'
import { processPluginsForEvent } from './plugin-processor'

export interface MarkdownState {
  /** Configuration options for conversion */
  options?: EngineOptions
  /** Content buffer for markdown output */
  buffer: string[]
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
  context?: PluginContext
  /**
   * Cumulative indent for list-item continuation. Grows by each ancestor
   * `<li>`'s marker width (`"- "` = 2, `"N. "` = digits(N) + 2) so code blocks
   * and continuation paragraphs land in the content column CommonMark requires.
   * Pushed on `<li>` enter, popped on `<li>` exit.
   */
  listIndent: string
  /** Per-`<li>` contribution widths, parallel stack to listIndent. */
  listIndentWidths: number[]
}

/**
 * Maintain the list-item indent stack. On `<li>` enter, push this item's
 * marker-width of spaces so subsequent continuation content (code blocks,
 * paragraphs, nested lists) lands in the correct column. On exit, pop.
 * Skip when the list item is rendered as literal `<li>` inside a table cell.
 */
function updateListIndent(state: MarkdownState, element: ElementNode, eventType: number): void {
  if (element.tagId !== TAG_LI)
    return
  if ((state.depthMap[TAG_TD] || 0) > 0 || (state.depthMap[TAG_TH] || 0) > 0)
    return
  if (eventType === NodeEventEnter) {
    const isOrdered = element.parent?.tagId === TAG_OL
    const width = isOrdered ? String(element.index + 1).length + 2 : 2
    state.listIndentWidths.push(width)
    state.listIndent += ' '.repeat(width)
  }
  else if (eventType === NodeEventExit) {
    const width = state.listIndentWidths.pop() ?? 0
    state.listIndent = state.listIndent.slice(0, state.listIndent.length - width)
  }
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
  if (lastChar === '|' && firstChar === '<' && state && (state.depthMap[TAG_TABLE] || 0) > 0) {
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
function shouldAddSpacingBeforeText(lastChar: string, lastNode: ElementNode | TextNode | undefined, textNode: TextNode): boolean {
  if (!lastChar || lastChar === '\n' || lastChar === ' ' || lastChar === '[' || lastChar === '>') {
    return false
  }
  if (lastNode?.tagHandler?.isInline) {
    return false
  }
  const firstChar = textNode.value[0]
  if (firstChar === ' ') {
    return false
  }
  // Skip spacing before punctuation (parity with Rust engine)
  if (firstChar === '.' || firstChar === ',' || firstChar === '!' || firstChar === '?'
    || firstChar === ':' || firstChar === ';' || firstChar === '_' || firstChar === '*'
    || firstChar === '`' || firstChar === ')' || firstChar === ']') {
    return false
  }
  return true
}

/**
 * Calculate newline configuration based on tag handler spacing config
 */
function calculateNewLineConfig(node: ElementNode): readonly [number, number] {
  const tagId = node.tagId
  const depthMap = node.depthMap

  // Adjust for list items and blockquotes
  if ((tagId !== TAG_LI && (depthMap[TAG_LI] || 0) > 0)
    || (tagId !== TAG_BLOCKQUOTE && (depthMap[TAG_BLOCKQUOTE] || 0) > 0)) {
    return NO_SPACING
  }

  // Adjust for inline elements
  // Block elements preserve spacing even inside span elements (presentational containers)
  // because spans shouldn't affect block-level semantics of their children
  const isBlockElement = tagId !== undefined && ((tagId >= TAG_H1 && tagId <= TAG_H6) || tagId === TAG_P || tagId === TAG_DIV)
  let currParent = node.parent
  while (currParent) {
    if (currParent.tagHandler?.collapsesInnerWhiteSpace) {
      // Exception: preserve block spacing when inside span (presentational wrapper)
      if (isBlockElement && currParent.tagId === TAG_SPAN) {
        currParent = currParent.parent
        continue
      }
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
export function createMarkdownProcessor(options: EngineOptions = {}, resolvedPlugins: TransformPlugin[] = [], tagOverrideHandlers?: Map<string, TagHandler>) {
  const state: MarkdownState = {
    options,
    buffer: [],
    depthMap: new Uint8Array(MAX_TAG_ID),
    listIndent: '',
    listIndentWidths: [],
  }

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
    const buff = state.buffer
    const lastBuffEntry = buff.at(-1)!
    const lastChar = lastBuffEntry?.charAt(lastBuffEntry.length - 1) || ''

    // Get second last character
    let secondLastChar
    if (lastBuffEntry && lastBuffEntry.length > 1) {
      secondLastChar = lastBuffEntry.charAt(lastBuffEntry.length - 2)
    }
    else if (buff.length > 1) {
      const prevBuff = buff[buff.length - 2]
      if (prevBuff) {
        secondLastChar = prevBuff.charAt(prevBuff.length - 1)
      }
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

        // Indent code block content when inside a list item so the fenced block
        // stays within the list item's content column. Only add indent to lines
        // that start at column 0 — preserves any existing indentation in the
        // HTML source and stays safe for text nodes that span stream chunks.
        if ((state.depthMap[TAG_PRE] || 0) > 0 && (state.depthMap[TAG_LI] || 0) > 0) {
          const indent = state.listIndent
          // Prepend list_indent on every non-blank line — CommonMark closes
          // the list item if any line is indented less than the content column,
          // so we add on top of any in-source indentation rather than skipping
          // lines that already start with whitespace.
          let value = textNode.value.replace(/\n(?!\n|$)/g, `\n${indent}`)
          // Prepend indent for first line if the previous buffer ended with a
          // newline (code fence opener). Blank first line stays blank.
          if (lastChar === '\n' && value[0] && value[0] !== '\n') {
            value = indent + value
          }
          textNode.value = value
        }

        state.buffer.push(textNode.value)
        state.lastContentCache = textNode.value
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
      // If the buffer has no content, add the current content (without new lines)
      if (!buff.length) {
        for (const fragment of output) {
          if (fragment) {
            state.buffer.push(fragment)
            state.lastContentCache = fragment
          }
        }
        updateListIndent(state, element, eventType)
        return
      }

      // Add newlines
      const newlinesStr = '\n'.repeat(newLines)
      // Trim only whitespace
      if (lastChar === ' ' && buff?.length) {
        buff[buff.length - 1] = buff.at(-1)!.substring(0, buff.at(-1)!.length - 1)
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
              if (buff?.length && buff.at(-1) === lastFragment) {
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
      state.buffer.push(' ')
      state.lastContentCache = ' '
    }

    // Add all output fragments
    for (const fragment of output) {
      if (fragment) {
        state.buffer.push(fragment)
        state.lastContentCache = fragment
      }
    }

    updateListIndent(state, element, eventType)
  }

  /**
   * Process HTML string and generate events
   */
  function processHtml(html: string): void {
    const parseState: ParseState = {
      depthMap: state.depthMap,
      depth: 0,
      resolvedPlugins,
      tagOverrideHandlers,
    }

    parseHtmlStream(html, parseState, (event) => {
      processPluginsForEvent(event, resolvedPlugins, state, processEvent)
    })
  }

  /**
   * Get the final markdown output
   */
  function getMarkdown(): string {
    const result = state.buffer.join('').trimStart()
    state.buffer.length = 0
    return result.trimEnd()
  }

  /**
   * Get new markdown content since the last call (for streaming)
   */
  function getMarkdownChunk(): string {
    const currentContent = state.buffer.join('').trimStart()
    const newContent = currentContent.slice(lastYieldedLength)
    lastYieldedLength = currentContent.length
    // Consolidate buffer into a single entry to prevent retroactive
    // whitespace trimming from modifying already-yielded content.
    // The trim logic uses identity checks (buff.at(-1) === lastFragment),
    // so a consolidated string won't match individual fragment references.
    if (state.buffer.length > 1) {
      state.buffer.length = 0
      state.buffer.push(currentContent)
    }
    return newContent
  }

  return {
    processEvent,
    processHtml,
    getMarkdown,
    getMarkdownChunk,
    state,
  }
}
