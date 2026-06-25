import type { ElementNode, Node, NodeEvent, TextNode } from './types'
import {
  ELEMENT_NODE,
  MAX_TAG_ID,
  NodeEventEnter,
  TAG_ADDRESS,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_BLOCKQUOTE,
  TAG_BR,
  TAG_CENTER,
  TAG_DD,
  TAG_DETAILS,
  TAG_DIALOG,
  TAG_DIV,
  TAG_DL,
  TAG_DT,
  TAG_FIELDSET,
  TAG_FIGCAPTION,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_FORM,
  TAG_H1,
  TAG_H6,
  TAG_HEADER,
  TAG_HR,
  TAG_IMG,
  TAG_LI,
  TAG_MAIN,
  TAG_NAV,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_Q,
  TAG_SECTION,
  TAG_TABLE,
  TAG_TD,
  TAG_TH,
  TAG_TR,
  TAG_UL,
  TEXT_NODE,
} from './const'
import { finalizeParse, parseHtmlStream } from './parse-core'
import { tagMetadata } from './tag-metadata'

export interface TextOptions {
  /**
   * Hard-wrap prose at this many characters, breaking on word boundaries.
   * `0` disables wrapping.
   */
  wrapWidth?: number
}

interface TextState {
  options?: TextOptions
  buffer: string[]
  depthMap: Uint8Array
  lastNode?: Node
}

const BLOCK_TAGS = new Set<number>([
  TAG_ADDRESS,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_BLOCKQUOTE,
  TAG_CENTER,
  TAG_DD,
  TAG_DETAILS,
  TAG_DIALOG,
  TAG_DIV,
  TAG_DL,
  TAG_DT,
  TAG_FIELDSET,
  TAG_FIGCAPTION,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_FORM,
  TAG_HEADER,
  TAG_HR,
  TAG_MAIN,
  TAG_NAV,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_SECTION,
  TAG_TABLE,
  TAG_UL,
])

function currentText(state: TextState): string {
  return state.buffer.join('')
}

function replaceBuffer(state: TextState, value: string): void {
  state.buffer.length = 0
  if (value)
    state.buffer.push(value)
}

function push(state: TextState, value: string | undefined | void): void {
  if (value)
    state.buffer.push(value)
}

function lastChar(state: TextState): string {
  const last = state.buffer.at(-1)
  return last?.charAt(last.length - 1) || ''
}

function ensureLineBreak(state: TextState): void {
  const text = currentText(state).replace(/[ \t]+$/g, '')
  if (!text)
    return replaceBuffer(state, '')
  replaceBuffer(state, text.endsWith('\n') ? text : `${text}\n`)
}

function ensureBlankLine(state: TextState): void {
  const text = currentText(state).trimEnd()
  if (!text)
    return replaceBuffer(state, '')
  replaceBuffer(state, `${text}\n\n`)
}

function shouldAddSpacingBeforeText(last: string, previous: Node | undefined, value: string): boolean {
  if (!last || last === '\n' || last === ' ' || last === '\t')
    return false
  if (previous?.tagHandler?.isInline)
    return false
  const first = value[0]
  if (first === ' ')
    return false
  return first !== '.'
    && first !== ','
    && first !== '!'
    && first !== '?'
    && first !== ':'
    && first !== ';'
    && first !== ')'
    && first !== ']'
}

function currentColumn(state: TextState): number {
  const text = currentText(state)
  const nl = text.lastIndexOf('\n')
  return nl === -1 ? [...text].length : [...text.slice(nl + 1)].length
}

function wrapText(value: string, col: number, width: number): string {
  const leading = value.charCodeAt(0) === 32
  const trailing = value.charCodeAt(value.length - 1) === 32
  let out = ''
  let first = true
  let i = 0
  while (i < value.length) {
    let next = value.indexOf(' ', i)
    if (next === -1)
      next = value.length
    if (next > i) {
      const word = value.slice(i, next)
      const wordLen = [...word].length
      const needSpace = first ? leading : true
      if (needSpace && col > 0 && col + 1 + wordLen > width) {
        out += '\n'
        col = 0
      }
      else if (needSpace) {
        out += ' '
        col++
      }
      out += word
      col += wordLen
      first = false
    }
    i = next + 1
  }
  if (trailing && out !== '' && !out.endsWith(' ') && !out.endsWith('\n'))
    out += ' '
  if (out === '' && (leading || trailing))
    out = ' '
  return out
}

function processText(state: TextState, node: TextNode, previous: Node | undefined): void {
  if (node.excludedFromMarkdown || !node.value)
    return

  if (shouldAddSpacingBeforeText(lastChar(state), previous, node.value))
    node.value = ` ${node.value}`

  const wrapWidth = state.options?.wrapWidth
  push(state, wrapWidth ? wrapText(node.value, currentColumn(state), wrapWidth) : node.value)
}

function processElement(state: TextState, node: ElementNode, eventType: number): void {
  const tagId = node.tagId

  if (eventType === NodeEventEnter) {
    if (tagId && tagId >= TAG_H1 && tagId <= TAG_H6) {
      ensureBlankLine(state)
    }
    else if (tagId !== undefined && BLOCK_TAGS.has(tagId)) {
      ensureBlankLine(state)
    }

    if (tagId === TAG_BR) {
      push(state, '\n')
    }
    else if (tagId === TAG_TD || tagId === TAG_TH) {
      push(state, (node.depthMap[TAG_TABLE] || 0) > 1 || node.index === 0 ? '' : '\t')
    }
    else if (tagId === TAG_IMG) {
      push(state, node.attributes?.alt)
    }
    else if (tagId === TAG_Q) {
      push(state, '"')
    }
    return
  }

  if (tagId === TAG_Q) {
    push(state, '"')
  }
  else if (tagId === TAG_TR || tagId === TAG_LI) {
    ensureLineBreak(state)
  }
  else if ((tagId && tagId >= TAG_H1 && tagId <= TAG_H6) || (tagId !== undefined && BLOCK_TAGS.has(tagId))) {
    ensureBlankLine(state)
  }
}

function createTextProcessor(options: TextOptions = {}) {
  const state: TextState = {
    options,
    buffer: [],
    depthMap: new Uint8Array(MAX_TAG_ID),
  }
  let lastYieldedLength = 0

  function processEvent(event: NodeEvent): void {
    const node = event.node
    const previous = state.lastNode
    state.lastNode = node

    if (node.type === TEXT_NODE && event.type === NodeEventEnter) {
      processText(state, node as TextNode, previous)
      return
    }
    if (node.type === ELEMENT_NODE)
      processElement(state, node as ElementNode, event.type)
  }

  function processHtml(html: string): void {
    const parseState = {
      depthMap: state.depthMap,
      depth: 0,
      tagHandlers: tagMetadata,
      plainText: true,
    }
    const leftover = parseHtmlStream(html, parseState, processEvent)
    finalizeParse(leftover, parseState, processEvent)
  }

  function getText(): string {
    const result = currentText(state).trim()
    state.buffer.length = 0
    return result
  }

  function getTextChunk(): string {
    const current = currentText(state).trimStart()
    const chunk = current.slice(lastYieldedLength)
    lastYieldedLength = current.length
    if (state.buffer.length > 1)
      replaceBuffer(state, current)
    return chunk
  }

  return {
    processEvent,
    processHtml,
    getText,
    getTextChunk,
    state,
  }
}

export function htmlToText(html: string, options: TextOptions = {}): string {
  const processor = createTextProcessor(options)
  processor.processHtml(html)
  return processor.getText()
}

export async function* streamHtmlToText(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: TextOptions = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')

  const decoder = new TextDecoder()
  const reader = htmlStream.getReader()
  const processor = createTextProcessor(options)
  const parseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    tagHandlers: tagMetadata,
    plainText: true,
  }
  let remainingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      const html = `${remainingHtml}${typeof value === 'string' ? value : decoder.decode(value, { stream: true })}`
      remainingHtml = parseHtmlStream(html, parseState, processor.processEvent)

      const chunk = processor.getTextChunk()
      if (chunk)
        yield chunk
    }

    const leftover = remainingHtml
      ? parseHtmlStream(remainingHtml, parseState, processor.processEvent)
      : ''
    finalizeParse(leftover, parseState, processor.processEvent)

    const finalChunk = processor.getTextChunk()
    if (finalChunk)
      yield finalChunk
  }
  finally {
    if (remainingHtml)
      decoder.decode(new Uint8Array(0), { stream: false })
    reader.releaseLock()
  }
}
