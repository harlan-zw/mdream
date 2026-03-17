import type { ExtractedElement as CoreExtractedElement, ElementNode, MdreamRuntimeState, TransformPlugin } from '../types'
import { parseSelector } from '../libs/query-selector'
import { createPlugin } from '../pluggable/plugin'

export interface ExtractedElement extends ElementNode {
  textContent: string
}

/**
 * @deprecated Use `plugins.extraction` config for declarative extraction that works with both JS and Rust engines.
 */
export function extractionPlugin(selectors: Record<string, (element: ExtractedElement, state: MdreamRuntimeState) => void>): TransformPlugin {
  // Parse selectors and create matcher-callback pairs
  const matcherCallbacks = Object.entries(selectors).map(([selector, callback]) => ({
    matcher: parseSelector(selector),
    callback,
  }))

  // Track elements we're currently collecting content for
  const trackedElements = new Map<ElementNode, { textContent: string, callback: (element: ExtractedElement, state: MdreamRuntimeState) => void }>()

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
      // Return undefined to indicate no transformation
      return undefined
    },

    onNodeExit(element, state) {
      // Check if we were tracking this element
      const tracked = trackedElements.get(element)
      if (tracked) {
        // Create extracted element with textContent
        const extractedElement: ExtractedElement = {
          ...element,
          textContent: tracked.textContent.trim(),
        }

        // Call the callback with the complete element and its text content
        tracked.callback(extractedElement, state)

        // Stop tracking this element
        trackedElements.delete(element)
      }
    },
  })
}

/**
 * Extraction collector for `plugins.extraction` config.
 * Collects results during processing; callbacks are called post-conversion
 * to match Rust engine behavior.
 */
export function extractionCollectorPlugin(config: Record<string, (element: CoreExtractedElement) => void>): { plugin: TransformPlugin, getResults: () => CoreExtractedElement[], callHandlers: () => void } {
  const matchers = Object.entries(config).map(([selector, callback]) => ({
    selector,
    matcher: parseSelector(selector),
    callback,
  }))
  const results: CoreExtractedElement[] = []

  const trackedElements = new Map<ElementNode, { textContent: string, selector: string, callback: (element: CoreExtractedElement) => void }>()

  const plugin = createPlugin({
    onNodeEnter(element) {
      for (let i = 0; i < matchers.length; i++) {
        const m = matchers[i]!
        if (m.matcher.matches(element)) {
          trackedElements.set(element, { textContent: '', selector: m.selector, callback: m.callback })
        }
      }
    },

    processTextNode(textNode) {
      let currentParent = textNode.parent
      while (currentParent) {
        const tracked = trackedElements.get(currentParent)
        if (tracked) {
          tracked.textContent += textNode.value
        }
        currentParent = currentParent.parent as ElementNode | null
      }
      return undefined
    },

    onNodeExit(element) {
      const tracked = trackedElements.get(element)
      if (tracked) {
        const extracted: CoreExtractedElement = {
          selector: tracked.selector,
          tagName: element.name,
          textContent: tracked.textContent.trim(),
          attributes: { ...element.attributes },
        }
        results.push(extracted)
        trackedElements.delete(element)
      }
    },
  })

  function callHandlers() {
    for (let i = 0; i < results.length; i++) {
      const el = results[i]!
      for (let j = 0; j < matchers.length; j++) {
        if (matchers[j]!.selector === el.selector) {
          matchers[j]!.callback(el)
          break
        }
      }
    }
  }

  return { plugin, getResults: () => results, callHandlers }
}
