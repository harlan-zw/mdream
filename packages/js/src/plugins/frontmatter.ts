import type { ElementNode, PluginSetup, TextNode, TransformPlugin } from '../types'
import { ELEMENT_NODE, TAG_HEAD, TAG_META, TAG_TITLE } from '../const'
import { createPlugin } from '../pluggable/plugin'

const BACKSLASH_RE = /\\/g
const DOUBLE_QUOTE_RE = /"/g

export interface FrontmatterPluginOptions {
  /** Additional frontmatter fields to include */
  additionalFields?: Record<string, string>
  /** Meta tag names to extract (beyond the standard ones) */
  metaFields?: string[]
  /** Receive structured frontmatter once the document is converted. */
  onExtract?: (frontmatter: Record<string, string>) => void
}

interface FrontmatterData {
  title?: string
  meta: Record<string, string>
  [key: string]: string | Record<string, string> | undefined
}

/**
 * A plugin that manages frontmatter generation from HTML head elements
 * Extracts metadata from meta tags and title and generates YAML frontmatter
 */
export function frontmatterPlugin(options: FrontmatterPluginOptions = {}): PluginSetup {
  return createPlugin(() => createFrontmatterHooks(options))
}

/** Fresh hooks for one conversion: collected metadata belongs to one document. */
function createFrontmatterHooks(options: FrontmatterPluginOptions): TransformPlugin {
  const additionalFields = options.additionalFields || {}
  const metaFields = new Set([
    'description',
    'keywords',
    'author',
    'date',
    'og:title',
    'og:description',
    'twitter:title',
    'twitter:description',
    ...(options.metaFields || []),
  ])

  // Metadata collection
  const frontmatter: FrontmatterData = { ...additionalFields, meta: {} }
  let inHead = false

  function formatValue(_name: string, value: string) {
    value = value.replace(BACKSLASH_RE, '\\\\').replace(DOUBLE_QUOTE_RE, '\\"')
    if (value.includes('\n') || value.includes(':') || value.includes('#') || value.includes(' ')) {
      return `"${value}"`
    }
    return value
  }

  function rawValue(value: string): string {
    const content = value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value
    let result = ''
    for (let index = 0; index < content.length; index++) {
      const character = content[index]
      const next = content[index + 1]
      if (character === '\\' && (next === '\\' || next === '"')) {
        result += next
        index++
      }
      else {
        result += character
      }
    }
    return result
  }

  function getStructuredData(): Record<string, string> | undefined {
    const result: Record<string, string> = {}
    if (frontmatter.title) {
      // Strip quotes that formatValue adds
      const raw = frontmatter.title
      result.title = rawValue(raw)
    }
    for (const [k, v] of Object.entries(frontmatter.meta)) {
      // Strip wrapping quotes from value
      result[k] = rawValue(String(v))
    }
    if (additionalFields) {
      for (const [k, v] of Object.entries(additionalFields)) {
        if (typeof v === 'string')
          result[k] = v
      }
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  const plugin = createPlugin({
    // Report once the document ends, so every head and late metadata counts.
    onDocumentEnd() {
      if (!options.onExtract)
        return
      const structured = getStructuredData()
      if (structured)
        options.onExtract(structured)
    },

    onNodeEnter(node: any): string | undefined {
      if (node.excludedFromMarkdown)
        return

      // Track when we enter the head section
      if (node.tagId === TAG_HEAD) {
        inHead = true
        return
      }

      // Process title tag inside head
      if (inHead && node.type === ELEMENT_NODE && node.tagId === TAG_TITLE) {
        // Title will be processed in processTextNode
        return
      }

      // Process meta tags inside head
      if (inHead && node.type === ELEMENT_NODE && node.tagId === TAG_META) {
        const elementNode = node as ElementNode
        const { name, property, content } = elementNode.attributes || {}

        // Check for valid meta tags
        const metaName = property || name
        if (metaName && content && metaFields.has(metaName)) {
          frontmatter.meta[metaName] = formatValue(metaName, content)
        }

        // Don't output anything for meta tags
        return undefined
      }
    },

    onNodeExit(node: any, state: any) {
      if (node.excludedFromMarkdown)
        return undefined

      // Handle exiting the head tag
      if (node.type === ELEMENT_NODE && node.tagId === TAG_HEAD) {
        inHead = false
        if (state.outputFormat !== 'markdown')
          return undefined

        // Generate frontmatter as we exit the head
        if (Object.keys(frontmatter).length > 0) {
          const frontmatterContent = generateFrontmatter()
          if (frontmatterContent) {
            state.buffer.push(frontmatterContent)
            state.lastContentCache = frontmatterContent
          }
        }
      }

      return undefined
    },

    processTextNode(node: TextNode) {
      if (node.parent?.excludedFromMarkdown)
        return

      // Only process if we're in the head section
      if (!inHead) {
        return
      }

      // Handle text inside title tag
      const parent = node.parent
      if (parent && parent.tagId === TAG_TITLE && node.value) {
        frontmatter.title = formatValue('title', node.value.trim())
        return { content: '', skip: true }
      }
    },
  } as any)

  return plugin

  /**
   * Generate YAML frontmatter string from collected metadata
   */
  function generateFrontmatter(): string {
    if (Object.keys(frontmatter).length === 0) {
      return ''
    }

    // Process entries, handling 'meta' specially
    const yamlLines: string[] = []

    // Sort frontmatter keys to put title and description first
    const entries = Object.entries(frontmatter)
      .sort(([a], [b]) => {
        // Put 'title' first, then 'description', then the rest alphabetically
        if (a === 'title')
          return -1
        if (b === 'title')
          return 1
        if (a === 'description')
          return -1
        if (b === 'description')
          return 1
        return a.localeCompare(b)
      })

    // Process each entry
    for (const [key, value] of entries) {
      if (key === 'meta' && typeof value === 'object' && value && Object.keys(value).length > 0) {
        // Add meta key
        yamlLines.push('meta:')

        // Sort by the raw key in code unit order, as Rust does, and quote a
        // key that holds `:` only when printing it.
        const metaEntries = Object.entries(value)
          .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
          .map(([metaKey, metaValue]) => `  ${metaKey.includes(':') ? `"${metaKey}"` : metaKey}: ${metaValue}`)

        yamlLines.push(...metaEntries)
      }
      else if (key !== 'meta' && typeof value === 'string') {
        // Add regular keys
        yamlLines.push(`${key}: ${value}`)
      }
    }

    // A head with no fields writes no block.
    if (yamlLines.length === 0)
      return ''

    return `---\n${yamlLines.join('\n')}\n---\n\n`
  }
}
