/**
 * Shared context for plugin hooks
 */
export interface PluginContext {
  /**
   * The node being processed
   */
  node: Node

  /**
   * The current runtime state
   */
  state: MdreamRuntimeState

  /**
   * The node event (for enter/exit hooks)
   */
  event?: NodeEvent
}

/**
 * Plugin interface for extending HTML to Markdown conversion
 */
export interface Plugin {
  /**
   * Initialize the plugin with options
   * @param options - The options to initialize the plugin with
   * @param tagHandlers - The current tag handlers, which can be extended
   * @returns Any data to be stored in the plugin instance
   */
  init?: (options?: Record<string, any>, tagHandlers?: Record<number, any>) => void | Record<string, any>

  /**
   * Process a node before it's handled by the parser
   * @param node - The node to process
   * @param state - The current runtime state
   * @returns Boolean or PluginHookResult indicating whether to continue processing the node
   */
  beforeNodeProcess?: (node: Node, state: MdreamRuntimeState) => boolean

  /**
   * Hook that runs when entering a node
   * @param event - The node event
   * @param state - The current runtime state
   * @returns String to add to the output, or PluginHookResult with content
   */
  onNodeEnter?: (event: NodeEvent, state: MdreamRuntimeState) => string

  /**
   * Hook that runs when exiting a node
   * @param event - The node event
   * @param state - The current runtime state
   * @returns String to add to the output, or PluginHookResult with content
   */
  onNodeExit?: (event: NodeEvent, state: MdreamRuntimeState) => string

  /**
   * Process attributes for a node
   * @param node - The node to process attributes for
   * @param state - The current runtime state
   */
  processAttributes?: (node: ElementNode, state: MdreamRuntimeState) => void

  /**
   * Process a text node before it's added to the output
   * @param node - The text node to process
   * @param state - The current runtime state
   * @returns Legacy format or PluginHookResult with textContent and skipNode
   */
  processTextNode?: (
    node: TextNode,
    state: MdreamRuntimeState
  ) => { content: string, skip: boolean }

  // Removed transformContent hook - use processTextNode instead

  /**
   * Hook that runs after the entire document is processed
   * This is useful for plugins that need to analyze the complete document
   * @param state - The final runtime state
   * @returns Optional data to be added to the state
   */
  finish?: (state: MdreamRuntimeState) => void | Record<string, any>
}

export interface HTMLToMarkdownOptions {
  /**
   * Origin URL for resolving relative image paths and internal links.
   * Important when converting HTML with relative paths from a specific website.
   */
  origin?: string

  /**
   * Plugins to extend HTML to Markdown conversion
   */
  plugins?: Plugin[]
}

// Standard DOM node types
export const ELEMENT_NODE = 1
export const TEXT_NODE = 3

// Element nodes represent HTML tags with attributes
export interface ElementNode extends Node {
  /** Element tag name (for ELEMENT_NODE) */
  name: string
  /** HTML attributes (for ELEMENT_NODE) */
  attributes: Record<string, string>
  /** Custom data added by plugins */
  context?: Record<string, any>
}

export interface TextNode extends Node {
  /** Text content (for TEXT_NODE) */
  value: string
  /** Custom data added by plugins */
  context?: Record<string, any>
}

/**
 * Base DOM node interface
 * Optimized for streaming HTML parsing with minimal memory footprint
 */
export interface Node {
  /** Node type (ELEMENT_NODE or TEXT_NODE) */
  type: number

  /** Current nesting depth in the DOM tree */
  depth: number

  /** Map of tag names to their nesting count (using Uint8Array for performance) */
  depthMap: Uint8Array

  /** Node exclusion and filtering now handled by plugins */

  /** Index of this node within its parent's children */
  index: number

  /** Current walk index for child traversal during streaming */
  currentWalkIndex?: number

  /** Count of text child nodes - used for whitespace handling */
  childTextNodeIndex?: number

  /** Whether node contains whitespace - used for whitespace optimization */
  containsWhitespace?: boolean

  /** ID of the tag for fast handler lookup */
  tagId?: number

  /** Cached reference to tag handler for performance */
  tagHandler?: TagHandler

  /** Parent node */
  parent?: ElementNode | null // parent will always be an element or null

  /** Custom data added by plugins */
  context?: Record<string, any>
}

/**
 * State interface for HTML parsing and processing
 * Contains parsing state that's maintained during HTML traversal
 */
export interface MdreamProcessingState {
  /** Map of tag names to their current nesting depth - uses TypedArray for performance */
  depthMap: Uint8Array

  /** Current overall nesting depth */
  depth: number

  /** Currently processing element node */
  currentNode?: ElementNode | null

  /** Node filtering and exclusion is now handled by plugins */

  /** Whether current content contains HTML entities that need decoding */
  hasEncodedHtmlEntity?: boolean

  /** Whether the last processed character was whitespace - for collapsing whitespace */
  lastCharWasWhitespace?: boolean

  /** Whether the last processed buffer has whitespace - optimization flag */
  textBufferContainsWhitespace?: boolean

  /** Whether the last processed buffer contains non-whitespace characters */
  textBufferContainsNonWhitespace?: boolean

  /** Whether a tag was just closed - affects whitespace handling */
  justClosedTag?: boolean

  /** Whether the next text node is the first in its element - for whitespace trimming */
  isFirstTextInElement?: boolean

  /** Reference to the last processed text node - for context tracking */
  lastTextNode?: Node

  /** Whether we've entered the body tag - used for minimal-from-first filtering */
  enteredBody?: boolean

  /** Whether we've seen a header tag - used for minimal-from-first-header filtering */
  hasSeenHeader?: boolean

  /** Output fragments during processing */
  fragments?: string[]

  /** Plugin instances array for efficient iteration */
  plugins?: Plugin[]
}

/**
 * Runtime state for markdown generation
 * Extended state that includes output tracking and options
 */
export interface MdreamRuntimeState extends Partial<MdreamProcessingState> {
  /** Number of newlines at end of most recent output */
  lastNewLines: number

  /** Total fragments processed for tracking */
  fragmentCount: number

  /** Current line count - primarily for non-zero checks */
  currentLine: number

  /** Accumulated markdown output buffer */
  buffer: string

  /** Configuration options for conversion */
  options?: HTMLToMarkdownOptions

  /** Table processing state - specialized for Markdown tables */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]

  /** Plugin instances array for efficient iteration */
  plugins?: Plugin[]
}

type NodeEventEnter = 0
type NodeEventExit = 1

/**
 * Node event for DOM traversal
 * Used in the event-based traversal system for streaming processing
 */
export interface NodeEvent {
  /** Event type - enter (start tag) or exit (end tag) */
  type: NodeEventEnter | NodeEventExit

  /** The node being processed */
  node: Node
}

/**
 * Handler context for markdown conversion
 * Passed to tag handler functions for converting specific elements
 */
export interface HandlerContext {
  /** Current node being processed */
  node: ElementNode

  /** Parent node (if any) */
  parent?: ElementNode

  /** Runtime state */
  state: MdreamRuntimeState
}

/**
 * Tag handler interface for HTML elements
 * Used by plugins to extend or customize tag handling
 */
export interface TagHandler {
  enter?: (context: HandlerContext) => string | undefined | void
  exit?: (context: HandlerContext) => string | undefined | void
  isSelfClosing?: boolean
  isNonNesting?: boolean
  isNonSupported?: boolean
  usesAttributes?: boolean
  collapsesInnerWhiteSpace?: boolean
  isInline?: boolean

  // Newline configuration: [enterNewlines, exitNewlines]
  // Number of newlines to add before/after the tag
  spacing?: readonly [number, number]
  excludesTextNodes?: boolean
}
