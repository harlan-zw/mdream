import type { ParseState } from './parse'
import type { ElementNode, EngineOptions, HandlerContext, NodeEvent, PluginContext, TagHandler, TextNode, TransformPlugin } from './types'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  MARKDOWN_CODE_BLOCK,
  MAX_TAG_ID,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
  TAG_BLOCKQUOTE,
  TAG_CODE,
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
  /**
   * <pre> fenced-code deferral (issue #97). A bare <pre> (no <code> child)
   * becomes a fenced code block, but the opening fence is deferred until the
   * first non-whitespace content so empty/whitespace-only blocks emit nothing.
   * `preFencePending`: inside a <pre> whose fence is not yet decided.
   * `preFenceLang`: language resolved from the <pre>'s own class.
   * `preOwnFence`: the <pre> opened its own fence (so a nested <code> must not).
   */
  preFencePending?: boolean
  preFenceLang?: string
  preOwnFence?: boolean
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
 * Whether prose at the current position may be hard-wrapped. Code blocks
 * (`<pre>`/`<code>`), table cells, and headings are emitted verbatim so wrapping
 * never corrupts fences, table rows, or heading lines. Parity with the Rust
 * engine's `can_wrap_here`.
 */
function canWrapHere(depthMap: Uint8Array): boolean {
  if (depthMap[TAG_PRE] || depthMap[TAG_CODE] || depthMap[TAG_TD] || depthMap[TAG_TH]) {
    return false
  }
  for (let h = TAG_H1; h <= TAG_H6; h++) {
    if (depthMap[h])
      return false
  }
  return true
}

/**
 * Character count (code points) of the current unterminated output line, i.e.
 * since the last newline across the buffer chunks. Includes any block prefix
 * (`> `, list indent) already written for the line.
 */
function currentColumn(buffer: string[]): number {
  let col = 0
  for (let i = buffer.length - 1; i >= 0; i--) {
    const s = buffer[i]
    const nl = s.lastIndexOf('\n')
    if (nl >= 0) {
      return col + [...s.slice(nl + 1)].length
    }
    col += [...s].length
  }
  return col
}

/**
 * Continuation prefix re-emitted at the start of each wrapped line so wrapped
 * text stays inside its block context (blockquote markers + list indentation).
 */
function wrapContinuationPrefix(state: MarkdownState): string {
  let p = ''
  const bq = state.depthMap[TAG_BLOCKQUOTE] || 0
  for (let i = 0; i < bq; i++) {
    p += '> '
  }
  p += state.listIndent
  return p
}

/**
 * Hard-wrap `value` on spaces so no output line exceeds `width` code points.
 * Words are never split, so an oversized token (e.g. a URL) overflows rather
 * than breaking, and a break only ever replaces an inter-word space. `value`
 * already carries any significant leading/trailing space (added upstream), so
 * those boundary spaces are preserved. Parity with the Rust `push_text_wrapped`.
 */
function wrapText(value: string, col: number, width: number, prefix: string): string {
  const leading = value.charCodeAt(0) === 32
  const trailing = value.charCodeAt(value.length - 1) === 32
  const prefixLen = [...prefix].length
  let out = ''
  let first = true
  let i = 0
  const len = value.length
  while (i < len) {
    // Manual split on single spaces to avoid an intermediate array allocation.
    let next = value.indexOf(' ', i)
    if (next === -1)
      next = len
    if (next > i) {
      const word = value.slice(i, next)
      const wordLen = [...word].length
      const needSpace = first ? leading : true
      if (needSpace && col > prefixLen && col + 1 + wordLen > width) {
        out += `\n${prefix}`
        col = prefixLen
      }
      else if (needSpace) {
        out += ' '
        col += 1
      }
      out += word
      col += wordLen
      first = false
    }
    i = next + 1
  }
  if (trailing && out !== '' && !out.endsWith(' ') && !out.endsWith('\n')) {
    out += ' '
  }
  // Whitespace-only value collapses to a single separator space.
  if (out === '' && (leading || trailing)) {
    out = ' '
  }
  return out
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
  // Truly unknown tags (no dictionary entry) default to inline zero spacing so
  // they don't fragment surrounding paragraphs. Built-in tags without a handler
  // (e.g. caption) keep block-default. Applies whether or not an override
  // handler is attached — overrides set isInline but inherit zero spacing.
  if (tagId === -1) {
    return NO_SPACING
  }
  return DEFAULT_BLOCK_SPACING
}

/**
 * Whether a string contains any non-whitespace character (space, tab, CR, LF).
 * Used to decide if a <pre>'s content warrants opening a fenced code block.
 */
function hasNonWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) {
      return true
    }
  }
  return false
}

/**
 * Emit a bare <pre>'s opening code fence (issue #97). Mirrors the <code>-in-<pre>
 * enter formatting in tags.ts: indented and newline-padded inside a list item,
 * otherwise a plain ```lang opener. Marks the <pre> as owning the fence so a
 * nested <code> does not double up and the <pre> exit emits the closing fence.
 */
function flushPreFence(state: MarkdownState): void {
  state.preFencePending = false
  state.preOwnFence = true
  const lang = state.preFenceLang || ''
  const liDepth = state.depthMap[TAG_LI] || 0
  const fence = liDepth > 0
    ? `\n\n${state.listIndent}${MARKDOWN_CODE_BLOCK}${lang}\n${state.listIndent}`
    : `${MARKDOWN_CODE_BLOCK}${lang}\n`
  state.buffer.push(fence)
  state.lastContentCache = fence
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

    // Deferred <pre> code fence (issue #97). A bare <pre> opens its fence right
    // before its first non-whitespace child so empty/whitespace-only blocks emit
    // nothing. A direct <code> child keeps fence ownership (handled in tags.ts).
    // Runs before lastChar is read so the fence is reflected in spacing checks.
    if (state.preFencePending && eventType === NodeEventEnter) {
      if (node.type === ELEMENT_NODE) {
        const el = node as ElementNode
        if (el.tagId === TAG_CODE && el.parent?.tagId === TAG_PRE) {
          // <pre><code>…</code></pre>: let the <code> handler emit the fence.
          state.preFencePending = false
        }
        else if (el.tagId !== TAG_PRE) {
          flushPreFence(state)
        }
      }
      else if (node.type === TEXT_NODE && hasNonWhitespace((node as TextNode).value)) {
        flushPreFence(state)
      }
    }

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

        // A <pre> whose fence is still pending has only seen whitespace so far
        // (non-whitespace would have opened the fence in the hook above). Drop
        // that whitespace so an empty/whitespace-only <pre> emits nothing and
        // never leaks between surrounding blocks (issue #97).
        if (state.preFencePending) {
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

        const wrapWidth = state.options?.wrapWidth
        if (wrapWidth && canWrapHere(state.depthMap)) {
          const wrapped = wrapText(textNode.value, currentColumn(state.buffer), wrapWidth, wrapContinuationPrefix(state))
          state.buffer.push(wrapped)
          state.lastContentCache = wrapped
        }
        else {
          state.buffer.push(textNode.value)
          state.lastContentCache = textNode.value
        }
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
    if (output[0]?.[0] && eventType === NodeEventEnter && !node.tagHandler?.literalEnter && lastChar && needsSpacing(lastChar, output[0][0], state)) {
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
