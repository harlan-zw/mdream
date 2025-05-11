import type { ElementNode, MdreamRuntimeState, NodeEvent, TextNode } from '../types.ts'
import { ELEMENT_NODE, TAG_HEAD, TAG_META, TAG_TITLE } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

export interface FrontmatterPluginOptions {
  /** Additional frontmatter fields to include */
  additionalFields?: Record<string, string>
  /** Meta tag names to extract (beyond the standard ones) */
  metaFields?: string[]
  /** Custom formatter for frontmatter values */
  formatValue?: (name: string, value: string) => string
  /** Whether the plugin is enabled */
  enabled?: boolean
}

/**
 * A plugin that manages frontmatter generation from HTML head elements
 * Extracts metadata from meta tags and title and generates YAML frontmatter
 */
export function frontmatterPlugin(options: FrontmatterPluginOptions = {}) {
  // Create a disabled plugin that only prevents head content
  if (options.enabled === false) {
    return createPlugin({
      processTextNode(node: TextNode): { content: string, skip: boolean } | undefined {
        // Skip all head content
        if (node.parent && (node.parent.tagId === TAG_HEAD || node.parent.tagId === TAG_TITLE || node.parent.tagId === TAG_META)) {
          return { content: '', skip: true }
        }
        return undefined
      },
      // Handle HEAD elements entirely through processTextNode
    })
  }

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
  const frontmatter: Record<string, string> = { ...additionalFields }
  let inHead = false
  let hasGeneratedFrontmatter = false

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
    name: 'frontmatter',

    init() {
      // Reset state
      Object.keys(frontmatter).forEach((key) => {
        if (!additionalFields[key]) {
          delete frontmatter[key]
        }
      })

      inHead = false
      hasGeneratedFrontmatter = false

      return { frontmatterPlugin: true }
    },

    onNodeEnter(event: NodeEvent, state: MdreamRuntimeState): string | undefined {
      const { node } = event

      // Track when we enter the head section
      if (node.type === ELEMENT_NODE && node.tagId === TAG_HEAD) {
        inHead = true
        return undefined // Don't output frontmatter markers yet
      }

      // Process title tag inside head
      if (inHead && node.type === ELEMENT_NODE && node.tagId === TAG_TITLE) {
        // Title will be processed in processTextNode
        return undefined
      }

      // Process meta tags inside head
      if (inHead && node.type === ELEMENT_NODE && node.tagId === TAG_META) {
        const elementNode = node as ElementNode
        const { name, property, content } = elementNode.attributes || {}

        // Check for valid meta tags
        const metaName = property || name
        if (metaName && content && metaFields.has(metaName)) {
          frontmatter[metaName] = formatValue(metaName, content)
        }

        // Don't output anything for meta tags
        return undefined
      }

      // Generate frontmatter when we encounter the first non-head element
      if (!inHead && !hasGeneratedFrontmatter && Object.keys(frontmatter).length > 0) {
        hasGeneratedFrontmatter = true
        return generateFrontmatter()
      }

      return undefined
    },

    onNodeExit(event: NodeEvent, state: MdreamRuntimeState): string | undefined {
      const { node } = event

      // Handle exiting the head tag
      if (node.type === ELEMENT_NODE && node.tagId === TAG_HEAD) {
        inHead = false

        // Generate frontmatter as we exit the head
        if (Object.keys(frontmatter).length > 0) {
          hasGeneratedFrontmatter = true
          return generateFrontmatter()
        }
      }

      return undefined
    },

    processTextNode(node: TextNode): { content: string, skip: boolean } | undefined {
      // Only process if we're in the head section
      if (!inHead) {
        return undefined
      }

      // Handle text inside title tag
      const parent = node.parent
      if (parent && parent.tagId === TAG_TITLE && node.value) {
        frontmatter.title = formatValue('title', node.value.trim())
        return { content: '', skip: true }
      }

      // Skip other content in head
      return { content: '', skip: true }
    },
  })

  /**
   * Generate YAML frontmatter string from collected metadata
   */
  function generateFrontmatter(): string {
    if (Object.keys(frontmatter).length === 0) {
      return ''
    }

    // Build frontmatter content
    const yaml = Object.entries(frontmatter)
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
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    return `---\n${yaml}\n---\n\n`
  }
}
