import type { ElementNode, TextNode } from '../types'
import { ELEMENT_NODE, TAG_HEAD, TAG_META, TAG_TITLE } from '../const'
import { createPlugin } from '../pluggable/plugin'

const DOUBLE_QUOTE_RE = /"/g

export interface FrontmatterPluginOptions {
  /** Additional frontmatter fields to include */
  additionalFields?: Record<string, string>
  /** Meta tag names to extract (beyond the standard ones) */
  metaFields?: string[]
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
export function frontmatterPlugin(options: FrontmatterPluginOptions = {}) {
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
    value = value.replace(DOUBLE_QUOTE_RE, '\\"')
    if (value.includes('\n') || value.includes(':') || value.includes('#') || value.includes(' ')) {
      return `"${value}"`
    }
    return value
  }

  function getStructuredData(): Record<string, string> | undefined {
    const result: Record<string, string> = {}
    if (frontmatter.title) {
      // Strip quotes that formatValue adds
      const raw = frontmatter.title
      result.title = raw.startsWith('"') && raw.endsWith('"')
        ? raw.slice(1, -1).replace(/\\"/g, '"')
        : raw
    }
    for (const [k, v] of Object.entries(frontmatter.meta)) {
      // Strip wrapping quotes from key (e.g. '"og:title"' → 'og:title')
      const cleanKey = k.startsWith('"') && k.endsWith('"') ? k.slice(1, -1) : k
      // Strip wrapping quotes from value
      const cleanVal = typeof v === 'string' && v.startsWith('"') && v.endsWith('"')
        ? v.slice(1, -1).replace(/\\"/g, '"')
        : String(v)
      result[cleanKey] = cleanVal
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
    onNodeEnter(node: any): string | undefined {
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
          frontmatter.meta[metaName.includes(':') ? `"${metaName}"` : metaName] = formatValue(metaName, content)
        }

        // Don't output anything for meta tags
        return undefined
      }
    },

    onNodeExit(node: any, state: any) {
      // Handle exiting the head tag
      if (node.type === ELEMENT_NODE && node.tagId === TAG_HEAD) {
        inHead = false

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

  // Attach getter to the plugin for structured data access
  ;(plugin as any).getFrontmatter = getStructuredData

  return plugin

  /**
   * Generate YAML frontmatter string from collected metadata
   */
  function generateFrontmatter(): string {
    if (Object.keys(frontmatter).length === 0) {
      return ''
    }

    // Process entries, handling 'meta' specially
    let yamlLines: string[] = []

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

        // Sort meta entries alphabetically and add with indentation
        const metaEntries = Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([metaKey, metaValue]) => `  ${metaKey}: ${metaValue}`)

        yamlLines.push(...metaEntries)
      }
      else if (key !== 'meta' && typeof value === 'string') {
        // Add regular keys
        yamlLines.push(`${key}: ${value}`)
      }
    }

    // Remove meta if empty
    if (Object.keys(frontmatter.meta).length === 0) {
      yamlLines = yamlLines.filter(line => !line.startsWith('meta:'))
    }

    return `---\n${yamlLines.join('\n')}\n---\n\n`
  }
}
