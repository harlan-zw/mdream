export interface HTMLToMarkdownOptions {
  /**
   * Size of chunks to yield in streaming mode
   * @default 4096
   */
  chunkSize?: number
}

// Node interface for HTML DOM
export interface Node {
  type: number
  name?: string
  value?: string
  attributes?: Record<string, string>
  children: Node[]
  parent?: Node
}

// State management for markdown generation
export interface MarkdownState {
  lastOutputType: 'text' | 'newline' | 'blockstart' | 'blockend' | 'none'
  consecutiveNewlines: number
  blockquoteLevel: number
  inBlockquote: boolean
  inTable: boolean
  inTableHead: boolean
  isFirstRow: boolean
  currentRowCells: string[]
  columnAlignments: string[]
  tableData: string[][]
  // New state fields for better spacing control
  inList: boolean
  listLevel: number
  inListItem: boolean
  currentListItemHasNestedList: boolean
  lastWasList: boolean
  // Table colspan state tracking
  inColspan: boolean
  colspanWidth: number
}

// Node event type for traversal
export type NodeEvent =
  | { type: 'enter', node: Node }
  | { type: 'exit', node: Node }

// Stack item for node traversal
export interface StackItem {
  node: Node
  visiting: boolean
}
