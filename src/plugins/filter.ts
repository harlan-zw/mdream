import type { ElementNode, Plugin } from '../types.ts'
import { NodeEventEnter, NodeEventExit } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'
import { ELEMENT_NODE } from '../types.ts'

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
    return element.name === this.tagName
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
    const match = selector.match(/\[([^=[\]~|^$*\s]+)(?:(=|~=|\|=|\^=|\$=|\*=)["']?([^"'\]]+)["']?)?\]/)
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
  /** CSS selectors (or Tag Ids) for elements to include (all others will be excluded) */
  include?: (string | number)[]
  /** CSS selectors (or Tag Ids) for elements to exclude */
  exclude?: (string | number)[]
  /** Process children of matched elements (defaults to true) */
  processChildren?: boolean
} = {}): Plugin {
  // Parse selectors
  const includeSelectors = options.include?.map((selector) => {
    if (typeof selector === 'string') {
      return parseSelector(selector)
    }
    return { matches: (element: ElementNode) => element.tagId === selector }
  }) || []

  const excludeSelectors = options.exclude?.map((selector) => {
    if (typeof selector === 'string') {
      return parseSelector(selector)
    }
    return { matches: (element: ElementNode) => element.tagId === selector }
  }) || []

  const hasInclude = includeSelectors.length > 0
  const hasExclude = excludeSelectors.length > 0
  const processChildren = options.processChildren !== false // Default to true

  return createPlugin({

    beforeNodeProcess({ node, type }, state) {
      // Make sure context is initialized
      state.context = state.context || {}

      // Initialize plugin-specific context on first call
      if (!state.context.initialized) {
        state.context.includeDepths = []
        state.context.excludeDepth = undefined
        state.context.initialized = true
      }

      // If in an excluded subtree, skip this node and its children
      if (state.context.excludeDepth !== undefined && node.depth >= state.context.excludeDepth) {
        return { skip: true }
      }

      if (type === NodeEventEnter) {
        // For element nodes, apply selector matching
        if (node.type === ELEMENT_NODE) {
          // Check exclude selectors first (they take precedence)
          if (hasExclude) {
            const shouldExclude = excludeSelectors.some(selector => selector.matches(node))
            if (shouldExclude) {
              state.context.excludeDepth = node.depth
              return { skip: true }
            }
          }

          // Then handle include selectors
          if (hasInclude) {
            const shouldInclude = includeSelectors.some(selector => selector.matches(node))

            // If this node is included, track it
            if (shouldInclude) {
              // If we're not supposed to process children, don't add to includeDepths
              if (processChildren) {
                state.context.includeDepths.push(node.depth)
              }
            }

            // Skip if we're not in an included subtree and this node isn't included
            const isInIncludedSubtree = state.context.includeDepths.length > 0
            if (!isInIncludedSubtree && !shouldInclude) {
              return { skip: true }
            }
          }
        }
      }
      else if (type === NodeEventExit && node.type === ELEMENT_NODE) {
        // Handle exiting an excluded node
        if (state.context.excludeDepth === node.depth) {
          state.context.excludeDepth = undefined
        }

        // Handle exiting an included node
        if (state.context.includeDepths.length > 0) {
          const lastDepth = state.context.includeDepths[state.context.includeDepths.length - 1]
          if (lastDepth === node.depth) {
            state.context.includeDepths.pop()
          }
        }
      }
    },
  })
}
