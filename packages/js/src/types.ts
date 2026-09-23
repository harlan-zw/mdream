/** Composable JavaScript conversion plugin. */
export interface TransformPlugin {
  /**
   * Whether a flattened element starts an output-excluded subtree.
   * @internal
   */
  excludesOverflowSubtree?: (node: ElementNode) => boolean

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

  /**
   * Runs once after the whole document is converted, including for streams.
   */
  onDocumentEnd?: (state: MdreamRuntimeState) => void
}

/**
 * Creates fresh hooks for one conversion. Use it for a plugin that keeps
 * per-document state, so a reused or concurrent plugin never shares that state.
 */
export type PluginSetup = () => TransformPlugin

/** Hooks shared by every conversion, or a setup that creates them per conversion. */
export type Plugin = TransformPlugin | PluginSetup
export type OutputFormat = 'markdown' | 'text' | 'html'

/**
 * Declarative tag override configuration.
 * When a string value is provided, it acts as an alias (e.g. `{ "x-heading": "h2" }`).
 */
export interface TagOverride {
  enter?: string
  exit?: string
  spacing?: [number, number]
  isInline?: boolean
  isSelfClosing?: boolean
  collapsesInnerWhiteSpace?: boolean
}

/** Cleanup rules. */
export interface CleanOptions {
  /** Strip tracking query parameters (utm_*, fbclid, gclid, etc.) from URLs */
  urls?: boolean
  /** Strip fragment-only links that don't match any heading in the output */
  fragments?: boolean
  /** Strip links with meaningless hrefs (#, javascript:void(0)) → plain text */
  emptyLinks?: boolean
  /** Collapse 3+ consecutive blank lines to 2 */
  blankLines?: boolean
  /** Strip links where text equals URL: [https://x.com](https://x.com) → https://x.com */
  redundantLinks?: boolean
  /** Strip self-referencing heading anchors: ## [Title](#title) → ## Title */
  selfLinkHeadings?: boolean
  /** Strip images with no alt text (decorative/tracking pixels) */
  emptyImages?: boolean
  /** Drop links that produce no visible text: [](url) → nothing */
  emptyLinkText?: boolean
}

/** Converter state a `CleanPass` reads and rewrites. */
export interface CleanTarget {
  /** Markdown written so far, one entry per write. */
  buffer: string[]
  /** Open element count per tag id. */
  depthMap: Uint16Array
  /** The last buffer entry the converter wrote. */
  lastContentCache?: string
  options?: EngineOptions
}

/**
 * Cleanup for one conversion. The converter calls these hooks; they rewrite
 * links after the converter writes them.
 */
export interface CleanPass {
  /** Output waits for the whole document, because `fragments` needs every heading. */
  holdsOutput: boolean
  /** An element's enter output starts at `outputStart` in the buffer. */
  enter: (element: ElementNode, outputStart: number) => void
  /** An element exits; called before its exit output. */
  exit: (element: ElementNode) => void
  /** Rewrite the closing anchor to its text and skip its close. Returns true when it did. */
  unwrap: (element: ElementNode) => boolean
  /** An element wrote its exit output `close` at `outputStart`. */
  closed: (element: ElementNode, outputStart: number, close: string) => void
  /** The earliest buffer index a later hook may rewrite, or Infinity. */
  held: () => number
  /**
   * Buffer index of the earliest marked link no heading matches yet, or -1
   * when every marked link is resolved. A still-unresolved link regrows when
   * a later heading matches its slug, moving every later position.
   */
  settled: () => number
  /** Apply the rules that need the whole document to the finished Markdown. */
  finish: (markdown: string) => string
}

/**
 * Cleanup rules and the pass that applies them.
 * Create one with `clean()` from `@mdream/js/clean`.
 */
export interface Cleaner extends CleanOptions {
  /** Start cleanup for one conversion. Returns nothing when no rule rewrites links. */
  apply: (target: CleanTarget) => CleanPass | undefined
}

/** Core conversion options. */
export interface EngineOptions {
  /**
   * Origin URL for resolving relative image paths and internal links.
   */
  origin?: string

  /** Declarative tag behavior overrides. */
  tagOverrides?: Record<string, TagOverride | string>

  /**
   * Clean up the markdown output. Pass `true` for all cleanup or an object
   * to enable specific features. The rules apply to the link and image nodes
   * as they convert; `fragments` also needs `apply` from a `Cleaner`.
   */
  clean?: boolean | CleanOptions

  /**
   * Hard-wrap prose at this many characters, breaking on word boundaries.
   * Applied inline during conversion (zero-cost when unset). Code blocks
   * (`<pre>`/`<code>`), tables, and headings are never wrapped. `0` disables
   * wrapping.
   */
  wrapWidth?: number

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
  /** Map of tag names to their nesting count */
  depthMap: Uint16Array
  /** Plugin outputs collected during processing */
  pluginOutput?: string[]
}

export interface TextNode extends Node {
  /** Text content (for TEXT_NODE) */
  value: string
  /** Markdown delimiters generated by a plugin around this literal text. */
  generatedMarkdown?: {
    prefix: string
    suffix: string
  }
  /** Custom data added by plugins */
  context?: PluginContext
  /** Follows an end tag that closed nothing, so it gets no separator. */
  joinsPrevious?: boolean
  /**
   * First text with no block ancestor: it drops its leading whitespace when
   * the output is at the start of a line.
   */
  trimsAtLineStart?: boolean
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

  /** Child-content counter used by whitespace and empty-link handling */
  childTextNodeIndex?: number

  /** Whether node contains whitespace - used for whitespace optimization */
  containsWhitespace?: boolean

  /** Whether this node belongs to an inert subtree and should not render */
  excludedFromMarkdown?: boolean

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
  depthMap: Uint16Array

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

  /** @deprecated No longer read or written. Retained for source compatibility. */
  inSingleQuote?: boolean
  /** @deprecated No longer read or written. Retained for source compatibility. */
  inDoubleQuote?: boolean
  /** @deprecated No longer read or written. Retained for source compatibility. */
  inBacktick?: boolean
  /** @deprecated No longer read or written. Retained for source compatibility. */
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
  /** Active output format for format-aware plugins. */
  outputFormat?: OutputFormat

  /** Number of newlines at end of most recent output */
  lastNewLines?: number

  /** Configuration options for conversion */
  options?: EngineOptions

  /** Table processing state - specialized for Markdown tables */
  tableRenderedTable?: boolean
  tableCurrentRowCells?: number
  tableColumnAlignments?: string[]
  /** See MarkdownState for semantics. */
  tableHeaderCells?: number

  /** Resolved plugin instances for efficient iteration */
  resolvedPlugins?: TransformPlugin[]

  /** Content buffer for markdown output */
  buffer: string[]

  /** Performance cache for last content to avoid iteration */
  lastContentCache?: string

  /** Reference to the last processed node */
  lastNode?: Node

  context?: PluginContext

  /**
   * Cumulative indent for list-item continuation. Grows by each ancestor
   * `<li>`'s marker width (`"- "` = 2, `"N. "` = digits(N) + 2) so continuation
   * content lands in the CommonMark content column. Managed by the processor.
   */
  listIndent?: string
  listIndentWidths?: number[]

  /**
   * <pre> fenced-code deferral (issue #97). See MarkdownState for semantics.
   */
  preFencePending?: boolean
  preFenceLang?: string
  preFenceOpen?: boolean
  /** Number of default blockquotes currently buffered for line prefixing. */
  bufferedBlockquoteDepth?: number
  /** Content-column prefix deferred after a list item rule. */
  listRulePending?: string
  /** Whether output should omit Markdown/HTML markup */
  plainText?: boolean
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

/** Internal serializer lifecycle emitted only by built-in GFM handlers. */
export type GfmAction
  = | { _tag: 'BlockquoteEnter', output?: string }
    | { _tag: 'BlockquoteExit' }
    | { _tag: 'PreEnter', language: string }
    | { _tag: 'PreExit' }
    | { _tag: 'CodeSpanEnter', output: string }
    | { _tag: 'CodeSpanExit' }
    | { _tag: 'CodeFenceEnter', language: string, output: string }

type TagHandlerResult = string | GfmAction | undefined | void

/**
 * Tag handler interface for HTML elements
 * Used by plugins to extend or customize tag handling
 */
export interface TagHandler {
  enter?: (context: HandlerContext) => TagHandlerResult
  exit?: (context: HandlerContext) => TagHandlerResult
  isSelfClosing?: boolean
  isNonNesting?: boolean
  collapsesInnerWhiteSpace?: boolean
  isInline?: boolean

  // Newline configuration: [enterNewlines, exitNewlines]
  // Number of newlines to add before/after the tag
  spacing?: readonly [number, number]
  excludesTextNodes?: boolean
  /**
   * When true, the `enter` string is emitted verbatim without synthesizing a
   * separating space before it. Set for user-supplied tagOverride enter
   * strings so markers like `^`/`~` attach to adjacent content (issue #93).
   */
  literalEnter?: boolean
  /** When true, the `exit` string is a user-supplied tagOverride, exempt from empty-pair cleanup. */
  literalExit?: boolean
  /**
   * Built-in tag id used by declarative string aliases.
   * @internal
   */
  aliasTagId?: number
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

/** Top-level options for the mdream JavaScript engine. */
export interface MdreamOptions extends Omit<EngineOptions, 'clean'> {
  /**
   * Cleanup rules from `clean()` in `@mdream/js/clean`. Import it only when
   * you use it, so the cleanup pass stays out of other bundles.
   */
  clean?: Cleaner
  /** Explicit plugins, applied in array order. */
  plugins?: Plugin[]
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
export interface SplitterOptions extends MdreamOptions {
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
