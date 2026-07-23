import type { HandlerContext, TagHandler, TagOverride } from './types'
import {
  BLOCKQUOTE_SPACING,
  LIST_ITEM_SPACING,
  MARKDOWN_CODE_BLOCK,
  MARKDOWN_EMPHASIS,
  MARKDOWN_HORIZONTAL_RULE,
  MARKDOWN_INLINE_CODE,
  MARKDOWN_STRIKETHROUGH,
  MARKDOWN_STRONG,
  NO_SPACING,
  TABLE_ROW_SPACING,
  TAG_A,
  TAG_ABBR,
  TAG_ADDRESS,
  TAG_AREA,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_AUDIO,
  TAG_B,
  TAG_BASE,
  TAG_BDO,
  TAG_BLOCKQUOTE,
  TAG_BODY,
  TAG_BR,
  TAG_BUTTON,
  TAG_CANVAS,
  TAG_CENTER,
  TAG_CITE,
  TAG_CODE,
  TAG_COL,
  TAG_DATALIST,
  TAG_DD,
  TAG_DEL,
  TAG_DETAILS,
  TAG_DFN,
  TAG_DIALOG,
  TAG_DIV,
  TAG_DL,
  TAG_DT,
  TAG_EM,
  TAG_EMBED,
  TAG_FIELDSET,
  TAG_FIGCAPTION,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_FORM,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_HEAD,
  TAG_HEADER,
  TAG_HR,
  TAG_I,
  TAG_IFRAME,
  TAG_IMG,
  TAG_INPUT,
  TAG_INS,
  TAG_KBD,
  TAG_KEYGEN,
  TAG_LABEL,
  TAG_LEGEND,
  TAG_LI,
  TAG_LINK,
  TAG_MAIN,
  TAG_MAP,
  TAG_MARK,
  TAG_META,
  TAG_METER,
  TAG_NAV,
  TAG_NOFRAMES,
  TAG_NOSCRIPT,
  TAG_OL,
  TAG_OPTGROUP,
  TAG_OPTION,
  TAG_P,
  TAG_PARAM,
  TAG_PLAINTEXT,
  TAG_PRE,
  TAG_PROGRESS,
  TAG_Q,
  TAG_RP,
  TAG_RT,
  TAG_RUBY,
  TAG_S,
  TAG_SAMP,
  TAG_SCRIPT,
  TAG_SECTION,
  TAG_SELECT,
  TAG_SMALL,
  TAG_SOURCE,
  TAG_SPAN,
  TAG_STRIKE,
  TAG_STRONG,
  TAG_STYLE,
  TAG_SUB,
  TAG_SUMMARY,
  TAG_SUP,
  TAG_SVG,
  TAG_TABLE,
  TAG_TBODY,
  TAG_TD,
  TAG_TEMPLATE,
  TAG_TEXTAREA,
  TAG_TFOOT,
  TAG_TH,
  TAG_THEAD,
  TAG_TIME,
  TAG_TITLE,
  TAG_TR,
  TAG_TRACK,
  TAG_U,
  TAG_UL,
  TAG_VAR,
  TAG_VIDEO,
  TAG_WBR,
  TAG_XMP,
  TagIdMap,
} from './const'
import { continuationPrefix } from './utils'

const TRACKING_PREFIXES = ['utm_', 'fbclid', 'gclid', 'mc_eid', 'msclkid', 'oly_'] as const

function isTrackingParam(url: string, start: number, end: number): boolean {
  for (let index = 0; index < TRACKING_PREFIXES.length; index++) {
    const prefix = TRACKING_PREFIXES[index]!
    if (end - start >= prefix.length && url.startsWith(prefix, start))
      return true
  }
  return false
}

function stripTrackingParams(url: string): string {
  const queryStart = url.indexOf('?')
  if (queryStart === -1)
    return url

  const fragmentStart = url.indexOf('#', queryStart + 1)
  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart
  let result = url.slice(0, queryStart)
  let parameterStart = queryStart + 1
  let kept = 0
  let removed = false

  while (parameterStart <= queryEnd) {
    let parameterEnd = url.indexOf('&', parameterStart)
    if (parameterEnd === -1 || parameterEnd > queryEnd)
      parameterEnd = queryEnd

    let keyEnd = url.indexOf('=', parameterStart)
    if (keyEnd === -1 || keyEnd > parameterEnd)
      keyEnd = parameterEnd

    if (isTrackingParam(url, parameterStart, keyEnd)) {
      removed = true
    }
    else {
      result += kept++ === 0 ? '?' : '&'
      result += url.slice(parameterStart, parameterEnd)
    }

    if (parameterEnd === queryEnd)
      break
    parameterStart = parameterEnd + 1
  }

  if (!removed)
    return url
  if (fragmentStart !== -1)
    result += url.slice(fragmentStart)
  return result
}

function hasExplicitScheme(url: string): boolean {
  const colon = url.indexOf(':')
  if (colon <= 0)
    return false
  for (let index = 0; index < colon; index++) {
    const code = url.charCodeAt(index)
    const isAlphaNumeric = (code >= 48 && code <= 57)
      || (code >= 65 && code <= 90)
      || (code >= 97 && code <= 122)
    if (!isAlphaNumeric && code !== 43 && code !== 45 && code !== 46)
      return false
  }
  return true
}

export function resolveUrl(url: string, origin?: string, clean = false): string {
  if (!url || url.charCodeAt(0) === 35)
    return url

  let resolved = url
  if (url.charCodeAt(0) === 47 && url.charCodeAt(1) === 47) {
    resolved = `https:${url}`
  }
  else if (origin) {
    let originEnd = origin.length
    while (originEnd > 0 && origin.charCodeAt(originEnd - 1) === 47)
      originEnd--
    const cleanOrigin = originEnd === origin.length ? origin : origin.slice(0, originEnd)

    if (url.charCodeAt(0) === 47) {
      resolved = `${cleanOrigin}${url}`
    }
    else if (url.charCodeAt(0) === 46 && url.charCodeAt(1) === 47) {
      resolved = `${cleanOrigin}/${url.slice(2)}`
    }
    else if (!hasExplicitScheme(url)) {
      resolved = `${cleanOrigin}/${url}`
    }
  }

  return clean && resolved.includes('?') ? stripTrackingParams(resolved) : resolved
}

// GFM autolink shorthand: only inline-syntax-safe absolute URIs are eligible
// for `<url>` rendering. Conservative scheme list matches the Rust core.
function isAutolinkUri(s: string): boolean {
  if (!(s.startsWith('http://') || s.startsWith('https://')
    || s.startsWith('ftp://') || s.startsWith('mailto:'))) {
    return false
  }
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 32 || c === 60 || c === 62 || c === 10 || c === 13 || c === 9)
      return false
  }
  return true
}

// Helper function to check if we're inside a table cell
function isInsideTableCell(state: HandlerContext['state']): boolean {
  const depthMap = state.depthMap!
  return depthMap[TAG_TD]! > 0 || depthMap[TAG_TH]! > 0
}

function isInsideRawHtmlBlock(state: HandlerContext['state']): boolean {
  const depthMap = state.depthMap!
  return Boolean(depthMap[TAG_DETAILS]
    || depthMap[TAG_SUMMARY]
    || depthMap[TAG_ADDRESS]
    || depthMap[TAG_DL]
    || depthMap[TAG_DT]
    || depthMap[TAG_DD])
}

// Helper function to get language from code class attribute
function getLanguageFromClass(className: string | undefined): string {
  if (!className)
    return ''

  const langParts = className
    .split(' ')
    .map(c => c.split('language-')[1])
    .filter(Boolean)

  return (langParts && langParts.length > 0) ? langParts[0]!.trim() : ''
}

function handleHeading(depth: number): TagHandler {
  return {
    enter: ({ state }) => {
      if ((state.depthMap?.[TAG_A] || 0) > 0) {
        return `<h${depth}>`
      }
      return `${'#'.repeat(depth)} `
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_A] || 0) > 0) {
        return `</h${depth}>`
      }
    },
    collapsesInnerWhiteSpace: true,
  }
}

const Strong: TagHandler = {
  enter: ({ state }) => {
    // we are already bold
    if ((state.depthMap?.[TAG_B] || 0) > 1) {
      return ''
    }
    return MARKDOWN_STRONG
  },
  exit: ({ node, state }) => {
    // we are already bold
    if ((state.depthMap?.[TAG_B] || 0) + (node.tagId === TAG_B ? 1 : 0) > 1) {
      return ''
    }
    return MARKDOWN_STRONG
  },
  collapsesInnerWhiteSpace: true,
  spacing: NO_SPACING,
  isInline: true,
}

const Emphasis: TagHandler = {
  enter: ({ state }) => {
    // we are already italic
    if ((state.depthMap?.[TAG_I] || 0) > 1) {
      return ''
    }
    return MARKDOWN_EMPHASIS
  },
  exit: ({ node, state }) => {
    // we are already italic
    if ((state.depthMap?.[TAG_I] || 0) + (node.tagId === TAG_I ? 1 : 0) > 1) {
      return ''
    }
    return MARKDOWN_EMPHASIS
  },
  collapsesInnerWhiteSpace: true,
  spacing: NO_SPACING,
  isInline: true,
}

const Strikethrough: TagHandler = {
  enter: () => MARKDOWN_STRIKETHROUGH,
  exit: () => MARKDOWN_STRIKETHROUGH,
  collapsesInnerWhiteSpace: true,
  spacing: NO_SPACING,
  isInline: true,
}

// Tag handlers with metadata
export const tagHandlers: Record<number, TagHandler> = {
  // Numeric tag constants
  [TAG_HEAD]: {
    // No special handling for head - plugins will handle frontmatter
    spacing: NO_SPACING,
    collapsesInnerWhiteSpace: true,
  },
  [TAG_DETAILS]: {
    // Inside a table cell the trailing block break would split the GFM row, so
    // emit the raw tags with no newlines (issue #147).
    enter: () => '<details>',
    exit: ({ state }) => isInsideTableCell(state) ? '</details>' : '</details>\n\n',
  },
  [TAG_SUMMARY]: {
    enter: () => '<summary>',
    exit: ({ state }) => isInsideTableCell(state) ? '</summary>' : '</summary>\n\n',
  },
  [TAG_TITLE]: {
    // No special handling for title - plugins will handle frontmatter
    collapsesInnerWhiteSpace: true,
    isNonNesting: true,
    spacing: NO_SPACING,
  },
  [TAG_SCRIPT]: {
    excludesTextNodes: true,
    isNonNesting: true,
  },
  [TAG_STYLE]: {
    isNonNesting: true,
    excludesTextNodes: true,
  },
  [TAG_META]: {
    // No special handling for meta - plugins will handle frontmatter
    collapsesInnerWhiteSpace: true,
    isSelfClosing: true,
    spacing: NO_SPACING,
  },
  [TAG_BR]: {
    enter: ({ node, state }) => {
      // A literal newline would terminate a table row/ATX heading or collapse
      // inside a raw HTML block, so preserve the inline HTML there.
      const depthMap = state.depthMap!
      if (isInsideTableCell(state) || isInsideRawHtmlBlock(state)
        || depthMap[TAG_H1]
        || depthMap[TAG_H2]
        || depthMap[TAG_H3]
        || depthMap[TAG_H4]
        || depthMap[TAG_H5]
        || depthMap[TAG_H6]) {
        return '<br>'
      }

      const prefix = continuationPrefix(node, state.listIndentWidths || [])
      return `\n${prefix}`
    },
    isSelfClosing: true,
    spacing: NO_SPACING,
    collapsesInnerWhiteSpace: true,
    isInline: true,
  },
  [TAG_H1]: handleHeading(1),
  [TAG_H2]: handleHeading(2),
  [TAG_H3]: handleHeading(3),
  [TAG_H4]: handleHeading(4),
  [TAG_H5]: handleHeading(5),
  [TAG_H6]: handleHeading(6),
  [TAG_HR]: {
    enter: () => MARKDOWN_HORIZONTAL_RULE,
    isSelfClosing: true,
  },
  [TAG_STRONG]: Strong,
  [TAG_B]: Strong,
  [TAG_EM]: Emphasis,
  [TAG_I]: Emphasis,
  [TAG_DEL]: Strikethrough,
  [TAG_S]: Strikethrough,
  [TAG_STRIKE]: Strikethrough,
  [TAG_SUB]: {
    enter: () => '<sub>',
    exit: () => '</sub>',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_SUP]: {
    enter: () => '<sup>',
    exit: () => '</sup>',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_INS]: {
    enter: () => '<ins>',
    exit: () => '</ins>',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_BLOCKQUOTE]: {
    enter: ({ state }) => {
      const depth = state.depthMap?.[TAG_BLOCKQUOTE] || 1
      let prefix = '> '.repeat(depth)

      // Add indentation if inside a list item
      const liDepth = state.depthMap?.[TAG_LI] || 0
      if (liDepth > 0) {
        prefix = `\n${state.listIndent}${prefix}`
      }

      return prefix
    },
    spacing: BLOCKQUOTE_SPACING,
  },
  // A bare <pre> (no <code> child) becomes a fenced code block (issue #97).
  // The opening fence is deferred to the first non-whitespace child by the
  // processor (flushPreFence) so empty/whitespace-only blocks emit nothing and a
  // <pre><code> keeps its existing fence. Only the closing fence lives here.
  [TAG_PRE]: {
    enter: ({ node, state }) => {
      // Inside a table cell a fenced code block would split the GFM row; emit
      // raw <pre> and let the content newlines become <br> (issue #147).
      if (isInsideTableCell(state)) {
        return '<pre>'
      }
      state.preFencePending = true
      state.preOwnFence = false
      state.preFenceLang = getLanguageFromClass(node.attributes?.class)
    },
    exit: ({ state }) => {
      if (isInsideTableCell(state)) {
        return '</pre>'
      }
      const ownFence = state.preOwnFence
      state.preFencePending = false
      state.preOwnFence = false
      // No own fence means a <code> child emitted it, or the <pre> had no
      // non-whitespace content (empty block stripped) — nothing to close.
      if (!ownFence) {
        return undefined
      }
      const liDepth = state.depthMap?.[TAG_LI] || 0
      if (liDepth > 0) {
        const indent = state.listIndent
        return `\n${indent}${MARKDOWN_CODE_BLOCK}\n\n${indent}`
      }
      return `\n${MARKDOWN_CODE_BLOCK}`
    },
  },
  [TAG_CODE]: {
    enter: ({ node, state }) => {
      if ((state.depthMap?.[TAG_PRE] || 0) > 0) {
        // Inside a table cell emit raw <code> so no fence newline splits the
        // GFM row (issue #147). The enclosing <pre> emitted raw <pre>.
        if (isInsideTableCell(state)) {
          return '<code>'
        }
        // The enclosing <pre> already opened its own fence (e.g. <pre> with
        // mixed text and <code> children); don't emit a nested fence.
        if (state.preOwnFence) {
          return undefined
        }
        // This <code> owns the <pre>'s fence; cancel the deferred pre fence.
        state.preFencePending = false
        const language = getLanguageFromClass(node.attributes?.class)
        const liDepth = state.depthMap?.[TAG_LI] || 0
        if (liDepth > 0) {
          const indent = state.listIndent
          return `\n\n${indent}${MARKDOWN_CODE_BLOCK}${language}\n`
        }
        return `${MARKDOWN_CODE_BLOCK}${language}\n`
      }
      // Inline code inside a list item: collapse the paragraph boundary with a
      // separator space when following text, but not when the buffer just
      // emitted a wrapper opener where a leading space would break the
      // pairing or leak into the wrapper content. Covers emphasis (`*`, `_`),
      // strikethrough (`~`), link text (`[`), HTML passthrough (`>`), and
      // whitespace. A trailing backtick does NOT suppress: two adjacent
      // `<code>` elements must be separated with a space so CommonMark parses
      // them as two code spans rather than merging into one.
      if ((state.depthMap?.[TAG_LI] || 0) > 0) {
        const lastEntry = state.buffer.at(-1)
        const lastChar = lastEntry?.charAt(lastEntry.length - 1) || ''
        if (lastChar && lastChar !== ' ' && lastChar !== '\n' && lastChar !== '\t'
          && lastChar !== '*' && lastChar !== '_' && lastChar !== '~'
          && lastChar !== '[' && lastChar !== '>') {
          return ` ${MARKDOWN_INLINE_CODE}`
        }
      }
      return MARKDOWN_INLINE_CODE
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_PRE] || 0) > 0) {
        // Raw <code> close inside a table cell (issue #147).
        if (isInsideTableCell(state)) {
          return '</code>'
        }
        // The enclosing <pre> owns the fence; this <code> emitted no opener.
        if (state.preOwnFence) {
          return undefined
        }
        const liDepth = state.depthMap?.[TAG_LI] || 0
        if (liDepth > 0) {
          const indent = state.listIndent
          return `\n${indent}${MARKDOWN_CODE_BLOCK}\n\n${indent}`
        }
        return `\n${MARKDOWN_CODE_BLOCK}`
      }
      return MARKDOWN_INLINE_CODE
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_UL]: {
    enter: ({ state }) => isInsideTableCell(state) ? '<ul>' : undefined,
    exit: ({ state }) => isInsideTableCell(state) ? '</ul>' : undefined,
  },
  [TAG_OL]: {
    enter: ({ state }) => isInsideTableCell(state) ? '<ol>' : undefined,
    exit: ({ state }) => isInsideTableCell(state) ? '</ol>' : undefined,
  },
  [TAG_LI]: {
    enter: ({ node, state }) => {
      if (isInsideTableCell(state)) {
        return '<li>'
      }

      // Parent determines marker: "N. " if <ol>, else "- ". The emitted indent
      // is the parent's accumulated listIndent — this <li>'s own marker width
      // is pushed onto state.listIndent after the enter output is written
      // (see markdown-processor.ts).
      const isOrdered = node.parent?.tagId === TAG_OL
      const marker = isOrdered ? `${node.index + 1}. ` : '- '
      return `${state.listIndent}${marker}`
    },
    exit: ({ state }) => isInsideTableCell(state) ? '</li>' : undefined,
    spacing: LIST_ITEM_SPACING,
  },
  [TAG_A]: {
    enter: ({ node }) => {
      if (node.attributes?.href) {
        return '['
      }
    },
    exit: ({ node, state }) => {
      if (!node.attributes?.href) {
        return ''
      }
      const href = resolveUrl(node.attributes?.href || '', state.options?.origin, state.cleanUrls === true)
      let title = node.attributes?.title
      // Check if title matches the last content to avoid duplication
      const lastContent = state.lastContentCache
      if (lastContent === title) {
        title = ''
      }
      // GFM autolink shorthand: when the link text equals href and href is a
      // bare absolute URI, emit `<href>` instead of `[href](href)`. Mirrors
      // the Rust core (crates/core/src/convert.rs).
      if (!title && isAutolinkUri(href)) {
        const buf = state.buffer
        let i = buf.length - 1
        // Sum the link-text length while scanning back for `[`, so the
        // slice/join allocation only happens when the text could equal href.
        let textLen = 0
        while (i >= 0) {
          const entry = buf[i]!
          if (entry === '[')
            break
          textLen += entry.length
          i--
        }
        if (i >= 0 && textLen === href.length && buf.slice(i + 1).join('') === href) {
          buf.length = i
          const auto = `<${href}>`
          buf.push(auto)
          state.lastContentCache = auto
          return ''
        }
      }
      return title ? `](${href} "${title}")` : `](${href})`
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_IMG]: {
    enter: ({ node, state }) => {
      const alt = node.attributes?.alt || ''
      const src = resolveUrl(node.attributes?.src || '', state.options?.origin, state.cleanUrls === true)
      return `![${alt}](${src})`
    },
    collapsesInnerWhiteSpace: true,
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_TABLE]: {
    enter: ({ state }) => {
      if (isInsideTableCell(state)) {
        return '<table>'
      }
      if ((state.depthMap?.[TAG_TABLE] || 0) <= 1) {
        state.tableRenderedTable = false
      }
      // Initialize table state
      state.tableColumnAlignments = []
    },
    exit: ({ state }) => isInsideTableCell(state) ? '</table>' : undefined,
  },
  [TAG_THEAD]: {
    enter: ({ state }) => {
      if (isInsideTableCell(state)) {
        return '<thead>'
      }
    },
    exit: ({ state }) => isInsideTableCell(state) ? '</thead>' : undefined,
    spacing: TABLE_ROW_SPACING,
    excludesTextNodes: true,
  },
  [TAG_TR]: {
    enter: ({ state }) => {
      if (isInsideTableCell(state)) {
        return '<tr>'
      }
      state.tableCurrentRowCells = 0
      return '| '
    },
    exit: ({ state }) => {
      if (isInsideTableCell(state) || (state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '</tr>'
      }

      // Handle header row separator
      if (!state.tableRenderedTable) {
        state.tableRenderedTable = true

        // Ensure we have alignments for all columns
        const alignments = state.tableColumnAlignments!
        while (alignments.length < state.tableCurrentRowCells!) {
          alignments.push('')
        }

        // Map alignment values to markdown syntax
        const alignmentMarkers = alignments.map((align) => {
          switch (align) {
            case 'left': return ':---'
            case 'center': return ':---:'
            case 'right': return '---:'
            default: return '---'
          }
        })

        return ` |\n| ${alignmentMarkers.join(' | ')} |`
      }

      return ' |'
    },
    excludesTextNodes: true,
    spacing: TABLE_ROW_SPACING,
  },
  [TAG_TH]: {
    enter: ({ node, state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '<th>'
      }

      // Handle alignment
      const align = node.attributes?.align?.toLowerCase()
      if (align) {
        state.tableColumnAlignments!.push(align)
      }
      else if (state.tableColumnAlignments!.length <= state.tableCurrentRowCells!) {
        state.tableColumnAlignments!.push('')
      }

      return node.index === 0 ? '' : ' | '
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '</th>'
      }
      state.tableCurrentRowCells!++
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
  },
  [TAG_TD]: {
    enter: ({ node, state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '<td>'
      }
      return node.index === 0 ? '' : ' | '
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '</td>'
      }
      state.tableCurrentRowCells!++
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
  },
  [TAG_P]: {
    enter: ({ state }) => {
      const bqDepth = state.depthMap?.[TAG_BLOCKQUOTE] || 0
      if (bqDepth > 0) {
        const lastEntry = state.buffer.at(-1)
        const lastChar = lastEntry?.charAt(lastEntry.length - 1) || ''
        // Only add separator if there's preceding text content (not the first <p> in the blockquote)
        if (lastChar && lastChar !== '\n' && lastChar !== ' ' && lastChar !== '>') {
          const prefix = '> '.repeat(bqDepth)
          return `\n${prefix.trimEnd()}\n${prefix}`
        }
      }
      if ((state.depthMap?.[TAG_LI] || 0) > 0 && !isInsideTableCell(state)) {
        const lastEntry = state.buffer.at(-1)
        const lastChar = lastEntry?.charAt(lastEntry.length - 1) || ''
        if (lastChar && lastChar !== ' ' && lastChar !== '\n') {
          return `\n\n${state.listIndent}`
        }
      }
    },
  },
  [TAG_DIV]: {},
  [TAG_SPAN]: {
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_NAV]: {
  },
  [TAG_LABEL]: {
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_BUTTON]: {
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_BODY]: { spacing: NO_SPACING },
  [TAG_CENTER]: {
    // if in table cell we preserve
    enter: ({ state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '<center>'
      }
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '</center>'
      }
    },
    spacing: NO_SPACING,
  },
  [TAG_TBODY]: {
    spacing: NO_SPACING,
    excludesTextNodes: true,
  },
  [TAG_TFOOT]: {
    spacing: TABLE_ROW_SPACING,
    excludesTextNodes: true,
  },
  [TAG_KBD]: {
    enter: () => '`',
    exit: () => '`',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_FOOTER]: {
    spacing: NO_SPACING,
  },
  [TAG_FORM]: {
    spacing: NO_SPACING,
  },
  [TAG_LINK]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    collapsesInnerWhiteSpace: true,
    isInline: true,
  },
  [TAG_AREA]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
    collapsesInnerWhiteSpace: true,
  },
  [TAG_BASE]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
    collapsesInnerWhiteSpace: true,
  },
  [TAG_COL]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
  },
  [TAG_EMBED]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
  },
  [TAG_INPUT]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
    collapsesInnerWhiteSpace: true,
  },
  [TAG_KEYGEN]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
    collapsesInnerWhiteSpace: true,
  },
  [TAG_PARAM]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
  },
  [TAG_SOURCE]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
  },
  [TAG_TRACK]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
  },
  [TAG_WBR]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
    collapsesInnerWhiteSpace: true,
  },
  [TAG_SVG]: {
    spacing: NO_SPACING,
  },
  [TAG_SELECT]: {
    spacing: NO_SPACING,
  },
  [TAG_TEXTAREA]: {
    isNonNesting: true,
    spacing: NO_SPACING,
  },
  [TAG_OPTION]: {
    spacing: NO_SPACING,
  },
  [TAG_OPTGROUP]: {
    spacing: NO_SPACING,
  },
  [TAG_FIELDSET]: {
    spacing: NO_SPACING,
  },
  [TAG_LEGEND]: {
    spacing: NO_SPACING,
  },
  [TAG_AUDIO]: {
    spacing: NO_SPACING,
  },
  [TAG_VIDEO]: {
    spacing: NO_SPACING,
  },
  [TAG_CANVAS]: {
    spacing: NO_SPACING,
  },
  [TAG_IFRAME]: {
    isNonNesting: true,
    spacing: NO_SPACING,
  },
  [TAG_MAP]: {
    spacing: NO_SPACING,
  },
  [TAG_DIALOG]: {
    spacing: NO_SPACING,
  },
  [TAG_METER]: {
    spacing: NO_SPACING,
  },
  [TAG_PROGRESS]: {
    spacing: NO_SPACING,
  },
  [TAG_TEMPLATE]: {
    // <template> content is parsed (including nested templates) but remains
    // inert, so its subtree is excluded from Markdown by the parser/processor.
    excludesTextNodes: true,
    spacing: NO_SPACING,
  },
  [TAG_ABBR]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_MARK]: {
    enter: () => '<mark>',
    exit: () => '</mark>',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_Q]: {
    enter: () => '"',
    exit: () => '"',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_SAMP]: {
    enter: () => '`',
    exit: () => '`',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_SMALL]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_NOSCRIPT]: {
    excludesTextNodes: true,
    spacing: NO_SPACING,
  },
  [TAG_DATALIST]: {
    // <datalist> holds <option> autocomplete data that browsers never render.
    // Treat the whole body as inert and drop it, mirroring <template>.
    isNonNesting: true,
    excludesTextNodes: true,
    spacing: NO_SPACING,
  },
  [TAG_NOFRAMES]: {
    isNonNesting: true,
    spacing: NO_SPACING,
  },
  [TAG_XMP]: {
    isNonNesting: true,
    spacing: NO_SPACING,
  },
  [TAG_PLAINTEXT]: {
    isNonNesting: true,
    spacing: NO_SPACING,
  },
  [TAG_ASIDE]: {
    spacing: NO_SPACING,
  },
  [TAG_U]: {
    enter: () => {
      return '<u>'
    },
    exit: () => {
      return '</u>'
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_CITE]: {
    enter: () => '*',
    exit: () => '*',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_DFN]: {
    enter: () => '**',
    exit: () => '**',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_VAR]: {
    enter: () => '`',
    exit: () => '`',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_TIME]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_BDO]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_RUBY]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_RT]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_RP]: {
    enter: () => '',
    exit: () => '',
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },

  [TAG_ADDRESS]: {
    enter: () => '<address>',
    exit: () => '</address>',
    spacing: NO_SPACING,
    collapsesInnerWhiteSpace: true,
  },

  [TAG_DL]: {
    spacing: NO_SPACING,
    enter: () => '<dl>',
    exit: () => '</dl>',
  },

  [TAG_DT]: {
    // Definition term
    enter: () => '<dt>',
    exit: () => '</dt>',
    collapsesInnerWhiteSpace: true,
    spacing: [0, 1],
  },

  [TAG_DD]: {
    // Definition term
    enter: () => '<dd>',
    exit: () => '</dd>',
    spacing: [0, 1],
  },

  [TAG_ARTICLE]: {},
  [TAG_SECTION]: {},
  [TAG_HEADER]: {},
  [TAG_MAIN]: {},
  [TAG_FIGURE]: {},

  [TAG_FIGCAPTION]: {
    enter: () => MARKDOWN_EMPHASIS,
    exit: () => MARKDOWN_EMPHASIS,
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
}

/**
 * Build a map of tag name → TagHandler from declarative tagOverrides config.
 * For alias (string value): clone the handler for the aliased tag.
 * For override object: overlay fields onto the base handler (if tag is known).
 */
export function buildTagOverrideHandlers(overrides: Record<string, TagOverride | string>): Map<string, TagHandler> {
  const result = new Map<string, TagHandler>()

  for (const tagName in overrides) {
    const override = overrides[tagName]
    if (!override)
      continue

    if (typeof override === 'string') {
      // Alias: look up the target tag's handler
      const targetId = TagIdMap[override as keyof typeof TagIdMap]
      if (targetId !== undefined) {
        const baseHandler = tagHandlers[targetId]
        if (baseHandler) {
          result.set(tagName, { ...baseHandler, aliasTagId: targetId })
        }
      }
    }
    else {
      // Override object: start with base handler if tag is known
      const baseId = TagIdMap[tagName as keyof typeof TagIdMap]
      const baseHandler = baseId !== undefined ? tagHandlers[baseId] : undefined
      const handler: TagHandler = baseHandler ? { ...baseHandler } : {}

      if (override.enter !== undefined) {
        const enterStr = override.enter
        handler.enter = () => enterStr
        handler.literalEnter = true
      }
      if (override.exit !== undefined) {
        const exitStr = override.exit
        handler.exit = () => exitStr
        handler.literalExit = true
      }
      if (override.spacing !== undefined) {
        handler.spacing = override.spacing
      }
      if (override.isInline !== undefined) {
        handler.isInline = override.isInline
      }
      if (override.isSelfClosing !== undefined) {
        handler.isSelfClosing = override.isSelfClosing
      }
      if (override.collapsesInnerWhiteSpace !== undefined) {
        handler.collapsesInnerWhiteSpace = override.collapsesInnerWhiteSpace
      }

      result.set(tagName, handler)
    }
  }

  return result
}
