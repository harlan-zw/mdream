import type { ElementNode, Plugin } from '../types.ts'
import { parseSelector } from '../libs/query-selector.ts'
import { createPlugin } from '../pluggable/plugin.ts'

export interface ExtractedElement extends ElementNode {
  textContent: string
}

export function extractionPlugin(selectors: Record<string, (element: ExtractedElement) => void>): Plugin {
  // Parse selectors and create matcher-callback pairs
  const matcherCallbacks = Object.entries(selectors).map(([selector, callback]) => ({
    matcher: parseSelector(selector),
    callback,
  }))

  // Track elements we're currently collecting content for
  const trackedElements = new Map<ElementNode, { textContent: string, callback: (element: ExtractedElement) => void }>()

  return createPlugin({
    onNodeEnter(element) {
      // Check if this element matches any of our selectors
      matcherCallbacks.forEach(({ matcher, callback }) => {
        if (matcher.matches(element)) {
          // Start tracking this element's content
          trackedElements.set(element, { textContent: '', callback })
        }
      })
    },

    processTextNode(textNode) {
      // Add text content to any tracked ancestor elements
      let currentParent = textNode.parent
      while (currentParent) {
        const tracked = trackedElements.get(currentParent)
        if (tracked) {
          tracked.textContent += textNode.value
        }
        currentParent = currentParent.parent as ElementNode | null
      }
    },

    onNodeExit(element) {
      // Check if we were tracking this element
      const tracked = trackedElements.get(element)
      if (tracked) {
        // Create extracted element with textContent
        const extractedElement: ExtractedElement = {
          ...element,
          textContent: tracked.textContent.trim(),
        }

        // Call the callback with the complete element and its text content
        tracked.callback(extractedElement)

        // Stop tracking this element
        trackedElements.delete(element)
      }
    },
  })
}
