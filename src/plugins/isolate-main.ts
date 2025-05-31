import type { ElementNode, Plugin } from '../types.ts'
import { ELEMENT_NODE, TEXT_NODE } from '../const.ts'
import {
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_FOOTER,
  TAG_MAIN,
  TAG_HEADER
} from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

/**
 * Plugin that isolates main content using the following priority order:
 * 1. If an explicit <main> element exists (within 5 depth levels), use its content exclusively
 * 2. Otherwise, find content between the first header tag (h1-h6) and first footer
 * 3. If footer is within 5 levels of nesting from the header, use it as the end boundary
 * 4. Exclude all content before the start marker and after the end marker
 *
 * @example
 * ```html
 * <body>
 *   <nav>Navigation (excluded)</nav>
 *   <main>
 *     <h1>Main Title (included)</h1>
 *     <p>Main content (included)</p>
 *   </main>
 *   <footer>Footer (excluded)</footer>
 * </body>
 * ```
 *
 * @example
 * ```html
 * <body>
 *   <nav>Navigation (excluded)</nav>
 *   <h1>Main Title (included)</h1>
 *   <p>Main content (included)</p>
 *   <footer>Footer (excluded)</footer>
 * </body>
 * ```
 */
export function isolateMainPlugin(): Plugin {
  let mainElement: ElementNode | null = null
  let firstHeaderElement: ElementNode | null = null
  let afterFooter = false

  // Header tag IDs for quick lookup
  const headerTagIds = new Set([TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6])

  return createPlugin({
    beforeNodeProcess(event) {
      const { node } = event

      // Handle element nodes
      if (node.type === ELEMENT_NODE) {
        const element = node as ElementNode

        // Priority 1: Look for explicit <main> element first (within 5 depth)
        if (!mainElement && element.tagId === TAG_MAIN && element.depth <= 5) {
          mainElement = element
          return // Include the main element
        }

        // If we have a main element, only include nodes inside it
        if (mainElement) {
          // Check if this element is inside the main element
          let current: ElementNode | null = element.parent
          let isInsideMain = element === mainElement

          while (current && !isInsideMain) {
            if (current === mainElement) {
              isInsideMain = true
              break
            }
            current = current.parent
          }

          if (!isInsideMain) {
            return { skip: true }
          }

          return // Include content inside main
        }

        // Priority 2: Fallback to header-footer heuristic if no main element
        // Look for first header that's NOT inside a <header> tag
        if (!firstHeaderElement && headerTagIds.has(element.tagId)) {
          // Check if this heading is inside a <header> tag
          let current = element.parent
          let isInHeaderTag = false
          
          while (current) {
            if (current.tagId === TAG_HEADER) {
              isInHeaderTag = true
              break
            }
            current = current.parent
          }
          
          // Only use this heading if it's not in a header tag
          if (!isInHeaderTag) {
            firstHeaderElement = element
            return // Include the header
          }
        }

        // Look for footer after header (within 5 depth difference)
        if (firstHeaderElement && !afterFooter && element.tagId === TAG_FOOTER) {
          const depthDifference = element.depth - firstHeaderElement.depth
          if (depthDifference <= 5) {
            afterFooter = true
            return { skip: true } // Exclude footer and everything after
          }
        }

        // Skip content before header (when using heuristic)
        if (!firstHeaderElement) {
          return { skip: true }
        }

        // Skip content after footer (when using heuristic)
        if (afterFooter) {
          return { skip: true }
        }
      }

      // Handle text nodes
      if (node.type === TEXT_NODE) {
        // If using main element, only include text inside main
        if (mainElement) {
          let current = node.parent
          let isInsideMain = false

          while (current) {
            if (current === mainElement) {
              isInsideMain = true
              break
            }
            current = current.parent
          }

          if (!isInsideMain) {
            return { skip: true }
          }

          return
        }

        // Otherwise use header-footer heuristic for text nodes
        if (!firstHeaderElement || afterFooter) {
          return { skip: true }
        }
      }

      return // Include this node
    },
  })
}
