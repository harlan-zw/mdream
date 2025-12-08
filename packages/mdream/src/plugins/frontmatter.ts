import type { ElementNode, Node, TextNode } from '../types.ts'
import { collectNodeContent } from '../buffer-region.ts'
import { ELEMENT_NODE, TAG_HEAD, TAG_META, TAG_TITLE } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

export interface FrontmatterData {
  title?: string
  meta: Record<string, string>
  [key: string]: string | Record<string, string> | undefined
}

export interface FrontmatterPluginOptions {
  /** Additional frontmatter fields to include */
  additionalFields?: Record<string, string>
  /** Meta tag names to extract (beyond the standard ones) */
  metaFields?: string[]
  /** Custom formatter for frontmatter values */
  formatValue?: (name: string, value: string) => string
  /** Inject frontmatter into markdown output @default true */
  inject?: boolean
  /** Callback when frontmatter is extracted */
  onFrontmatter?: (data: FrontmatterData) => void
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

  // Metadata collection - store raw values
  const frontmatter: FrontmatterData = { ...additionalFields, meta: {} }
  let inHead = false

  // Format value for YAML output
  const formatValue = options.formatValue || ((_name: string, value: string) => {
    const escaped = value.replace(/"/g, '\\"')
    if (escaped.includes('\n') || escaped.includes(':') || escaped.includes('#') || escaped.includes(' '))
      return `"${escaped}"`
    return escaped
  })

  const plugin = createPlugin({
    onNodeEnter(node): string | undefined {
      if (node.tagId === TAG_HEAD) {
        inHead = true
        return
      }

      if (inHead && node.type === ELEMENT_NODE && node.tagId === TAG_TITLE)
        return

      if (inHead && node.type === ELEMENT_NODE && node.tagId === TAG_META) {
        const elementNode = node as ElementNode
        const { name, property, content } = elementNode.attributes || {}
        const metaName = property || name
        if (metaName && content && metaFields.has(metaName))
          frontmatter.meta[metaName] = content // store raw value
        return undefined
      }
    },

    onNodeExit(node, state) {
      // Handle exiting the head tag
      if (node.type === ELEMENT_NODE && node.tagId === TAG_HEAD) {
        inHead = false

        // Generate frontmatter as we exit the head
        if (Object.keys(frontmatter).length > 0) {
          // Call callback if provided
          if (options.onFrontmatter) {
            options.onFrontmatter(frontmatter)
          }

          // Only inject if inject !== false
          if (options.inject !== false) {
            const frontmatterContent = generateFrontmatter()
            collectNodeContent({ type: 1, regionId: 0 } as Node, frontmatterContent, state)
          }
        }
      }

      return undefined
    },

    processTextNode(node: TextNode) {
      if (!inHead)
        return

      const parent = node.parent
      if (parent && parent.tagId === TAG_TITLE && node.value) {
        frontmatter.title = node.value.trim() // store raw value
        return { content: '', skip: true }
      }
    },
  });

  // Add name for identification
  (plugin as { _name?: string })._name = 'frontmatter'

  function generateFrontmatter(): string {
    if (Object.keys(frontmatter).length === 0)
      return ''

    let yamlLines: string[] = []
    const entries = Object.entries(frontmatter)
      .sort(([a], [b]) => {
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

    for (const [key, value] of entries) {
      if (key === 'meta' && typeof value === 'object' && value && Object.keys(value).length > 0) {
        yamlLines.push('meta:')
        const metaEntries = Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([metaKey, metaValue]) => {
            const fmtKey = metaKey.includes(':') ? `"${metaKey}"` : metaKey
            return `  ${fmtKey}: ${formatValue(metaKey, metaValue)}`
          })
        yamlLines.push(...metaEntries)
      }
      else if (key !== 'meta' && typeof value === 'string') {
        yamlLines.push(`${key}: ${formatValue(key, value)}`)
      }
    }

    if (Object.keys(frontmatter.meta).length === 0)
      yamlLines = yamlLines.filter(line => !line.startsWith('meta:'))

    return `---\n${yamlLines.join('\n')}\n---\n\n`
  }

  return plugin
}
