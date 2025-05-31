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
 * Matches a simple tag selector (e.g., 'div', 'p', 'h1')
 */
class TagSelector implements SelectorMatcher {
  constructor(private readonly tagName: string) {}

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
  private readonly id: string

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
  private readonly className: string

  constructor(selector: string) {
    // Remove the . prefix
    this.className = selector.slice(1)
  }

  matches(element: ElementNode): boolean {
    if (!element.attributes?.class)
      return false

    // Check if the class is in the element's class list
    const classes = element.attributes.class.trim().split(' ').filter(Boolean)
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
  private readonly attrName: string
  private readonly attrValue?: string
  private readonly operator?: string

  constructor(selector: string) {
    // Parse [attr], [attr=value], [attr^=value], etc.
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group
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
        return value.trim().split(' ').filter(Boolean).includes(this.attrValue)
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
  constructor(private readonly selectors: SelectorMatcher[]) {}

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
