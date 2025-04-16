import type { HTMLToMarkdownOptions } from './types.ts'
import { generateNodeEvents, processNodeEvent } from './converter.ts'
import { parseHTML, populateNodeDepthMap } from './parser.ts'
import { findBestBreakPoint } from './utils.ts'

/**
 * Main function to convert HTML to Markdown
 */
export async function htmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): Promise<string> {
  const chunkSize = options.chunkSize || 4096
  const stream = htmlToMarkdownStream(html, { chunkSize })

  // Collect all chunks into a single string
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  // Join and trim any trailing newlines
  let result = chunks.join('')
  result = result.replace(/\n+$/, '')

  return result
}

/**
 * Stream HTML to Markdown conversion
 */
export async function* htmlToMarkdownStream(
  html: string,
  options: HTMLToMarkdownOptions = {},
): AsyncGenerator<string> {
  const chunkSize = options.chunkSize || 4096

  try {
    // Parse HTML into a DOM tree
    const doc = parseHTML(html)

    // Initialize state
    const state = {
      lastOutputType: 'none',
      consecutiveNewlines: 0,
      blockquoteLevel: 0,
      inBlockquote: false,
      inTable: false,
      inTableHead: false,
      isFirstRow: false,
      currentRowCells: [],
      columnAlignments: [],
      tableData: [],
      // List state fields
      inList: false,
      listLevel: 0,
      inListItem: false,
      currentListItemHasNestedList: false,
      lastWasList: false,
      // Table colspan state
      inColspan: false,
      colspanWidth: 1
    }

    // Get the node depth map that was populated during parsing
    const nodeDepthMap = new Map<Node, number>()
    // We need to populate the node depth map for the document
    populateNodeDepthMap(doc, nodeDepthMap)

    // Buffer for accumulating markdown output
    let buffer = ''

    // Process the document in a depth-first traversal
    for await (const event of generateNodeEvents(doc)) {
      const markdownFragment = processNodeEvent(
        event,
        state,
        nodeDepthMap,
      )

      buffer += markdownFragment

      // If buffer exceeds chunk size, yield a chunk
      if (buffer.length >= chunkSize) {
        const breakPoint = findBestBreakPoint(buffer, chunkSize)
        const chunk = buffer.substring(0, breakPoint)
        buffer = buffer.substring(breakPoint)

        yield chunk
      }
    }

    // Trim trailing newlines from the final output
    buffer = buffer.replace(/\n+$/, '')

    // Yield any remaining content
    if (buffer.length > 0) {
      yield buffer
    }
  }
  catch (error) {
    console.error('Error converting HTML to Markdown:', error)
    yield '<!-- Error converting HTML to Markdown -->'
  }
}

export type * from './types.ts'

