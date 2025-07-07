import type { ElementNode } from '../types.ts'

/**
 * CSS selector matching interface
 */
export interface SelectorMatcher {
  /** Test if an element matches the selector */
  matches: (element: ElementNode) => boolean
  /** Get description of this selector (for debugging) */
  toString: () => string
}

/**
 * Creates a tag selector matcher (e.g., 'div', 'p', 'h1')
 */
export function createTagSelector(tagName: string): SelectorMatcher {
  return {
    matches: (element: ElementNode) => element.name === tagName,
    toString: () => tagName,
  }
}

/**
 * Creates an ID selector matcher (e.g., '#main', '#content')
 */
export function createIdSelector(selector: string): SelectorMatcher {
  const id = selector.slice(1) // Remove the # prefix
  return {
    matches: (element: ElementNode) => element.attributes?.id === id,
    toString: () => `#${id}`,
  }
}

/**
 * Creates a class selector matcher (e.g., '.container', '.header')
 */
export function createClassSelector(selector: string): SelectorMatcher {
  const className = selector.slice(1) // Remove the . prefix
  return {
    matches: (element: ElementNode) => {
      if (!element.attributes?.class)
        return false
      const classes = element.attributes.class.trim().split(' ').filter(Boolean)
      return classes.includes(className)
    },
    toString: () => `.${className}`,
  }
}

/**
 * Creates an attribute selector matcher (e.g., '[data-id]', '[href="https://example.com"]')
 */
export function createAttributeSelector(selector: string): SelectorMatcher {
  // Parse [attr], [attr=value], [attr^=value], etc.
  // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group
  const match = selector.match(/\[([^\]=~|^$*]+)(?:([=~|^$*]+)["']?([^"'\]]+)["']?)?\]/)

  const attrName = match ? match[1] : selector.slice(1, -1)
  const operator = match?.[2]
  const attrValue = match?.[3]

  return {
    matches: (element: ElementNode) => {
      // If the attribute doesn't exist, it's not a match
      if (!(attrName in (element.attributes || {}))) {
        return false
      }

      // If we're just checking for existence, we've already confirmed it exists
      if (!operator || !attrValue) {
        return true
      }

      const value = element.attributes[attrName]

      // Handle different attribute selectors
      switch (operator) {
        case '=': // Exact match
          return value === attrValue
        case '^=': // Starts with
          return value.startsWith(attrValue)
        case '$=': // Ends with
          return value.endsWith(attrValue)
        case '*=': // Contains
          return value.includes(attrValue)
        case '~=': // Contains word
          return value.trim().split(' ').filter(Boolean).includes(attrValue)
        case '|=': // Starts with prefix
          return value === attrValue || value.startsWith(`${attrValue}-`)
        default:
          return false
      }
    },
    toString: () => {
      if (!operator || !attrValue) {
        return `[${attrName}]`
      }
      return `[${attrName}${operator}${attrValue}]`
    },
  }
}

/**
 * Creates a compound selector that combines multiple selectors (e.g., 'div.container', 'h1#title')
 */
export function createCompoundSelector(selectors: SelectorMatcher[]): SelectorMatcher {
  return {
    matches: (element: ElementNode) => selectors.every(selector => selector.matches(element)),
    toString: () => selectors.map(s => s.toString()).join(''),
  }
}

/**
 * Parses a CSS selector into a matcher
 */
export function parseSelector(selector: string): SelectorMatcher {
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

    // Handle selector type transitions BEFORE setting inAttribute
    if ((char === '.' || char === '#' || char === '[') && current) {
      // Save the current selector and start a new one
      if (current[0] === '.') {
        selectorParts.push(createClassSelector(current))
      }
      else if (current[0] === '#') {
        selectorParts.push(createIdSelector(current))
      }
      else if (current[0] === '[') {
        selectorParts.push(createAttributeSelector(current))
      }
      else {
        selectorParts.push(createTagSelector(current))
      }
      current = char
    }
    else {
      current += char
    }

    // Track if we're inside attribute brackets
    if (char === '[')
      inAttribute = true
    if (char === ']')
      inAttribute = false

    // If we're inside attribute brackets, keep collecting (but skip the opening bracket)
    if (inAttribute && char !== '[') {
      // Last statement in loop, no need for continue
    }
  }

  // Add the last selector
  if (current) {
    if (current[0] === '.') {
      selectorParts.push(createClassSelector(current))
    }
    else if (current[0] === '#') {
      selectorParts.push(createIdSelector(current))
    }
    else if (current[0] === '[') {
      selectorParts.push(createAttributeSelector(current))
    }
    else {
      selectorParts.push(createTagSelector(current))
    }
  }

  // If there's only one selector, return it directly
  if (selectorParts.length === 1) {
    return selectorParts[0]
  }

  // Otherwise, return a compound selector
  return createCompoundSelector(selectorParts)
}
