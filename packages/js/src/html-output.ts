import type { ElementNode, EngineOptions, NodeEvent, TextNode } from './types'
import {
  ELEMENT_NODE,
  NodeEventEnter,
  TAG_A,
  TAG_ABBR,
  TAG_ADDRESS,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_B,
  TAG_BLOCKQUOTE,
  TAG_BR,
  TAG_CAPTION,
  TAG_CITE,
  TAG_CODE,
  TAG_DD,
  TAG_DEL,
  TAG_DETAILS,
  TAG_DFN,
  TAG_DIV,
  TAG_DL,
  TAG_DT,
  TAG_EM,
  TAG_FIGCAPTION,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_H1,
  TAG_H6,
  TAG_HEADER,
  TAG_HR,
  TAG_I,
  TAG_IMG,
  TAG_INS,
  TAG_KBD,
  TAG_LI,
  TAG_MAIN,
  TAG_MARK,
  TAG_NAV,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_Q,
  TAG_RP,
  TAG_RT,
  TAG_RUBY,
  TAG_S,
  TAG_SAMP,
  TAG_SECTION,
  TAG_SMALL,
  TAG_SPAN,
  TAG_STRIKE,
  TAG_STRONG,
  TAG_SUB,
  TAG_SUMMARY,
  TAG_SUP,
  TAG_TABLE,
  TAG_TBODY,
  TAG_TD,
  TAG_TFOOT,
  TAG_TH,
  TAG_THEAD,
  TAG_TIME,
  TAG_TR,
  TAG_U,
  TAG_UL,
  TAG_VAR,
  TEXT_NODE,
} from './const'
import { resolveUrl } from './tags'
import { getLanguageFromClass, isSafeHtmlUrl, parseUnsignedInteger } from './utils'

interface HeadingFrame {
  _tag: 'Heading'
  level: number
  output: string[]
  text: string
}

interface PreFrame {
  _tag: 'Pre'
  language: string
  output: string[]
}

type HtmlFrame = HeadingFrame | PreFrame

export interface HtmlOutputState {
  frames: HtmlFrame[]
}

export function createHtmlOutputState(): HtmlOutputState {
  return { frames: [] }
}

function escapeText(value: string): string {
  let output = ''
  let last = 0
  for (let index = 0; index < value.length; index++) {
    let replacement = ''
    switch (value.charCodeAt(index)) {
      case 38:
        replacement = '&amp;'
        break
      case 60:
        replacement = '&lt;'
        break
      case 62:
        replacement = '&gt;'
        break
    }
    if (replacement) {
      output += value.slice(last, index) + replacement
      last = index + 1
    }
  }
  return last ? output + value.slice(last) : value
}

function escapeAttribute(value: string): string {
  let output = ''
  let last = 0
  for (let index = 0; index < value.length; index++) {
    let replacement = ''
    switch (value.charCodeAt(index)) {
      case 34:
        replacement = '&quot;'
        break
      case 38:
        replacement = '&amp;'
        break
      case 60:
        replacement = '&lt;'
        break
      case 62:
        replacement = '&gt;'
        break
    }
    if (replacement) {
      output += value.slice(last, index) + replacement
      last = index + 1
    }
  }
  return last ? output + value.slice(last) : value
}

function slugifyHeading(text: string): string {
  let output = ''
  let pendingDash = false
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    const alphaNumeric = (code >= 48 && code <= 57)
      || (code >= 97 && code <= 122)
      || (code >= 65 && code <= 90)
    if (alphaNumeric) {
      if (pendingDash && output)
        output += '-'
      output += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : text[index]
      pendingDash = false
    }
    else if (code === 32 || code === 9 || code === 10 || code === 13 || code === 45) {
      pendingDash = output.length > 0
    }
  }
  return output
}

function tagName(tagId: number | undefined): string | undefined {
  if (tagId !== undefined && tagId >= TAG_H1 && tagId <= TAG_H6)
    return `h${tagId - TAG_H1 + 1}`
  switch (tagId) {
    case TAG_DETAILS: return 'details'
    case TAG_SUMMARY: return 'summary'
    case TAG_STRONG:
    case TAG_B: return 'strong'
    case TAG_EM:
    case TAG_I: return 'em'
    case TAG_DEL:
    case TAG_S:
    case TAG_STRIKE: return 'del'
    case TAG_SUB: return 'sub'
    case TAG_SUP: return 'sup'
    case TAG_INS: return 'ins'
    case TAG_BLOCKQUOTE: return 'blockquote'
    case TAG_CODE: return 'code'
    case TAG_UL: return 'ul'
    case TAG_LI: return 'li'
    case TAG_A: return 'a'
    case TAG_TABLE: return 'table'
    case TAG_THEAD: return 'thead'
    case TAG_TBODY: return 'tbody'
    case TAG_TFOOT: return 'tfoot'
    case TAG_TR: return 'tr'
    case TAG_TH: return 'th'
    case TAG_TD: return 'td'
    case TAG_OL: return 'ol'
    case TAG_P: return 'p'
    case TAG_DIV: return 'div'
    case TAG_SPAN: return 'span'
    case TAG_NAV: return 'nav'
    case TAG_KBD: return 'kbd'
    case TAG_FOOTER: return 'footer'
    case TAG_ARTICLE: return 'article'
    case TAG_SECTION: return 'section'
    case TAG_ABBR: return 'abbr'
    case TAG_MARK: return 'mark'
    case TAG_Q: return 'q'
    case TAG_SAMP: return 'samp'
    case TAG_SMALL: return 'small'
    case TAG_ASIDE: return 'aside'
    case TAG_U: return 'u'
    case TAG_CITE: return 'cite'
    case TAG_DFN: return 'dfn'
    case TAG_VAR: return 'var'
    case TAG_TIME: return 'time'
    case TAG_RUBY: return 'ruby'
    case TAG_RT: return 'rt'
    case TAG_RP: return 'rp'
    case TAG_DD: return 'dd'
    case TAG_DT: return 'dt'
    case TAG_ADDRESS: return 'address'
    case TAG_DL: return 'dl'
    case TAG_FIGURE: return 'figure'
    case TAG_MAIN: return 'main'
    case TAG_HEADER: return 'header'
    case TAG_FIGCAPTION: return 'figcaption'
    case TAG_CAPTION: return 'caption'
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
    const title = attributes.title === undefined ? '' : ` title="${escapeAttribute(attributes.title)}"`
    return ` href="${escapeAttribute(resolved)}"${title}`
  }
  if (tagId === TAG_OL) {
    const start = parseUnsignedInteger(attributes.start)
    return start === undefined ? '' : ` start="${start}"`
  }
  if (tagId === TAG_CODE) {
    const language = getLanguageFromClass(attributes.class)
    return language ? ` class="language-${escapeAttribute(language)}"` : ''
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
  ;(frame?.output || output).push(value)
}

function processText(node: TextNode, state: HtmlOutputState, output: string[]): void {
  if (node.excludedFromMarkdown || !node.value)
    return
  for (let index = state.frames.length - 1; index >= 0; index--) {
    const frame = state.frames[index]!
    if (frame._tag === 'Heading') {
      frame.text += node.value
      break
    }
  }
  append(state, output, escapeText(node.value))
}

function closeFrame(state: HtmlOutputState, output: string[], frame: HtmlFrame): void {
  state.frames.pop()
  if (frame._tag === 'Heading') {
    const slug = slugifyHeading(frame.text)
    const id = slug ? ` id="${slug}"` : ''
    append(state, output, `<h${frame.level}${id}>${frame.output.join('')}</h${frame.level}>`)
    return
  }
  const language = frame.language ? ` class="language-${escapeAttribute(frame.language)}"` : ''
  append(state, output, `<pre tabindex="0"><code${language}>${frame.output.join('')}</code></pre>`)
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
  if (frame?._tag === 'Pre') {
    if (type === NodeEventEnter && tagId === TAG_CODE && !frame.language)
      frame.language = getLanguageFromClass(element.attributes.class)
    else if (type === NodeEventEnter && tagId === TAG_BR)
      frame.output.push('\n')
    else if (type !== NodeEventEnter && tagId === TAG_PRE)
      closeFrame(state, output, frame)
    return
  }

  if (type === NodeEventEnter && tagId !== undefined && tagId >= TAG_H1 && tagId <= TAG_H6) {
    state.frames.push({ _tag: 'Heading', level: tagId - TAG_H1 + 1, output: [], text: '' })
    return
  }
  if (type !== NodeEventEnter && frame?._tag === 'Heading' && tagId !== undefined && tagId >= TAG_H1 && tagId <= TAG_H6) {
    closeFrame(state, output, frame)
    return
  }
  if (type === NodeEventEnter && tagId === TAG_PRE) {
    state.frames.push({ _tag: 'Pre', language: getLanguageFromClass(element.attributes.class), output: [] })
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
        const resolved = escapeAttribute(resolveUrl(src, options.origin, options.clean))
        const alt = escapeAttribute(element.attributes.alt || '')
        const title = element.attributes.title === undefined ? '' : ` title="${escapeAttribute(element.attributes.title)}"`
        append(state, output, `<img src="${resolved}" alt="${alt}"${title}>`)
      }
    }
    return
  }

  const name = tagName(tagId)
  if (!name)
    return
  const attributes = safeAttributes(element, tagId!, options)
  if (attributes === undefined)
    return
  append(state, output, type === NodeEventEnter ? `<${name}${attributes}>` : `</${name}>`)
}
