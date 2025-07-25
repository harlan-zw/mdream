import type { HandlerContext, TagHandler } from './types'
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
  TAG_FOOTER,
  TAG_FORM,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_HEAD,
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
  TAG_MAP,
  TAG_MARK,
  TAG_META,
  TAG_METER,
  TAG_NAV,
  TAG_NOFRAMES,
  TAG_NOSCRIPT,
  TAG_OL,
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
  TAG_SAMP,
  TAG_SCRIPT,
  TAG_SELECT,
  TAG_SMALL,
  TAG_SOURCE,
  TAG_SPAN,
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
} from './const.ts'

// Helper function to resolve URLs
function resolveUrl(url: string, origin?: string): string {
  if (!url)
    return url

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  if (origin) {
    if (url.startsWith('/') && origin) {
      // Remove trailing slash from origin if present
      const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin
      return `${cleanOrigin}${url}`
    }
    // handle ./ paths
    if (url.startsWith('./')) {
      return `${origin}/${url.slice(2)}`
    }

    // relative url
    if (!url.startsWith('http')) {
      // Remove leading slash if present
      const cleanUrl = url.startsWith('/') ? url.slice(1) : url
      return `${origin}/${cleanUrl}`
    }
  }

  return url
}

// Helper function to check if we're inside a table cell
function isInsideTableCell(node: HandlerContext['node']): boolean {
  return node.depthMap[TAG_TD] > 0
}

// Helper function to get language from code class attribute
function getLanguageFromClass(className: string | undefined): string {
  if (!className)
    return ''

  const langParts = className
    .split(' ')
    .map(c => c.split('language-')[1])
    .filter(Boolean)

  return langParts.length > 0 ? langParts[0].trim() : ''
}

function handleHeading(depth: number): TagHandler {
  return {
    enter: ({ node }) => {
      if (node.depthMap[TAG_A]) {
        return `<h${depth}>`
      }
      return `${'#'.repeat(depth)} `
    },
    exit: ({ node }) => {
      if (node.depthMap[TAG_A]) {
        return `</h${depth}>`
      }
    },
    collapsesInnerWhiteSpace: true,
  }
}

const Strong: TagHandler = {
  enter: ({ node }) => {
    // we are already bold
    if (node.depthMap[TAG_B] > 1) {
      return ''
    }
    return MARKDOWN_STRONG
  },
  exit: ({ node }) => {
    // we are already bold
    if (node.depthMap[TAG_B] > 1) {
      return ''
    }
    return MARKDOWN_STRONG
  },
  collapsesInnerWhiteSpace: true,
  spacing: NO_SPACING,
  isInline: true,
}

const Emphasis: TagHandler = {
  enter: ({ node }) => {
    // we are already italic
    if (node.depthMap[TAG_I] > 1) {
      return ''
    }
    return MARKDOWN_EMPHASIS
  },
  exit: ({ node }) => {
    // we are already italic
    if (node.depthMap[TAG_I] > 1) {
      return ''
    }
    return MARKDOWN_EMPHASIS
  },
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
    enter: () => '<details>',
    exit: () => '</details>\n\n',
  },
  [TAG_SUMMARY]: {
    enter: () => '<summary>',
    exit: () => '</summary>\n\n',
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
    enter: ({ node }) => {
      // Keep <br> inside table cells
      return isInsideTableCell(node) ? '<br>' : undefined
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
  [TAG_DEL]: {
    enter: () => MARKDOWN_STRIKETHROUGH,
    exit: () => MARKDOWN_STRIKETHROUGH,
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
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
    enter: ({ node }) => {
      const depth = node.depthMap[TAG_BLOCKQUOTE] || 1
      let prefix = '> '.repeat(depth)

      // Add indentation if inside a list item
      if (node.depthMap[TAG_LI] > 0) {
        prefix = `\n${'  '.repeat(node.depthMap[TAG_LI])}${prefix}`
      }

      return prefix
    },
    spacing: BLOCKQUOTE_SPACING,
  },
  [TAG_CODE]: {
    enter: ({ node }) => {
      if ((node.depthMap[TAG_PRE] || 0) > 0) {
        const language = getLanguageFromClass(node.attributes?.class)
        return `${MARKDOWN_CODE_BLOCK}${language}\n`
      }
      return MARKDOWN_INLINE_CODE
    },
    exit: ({ node }) => {
      return node.depthMap[TAG_PRE] > 0
        ? `\n${MARKDOWN_CODE_BLOCK}`
        : MARKDOWN_INLINE_CODE
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_UL]: {
    enter: ({ node }) => isInsideTableCell(node) ? '<ul>' : undefined,
    exit: ({ node }) => isInsideTableCell(node) ? '</ul>' : undefined,
  },
  [TAG_LI]: {
    enter: ({ node }) => {
      if (isInsideTableCell(node)) {
        return '<li>'
      }

      // Calculate list nesting depth
      const depth = (node.depthMap[TAG_UL] || 0) + (node.depthMap[TAG_OL] || 0) - 1
      const isOrdered = node.parent?.tagId === TAG_OL
      const indent = '  '.repeat(Math.max(0, depth))
      const marker = isOrdered ? `${node.index + 1}. ` : '- '

      return `${indent}${marker}`
    },
    exit: ({ node }) => isInsideTableCell(node) ? '</li>' : undefined,
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
      const href = resolveUrl(node.attributes?.href || '', state.options?.origin)
      let title = node.attributes?.title
      // Check if title matches the last content to avoid duplication
      const lastContent = state.lastContentCache
      if (lastContent === title) {
        title = ''
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
      const src = resolveUrl(node.attributes?.src || '', state.options?.origin)
      return `![${alt}](${src})`
    },
    collapsesInnerWhiteSpace: true,
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
  },
  [TAG_TABLE]: {
    enter: ({ node, state }) => {
      if (isInsideTableCell(node)) {
        return '<table>'
      }
      if (node.depthMap[TAG_TABLE] <= 1) {
        state.tableRenderedTable = false
      }
      // Initialize table state
      state.tableColumnAlignments = []
    },
    exit: ({ node }) => isInsideTableCell(node) ? '</table>' : undefined,
  },
  [TAG_THEAD]: {
    enter: ({ node }) => {
      if (isInsideTableCell(node)) {
        return '<thead>'
      }
    },
    exit: ({ node }) => isInsideTableCell(node) ? '</thead>' : undefined,
    spacing: TABLE_ROW_SPACING,
    excludesTextNodes: true,
  },
  [TAG_TR]: {
    enter: ({ node, state }) => {
      if (isInsideTableCell(node)) {
        return '<tr>'
      }
      state.tableCurrentRowCells = 0
      return '| '
    },
    exit: ({ node, state }) => {
      if (isInsideTableCell(node) || node.depthMap[TAG_TABLE] > 1) {
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
      if (node.depthMap[TAG_TABLE] > 1) {
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
    exit: ({ node, state }) => {
      if (node.depthMap[TAG_TABLE] > 1) {
        return '</th>'
      }
      state.tableCurrentRowCells!++
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
  },
  [TAG_TD]: {
    enter: ({ node }) => {
      if (node.depthMap[TAG_TABLE] > 1) {
        return '<td>'
      }
      return node.index === 0 ? '' : ' | '
    },
    exit: ({ node, state }) => {
      if (node.depthMap[TAG_TABLE] > 1) {
        return '</td>'
      }
      state.tableCurrentRowCells!++
    },
    collapsesInnerWhiteSpace: true,
    spacing: NO_SPACING,
  },
  [TAG_P]: {},
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
    isInline: true,
  },
  [TAG_BODY]: { spacing: NO_SPACING },
  [TAG_CENTER]: {
    // if in table cell we preserve
    enter: ({ node }) => {
      if (node.depthMap[TAG_TABLE] > 1) {
        return '<center>'
      }
    },
    exit: ({ node }) => {
      if (node.depthMap[TAG_TABLE] > 1) {
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
  },
  [TAG_BASE]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
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
  },
  [TAG_KEYGEN]: {
    isSelfClosing: true,
    spacing: NO_SPACING,
    isInline: true,
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
    isNonNesting: true,
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
}
