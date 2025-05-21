import type { ElementNode, TextNode } from '../types.ts'
import { ELEMENT_NODE, TAG_HEAD, TAG_META, TAG_TITLE } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

export interface FrontmatterPluginOptions {
  /** Additional frontmatter fields to include */
  additionalFields?: Record<string, string>
  /** Meta tag names to extract (beyond the standard ones) */
  metaFields?: string[]
  /** Custom formatter for frontmatter values */
  formatValue?: (name: string, value: string) => string
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
  const frontmatter: Record<string, any> = { ...additionalFields, meta: {} }
  let inHead = false

  // Format frontmatter value (handle quotes, etc.)
  const formatValue = options.formatValue || ((name: string, value: string) => {
    // Escape quotes in values
    value = value.replace(/"/g, '\\"')

    // Add quotes for values with special characters
    if (value.includes('\n') || value.includes(':') || value.includes('#') || value.includes(' ')) {
      return `"${value}"`
    }
    return value
  })

  return createPlugin({
    onNodeEnter(node): string | undefined {
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

    onNodeExit(node) {
      // Handle exiting the head tag
      if (node.type === ELEMENT_NODE && node.tagId === TAG_HEAD) {
        inHead = false

        // Generate frontmatter as we exit the head
        if (Object.keys(frontmatter).length > 0) {
          return generateFrontmatter()
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
  })

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
      if (key === 'meta' && Object.keys(value as Record<string, string>).length > 0) {
        // Add meta key
        yamlLines.push('meta:')

        // Sort meta entries alphabetically and add with indentation
        const metaEntries = Object.entries(value as Record<string, string>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([metaKey, metaValue]) => `  ${metaKey}: ${metaValue}`)

        yamlLines.push(...metaEntries)
      }
      else if (key !== 'meta' || Object.keys(value as Record<string, string>).length > 0) {
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
