import type { SelectorMatcher } from '../libs/query-selector'
import type { ElementNode, TextNode, TransformPlugin } from '../types'
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
 * Whether an element is visually hidden, so the filter drops it and its subtree:
 * inline display:none / visibility:hidden / position:absolute|fixed, or the
 * `hidden` attribute (except hidden="until-found"). Browsers never render these,
 * so neither should the Markdown.
 *
 * Matches the actual `display:`/`visibility:`/`position:` declaration (not bare
 * keywords like `fixed`, which would false-match e.g. `background-attachment:fixed`)
 * and both unspaced and `: `-spaced forms. Allocation-free to keep the hot path
 * cheap; uppercased properties (rare in inline styles) are not handled.
 */
function isHidden(element: ElementNode): boolean {
  const style = element.attributes?.style
  if (style && (style.includes('display:none') || style.includes('display: none')
    || style.includes('visibility:hidden') || style.includes('visibility: hidden')
    || style.includes('position:absolute') || style.includes('position: absolute')
    || style.includes('position:fixed') || style.includes('position: fixed'))) {
    return true
  }
  // The `hidden` attribute hides the element unless it's the revealable
  // `until-found` state (an enumerated keyword, so ASCII case-insensitive).
  const hidden = element.attributes?.hidden
  return hidden !== undefined && hidden.toLowerCase() !== 'until-found'
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
} = {}): TransformPlugin {
  // Parse selectors — compile string tag names to TAG_* IDs for fast numeric matching
  const includeSelectors = options.include?.map(selector => compileSelector(selector)) || []
  const excludeSelectors = options.exclude?.map(selector => compileSelector(selector)) || []
  const processChildren = options.processChildren !== false // Default to true

  // Tracks elements whose subtree is hidden. Hidden-ness propagates O(1) from
  // the parent (set on enter, before children), so isHidden() runs once per
  // element instead of being re-evaluated for every ancestor of every node.
  const skippedSubtrees = new WeakSet<ElementNode>()

  return createPlugin({
    // Handle include/exclude filtering for elements and text nodes
    beforeNodeProcess(event: any) {
      const { node } = event

      // Handle text nodes - skip if any ancestor is excluded or hidden
      if (node.type === TEXT_NODE) {
        const textNode = node as TextNode
        const parent = textNode.parent as ElementNode | null
        // Hidden propagates to the immediate parent, so one lookup covers all ancestors.
        if (parent && skippedSubtrees.has(parent)) {
          return { skip: true }
        }
        return
      }

      // Handle element nodes
      if (node.type !== ELEMENT_NODE) {
        return
      }

      const element = node as ElementNode

      if (skippedSubtrees.has(element)) {
        return { skip: true }
      }

      // Drop hidden elements and their subtrees. Inherit the parent's hidden flag
      // (O(1)); only run the style/attr scan when not already inside a hidden subtree.
      const parentSkipped = element.parent ? skippedSubtrees.has(element.parent as ElementNode) : false
      if (parentSkipped || isHidden(element)) {
        skippedSubtrees.add(element)
        return { skip: true }
      }
      // Check if element should be excluded
      if (excludeSelectors.length && excludeSelectors.some(selector => selector.matches(element))) {
        skippedSubtrees.add(element)
        return { skip: true }
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
