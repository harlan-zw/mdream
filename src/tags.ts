import type { HandlerContext } from './types.ts'

interface TagHandler {
  enter?: (context: HandlerContext) => string | undefined | void
  exit?: (context: HandlerContext) => string | undefined | void
}

// Pre-defined strings to avoid repeated allocations
const FRONTMATTER_START = '---'
const FRONTMATTER_END = '\n---\n\n'
const MARKDOWN_STRONG = '**'
const MARKDOWN_EMPHASIS = '*'
const MARKDOWN_STRIKETHROUGH = '~~'
const MARKDOWN_CODE_BLOCK = '```'
const MARKDOWN_INLINE_CODE = '`'
const MARKDOWN_HORIZONTAL_RULE = '---'

// Helper function to resolve URLs
function resolveUrl(url: string, origin?: string): string {
  if (!url)
    return url

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  if (url.startsWith('/') && origin) {
    // Remove trailing slash from origin if present
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin
    return `${cleanOrigin}${url}`
  }

  return url
}

// Helper function to check if we're inside a table cell
function isInsideTableCell(node: HandlerContext['node']): boolean {
  return node.depthMap.td > 0
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

export const tagHandlers: Record<string, TagHandler> = {
  head: {
    enter: () => FRONTMATTER_START,
    exit: () => FRONTMATTER_END,
  },
  details: {
    enter: () => '<details>',
    exit: () => '</details>',
  },
  summary: {
    enter: () => '<summary>',
    exit: () => '</summary>',
  },
  title: {
    enter: () => '\ntitle: "',
    exit: () => '"',
  },
  meta: {
    enter: ({ node }) => {
      const { name, content } = node.attributes || {}
      if (name === 'description') {
        return `\ndescription: "${content || ''}"`
      }
    },
  },
  br: {
    enter: ({ node }) => {
      // Keep <br> inside table cells
      return isInsideTableCell(node) ? '<br>' : undefined
    },
  },
  h1: {
    enter: () => '# ',
  },
  h2: {
    enter: () => '## ',
  },
  h3: {
    enter: () => '### ',
  },
  h4: {
    enter: () => '#### ',
  },
  h5: {
    enter: () => '##### ',
  },
  h6: {
    enter: () => '###### ',
  },
  hr: {
    enter: () => MARKDOWN_HORIZONTAL_RULE,
  },
  strong: {
    enter: () => MARKDOWN_STRONG,
    exit: () => MARKDOWN_STRONG,
  },
  b: {
    enter: () => MARKDOWN_STRONG,
    exit: () => MARKDOWN_STRONG,
  },
  em: {
    enter: () => MARKDOWN_EMPHASIS,
    exit: () => MARKDOWN_EMPHASIS,
  },
  i: {
    enter: () => MARKDOWN_EMPHASIS,
    exit: () => MARKDOWN_EMPHASIS,
  },
  del: {
    enter: () => MARKDOWN_STRIKETHROUGH,
    exit: () => MARKDOWN_STRIKETHROUGH,
  },
  sub: {
    enter: () => '<sub>',
    exit: () => '</sub>',
  },
  sup: {
    enter: () => '<sup>',
    exit: () => '</sup>',
  },
  ins: {
    enter: () => '<ins>',
    exit: () => '</ins>',
  },
  blockquote: {
    enter: ({ node }) => {
      const depth = node.depthMap.blockquote || 1
      return '> '.repeat(depth)
    },
  },
  code: {
    enter: ({ node }) => {
      if (node.depthMap.pre > 0) {
        const language = getLanguageFromClass(node.attributes?.class)
        return `${MARKDOWN_CODE_BLOCK}${language}\n`
      }
      return MARKDOWN_INLINE_CODE
    },
    exit: ({ node }) => {
      return node.depthMap.pre > 0
        ? `\n${MARKDOWN_CODE_BLOCK}`
        : MARKDOWN_INLINE_CODE
    },
  },
  ul: {
    enter: ({ node }) => isInsideTableCell(node) ? '<ul>' : undefined,
    exit: ({ node }) => isInsideTableCell(node) ? '</ul>' : undefined,
  },
  li: {
    enter: ({ node }) => {
      if (isInsideTableCell(node)) {
        return '<li>'
      }

      // Calculate list nesting depth
      const depth = (node.depthMap.ul || 0) + (node.depthMap.ol || 0) - 1
      const isOrdered = node.parentNode?.name === 'ol'
      const indent = '  '.repeat(Math.max(0, depth))
      const marker = isOrdered ? `${node.index + 1}. ` : '- '

      return `${indent}${marker}`
    },
    exit: ({ node }) => isInsideTableCell(node) ? '</li>' : undefined,
  },
  a: {
    enter: () => '[',
    exit: ({ node, state }) => {
      const href = resolveUrl(node.attributes?.href || '', state.options?.origin)
      return `](${href})`
    },
  },
  img: {
    enter: ({ node, state }) => {
      const alt = node.attributes?.alt || ''
      const src = resolveUrl(node.attributes?.src || '', state.options?.origin)
      return `![${alt}](${src})`
    },
  },
  table: {
    enter: ({ node, state }) => {
      if (isInsideTableCell(node)) {
        return '<table>'
      }
      // Initialize table state
      state.tableColumnAlignments = []
    },
    exit: ({ node }) => isInsideTableCell(node) ? '</table>' : undefined,
  },
  thead: {
    enter: ({ node, state }) => {
      if (isInsideTableCell(node)) {
        return '<thead>'
      }
      state.tableNeedsThead = true
    },
    exit: ({ node }) => isInsideTableCell(node) ? '</thead>' : undefined,
  },
  tr: {
    enter: ({ node, state }) => {
      if (isInsideTableCell(node)) {
        return '<tr>'
      }
      state.tableCurrentRowCells = 0
      return '| '
    },
    exit: ({ node, state }) => {
      if (isInsideTableCell(node)) {
        return '</tr>'
      }

      // Handle header row separator
      if (state.tableNeedsThead) {
        state.tableNeedsThead = false

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
  },
  th: {
    enter: ({ node, state }) => {
      if (node.depthMap.table > 1) {
        return '<th>'
      }

      if (state.tableNeedsThead !== false) {
        state.tableNeedsThead = true
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
      if (node.depthMap.table > 1) {
        return '</th>'
      }
      state.tableCurrentRowCells!++
    },
  },
  td: {
    enter: ({ node }) => {
      if (node.depthMap.table > 1) {
        return '<td>'
      }
      return node.index === 0 ? '' : ' | '
    },
    exit: ({ node, state }) => {
      if (node.depthMap.table > 1) {
        return '</td>'
      }
      state.tableCurrentRowCells!++
    },
  },
}
