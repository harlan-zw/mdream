import type { OutputProcessor } from './output-runner'
import type { ElementNode, EngineOptions, MdreamRuntimeState, NodeEvent, TextNode } from './types'
import {
  DEFAULT_BLOCK_SPACING,
  ELEMENT_NODE,
  MAX_TAG_ID,
  NO_SPACING,
  NodeEventEnter,
  NodeEventExit,
  TAG_BLOCKQUOTE,
  TAG_BR,
  TAG_CODE,
  TAG_DIV,
  TAG_H1,
  TAG_H6,
  TAG_IMG,
  TAG_LI,
  TAG_P,
  TAG_PRE,
  TAG_Q,
  TAG_SPAN,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TEXT_NODE,
} from './const'
import { resolveUrl } from './url'
import { isInsideHeading, isInsideTableCell } from './utils'

interface TextState extends MdreamRuntimeState {
  options: EngineOptions
  buffer: string[]
  depthMap: Uint16Array
  lastNode?: ElementNode | TextNode
  lastTextNode?: TextNode
  pendingInlineWhitespace?: boolean
}

function trimAsciiWhitespaceEnd(value: string): string {
  let end = value.length
  while (end > 0) {
    const code = value.charCodeAt(end - 1)
    if (code !== 32 && (code < 9 || code > 13))
      break
    end--
  }
  return end === value.length ? value : value.slice(0, end)
}

function shouldAddSpacingBeforeText(lastChar: string, lastNode: ElementNode | TextNode | undefined, textNode: TextNode): boolean {
  if (!lastChar || '\n \t['.includes(lastChar) || textNode.value[0] === ' ')
    return false
  if (lastNode?.tagHandler?.isInline)
    return false
  const firstChar = textNode.value[0]
  return Boolean(firstChar && !'.,!?:;)]'.includes(firstChar))
}

function currentColumn(buffer: string[]): number {
  let column = 0
  for (let index = buffer.length - 1; index >= 0; index--) {
    const value = buffer[index]!
    const newline = value.lastIndexOf('\n')
    if (newline >= 0)
      return column + [...value.slice(newline + 1)].length
    column += [...value].length
  }
  return column
}

function wrapText(value: string, column: number, width: number): string {
  const leading = value.charCodeAt(0) === 32
  const trailing = value.charCodeAt(value.length - 1) === 32
  let output = ''
  let first = true
  let index = 0
  while (index < value.length) {
    let next = value.indexOf(' ', index)
    if (next === -1)
      next = value.length
    if (next > index) {
      const word = value.slice(index, next)
      const wordLength = [...word].length
      const needsSpace = first ? leading : true
      if (needsSpace && column > 0 && column + 1 + wordLength > width) {
        output += '\n'
        column = 0
      }
      else if (needsSpace) {
        output += ' '
        column++
      }
      output += word
      column += wordLength
      first = false
    }
    index = next + 1
  }
  if (trailing && output && !output.endsWith(' ') && !output.endsWith('\n'))
    output += ' '
  return output || (leading || trailing ? ' ' : '')
}

function canWrapHere(depthMap: Uint16Array): boolean {
  if (depthMap[TAG_PRE] || depthMap[TAG_CODE] || depthMap[TAG_TD] || depthMap[TAG_TH])
    return false
  return !isInsideHeading(depthMap)
}

function newlineConfig(node: ElementNode, depthMap: Uint16Array): readonly [number, number] {
  const tagId = node.tagId
  if ((tagId !== TAG_LI && depthMap[TAG_LI])
    || (tagId !== TAG_BLOCKQUOTE && depthMap[TAG_BLOCKQUOTE])) {
    return tagId === TAG_PRE ? [1, 1] : NO_SPACING
  }

  const block = tagId !== undefined
    && ((tagId >= TAG_H1 && tagId <= TAG_H6) || tagId === TAG_P || tagId === TAG_DIV || tagId === TAG_LI)
  let parent = node.parent
  while (parent) {
    if (parent.tagHandler?.collapsesInnerWhiteSpace) {
      if (block && parent.tagId === TAG_SPAN) {
        parent = parent.parent
        continue
      }
      return NO_SPACING
    }
    parent = parent.parent
  }
  if (node.tagHandler?.spacing)
    return node.tagHandler.spacing
  return tagId === -1 ? NO_SPACING : DEFAULT_BLOCK_SPACING
}

function elementOutput(node: ElementNode, eventType: number, state: TextState): string | undefined {
  const override = state.options.tagOverrides?.[node.name]
  if (override && typeof override !== 'string') {
    const output = eventType === NodeEventEnter ? override.enter : override.exit
    if (output !== undefined)
      return output
  }

  if (eventType === NodeEventEnter) {
    if (node.tagId === TAG_BR)
      return '\n'
    if (node.tagId === TAG_P && (state.depthMap[TAG_BLOCKQUOTE] || (state.depthMap[TAG_LI] && !isInsideTableCell(state)))) {
      const last = state.buffer.at(-1)?.at(-1)
      if (last && last !== ' ' && last !== '\n')
        return '\n\n'
    }
    if (node.tagId === TAG_TD || node.tagId === TAG_TH)
      return state.depthMap[TAG_TABLE]! > 1 || node.index === 0 ? undefined : '\t'
    if (node.tagId === TAG_IMG) {
      const alt = node.attributes.alt
      if (alt !== undefined)
        return alt || undefined
      return node.attributes.title
        || resolveUrl(node.attributes.src || '', state.options.origin, state.options.clean)
        || undefined
    }
    if (node.tagId === TAG_Q)
      return '"'
  }
  else if (node.tagId === TAG_Q) {
    return '"'
  }
}

function trailingNewlines(buffer: string[]): number {
  let count = 0
  for (let index = buffer.length - 1; index >= 0 && count < 2; index--) {
    const value = buffer[index]!
    for (let offset = value.length - 1; offset >= 0 && count < 2; offset--) {
      if (value.charCodeAt(offset) !== 10)
        return count
      count++
    }
  }
  return count
}

function appendOutput(state: TextState, element: ElementNode, eventType: number, output: string | undefined): void {
  const buffer = state.buffer
  const config = newlineConfig(element, state.depthMap)
  const missingNewlines = Math.max(0, (config[eventType] || 0) - trailingNewlines(buffer))
  const isInline = element.tagHandler?.isInline === true

  if (buffer.length === 0) {
    if (output)
      buffer.push(output)
    return
  }

  if (state.pendingInlineWhitespace) {
    const firstOutput = output?.[0] || ''
    if (eventType === NodeEventEnter) {
      if (!isInline || element.tagId === TAG_BR || missingNewlines > 0 || firstOutput === '\n' || firstOutput === '\r') {
        state.pendingInlineWhitespace = false
      }
      else if (firstOutput) {
        const last = buffer.at(-1)?.at(-1)
        if (last && !' \n\t\r'.includes(last) && !' \n\t\r'.includes(firstOutput))
          buffer.push(' ')
        state.pendingInlineWhitespace = false
      }
    }
    else if (!isInline || missingNewlines > 0) {
      state.pendingInlineWhitespace = false
    }
  }

  if (buffer.length && state.lastTextNode?.containsWhitespace) {
    const isBlock = !isInline && missingNewlines > 0
    const collapses = element.tagHandler?.collapsesInnerWhiteSpace
    const hasSpacing = Array.isArray(element.tagHandler?.spacing)
    const trim = (element.tagId === TAG_BR && output?.endsWith('\n'))
      || ((!isInline || eventType === NodeEventExit) && !isBlock && !(collapses && eventType === NodeEventEnter) && !(hasSpacing && eventType === NodeEventEnter))
    if (trim) {
      const last = buffer.at(-1)!
      const trimmed = trimAsciiWhitespaceEnd(last)
      if (trimmed.length !== last.length) {
        buffer[buffer.length - 1] = trimmed
        if (eventType === NodeEventExit && isInline)
          state.pendingInlineWhitespace = true
      }
    }
    state.lastTextNode = undefined
  }

  const newline = missingNewlines ? '\n'.repeat(missingNewlines) : ''
  if (eventType === NodeEventEnter && newline)
    buffer.push(newline)
  if (output)
    buffer.push(output)
  if (eventType === NodeEventExit && newline)
    buffer.push(newline)
}

export function createTextOutputProcessor(options: EngineOptions): OutputProcessor {
  const state: TextState = {
    options,
    outputFormat: 'text',
    buffer: [],
    depthMap: new Uint16Array(MAX_TAG_ID),
    plainText: true,
  }
  let preserveLeadingWhitespace = false
  let yieldedLength = 0

  function processTextNode(node: TextNode, lastNode: ElementNode | TextNode | undefined): void {
    if (node.excludedFromMarkdown || !node.value)
      return
    const last = state.buffer.at(-1)?.at(-1) || ''
    if (state.pendingInlineWhitespace) {
      if (!node.value.trim())
        return
      if (last && !' \n\t\r'.includes(last) && !' \n\t\r'.includes(node.value[0] || ''))
        node.value = ` ${node.value}`
      state.pendingInlineWhitespace = false
    }
    if (state.depthMap[TAG_PRE] && state.buffer.length === 0)
      preserveLeadingWhitespace = true
    if (node.value === ' ' && ' \n\t\r'.includes(last))
      return
    if (!state.depthMap[TAG_PRE] && shouldAddSpacingBeforeText(last, lastNode, node))
      node.value = ` ${node.value}`

    const width = state.options.wrapWidth
    const value = width && canWrapHere(state.depthMap)
      ? wrapText(node.value, currentColumn(state.buffer), width)
      : node.value
    state.buffer.push(value)
    state.lastContentCache = value
    state.lastTextNode = node
  }

  function processEvent(event: NodeEvent): void {
    state.depth = event.node.depth
    const inTemplate = event.node.type === ELEMENT_NODE
      ? event.node.excludedFromMarkdown
      : event.node.parent?.excludedFromMarkdown
    if (inTemplate)
      return

    const lastNode = state.lastNode
    state.lastNode = event.node as ElementNode | TextNode
    if (event.node.type === TEXT_NODE && event.type === NodeEventEnter) {
      processTextNode(event.node as TextNode, lastNode)
      return
    }
    if (event.node.type !== ELEMENT_NODE)
      return

    const element = event.node as ElementNode
    let output: string | undefined
    if (element.pluginOutput?.length) {
      output = element.pluginOutput.join('')
      element.pluginOutput = undefined
    }
    else {
      output = elementOutput(element, event.type, state)
    }

    if (element.tagId === TAG_BR && event.type === NodeEventEnter && output) {
      const currentNewlines = trailingNewlines(state.buffer)
      if (!state.depthMap[TAG_PRE] && currentNewlines >= 2)
        output = undefined
      state.pendingInlineWhitespace = false
    }
    appendOutput(state, element, event.type, output)
    state.lastNode = element
  }

  return {
    state,
    processEvent,
    takeOutput() {
      const content = state.buffer.join('')
      const normalized = preserveLeadingWhitespace ? content : content.trimStart()
      let stableLength = normalized.length
      if (!state.depthMap[TAG_PRE])
        stableLength = trimAsciiWhitespaceEnd(normalized).length
      if (stableLength < yieldedLength)
        stableLength = yieldedLength
      const output = normalized.slice(yieldedLength, stableLength)
      yieldedLength = stableLength
      return output
    },
  }
}
