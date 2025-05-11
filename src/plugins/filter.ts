import type { ElementNode, Plugin } from '../types.ts'
import { ELEMENT_NODE, TEXT_NODE } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

/**
 * CSS selector matching interface
 */
interface SelectorMatcher {
  /** Test if an element matches the selector */
  matches: (element: ElementNode) => boolean
  /** Get description of this selector (for debugging) */
  toString: () => string
}

/**
 * Matches a simple tag selector (e.g., 'div', 'p', 'h1')
 */
class TagSelector implements SelectorMatcher {
  constructor(private tagName: string) {}

  matches(element: ElementNode): boolean {
    return element.name?.toLowerCase() === this.tagName.toLowerCase()
  }

  toString(): string {
    return this.tagName
  }
}

/**
 * Matches an ID selector (e.g., '#main', '#content')
 */
class IdSelector implements SelectorMatcher {
  private id: string

  constructor(selector: string) {
    // Remove the # prefix
    this.id = selector.slice(1)
  }

  matches(element: ElementNode): boolean {
    return element.attributes?.id === this.id
  }

  toString(): string {
    return `#${this.id}`
  }
}

/**
 * Matches a class selector (e.g., '.container', '.header')
 */
class ClassSelector implements SelectorMatcher {
  private className: string

  constructor(selector: string) {
    // Remove the . prefix
    this.className = selector.slice(1)
  }

  matches(element: ElementNode): boolean {
    if (!element.attributes?.class)
      return false

    // Check if the class is in the element's class list
    const classes = element.attributes.class.split(/\s+/)
    return classes.includes(this.className)
  }

  toString(): string {
    return `.${this.className}`
  }
}

/**
 * Matches an attribute selector (e.g., '[data-id]', '[href="https://example.com"]')
 */
class AttributeSelector implements SelectorMatcher {
  private attrName: string
  private attrValue?: string
  private operator?: string

  constructor(selector: string) {
    // Parse [attr], [attr=value], [attr^=value], etc.
    const match = selector.match(/\[([^\]=~|^$*]+)(?:([=~|^$*]+)["']?([^"'\]]+)["']?)?\]/)

    if (match) {
      this.attrName = match[1]
      this.operator = match[2]
      this.attrValue = match[3]
    }
    else {
      // Fallback to simple attribute existence check
      this.attrName = selector.slice(1, -1)
    }
  }

  matches(element: ElementNode): boolean {
    // If the attribute doesn't exist, it's not a match
    if (!(this.attrName in (element.attributes || {}))) {
      return false
    }

    // If we're just checking for existence, we've already confirmed it exists
    if (!this.operator || !this.attrValue) {
      return true
    }

    const value = element.attributes[this.attrName]

    // Handle different attribute selectors
    switch (this.operator) {
      case '=': // Exact match
        return value === this.attrValue
      case '^=': // Starts with
        return value.startsWith(this.attrValue)
      case '$=': // Ends with
        return value.endsWith(this.attrValue)
      case '*=': // Contains
        return value.includes(this.attrValue)
      case '~=': // Contains word
        return value.split(/\s+/).includes(this.attrValue)
      case '|=': // Starts with prefix
        return value === this.attrValue || value.startsWith(`${this.attrValue}-`)
      default:
        return false
    }
  }

  toString(): string {
    if (!this.operator || !this.attrValue) {
      return `[${this.attrName}]`
    }
    return `[${this.attrName}${this.operator}${this.attrValue}]`
  }
}

/**
 * Compound selector that combines multiple selectors (e.g., 'div.container', 'h1#title')
 */
class CompoundSelector implements SelectorMatcher {
  constructor(private selectors: SelectorMatcher[]) {}

  matches(element: ElementNode): boolean {
    // All selectors must match
    return this.selectors.every(selector => selector.matches(element))
  }

  toString(): string {
    return this.selectors.map(s => s.toString()).join('')
  }
}

/**
 * Parses a CSS selector into a matcher
 */
function parseSelector(selector: string): SelectorMatcher {
  // Remove whitespace
  selector = selector.trim()

  if (!selector) {
    throw new Error('Empty selector')
  }

  // Handle compound selectors (without spaces/combinators for now)
  // This supports basic compound selectors like "div.class#id[attr=val]"
  const selectorParts: SelectorMatcher[] = []
  let current = ''
  let inAttribute = false

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]

    // Track if we're inside attribute brackets
    if (char === '[')
      inAttribute = true
    if (char === ']')
      inAttribute = false

    // If we're inside attribute brackets, keep collecting
    if (inAttribute) {
      current += char
      continue
    }

    // Handle selector type transitions
    if ((char === '.' || char === '#' || char === '[') && current) {
      // Save the current selector and start a new one
      if (current[0] === '.') {
        selectorParts.push(new ClassSelector(current))
      }
      else if (current[0] === '#') {
        selectorParts.push(new IdSelector(current))
      }
      else if (current[0] === '[') {
        selectorParts.push(new AttributeSelector(current))
      }
      else {
        selectorParts.push(new TagSelector(current))
      }
      current = char
    }
    else {
      current += char
    }
  }

  // Add the last selector
  if (current) {
    if (current[0] === '.') {
      selectorParts.push(new ClassSelector(current))
    }
    else if (current[0] === '#') {
      selectorParts.push(new IdSelector(current))
    }
    else if (current[0] === '[') {
      selectorParts.push(new AttributeSelector(current))
    }
    else {
      selectorParts.push(new TagSelector(current))
    }
  }

  // If there's only one selector, return it directly
  if (selectorParts.length === 1) {
    return selectorParts[0]
  }

  // Otherwise, return a compound selector
  return new CompoundSelector(selectorParts)
}

// Tracks whether we're starting element capture or not
interface ElementCapture {
  elementName: string
  content: string
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
  /** CSS selectors for elements to include (all others will be excluded) */
  include?: string[]
  /** CSS selectors for elements to exclude */
  exclude?: string[]
  /** Whether to also process the children of matching elements */
  processChildren?: boolean
} = {}): Plugin {
  // Parse selectors
  const includeSelectors = options.include?.map(parseSelector) || []
  const excludeSelectors = options.exclude?.map(parseSelector) || []
  const processChildren = options.processChildren !== false // Default to true

  // Track element matching for content filtering
  const capturedElements: Map<string, ElementCapture> = new Map()
  const elementsToInclude: Set<string> = new Set()
  const elementsToExclude: Set<string> = new Set()
  const elementStack: string[] = []
  let currentElementId = 0

  return createPlugin({
    init() {
      // Reset state
      capturedElements.clear()
      elementsToInclude.clear()
      elementsToExclude.clear()
      elementStack.length = 0
      currentElementId = 0
      return { querySelectorPlugin: true }
    },

    onNodeEnter(event, state) {
      const { node } = event

      // We only care about element nodes for selector matching
      if (node.type !== ELEMENT_NODE || !node.name) {
        return
      }

      const element = node as ElementNode
      // Generate a unique ID for this element
      const elementId = `el_${currentElementId++}`

      // Add to the stack to track hierarchy
      elementStack.push(elementId)

      // Check if it should be excluded
      if (excludeSelectors.length) {
        const shouldExclude = excludeSelectors.some(selector => selector.matches(element))
        if (shouldExclude) {
          elementsToExclude.add(elementId)
          return
        }
      }

      // Special handling for specific tags that need to be processed as units
      // Links <a> and images <img> need special handling to ensure their attributes
      // are included in the final output
      const isSpecialTag = element.name === 'a' || element.name === 'img'

      // Check if it should be included
      if (includeSelectors.length) {
        // For special tags like <a> and <img>, look for attribute filters that apply to them
        // and force inclusion when matched
        if (isSpecialTag) {
          // Automatically include links with href or images with alt when those attributes are selected
          const hasMatchingSelector = includeSelectors.some((selector) => {
            // Only check if the selector is specific to this tag type
            if ((element.name === 'a' && selector.toString().includes('[href]'))
              || (element.name === 'img' && selector.toString().includes('[alt]'))) {
              return selector.matches(element)
            }
            return false
          })

          if (hasMatchingSelector) {
            elementsToInclude.add(elementId)

            // Ensure children (like text nodes) are processed too
            for (let i = elementStack.length - 2; i >= 0; i--) {
              const parentId = elementStack[i]
              elementsToInclude.add(parentId)
            }

            // Special handling for link text nodes
            if (element.name === 'a' && element.children) {
              // Process all child nodes of links
              for (const child of element.children) {
                if (child.type === TEXT_NODE) {
                  // Include all text nodes of the link
                  elementsToInclude.add(`el_${currentElementId}`) // Reserve ID for text node
                }
              }
            }
          }
        }

        // Standard inclusion logic
        const directlyIncluded = includeSelectors.some(selector => selector.matches(element))
        if (directlyIncluded) {
          elementsToInclude.add(elementId)
        }
        else if (processChildren && elementStack.length > 1) {
          // Check if parent is included
          const parentId = elementStack[elementStack.length - 2]
          if (elementsToInclude.has(parentId)) {
            elementsToInclude.add(elementId)
          }
        }
      }
      else {
        // If no include selectors, default to including everything not excluded
        elementsToInclude.add(elementId)
      }

      // Initialize capture for this element
      capturedElements.set(elementId, {
        elementName: element.name,
        content: '',
      })
    },

    // Track when we exit an element
    onNodeExit(event, state) {
      if (event.node.type !== ELEMENT_NODE) {
        return
      }

      // Pop from stack
      if (elementStack.length) {
        elementStack.pop()
      }
    },

    // Note: We now handle all content transformation through processTextNode

    // Process text nodes (this is where we can filter by element)
    processTextNode(node, state) {
      // If no filtering, return as is
      if (includeSelectors.length === 0 && excludeSelectors.length === 0) {
        return undefined
      }

      // Get current element ID from stack
      if (!elementStack.length) {
        return undefined
      }

      // Process content based on selector rules
      if (elementStack.length === 0 && node.type === TEXT_NODE) {
        // Filter out any elements that don't match our criteria

        // Regular HTML processing, append included content and filter excluded
        if (includeSelectors.length === 0 && excludeSelectors.length === 0) {
          // No filtering
          return undefined
        }

        // Handle include and exclude rules
        if (includeSelectors.length) {
          // Only include content from elements that match include selectors
          let includeContent = false
          for (const elementId of elementsToInclude) {
            // Skip elements that are specifically excluded
            if (elementsToExclude.has(elementId)) {
              continue
            }
            includeContent = true
            break
          }

          if (!includeContent) {
            return { content: '', skip: true } // Nothing matches include criteria
          }
        }
        else {
          // Only exclude content
          // If nothing has been excluded, return as is
          if (elementsToExclude.size === 0) {
            return undefined
          }
        }
      }

      // Special handling for link and image text
      if (node.parent?.name === 'a' || node.parent?.name === 'img') {
        // Check if the parent element has the required attributes
        const isLinkWithHref = node.parent.name === 'a' && node.parent.attributes?.href
        const isImgWithAlt = node.parent.name === 'img' && node.parent.attributes?.alt

        // Check if any of our selectors match these special elements
        const specialSelectorMatches = includeSelectors.some((selector) => {
          const selectorStr = selector.toString()
          return (isLinkWithHref && selectorStr.includes('a[href]'))
            || (isImgWithAlt && selectorStr.includes('img[alt]'))
        })

        // If we're targeting links with href or images with alt, always include their text
        if (specialSelectorMatches) {
          return undefined // Process normally
        }
      }

      const currentElementId = elementStack[elementStack.length - 1]

      // Check if current element or any parent is excluded
      let isExcluded = false
      for (let i = 0; i < elementStack.length; i++) {
        if (elementsToExclude.has(elementStack[i])) {
          isExcluded = true
          break
        }
      }

      if (isExcluded) {
        return { content: '', skip: true }
      }

      // With include selectors, we need element or any parent to be included
      if (includeSelectors.length) {
        let included = false

        // If we're not processing children, only direct matches count
        if (!processChildren) {
          // Only consider the current element - not parents
          included = elementsToInclude.has(currentElementId)
        }
        else {
          // Check the entire stack for included elements
          for (let i = 0; i < elementStack.length; i++) {
            if (elementsToInclude.has(elementStack[i])) {
              included = true
              break
            }
          }
        }

        if (!included) {
          return { content: '', skip: true }
        }
      }

      // Default: process normally
      return undefined
    },

    // Process element attributes if needed
    processAttributes(node, state) {
      // Nothing to do here for now
    },

    // Check if we should process this node at all
    beforeNodeProcess(node, state) {
      return true // Always process, we'll filter in the text handling
    },
  })
}

// Extend the ElementNode type to include our internal node ID
declare module '../types.ts' {
  interface ElementNode {
    /** Internal node ID for tracking selected nodes */
    __nodeId?: number
  }
}
