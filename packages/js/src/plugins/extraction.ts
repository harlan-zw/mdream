import type { ExtractedElement as CoreExtractedElement, ElementNode, MdreamRuntimeState, TransformPlugin } from '../types'
import { parseSelector } from '../libs/query-selector'
import { createPlugin } from '../pluggable/plugin'

export interface ExtractedElement extends ElementNode {
  textContent: string
}

type ExtractionCallback = (element: ExtractedElement, state: MdreamRuntimeState) => void

/** Extract matching elements through the composable JavaScript plugin interface. */
export function extractionPlugin(selectors: Record<string, ExtractionCallback>): TransformPlugin {
  // Parse selectors and create matcher-callback pairs
  const matcherCallbacks = Object.entries(selectors).map(([selector, callback]) => ({
    matcher: parseSelector(selector),
    callback,
  }))

  // Track elements we're currently collecting content for
  const trackedElements = new Map<ElementNode, { textContent: string, callbacks: ExtractionCallback[] }>()

  return createPlugin({
    onNodeEnter(element) {
      // Check if this element matches any of our selectors
      let callbacks: ExtractionCallback[] | undefined
      for (let i = 0; i < matcherCallbacks.length; i++) {
        const { matcher, callback } = matcherCallbacks[i]!
        if (matcher.matches(element)) {
          callbacks ||= []
          callbacks.push(callback)
        }
      }
      if (callbacks)
        trackedElements.set(element, { textContent: '', callbacks })
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
        for (let i = 0; i < tracked.callbacks.length; i++) {
          // Each matching handler receives its own extracted element object.
          const extractedElement: ExtractedElement = {
            ...element,
            attributes: { ...element.attributes },
            textContent: tracked.textContent.trim(),
          }
          tracked.callbacks[i]!(extractedElement, state)
        }

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

  const trackedElements = new Map<ElementNode, { textContent: string, selectors: string[] }>()

  const plugin = createPlugin({
    onNodeEnter(element) {
      let selectors: string[] | undefined
      for (let i = 0; i < matchers.length; i++) {
        const m = matchers[i]!
        if (m.matcher.matches(element)) {
          selectors ||= []
          selectors.push(m.selector)
        }
      }
      if (selectors)
        trackedElements.set(element, { textContent: '', selectors })
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
        for (let i = 0; i < tracked.selectors.length; i++) {
          const extracted: CoreExtractedElement = {
            selector: tracked.selectors[i]!,
            tagName: element.name,
            textContent: tracked.textContent.trim(),
            attributes: { ...element.attributes },
          }
          results.push(extracted)
        }
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
