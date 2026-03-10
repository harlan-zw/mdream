import type { SelectorMatcher } from '../libs/query-selector'
import type { ElementNode, Plugin, TextNode } from '../types'
import { ELEMENT_NODE, TagIdMap, TEXT_NODE } from '../const'
import { parseSelector } from '../libs/query-selector'
import { createPlugin } from '../pluggable/plugin'

/**
 * Compiles a selector (string or TAG_* number) into a fast matcher.
 * String tag names (e.g. 'form') are compiled to TAG_* ID comparisons at creation time,
 * avoiding per-element string comparison. CSS selectors (e.g. '.class', '#id') use parseSelector.
 */
function compileSelector(selector: string | number): SelectorMatcher {
  if (typeof selector === 'number') {
    return { matches: (element: ElementNode) => element.tagId === selector, toString: () => String(selector) }
  }
  // Check if it's a simple tag name that can be compiled to a TAG_* ID
  const tagId = (TagIdMap as Record<string, number>)[selector]
  if (tagId !== undefined) {
    return { matches: (element: ElementNode) => element.tagId === tagId, toString: () => selector }
  }
  return parseSelector(selector)
}

/**
 * Plugin that filters nodes based on CSS selectors.
 * Allows including or excluding nodes based on selectors.
 *
 * @example
 * // Include only heading elements and their children
 * withQuerySelectorPlugin({ include: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] })
 *
 * @example
 * // Exclude navigation, sidebar, and footer
 * withQuerySelectorPlugin({ exclude: ['nav', '#sidebar', '.footer'] })
 */
export function filterPlugin(options: {
  /** CSS selectors, tag names, or TAG_* constants for elements to include (all others will be excluded) */
  include?: (string | number)[]
  /** CSS selectors, tag names, or TAG_* constants for elements to exclude */
  exclude?: (string | number)[]
  /** Whether to also process the children of matching elements */
  processChildren?: boolean
  keepAbsolute?: boolean
} = {}): Plugin {
  // Parse selectors — compile string tag names to TAG_* IDs for fast numeric matching
  const includeSelectors = options.include?.map(selector => compileSelector(selector)) || []
  const excludeSelectors = options.exclude?.map(selector => compileSelector(selector)) || []
  const processChildren = options.processChildren !== false // Default to true

  // No need for complex state tracking since beforeNodeProcess handles everything

  return createPlugin({
    // Handle include/exclude filtering for elements and text nodes
    beforeNodeProcess(event: any) {
      const { node } = event

      // Handle text nodes - check if any ancestor is excluded
      if (node.type === TEXT_NODE) {
        const textNode = node as TextNode
        let currentParent = textNode.parent as ElementNode | null
        while (currentParent && excludeSelectors.length) {
          const parentShouldExclude = excludeSelectors.some(selector => selector.matches(currentParent!))
          if (parentShouldExclude) {
            return { skip: true }
          }
          currentParent = currentParent.parent as ElementNode | null
        }
        return
      }

      // Handle element nodes
      if (node.type !== ELEMENT_NODE) {
        return
      }

      const element = node as ElementNode

      // Check if element should be excluded
      if (excludeSelectors.length) {
        if (element.attributes.style?.includes('absolute') || element.attributes.style?.includes('fixed')) {
          return { skip: true }
        }
        const shouldExclude = excludeSelectors.some(selector => selector.matches(element))
        if (shouldExclude) {
          return { skip: true }
        }
      }

      // Check if any parent element is excluded
      let currentParent = element.parent
      while (currentParent) {
        if (excludeSelectors.length) {
          const parentShouldExclude = excludeSelectors.some(selector => selector.matches(currentParent!))
          if (parentShouldExclude) {
            return { skip: true }
          }
        }
        currentParent = currentParent.parent as ElementNode | null
      }

      // Handle include filtering (only if include selectors are specified)
      if (includeSelectors.length) {
        // Check if this element or any ancestor matches include selectors
        let currentElement = element as ElementNode | null
        while (currentElement) {
          const shouldInclude = includeSelectors.some(selector => selector.matches(currentElement!))
          if (shouldInclude) {
            return // Include this element
          }
          if (!processChildren)
            break // Don't check ancestors if not processing children
          currentElement = currentElement.parent as ElementNode | null
        }

        // If we have include selectors but nothing matched, exclude this element
        return { skip: true }
      }
    },

  } as any)
}
