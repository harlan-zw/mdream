import type { ElementNode, EngineOptions, NodeEvent, TextNode } from './types'
import {
  ELEMENT_NODE,
  NodeEventEnter,
  TAG_A,
  TAG_ABBR,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_B,
  TAG_BR,
  TAG_CAPTION,
  TAG_CODE,
  TAG_DEL,
  TAG_DETAILS,
  TAG_EM,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_H1,
  TAG_H6,
  TAG_HR,
  TAG_I,
  TAG_IMG,
  TAG_KBD,
  TAG_MAIN,
  TAG_NAV,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_RUBY,
  TAG_S,
  TAG_SECTION,
  TAG_SMALL,
  TAG_STRIKE,
  TAG_STRONG,
  TAG_SUMMARY,
  TAG_TABLE,
  TAG_TD,
  TAG_TFOOT,
  TAG_TH,
  TAG_TIME,
  TagIdMap,
  TEXT_NODE,
} from './const'
import { resolveUrl } from './tags'
import { getLanguageFromClass, isSafeHtmlUrl, parseUnsignedInteger } from './utils'

interface HeadingFrame {
  _tag: 0
  level: number
  output: string
  text: string
}

interface PreFrame {
  _tag: 1
  depth: number
  language: string
  output: string
}

type HtmlFrame = HeadingFrame | PreFrame

export interface HtmlOutputState {
  frames: HtmlFrame[]
}

export function createHtmlOutputState(): HtmlOutputState {
  return { frames: [] }
}

function escapeHtml(value: string, attribute = false): string {
  return value.replace(attribute ? /[&<>"]/g : /[&<>]/g, character => character === '&'
    ? '&amp;'
    : character === '<'
      ? '&lt;'
      : character === '>' ? '&gt;' : '&quot;')
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z\d \t\n\r-]/g, '').trim().replace(/[ \t\n\r-]+/g, '-')
}

function tagName(node: ElementNode, tagId: number): string | undefined {
  switch (tagId) {
    case TAG_STRONG:
    case TAG_B: return 'strong'
    case TAG_EM:
    case TAG_I: return 'em'
    case TAG_DEL:
    case TAG_S:
    case TAG_STRIKE: return 'del'
  }
  const safe = tagId === TAG_DETAILS
    || tagId === TAG_SUMMARY
    || (tagId >= TAG_STRONG && tagId <= TAG_A)
    || (tagId >= TAG_TABLE && tagId <= TAG_OL)
    || (tagId >= TAG_P && tagId <= TAG_TFOOT)
    || tagId === TAG_NAV
    || (tagId >= TAG_KBD && tagId <= TAG_FOOTER)
    || (tagId >= TAG_ARTICLE && tagId <= TAG_SECTION)
    || (tagId >= TAG_ABBR && tagId <= TAG_SMALL)
    || (tagId >= TAG_ASIDE && tagId <= TAG_TIME)
    || (tagId >= TAG_RUBY && tagId <= TAG_FIGURE)
    || (tagId >= TAG_MAIN && tagId <= TAG_CAPTION)
  if (!safe)
    return
  if (node.tagHandler?.aliasTagId === undefined)
    return node.name
  for (const name in TagIdMap) {
    if (TagIdMap[name as keyof typeof TagIdMap] === tagId)
      return name
  }
}

function resolveTagId(node: ElementNode): number | undefined {
  return node.tagHandler?.aliasTagId ?? node.tagId
}

function safeAttributes(node: ElementNode, tagId: number, options: EngineOptions): string | undefined {
  const attributes = node.attributes
  if (tagId === TAG_A) {
    const href = attributes.href
    if (!href || !isSafeHtmlUrl(href))
      return undefined
    const resolved = resolveUrl(href, options.origin, options.clean)
    const title = attributes.title === undefined ? '' : ` title="${escapeHtml(attributes.title, true)}"`
    return ` href="${escapeHtml(resolved, true)}"${title}`
  }
  if (tagId === TAG_OL) {
    const start = parseUnsignedInteger(attributes.start)
    return start === undefined ? '' : ` start="${start}"`
  }
  if (tagId === TAG_CODE) {
    const language = getLanguageFromClass(attributes.class)
    return language ? ` class="language-${escapeHtml(language, true)}"` : ''
  }
  if (tagId === TAG_TH || tagId === TAG_TD) {
    let output = ''
    const colspan = parseUnsignedInteger(attributes.colspan)
    if (colspan !== undefined && colspan > 0)
      output += ` colspan="${colspan}"`
    if (tagId === TAG_TH) {
      const align = attributes.align?.toLowerCase()
      if (align === 'left' || align === 'center' || align === 'right')
        output += ` align="${align}"`
    }
    return output
  }
  return ''
}

function append(state: HtmlOutputState, output: string[], value: string): void {
  const frame = state.frames.at(-1)
  if (frame)
    frame.output += value
  else
    output.push(value)
}

function processText(node: TextNode, state: HtmlOutputState, output: string[]): void {
  if (node.excludedFromMarkdown || !node.value)
    return
  for (let index = state.frames.length - 1; index >= 0; index--) {
    const frame = state.frames[index]!
    if (frame._tag === 0) {
      frame.text += node.value
      break
    }
  }
  append(state, output, escapeHtml(node.value))
}

function closeFrame(state: HtmlOutputState, output: string[], frame: HtmlFrame): void {
  state.frames.pop()
  if (frame._tag === 0) {
    const slug = slugifyHeading(frame.text)
    const id = slug ? ` id="${slug}"` : ''
    append(state, output, `<h${frame.level}${id}>${frame.output}</h${frame.level}>`)
    return
  }
  const language = frame.language ? ` class="language-${escapeHtml(frame.language, true)}"` : ''
  append(state, output, `<pre tabindex="0"><code${language}>${frame.output}</code></pre>`)
}

export function processHtmlOutputEvent(
  event: NodeEvent,
  state: HtmlOutputState,
  output: string[],
  options: EngineOptions,
): void {
  const { node, type } = event
  if (node.type === TEXT_NODE) {
    if (type === NodeEventEnter)
      processText(node as TextNode, state, output)
    return
  }
  if (node.type !== ELEMENT_NODE)
    return

  const element = node as ElementNode
  const tagId = resolveTagId(element)
  const frame = state.frames.at(-1)
  if (frame?._tag === 1) {
    if (type === NodeEventEnter && tagId === TAG_CODE && !frame.language)
      frame.language = getLanguageFromClass(element.attributes.class)
    else if (type === NodeEventEnter && tagId === TAG_BR)
      frame.output += '\n'
    else if (type !== NodeEventEnter && tagId === TAG_PRE && element.depth === frame.depth)
      closeFrame(state, output, frame)
    return
  }

  if (type === NodeEventEnter && tagId !== undefined && tagId >= TAG_H1 && tagId <= TAG_H6) {
    state.frames.push({ _tag: 0, level: tagId - TAG_H1 + 1, output: '', text: '' })
    return
  }
  if (type !== NodeEventEnter && frame?._tag === 0 && tagId !== undefined && tagId >= TAG_H1 && tagId <= TAG_H6) {
    closeFrame(state, output, frame)
    return
  }
  if (type === NodeEventEnter && tagId === TAG_PRE) {
    state.frames.push({ _tag: 1, depth: element.depth, language: getLanguageFromClass(element.attributes.class), output: '' })
    return
  }
  if (tagId === TAG_BR) {
    if (type === NodeEventEnter)
      append(state, output, '<br>')
    return
  }
  if (tagId === TAG_HR) {
    if (type === NodeEventEnter)
      append(state, output, '<hr>')
    return
  }
  if (tagId === TAG_IMG) {
    if (type === NodeEventEnter) {
      const src = element.attributes.src
      if (src && isSafeHtmlUrl(src, true)) {
        const resolved = escapeHtml(resolveUrl(src, options.origin, options.clean), true)
        const alt = escapeHtml(element.attributes.alt || '', true)
        const title = element.attributes.title === undefined ? '' : ` title="${escapeHtml(element.attributes.title, true)}"`
        append(state, output, `<img src="${resolved}" alt="${alt}"${title}>`)
      }
    }
    return
  }

  if (tagId === undefined)
    return
  const name = tagName(element, tagId)
  if (!name)
    return
  const attributes = safeAttributes(element, tagId, options)
  if (attributes === undefined)
    return
  append(state, output, type === NodeEventEnter ? `<${name}${attributes}>` : `</${name}>`)
}
