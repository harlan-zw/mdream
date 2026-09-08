import type { ElementNode, EngineOptions, HandlerContext, TagHandler, TagOverride } from './types'
import {
  BLOCKQUOTE_SPACING,
  isInsideRawHtmlBlock,
  LIST_ITEM_SPACING,
  MARKDOWN_CODE_BLOCK,
  MARKDOWN_EMPHASIS,
  MARKDOWN_HORIZONTAL_RULE,
  MARKDOWN_HORIZONTAL_RULE_ALT,
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
  TAG_CAPTION,
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
  TAG_NOEMBED,
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
import { blockOpenPrefix, continuationPrefix, escapeHtml, getLanguageFromClass, isEmptyLinkHref, isInsideHeading, isInsideTableCell, isSafeHtmlUrl, listMarkerLineStart, orderedItemNumber, parseUnsignedInteger } from './utils'

const TRACKING_PARAM_RE = /^(?:utm_|fbclid|gclid|mc_eid|msclkid|oly_)/
const URL_SCHEME_RE = /^[A-Z][\dA-Z+.-]*:/i
const SLASH_CHAR = 47

function stripTrackingParams(url: string): string {
  const queryStart = url.indexOf('?')
  const fragmentStart = url.indexOf('#')
  if (queryStart === -1 || (fragmentStart !== -1 && fragmentStart < queryStart))
    return url

  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart
  const query = url.slice(queryStart + 1, queryEnd)
    .split('&')
    .filter(parameter => !TRACKING_PARAM_RE.test(parameter))
    .join('&')
  return `${url.slice(0, queryStart)}${query ? `?${query}` : ''}${url.slice(queryEnd)}`
}

/** Index of the first `?` or `#` at or after `from`, else `value.length`. */
function pathEnd(value: string, from: number): number {
  const query = value.indexOf('?', from)
  const fragment = value.indexOf('#', from)
  if (query === -1)
    return fragment === -1 ? value.length : fragment
  return fragment === -1 ? query : Math.min(query, fragment)
}

function hasDotSegment(path: string): boolean {
  // No `.` anywhere rules out a dot segment.
  return path.includes('.')
    && (path === '.' || path === '..' || path.startsWith('./') || path.startsWith('../')
      || path.includes('/./') || path.includes('/../') || path.endsWith('/.') || path.endsWith('/..'))
}

/** `dir` starts and ends with `/`; a `..` never climbs past the root. */
function mergeDotSegments(dir: string, rest: string): string {
  let out = dir
  let index = 0
  for (;;) {
    let end = rest.indexOf('/', index)
    const last = end === -1
    if (last)
      end = rest.length
    const segment = rest.slice(index, end)
    if (segment === '..')
      // lastIndexOf clamps a negative start to 0, which holds `out` at the root.
      out = out.slice(0, out.lastIndexOf('/', out.length - 2) + 1)
    else if (segment !== '.')
      out += last ? segment : `${segment}/`
    if (last)
      return out
    index = end + 1
  }
}

// One origin serves a whole document, so its split is kept until a different
// one arrives. Keying by the string keeps interleaved conversions correct.
let baseOrigin: string | undefined
let baseRoot = ''
let basePath = ''
let baseDir = ''

/** False when `origin` has no `scheme://authority` to resolve against. */
function loadBase(origin: string): boolean {
  if (origin !== baseOrigin) {
    baseOrigin = origin
    baseRoot = ''
    const authority = origin.indexOf('://')
    if (authority !== -1) {
      // The base query and fragment take no part in resolution.
      const end = pathEnd(origin, authority + 3)
      const slash = origin.indexOf('/', authority + 3)
      const rootEnd = slash === -1 || slash > end ? end : slash
      baseRoot = origin.slice(0, rootEnd)
      basePath = origin.slice(rootEnd, end)
      baseDir = basePath.slice(0, basePath.lastIndexOf('/') + 1) || '/'
    }
  }
  return baseRoot !== ''
}

function resolveAgainstBase(origin: string, url: string): string {
  if (!loadBase(origin)) {
    let prefix = origin
    while (prefix.endsWith('/'))
      prefix = prefix.slice(0, -1)
    const path = url.startsWith('./') ? url.slice(2) : url
    return `${prefix}${path.charCodeAt(0) === SLASH_CHAR ? '' : '/'}${path}`
  }

  // Only the path resolves; query and fragment carry across.
  const end = pathEnd(url, 0)
  const path = url.slice(0, end)
  const suffix = end === url.length ? '' : url.slice(end)
  if (!path)
    return `${baseRoot}${basePath}${suffix}`

  const dot = hasDotSegment(path)
  if (path.charCodeAt(0) === SLASH_CHAR)
    return `${baseRoot}${dot ? mergeDotSegments('/', path.slice(1)) : path}${suffix}`
  return `${baseRoot}${dot ? mergeDotSegments(baseDir, path) : baseDir + path}${suffix}`
}

export function resolveUrl(url: string, origin?: string, clean?: EngineOptions['clean']): string {
  if (!url || url[0] === '#')
    return url

  const isSlash = url.charCodeAt(0) === SLASH_CHAR
  let resolved = url
  if (isSlash && url.charCodeAt(1) === SLASH_CHAR) {
    // A network-path reference inherits only the base scheme.
    let scheme = 'https'
    if (origin && loadBase(origin))
      scheme = baseRoot.slice(0, baseRoot.indexOf(':'))
    resolved = `${scheme}:${url}`
  }
  // An explicit scheme (`mailto:`, `https:`, …) means absolute.
  else if (origin && (isSlash || !URL_SCHEME_RE.test(url))) {
    resolved = resolveAgainstBase(origin, url)
  }

  const cleansUrls = clean === true || (!!clean && clean.urls === true)
  return cleansUrls && resolved.includes('?') ? stripTrackingParams(resolved) : resolved
}

export function safeAnchorOutput(node: ElementNode, options: EngineOptions | undefined, entering: boolean, protectMarkdown = false): string | undefined {
  const href = node.attributes?.href
  if (!href || !isSafeHtmlUrl(href))
    return
  const resolved = resolveUrl(href, options?.origin, options?.clean)
  if (!isSafeHtmlUrl(resolved))
    return
  if (!entering)
    return '</a>'
  const escapedHref = escapeHtml(resolved, true, protectMarkdown)
  const title = node.attributes?.title === undefined
    ? ''
    : ` title="${escapeHtml(node.attributes.title, true, protectMarkdown)}"`
  return `<a href="${escapedHref}"${title}>`
}

function serializeMarkdownDestination(destination: string): string {
  if (!/[\t\n\f\r ()\\<>]/.test(destination))
    return destination

  const escaped = /[\\<>]/.test(destination)
    ? destination.replace(/[\\<>]/g, '\\$&')
    : destination
  return `<${escaped}>`
}

function stripsEmptyLink(state: HandlerContext['state'], href: string): boolean {
  const clean = state.options?.clean
  if (!(clean === true || (typeof clean === 'object' && clean.emptyLinks)))
    return false
  return isEmptyLinkHref(href)
}

function serializeMarkdownTitle(title: string): string {
  return /[\\"]/.test(title)
    ? title.replace(/[\\"]/g, '\\$&')
    : title
}

function serializeMarkdownResource(destination: string, title?: string): string {
  const serializedTitle = title ? ` "${serializeMarkdownTitle(title)}"` : ''
  return `(${serializeMarkdownDestination(destination)}${serializedTitle})`
}

function serializeImageDescription(alt: string): string {
  return /[\\[\]*_`~<&]/.test(alt)
    ? alt.replace(/[\\[\]*_`~<&]/g, '\\$&')
    : alt
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

export function renderBreak(node: HandlerContext['node'], state: HandlerContext['state']): string {
  // A literal newline would terminate a table row/ATX heading or collapse
  // inside a raw HTML block, so preserve the inline HTML there.
  const depthMap = state.depthMap!
  if (isInsideTableCell(state) || isInsideRawHtmlBlock(depthMap) || isInsideHeading(depthMap)) {
    return '<br>'
  }
  // Hard-break markers are literal content inside code.
  if (depthMap[TAG_PRE] || depthMap[TAG_CODE])
    return '\n'

  const prefix = continuationPrefix(
    node,
    state.listIndentWidths || [],
    !state.bufferedBlockquoteDepth,
  )
  return `  \n${prefix}`
}

export const breakHandler: TagHandler = {
  enter: ({ node, state }) => renderBreak(node, state),
  isSelfClosing: true,
  spacing: NO_SPACING,
  collapsesInnerWhiteSpace: true,
  isInline: true,
}

// A `#` run closing a heading is an ATX closing sequence and is dropped by the
// renderer, so the last one is escaped back into content.
function escapeTrailingHeadingHashes(buffer: string[]): void {
  let index = buffer.length - 1
  while (index >= 0 && buffer[index] === '')
    index--
  if (index < 0)
    return

  const entry = buffer[index]!
  let end = entry.length
  while (end > 0 && (entry[end - 1] === ' ' || entry[end - 1] === '\t'))
    end--
  let run = end
  while (run > 0 && entry[run - 1] === '#')
    run--
  if (run === end)
    return

  // Only a run opening the heading content or preceded by whitespace closes it.
  // Requiring a space also rejects the `## ` prefix entry of an empty heading.
  const previous = buffer[index - 1]
  const before = run > 0 ? entry[run - 1] : previous?.charAt(previous.length - 1)
  if (before !== ' ' && before !== '\t')
    return

  buffer[index] = `${entry.slice(0, run)}\\${entry.slice(run)}`
}

// What the current output line holds where a table row is about to be written.
const LINE_FRESH = -1 // a newline already opened the content column
const LINE_OPEN = 0 // nothing but block prefix, or a pending list marker
const LINE_ROW = 1 // a row left open mid-line
const LINE_CONTENT = 2 // other content, so the row needs a block break

// A row must open its own line at the item's content column: sharing one with
// preceding content (a `<caption>`) leaves the header as prose and the
// delimiter row never forms a table.
function lineStateBeforeRow(buffer: string[]): number {
  let fragment = buffer.length - 1
  while (fragment >= 0 && buffer[fragment]!.length === 0)
    fragment--
  if (fragment < 0)
    return LINE_OPEN
  // Rows end their line, so the row after a row decides on one character and
  // never rescans the line it just wrote.
  const tail = buffer[fragment]!
  if (tail.charCodeAt(tail.length - 1) === 10)
    return LINE_FRESH

  let firstNonSpace = -1
  let markerFragment = -1
  let markerIndex = -1
  let cursor = tail.length
  for (;;) {
    if (cursor === 0) {
      if (--fragment < 0)
        break
      cursor = buffer[fragment]!.length
      continue
    }
    const code = buffer[fragment]!.charCodeAt(--cursor)
    if (code === 10)
      break
    if (code !== 32 && code !== 9) {
      firstNonSpace = code
      if (markerFragment < 0) {
        markerFragment = fragment
        markerIndex = cursor
      }
    }
  }

  if (firstNonSpace === -1)
    return LINE_OPEN
  // A row already open only needs its line broken, not a new block.
  if (firstNonSpace === 124) // |
    return LINE_ROW
  // A pending list marker is block prefix, not content: a table's first row
  // belongs on it.
  return listMarkerLineStart(buffer, markerFragment, markerIndex) ? LINE_OPEN : LINE_CONTENT
}

// A row's own line at the enclosing list item's content column. Outside a list
// the marker is constant, which covers most tables.
function rowMarker(state: HandlerContext['state']): string {
  const indent = state.listIndent
  const lineState = lineStateBeforeRow(state.buffer)
  if (!indent) {
    return lineState === LINE_ROW ? '\n| ' : lineState === LINE_CONTENT ? '\n\n| ' : '| '
  }
  switch (lineState) {
    case LINE_ROW:
      return `\n${indent}| `
    case LINE_CONTENT:
      return `\n\n${indent}| `
    case LINE_FRESH:
      return `${indent}| `
    default:
      // A pending list marker already supplies the content column.
      return '| '
  }
}

const MAX_CELL_SPAN = 64

// GFM has no `colspan`: a spanned cell is written as its content followed by empty
// cells, or the delimiter row is too narrow and GFM drops every cell past it.
function cellEnter(node: HandlerContext['node'], state: HandlerContext['state']): string {
  if (node.index === 0)
    return ''
  // GFM discards cells past the delimiter row's width, so this one folds into
  // the previous cell rather than vanishing.
  const header = state.tableHeaderCells || 0
  return header > 0 && (state.tableCurrentRowCells || 0) >= header ? ' ' : ' | '
}

function cellExit(node: HandlerContext['node'], state: HandlerContext['state']): string | undefined {
  const parsedSpan = parseUnsignedInteger((node as { attributes?: Record<string, string> }).attributes?.colspan)
  const span = parsedSpan && parsedSpan < 256 ? Math.min(parsedSpan, MAX_CELL_SPAN) : 1
  state.tableCurrentRowCells! += span
  return span > 1 ? ' |'.repeat(span - 1) : undefined
}

function handleHeading(depth: number): TagHandler {
  return {
    // A `#` prefix needs its own line, which a GFM row cannot give it.
    enter: ({ state }) => {
      if ((state.depthMap?.[TAG_A] || 0) > 0 || isInsideTableCell(state)) {
        return `<h${depth}>`
      }
      return `${'#'.repeat(depth)} `
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_A] || 0) > 0 || isInsideTableCell(state)) {
        return `</h${depth}>`
      }
      escapeTrailingHeadingHashes(state.buffer)
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
// Fallback content a browser with the feature enabled does not render. Both
// flags are needed: isNonNesting alone emits the raw text, excludesTextNodes
// alone still parses descendant markup into elements.
const INERT_RAWTEXT: TagHandler = {
  isNonNesting: true,
  excludesTextNodes: true,
  spacing: NO_SPACING,
}

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
  [TAG_BR]: breakHandler,
  [TAG_H1]: handleHeading(1),
  [TAG_H2]: handleHeading(2),
  [TAG_H3]: handleHeading(3),
  [TAG_H4]: handleHeading(4),
  [TAG_H5]: handleHeading(5),
  [TAG_H6]: handleHeading(6),
  [TAG_HR]: {
    enter: ({ node, state }) => {
      // A thematic break cannot end a GFM row; raw <hr> can sit in a cell.
      if (isInsideTableCell(state))
        return '<hr>'
      // `continuationPrefix` allocates an ancestor chain, so only a rule that
      // can actually carry a prefix asks for one.
      if (!(state.depthMap?.[TAG_LI] || state.bufferedBlockquoteDepth))
        return MARKDOWN_HORIZONTAL_RULE
      const prefix = continuationPrefix(
        node,
        state.listIndentWidths || [],
        !state.bufferedBlockquoteDepth,
      )
      if (!prefix)
        return MARKDOWN_HORIZONTAL_RULE
      if (state.depthMap?.[TAG_LI])
        state.listRulePending = prefix
      const open = blockOpenPrefix(state.buffer, prefix)
      // Sharing the marker's line, where `---` would make the whole line a
      // thematic break and take the item with it.
      return open === undefined
        ? MARKDOWN_HORIZONTAL_RULE_ALT
        : `${open}${MARKDOWN_HORIZONTAL_RULE}`
    },
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
      // The processor prefixes the completed subtree once every structural
      // newline is known. Preserve the list marker's trailing space here.
      const output = (state.depthMap?.[TAG_LI] || 0) > 0 ? '\n' : undefined
      return { _tag: 'BlockquoteEnter', output }
    },
    exit: () => ({ _tag: 'BlockquoteExit' }),
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
      return {
        _tag: 'PreEnter',
        language: getLanguageFromClass(node.attributes?.class),
      }
    },
    exit: ({ state }) => {
      if (isInsideTableCell(state)) {
        return '</pre>'
      }
      return { _tag: 'PreExit' }
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
        // A fence is already open for this <pre>: the <pre> opened it (mixed text
        // + <code> children) or an earlier <code> sibling did.
        if (state.preFenceOpen) {
          return undefined
        }
        const language = getLanguageFromClass(node.attributes?.class)
        const liDepth = state.depthMap?.[TAG_LI] || 0
        if (liDepth > 0) {
          const indent = state.listIndent
          // A blank line between the marker and the fence ends the item, leaving
          // the block a sibling of the list.
          const open = blockOpenPrefix(state.buffer, indent) ?? ''
          return {
            _tag: 'CodeFenceEnter',
            language,
            output: `${open}${MARKDOWN_CODE_BLOCK}${language}\n`,
          }
        }
        return {
          _tag: 'CodeFenceEnter',
          language,
          output: `${MARKDOWN_CODE_BLOCK}${language}\n`,
        }
      }
      if (isInsideRawHtmlBlock(state.depthMap!)) {
        return '<code>'
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
          return { _tag: 'CodeSpanEnter', output: ` ${MARKDOWN_INLINE_CODE}` }
        }
      }
      return { _tag: 'CodeSpanEnter', output: MARKDOWN_INLINE_CODE }
    },
    exit: ({ state }) => {
      if ((state.depthMap?.[TAG_PRE] || 0) > 0) {
        // Raw <code> close inside a table cell (issue #147).
        if (isInsideTableCell(state)) {
          return '</code>'
        }
        // The <pre> exit owns the closing fence, so a text sibling after this
        // </code> still lands inside the block.
        return undefined
      }
      if (isInsideRawHtmlBlock(state.depthMap!)) {
        return '</code>'
      }
      return { _tag: 'CodeSpanExit' }
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
      const marker = isOrdered ? `${orderedItemNumber(node.parent, node.index)}. ` : '- '
      return `${state.listIndent}${marker}`
    },
    exit: ({ state }) => isInsideTableCell(state) ? '</li>' : undefined,
    spacing: LIST_ITEM_SPACING,
  },
  [TAG_A]: {
    enter: ({ node, state }) => {
      if (node.attributes?.href !== undefined) {
        if (stripsEmptyLink(state, node.attributes.href))
          return
        if (isInsideRawHtmlBlock(state.depthMap!))
          return safeAnchorOutput(node, state.options, true, true)
        return '['
      }
    },
    exit: ({ node, state }) => {
      if (node.attributes?.href === undefined) {
        return ''
      }
      if (stripsEmptyLink(state, node.attributes.href))
        return ''
      if (isInsideRawHtmlBlock(state.depthMap!) && !node.tagHandler?.literalEnter)
        return safeAnchorOutput(node, state.options, false, true)
      const href = resolveUrl(node.attributes.href, state.options?.origin, state.options?.clean)
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
      return `]${serializeMarkdownResource(href, title)}`
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_IMG]: {
    enter: ({ node, state }) => {
      const alt = node.attributes?.alt || ''
      const src = resolveUrl(node.attributes?.src || '', state.options?.origin, state.options?.clean)
      return `![${serializeImageDescription(alt)}]${serializeMarkdownResource(src, node.attributes?.title)}`
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
      state.tableHeaderCells = 0
    },
    exit: ({ state }) => isInsideTableCell(state) ? '</table>' : undefined,
  },
  // Inside a list item nothing else writes the caption's content column: glued to
  // preceding text it swallows the table's first row, and at column 0 it takes the
  // table out of the item.
  [TAG_CAPTION]: {
    enter: ({ state }) => {
      if ((state.depthMap?.[TAG_LI] || 0) === 0 || isInsideTableCell(state))
        return undefined
      return blockOpenPrefix(state.buffer, state.listIndent)
    },
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
      return rowMarker(state)
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

        state.tableHeaderCells = alignments.length
        const indent = (state.depthMap?.[TAG_LI] || 0) > 0 ? state.listIndent : ''
        return ` |\n${indent}| ${alignmentMarkers.join(' | ')} |`
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

      return cellEnter(node, state)
    },
    exit: ({ node, state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '</th>'
      }
      return cellExit(node, state)
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
  },
  [TAG_TD]: {
    enter: ({ node, state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '<td>'
      }
      return cellEnter(node, state)
    },
    exit: ({ node, state }) => {
      if ((state.depthMap?.[TAG_TABLE] || 0) > 1) {
        return '</td>'
      }
      return cellExit(node, state)
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
  },
  [TAG_P]: {
    enter: ({ state }) => {
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
  [TAG_IFRAME]: { ...INERT_RAWTEXT },
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
  [TAG_NOSCRIPT]: { ...INERT_RAWTEXT },
  [TAG_NOEMBED]: { ...INERT_RAWTEXT },
  [TAG_DATALIST]: {
    // <datalist> holds <option> autocomplete data that browsers never render.
    // Treat the whole body as inert and drop it, mirroring <template>.
    isNonNesting: true,
    excludesTextNodes: true,
    spacing: NO_SPACING,
  },
  [TAG_NOFRAMES]: { ...INERT_RAWTEXT },
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
