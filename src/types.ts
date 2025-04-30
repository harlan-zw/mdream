export interface HTMLToMarkdownOptions {
  /**
   * Size of chunks to yield in streaming mode
   * @default 4096
   */
  chunkSize?: number

  /**
   * Base URL for resolving relative image paths
   * If provided, relative image paths will be prefixed with this URL
   */
  imageResolver?: string

  /**
   * Origin URL for resolving relative image paths
   * If provided, relative image paths will be resolved against this origin
   */
  origin?: string

  /**
   * Only start processing nodes after encountering the first h1 element
   * @default true
   */
  startAtFirstH1?: boolean
}

// Node interface for HTML DOM
export interface Node {
  type: number
  name?: string
  value?: string
  attributes?: Record<string, string>
  parentNode?: Node | null
  children?: Node[]
  context?: Record<string, any>
  depth?: number // Adding depth property used during processing
  pre?: boolean // Flag to indicate if the node is inside a pre tag
  complete?: boolean
}

// State management for markdown generation
export interface DownstreamState {
  processingHTMLDocument: boolean
  buffer: string

  // Configuration options
  options: HTMLToMarkdownOptions

  // Element context stack to track nested elements
  nodeStack: Node[]

  // Node tracking state
  isInSupportedNode?: boolean
  unsupportedNode?: Node // Reference to the currently skipped unsupported node

  // Event tracking for streaming processing
  previousEvents?: NodeEvent[]

  // Table state
  tableData: string[][]
  tableCurrentRowCells: string[]
  tableColumnAlignments: string[]
  tableColspanWidth: number

  // Parser state for handling incomplete HTML chunks
  parseState?: {
    inTag: boolean
    inComment: boolean
    inDoctype: boolean
    inPreTag: boolean
  }

  // State for tracking first h1
  seenFirstH1?: boolean
  waitForFirstH1?: boolean
}

// Node event type for traversal
export type NodeEvent =
  | { type: 'enter', node: Node }
  | { type: 'exit', node: Node }

// Define handler context type
export interface HandlerContext {
  node: Node
  parent?: Node
  state: DownstreamState
}
