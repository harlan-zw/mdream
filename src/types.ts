/**
 * Worker factory configuration
 */
export interface WorkerConfig {
  /**
   * Worker factory function
   */
  factory: any // Using any to avoid circular dependencies
  
  /**
   * Maximum number of workers to create
   */
  maxWorkers?: number
}

export interface HTMLToMarkdownOptions {
  /**
   * Size of chunks to yield in streaming mode
   * @default 4096
   */
  chunkSize?: number

  /**
   * Origin URL for resolving relative image paths and internal links.
   */
  origin?: string

  /**
   * Does not wait for a header tag to be opened before processing HTML to markdown.
   * @default false
   */
  full?: boolean

  /**
   * Use worker threads for parallel processing
   * @default true
   */
  useWorkers?: boolean

  /**
   * Number of worker threads to use for parsing
   * @default CPU count - 1 (min 1, max 4)
   */
  workerCount?: number
  
  /**
   * Worker configuration - provides a specific worker implementation
   * When specified, this overrides useWorkers and workerCount
   */
  worker?: WorkerConfig
}

// Node types
export const ELEMENT_NODE = 1
export const TEXT_NODE = 3

/**
 * Base DOM node interface
 */
export interface Node {
  /** Node type (ELEMENT_NODE or TEXT_NODE) */
  type: number

  /** Element tag name (for ELEMENT_NODE) */
  name?: string

  /** Text content (for TEXT_NODE) */
  value?: string

  /** HTML attributes (for ELEMENT_NODE) */
  attributes?: Record<string, string>

  /** Parent node reference */
  parentNode?: ParentNode | null

  /** Current nesting depth in the DOM tree */
  depth: number

  /** Map of tag names to their nesting count */
  depthMap: Record<string, number>

  /** Whether this node has been completely processed */
  complete?: boolean

  /** Whether this node should be excluded from output */
  excluded: boolean

  /** Whether this node is unsupported for processing */
  unsupported: boolean

  /** Index of this node within its parent's children */
  index: number
}

/**
 * Parent node that can contain child nodes
 */
export interface ParentNode extends Node {
  /** Current walk index for child traversal */
  currentWalkIndex: number

  /** Child nodes (not used in streaming mode) */
  children?: Node[]
}

/**
 * State interface for HTML parsing and processing
 */
export interface MdreamProcessingState {
  /** Map of tag names to their current nesting depth */
  depthMap: Record<string, number>

  /** Current overall nesting depth */
  depth: number

  /** Currently processing element node */
  currentElementNode: ParentNode | null

  /** Depth at which an unsupported node was encountered */
  inUnsupportedNodeDepth?: number

  /** Depth at which an excluded node was encountered */
  isExcludedNodeDepth?: number

  /** Whether we're processing a full HTML document (with DOCTYPE) */
  processingHTMLDocument?: boolean

  /** Whether current content contains HTML entities that need decoding */
  hasEncodedHtmlEntity?: boolean

  /** Whether the last processed character was whitespace */
  lastCharWasWhitespace?: boolean

  /** Whether a tag was just closed (affects whitespace handling) */
  justClosedTag?: boolean

  /** Whether the next text node is the first in its element */
  isFirstTextInElement?: boolean

  /** Reference to the last processed text node */
  lastTextNode?: Node

  /** Whether we've entered the body tag */
  enteredBody?: boolean

  /** Whether we've seen a header tag */
  hasSeenHeader?: boolean
}

/**
 * Runtime state for markdown generation
 */
export interface MdreamRuntimeState extends Partial<MdreamProcessingState> {
  /** Last new lines emitted */
  lastNewLines: number

  /** Accumulated markdown output buffer */
  buffer: string

  /** Configuration options */
  options?: HTMLToMarkdownOptions

  /** Table processing state */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]
}

/**
 * Node event for DOM traversal
 */
export interface NodeEvent {
  /** Event type - enter or exit */
  type: 'enter' | 'exit'

  /** The node being processed */
  node: Node
}

/**
 * Handler context for markdown conversion
 */
export interface HandlerContext {
  /** Current node being processed */
  node: Node

  /** Parent node (if any) */
  parent?: Node

  /** Runtime state */
  state: MdreamRuntimeState
}
