/**
 * Imperative hook-based transform plugins. **JavaScript engine only.**
 * When transforms are provided, the JS engine is used regardless of engine selection.
 * For declarative config that works with both engines, use `BuiltinPlugins`.
 */
export interface TransformPlugin {
  /**
   * Process a node before it's handled by the parser
   */
  beforeNodeProcess?: (event: NodeEvent, state: MdreamRuntimeState) => undefined | void | { skip: boolean }

  /**
   * Hook that runs when entering a node
   * @returns String to add to the output, or PluginHookResult with content
   */
  onNodeEnter?: (node: ElementNode, state: MdreamRuntimeState) => string | undefined | void

  /**
   * Hook that runs when exiting a node
   */
  onNodeExit?: (node: ElementNode, state: MdreamRuntimeState) => string | undefined | void

  /**
   * Process attributes for a node
   */
  processAttributes?: (node: ElementNode, state: MdreamRuntimeState) => void

  /**
   * Process a text node before it's added to the output
   * @returns Result with content and skip flag, or undefined for no transformation
   */
  processTextNode?: (
    node: TextNode,
    state: MdreamRuntimeState,
  ) => { content: string, skip: boolean } | undefined
}

/**
 * Frontmatter configuration options.
 */
export interface FrontmatterConfig {
  additionalFields?: Record<string, string>
  metaFields?: string[]
  /**
   * Custom formatter for frontmatter YAML values.
   * Works with both engines.
   */
  formatValue?: (name: string, value: string) => string
  /**
   * Callback to receive structured frontmatter data.
   * Called after conversion with the extracted key-value pairs.
   */
  onExtract?: (frontmatter: Record<string, string>) => void
}

/**
 * Declarative configuration for built-in plugins.
 * Works with both the JavaScript and Rust engines.
 */
export interface BuiltinPlugins {
  /** Filter elements by CSS selectors, tag names, or TAG_* constants */
  filter?: {
    include?: (string | number)[]
    exclude?: (string | number)[]
    processChildren?: boolean
  }
  /**
   * Extract frontmatter from HTML head.
   * - `true`: enable with defaults
   * - `(fm) => void`: enable and receive structured data via callback
   * - `FrontmatterConfig`: enable with config options and optional callback
   */
  frontmatter?: boolean | ((frontmatter: Record<string, string>) => void) | FrontmatterConfig
  /** Isolate main content area */
  isolateMain?: boolean
  /** Convert Tailwind utility classes to markdown formatting */
  tailwind?: boolean
  /**
   * Extract elements matching CSS selectors during conversion.
   * Each key is a CSS selector; the handler is called for every match.
   */
  extraction?: Record<string, (element: ExtractedElement) => void>
}

/**
 * Shared engine options that work with both JS and Rust engines.
 * This is the contract that `MarkdownEngine` methods accept.
 */
export interface EngineOptions {
  /**
   * Origin URL for resolving relative image paths and internal links.
   */
  origin?: string

  /**
   * Declarative built-in plugin config. Works with both JS and Rust engines.
   */
  plugins?: BuiltinPlugins
}

// Standard DOM node types
export { ELEMENT_NODE, TEXT_NODE } from './const'

// Element nodes represent HTML tags with attributes
export interface ElementNode extends Node {
  /** Element tag name (for ELEMENT_NODE) */
  name: string
  /** HTML attributes (for ELEMENT_NODE) */
  attributes: Record<string, string>
  /** Custom data added by plugins */
  context?: PluginContext
  /** ID of the tag for fast handler lookup */
  tagId?: number
  /** Map of tag names to their nesting count (using Uint8Array for performance) */
  depthMap: Uint8Array
  /** Plugin outputs collected during processing */
  pluginOutput?: string[]
}

export interface TextNode extends Node {
  /** Text content (for TEXT_NODE) */
  value: string
  /** Custom data added by plugins */
  context?: PluginContext
  /** Whether this text node should be excluded from markdown output (for script/style elements) */
  excludedFromMarkdown?: boolean
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

  /** Node exclusion and filtering now handled by plugins */

  /** Index of this node within its parent's children */
  index: number

  /** Current walk index for child traversal during streaming */
  currentWalkIndex?: number

  /** Count of text child nodes - used for whitespace handling */
  childTextNodeIndex?: number

  /** Whether node contains whitespace - used for whitespace optimization */
  containsWhitespace?: boolean

  /** Cached reference to tag handler for performance */
  tagHandler?: TagHandler

  /** Parent node */
  parent?: ElementNode | null // parent will always be an element or null

  /** Custom data added by plugins */
  context?: PluginContext
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

  /** Quote state tracking for non-nesting tags - avoids backward scanning */
  inSingleQuote?: boolean
  inDoubleQuote?: boolean
  inBacktick?: boolean

  /** Backslash escaping state tracking - avoids checking previous character */
  lastCharWasBackslash?: boolean

  /** Resolved plugin instances for efficient iteration */
  resolvedPlugins?: TransformPlugin[]

  /** Configuration options for conversion */
  options?: EngineOptions
}

/**
 * Runtime state for markdown generation
 * Extended state that includes output tracking and options
 */
export interface MdreamRuntimeState extends Partial<MdreamProcessingState> {
  /** Number of newlines at end of most recent output */
  lastNewLines?: number

  /** Configuration options for conversion */
  options?: EngineOptions

  /** Table processing state - specialized for Markdown tables */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]

  /** Resolved plugin instances for efficient iteration */
  resolvedPlugins?: TransformPlugin[]

  /** Content buffer for markdown output */
  buffer: string[]

  /** Performance cache for last content to avoid iteration */
  lastContentCache?: string

  /** Reference to the last processed node */
  lastNode?: Node

  context?: PluginContext
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
  collapsesInnerWhiteSpace?: boolean
  isInline?: boolean

  // Newline configuration: [enterNewlines, exitNewlines]
  // Number of newlines to add before/after the tag
  spacing?: readonly [number, number]
  excludesTextNodes?: boolean
}

// Plugin-specific context interfaces
export interface ReadabilityContext {
  score?: number
  tagCount?: number
  linkTextLength?: number
  textLength?: number
  isHighLinkDensity?: boolean
}

export interface TailwindContext {
  hidden?: boolean
  prefix?: string
  suffix?: string
}

export interface PluginContext {
  // Readability plugin data
  score?: number
  tagCount?: number
  linkTextLength?: number
  textLength?: number
  isHighLinkDensity?: boolean
  // Tailwind plugin data
  tailwind?: TailwindContext
  // Allow additional plugin-specific data
  [key: string]: unknown
}

/**
 * Element extracted during conversion by the extraction plugin.
 */
export interface ExtractedElement {
  /** The CSS selector that matched this element */
  selector: string
  /** The HTML tag name */
  tagName: string
  /** Accumulated text content of the element */
  textContent: string
  /** HTML attributes of the element */
  attributes: Record<string, string>
}

/**
 * Markdown chunk with content and metadata
 * Compatible with LangChain Document structure
 */
export interface MarkdownChunk {
  /** The markdown content of the chunk */
  content: string
  /** Metadata extracted during chunking */
  metadata: {
    /** Header hierarchy at this chunk position */
    headers?: Record<string, string>
    /** Code block language if chunk is/contains code */
    code?: string
    /** Line number range in original document */
    loc?: {
      lines: {
        from: number
        to: number
      }
    }
  }
}

/**
 * Options for HTML to Markdown chunking
 * Extends EngineOptions with chunking-specific settings
 */
export interface SplitterOptions extends EngineOptions {
  /**
   * Header tag IDs to split on (TAG_H1, TAG_H2, etc.)
   * @example [TAG_H1, TAG_H2]
   * @default [TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6]
   */
  headersToSplitOn?: number[]

  /**
   * Return each line as individual chunk
   * @default false
   */
  returnEachLine?: boolean

  /**
   * Strip headers from chunk content
   * @default true
   */
  stripHeaders?: boolean

  /**
   * Maximum chunk size
   * @default 1000
   */
  chunkSize?: number

  /**
   * Overlap between chunks for context preservation
   * @default 200
   */
  chunkOverlap?: number

  /**
   * Function to measure chunk length (default: character count)
   * Can be replaced with token counter for LLM applications
   * @default (text) => text.length
   */
  lengthFunction?: (text: string) => number

  /**
   * Keep separators in the split chunks
   * @default false
   */
  keepSeparator?: boolean
}
