import type { HandlerContext } from './types.ts'
import { getNodeDepth, isNodeInStack } from './utils.ts'

export const tagHandlers: Record<
  string,
  {
    enter?: (context: HandlerContext) => string
    exit?: (context: HandlerContext) => string
  }
> = {
  head: {
    // frontmatter
    enter: () => `---`,
    exit: () => `\n---\n\n`,
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
    exit: () => `"`,
  },
  meta: {
    // only description
    enter: ({ node }) => {
      if (node.attributes?.name === 'description') {
        const description = node.attributes?.content || ''
        return `\ndescription: "${description}"`
      }
      return ''
    },
  },
  br: {
    enter: ({ state }) => {
      // if we're inside a td we need to keep the <br>
      if (isNodeInStack(state, 'td')) {
        return '<br>'
      }
      return ''
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
    enter: () => ('---'),
  },
  strong: {
    enter: () => ('**'),
    exit: () => ('**'),
  },
  b: {
    enter: () => ('**'),
    exit: () => ('**'),
  },
  em: {
    enter: () => ('*'),
    exit: () => ('*'),
  },
  i: {
    enter: () => ('*'),
    exit: () => ('*'),
  },
  del: {
    enter: () => ('~~'),
    exit: () => ('~~'),
  },
  sub: {
    enter: () => ('<sub>'),
    exit: () => ('</sub>'),
  },
  sup: {
    enter: () => ('<sup>'),
    exit: () => ('</sup>'),
  },
  ins: {
    enter: () => ('<ins>'),
    exit: () => ('</ins>'),
  },
  blockquote: {
    enter: ({ state }) => {
      const depth = getNodeDepth(state, 'blockquote')
      return '> '.repeat(depth)
    },
  },
  code: {
    enter: ({ node, state }) => {
      node.context = {
        isMultiline: isNodeInStack(state, 'pre'),
      }
      if (node.context.isMultiline) {
        // Get language from class attribute if it exists
        let language = ''
        if (node.attributes?.class) {
          const langParts = node.attributes.class
            .split(' ')
            .map(c => c.split('language-')?.[1])
            .filter(Boolean)

          if (langParts.length > 0) {
            language = langParts[0].trim()
          }
        }

        // Check previous node type to determine spacing
        return (`\`\`\`${language}\n`)
      }
      return ('`')
    },
    exit: ({ node }) => {
      // Get code context
      if (node.context?.isMultiline) {
        return '\n```'
      }
      return ('`')
    },
  },
  pre: {
    enter: () => '',
  },
  ul: {
    enter: ({ state }) => {
      if (isNodeInStack(state, 'td')) {
        return '<ul>'
      }
      return ''
    },
    exit: ({ state }) => {
      if (isNodeInStack(state, 'td')) {
        return '</ul>'
      }
      return ''
    },
  },
  li: {
    enter: ({ state, node }) => {
      if (isNodeInStack(state, 'td')) {
        return '<li>'
      }
      // Calculate list nesting depth by counting ul/ol elements in the stack
      const stack = state.nodeStack.filter(Boolean).filter(ctx =>
        ctx.name === 'ul' || ctx.name === 'ol',
      )
      const parent = node.parentNode
      if (!parent) {
        return ''
      }
      const depth = stack.length - 1 // Subtract 1 because we're already inside a list
      const isOrdered = parent.name === 'ol'
      const indent = '  '.repeat(Math.max(0, depth))

      // Get list item index for ordered lists
      let index = 1
      if (isOrdered) {
        parent.context = parent.context || {
          index: 1,
        }
        index = parent.context.index++
      }

      const marker = isOrdered ? `${index}. ` : '- '

      // Get the index of this list item in its parent
      // Apply the indent before the marker
      return `${indent}${marker}`
    },
    exit: ({ node, state }) => {
      if (isNodeInStack(state, 'td')) {
        return '</li>'
      }
      const parent = node.parentNode
      if (!parent?.children)
        return ''

      // Find current item index in parent's children
      const currentIndex = parent.children.findIndex(child => child === node)
      const isLastItem = currentIndex === parent.children.length - 1

      // If this is not the last item, we need to ensure single line spacing
      if (!isLastItem) {
        // // If this is the end of a nested list, don't add extra newlines
        // const hasNestedList = node.children?.some(child =>
        //   child.type === ELEMENT_NODE && (child.name === 'ul' || child.name === 'ol'),
        // )

        // Reset pendingAfterNL to prevent extra newlines between list items
        state.pendingAfterNL = 0
      }

      return ''
    },
  },
  a: {
    enter: () => ('['),
    exit: ({ node, state }) => {
      let href = node.attributes?.href || ''
      // Resolve absolute paths if origin is provided
      if (href && href.startsWith('//')) {
        // make https
        href = `https:${href}`
      }
      else if (href && href.startsWith('/') && state.options?.origin) {
        // Remove trailing slash from origin if present
        const origin = state.options.origin.endsWith('/')
          ? state.options.origin.slice(0, -1)
          : state.options.origin

        href = `${origin}${href}`
      }
      return (`](${href})`)
    },
  },
  img: {
    enter: ({ node, state }) => {
      const alt = node.attributes?.alt || ''
      let src = node.attributes?.src || ''

      // Resolve absolute paths if origin is provided
      if (src && src.startsWith('//')) {
        // make https
        src = `https:${src}`
      }
      else
        if (src && src.startsWith('/') && state.options?.origin) {
        // Remove trailing slash from origin if present
          const origin = state.options.origin.endsWith('/')
            ? state.options.origin.slice(0, -1)
            : state.options.origin

          src = `${origin}${src}`
        }
      return `![${alt}](${src})`
    },
  },
  table: {
    enter: ({ state }) => {
      if (isNodeInStack(state, 'td')) {
        return '<table>'
      }
      // Initialize table state
      state.tableData = []
      state.tableCurrentRowCells = []
      state.tableColumnAlignments = []
      state.tableColspanWidth = 1
      return ''
    },
    exit: ({ state }) => {
      // if we're inside a td we need to keep the </table>
      if (isNodeInStack(state, 'td')) {
        return '</table>'
      }
      return ''
    },
  },
  tr: {
    enter: ({ state }) => {
      if (isNodeInStack(state, 'td')) {
        return '<tr>'
      }
      // Reset current row cells
      state.tableCurrentRowCells = []
      return '| '
    },
    exit: ({ state }) => {
      if (isNodeInStack(state, 'td')) {
        return '</tr>'
      }
      // Store the row
      state.tableData.push([...state.tableCurrentRowCells])
      // if this was the first row, we need to add the header separator
      if (state.tableData.length === 1) {
        let columnCount = 0
        for (const row of state.tableData) {
          columnCount = Math.max(columnCount, row.length)
        }
        // Ensure we have alignments for all columns
        while (state.tableColumnAlignments.length < columnCount) {
          state.tableColumnAlignments.push('')
        }

        // Map alignment values to markdown alignment syntax
        const alignmentMarkers = state.tableColumnAlignments.map((align) => {
          switch (align) {
            case 'left':
              return ':---'
            case 'center':
              return ':---:'
            case 'right':
              return '---:'
            default:
              return '---'
          }
        })

        return ` |\n| ${alignmentMarkers.join(' | ')} |`
      }
      return ' |'
    },
  },
  th: {
    enter: ({ node, state }) => {
      // Handle alignment for header cells
      if (node.attributes?.align) {
        const align = node.attributes.align.toLowerCase()

        // Store the alignment type directly, not the formatting
        state.tableColumnAlignments.push(align)
      }
      else if (state.tableColumnAlignments.length <= state.tableCurrentRowCells.length) {
        // Default alignment (no special alignment)
        state.tableColumnAlignments.push('')
      }

      const isNotFirstOrLast = node.parentNode?.children
        ? node.parentNode.children.filter(s => s.name === 'th')[0] === node
        : false

      return isNotFirstOrLast ? '' : ' | '
    },
    exit: ({ state }) => {
      // Store the content for this cell
      state.tableCurrentRowCells.push('')
      return ''
    },
  },
  td: {
    enter: ({ node, state }) => {
      if (getNodeDepth(state, 'table') > 1) {
        return '<td>'
      }
      // We only handle alignment in the th cells, not in td cells
      // Handle colspan only for td cells
      return node.parentNode?.children?.[0] === node ? '' : ' | '
    },
    exit: ({ state }) => {
      if (getNodeDepth(state, 'table') > 1) {
        return '</td>'
      }
      // Store the content for this cell
      state.tableCurrentRowCells.push('')
      return ''
    },
  },
  input: {
    enter: ({ node }) => {
      if (node.attributes?.type === 'checkbox') {
        const isChecked = node.attributes.checked !== undefined
        // Don't add trailing space, the text node will provide spacing
        return isChecked ? '[x]' : '[ ]'
      }
      return ''
    },
  },
}
