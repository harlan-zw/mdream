import type { TagHandler } from './tags.ts'

export interface HTMLToMarkdownOptions {
  /**
   * Origin URL for resolving relative image paths and internal links.
   */
  origin?: string

  /**
   * Does not wait for a header tag to be opened before processing HTML to markdown.
   * @default false
   */
  strategy?: 'minimal' | 'minimal-from-first-header' | 'full'
}

// Node types
export const ELEMENT_NODE = 1
export const TEXT_NODE = 3

/**
 * Type for the optimized depth map using Uint8Array
 * This replaces the Record<number, number> with a fixed-size typed array
 * for faster property access
 */
export type DepthMapArray = Uint8Array

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
  parent?: ParentNode | null

  /** Current nesting depth in the DOM tree */
  depth: number

  /** Map of tag names to their nesting count (using Uint8Array for performance) */
  depthMap: DepthMapArray

  /** Whether this node should be excluded from output */
  minimal: boolean

  /** Whether this node is unsupported for processing */
  unsupported: boolean

  /** Index of this node within its parent's children */
  index: number

  /** Current walk index for child traversal */
  currentWalkIndex?: number

  /** The text child nodes of the parent node */
  childTextNodeIndex?: number

  /** Does this node contain whitespace? */
  containsWhitespace?: boolean

  /** Tag handler reference (for fast lookup) */
  tagHandler: TagHandler

  /** Tag ID (numeric constant for the tag) */
  tagId: number
}

/**
 * Parent node that can contain child nodes
 */
export interface ParentNode extends Node {

  /** Child nodes (not used in streaming mode) */
  children?: Node[]
}

/**
 * State interface for HTML parsing and processing
 */
export interface MdreamProcessingState {
  /** Map of tag names to their current nesting depth (using Uint8Array for performance) */
  depthMap: DepthMapArray

  /** Current overall nesting depth */
  depth: number

  /** Currently processing element node */
  currentNode: ParentNode | null

  /** Depth at which an unsupported node was encountered */
  inUnsupportedNodeDepth?: number

  /** Depth at which an excluded node was encountered */
  isMinimalNodeDepth?: number

  /** Whether current content contains HTML entities that need decoding */
  hasEncodedHtmlEntity?: boolean

  /** Whether the last processed character was whitespace */
  lastCharWasWhitespace?: boolean

  /** Whether the last processed buffer has whitespace */
  textBufferContainsWhitespace?: boolean

  /** Whether the last processed buffer contains non-whitespace characters */
  textBufferContainsNonWhitespace?: boolean

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

  /** If we try and recover from malformed HTML */
  strictMode?: boolean
}

/**
 * Runtime state for markdown generation
 */
export interface MdreamRuntimeState extends Partial<MdreamProcessingState> {
  /** Last new lines emitted */
  lastNewLines: number

  /** Current count of fragments */
  fragmentCount: number

  /** Current line - may not be accurate, just used for non-zero */
  currentLine: number

  /** Accumulated markdown output buffer */
  buffer: string
  /** Fragments to emit */
  fragments: string[]

  /** Configuration options */
  options?: HTMLToMarkdownOptions

  /** Table processing state */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]
}

type NodeEventEnter = 0
type NodeEventExit = 1

/**
 * Node event for DOM traversal
 */
export interface NodeEvent {
  /** Event type - enter or exit */
  type: NodeEventEnter | NodeEventExit

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
