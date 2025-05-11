import type { ElementNode, Node, Plugin, TextNode } from '../types.ts'
import { ELEMENT_NODE } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'
import { tagHandlers } from '../tags.ts'

/**
 * Type definition for Tailwind mapping
 */
interface TailwindMarkdownFormat {
  prefix?: string
  suffix?: string
  hidden?: boolean
}

/**
 * Mapping of Tailwind classes to Markdown formatting
 */
const TAILWIND_TO_MARKDOWN_MAP: Record<string, TailwindMarkdownFormat> = {
  // Typography
  'font-bold': { prefix: '**', suffix: '**' },
  'font-semibold': { prefix: '**', suffix: '**' },
  'font-black': { prefix: '**', suffix: '**' },
  'font-extrabold': { prefix: '**', suffix: '**' },
  'font-medium': { prefix: '**', suffix: '**' },
  'font-italic': { prefix: '*', suffix: '*' },
  'italic': { prefix: '*', suffix: '*' },
  'line-through': { prefix: '~~', suffix: '~~' },

  // Display properties - hide elements
  'hidden': { hidden: true },
  'invisible': { hidden: true },

  // Position properties - hide positioned elements
  'absolute': { hidden: true },
  'fixed': { hidden: true },
  'sticky': { hidden: true },
}

/**
 * Interface for storing Tailwind data on nodes
 */
interface TailwindNodeData {
  prefix: string
  suffix: string
  hidden: boolean
}

/**
 * Extract base class name from a responsive breakpoint variant
 */
function extractBaseClass(className: string): {
  baseClass: string
  breakpoint: string
} {
  const breakpoints = ['sm:', 'md:', 'lg:', 'xl:', '2xl:']

  for (const bp of breakpoints) {
    if (className.startsWith(bp)) {
      return {
        baseClass: className.substring(bp.length),
        breakpoint: bp,
      }
    }
  }

  return {
    baseClass: className,
    breakpoint: '', // Base/mobile class (no breakpoint)
  }
}

/**
 * Sort classes by breakpoint for mobile-first processing
 */
function sortByBreakpoint(classes: string[]): string[] {
  const breakpointOrder: Record<string, number> = {
    '': 0, // Base/mobile (no breakpoint)
    'sm:': 1,
    'md:': 2,
    'lg:': 3,
    'xl:': 4,
    '2xl:': 5,
  }

  return [...classes].sort((a, b) => {
    const aBreakpoint = extractBaseClass(a).breakpoint
    const bBreakpoint = extractBaseClass(b).breakpoint
    return breakpointOrder[aBreakpoint] - breakpointOrder[bBreakpoint]
  })
}

/**
 * Group classes by their formatting type to handle overrides
 */
function groupByFormattingType(classes: string[]): Record<string, string[]> {
  const sorted = sortByBreakpoint(classes)
  const groups: Record<string, string[]> = {
    emphasis: [], // italic, etc.
    weight: [], // bold, etc.
    decoration: [], // strikethrough, etc.
    display: [], // hidden, etc.
    position: [], // absolute, fixed, etc.
    other: [],
  }

  for (const cls of sorted) {
    const { baseClass } = extractBaseClass(cls)

    if (baseClass.includes('italic')) {
      groups.emphasis.push(cls)
    }
    else if (baseClass.includes('font-') || baseClass === 'bold') {
      groups.weight.push(cls)
    }
    else if (baseClass.includes('line-through') || baseClass.includes('underline')) {
      groups.decoration.push(cls)
    }
    else if (baseClass === 'hidden' || baseClass.includes('invisible')) {
      groups.display.push(cls)
    }
    else if (['absolute', 'fixed', 'sticky'].includes(baseClass)) {
      groups.position.push(cls)
    }
    else {
      groups.other.push(cls)
    }
  }

  return groups
}

/**
 * Fix redundant markdown delimiters
 */
function fixRedundantDelimiters(content: string): string {
  // Fix doubled delimiters like ****text**** -> **text**
  content = content.replace(/\*\*\*\*/g, '**')

  // Fix doubled strikethrough like ~~~~text~~~~ -> ~~text~~
  content = content.replace(/~~~~/g, '~~')

  // Fix doubled bold + italic like ***bold***italic*** -> ***bold italic***
  content = content.replace(/\*\*\*([^*]+)\*\*\*([^*]+)\*\*\*/g, '***$1 $2***')

  return content
}

/**
 * Normalizes a list of Tailwind classes by processing breakpoints and resolving conflicts
 */
function normalizeClasses(classes: string[]): string[] {
  // Track which classes we want to include in our final set
  const result: string[] = []

  // Process non-breakpoint classes first (mobile-first)
  const mobileClasses = classes.filter(cls => !hasBreakpoint(cls))
  const breakpointClasses = classes.filter(cls => hasBreakpoint(cls))

  // Add all mobile classes first
  result.push(...mobileClasses)

  // Then add breakpoint classes
  result.push(...breakpointClasses)

  return result
}

/**
 * Check if a class has a breakpoint prefix
 */
function hasBreakpoint(className: string): boolean {
  const { breakpoint } = extractBaseClass(className)
  return breakpoint !== ''
}

/**
 * Process Tailwind classes for an element with mobile-first approach
 */
function processTailwindClasses(classes: string[]): TailwindNodeData {
  let prefix = ''
  let suffix = ''
  let hidden = false

  // Normalize the class list to resolve conflicts and apply mobile-first approach
  const normalizedClasses = normalizeClasses(classes)

  // Group classes by function
  const grouped = groupByFormattingType(normalizedClasses)

  // Process weight (bold) classes
  if (grouped.weight.length > 0) {
    const { baseClass } = extractBaseClass(grouped.weight[0])
    const mapping = TAILWIND_TO_MARKDOWN_MAP[baseClass]
    if (mapping) {
      if (mapping.prefix)
        prefix += mapping.prefix
      if (mapping.suffix)
        suffix = mapping.suffix + suffix
    }
  }

  // Process emphasis (italic) classes
  if (grouped.emphasis.length > 0) {
    const { baseClass } = extractBaseClass(grouped.emphasis[0])
    const mapping = TAILWIND_TO_MARKDOWN_MAP[baseClass]
    if (mapping) {
      if (mapping.prefix)
        prefix += mapping.prefix
      if (mapping.suffix)
        suffix = mapping.suffix + suffix
    }
  }

  // Process decoration (strikethrough) classes
  if (grouped.decoration.length > 0) {
    const { baseClass } = extractBaseClass(grouped.decoration[0])
    const mapping = TAILWIND_TO_MARKDOWN_MAP[baseClass]
    if (mapping) {
      if (mapping.prefix)
        prefix += mapping.prefix
      if (mapping.suffix)
        suffix = mapping.suffix + suffix
    }
  }

  // Process display classes (hidden)
  for (const cls of grouped.display) {
    const { baseClass } = extractBaseClass(cls)
    const mapping = TAILWIND_TO_MARKDOWN_MAP[baseClass]
    if (mapping && mapping.hidden) {
      hidden = true
      break
    }
  }

  // Process position classes (absolute, fixed, sticky)
  for (const cls of grouped.position) {
    const { baseClass } = extractBaseClass(cls)
    const mapping = TAILWIND_TO_MARKDOWN_MAP[baseClass]
    if (mapping && mapping.hidden) {
      hidden = true
      break
    }
  }

  return { prefix, suffix, hidden }
}

/**
 * Creates a plugin that adds Tailwind class processing
 */
export function tailwindPlugin(): Plugin {
  return createPlugin({
    init(options) {
      // Set all tag handlers to use attributes since they need to
      // access the class attribute for Tailwind processing
      for (const tagName in tagHandlers) {
        if (Object.prototype.hasOwnProperty.call(tagHandlers, tagName)) {
          if (!tagHandlers[tagName].usesAttributes) {
            tagHandlers[tagName].usesAttributes = true
          }
        }
      }

      return { tailwind: true }
    },

    // Process node attributes to extract Tailwind classes
    processAttributes(node: ElementNode): void {
      const classAttr = node.attributes?.class

      if (!classAttr) {
        return
      }

      // Split on whitespace and filter out empty strings
      const classes = classAttr.split(/\s+/).filter(Boolean)
      const { prefix, suffix, hidden } = processTailwindClasses(classes)

      // Store the processed Tailwind information in the node's plugin data
      node.context = node.context || {}
      node.context.tailwind = {
        prefix,
        suffix,
        hidden,
      }
    },

    // Process text nodes to apply Tailwind formatting
    processTextNode(node: TextNode) {
      // Get parent node
      const parentNode = node.parent as ElementNode | undefined
      if (!parentNode || (parentNode.type !== ELEMENT_NODE)) {
        return undefined
      }

      // Skip hidden elements
      const tailwindData = parentNode.context?.tailwind
      if (tailwindData?.hidden) {
        return { content: '', skip: true }
      }

      // Get the content
      let content = node.value

      // Apply Tailwind prefix/suffix
      const prefix = tailwindData?.prefix || ''
      const suffix = tailwindData?.suffix || ''

      if (prefix || suffix) {
        content = prefix + content + suffix
        content = fixRedundantDelimiters(content)
      }

      return { content, skip: false }
    },

    // Filter out hidden elements
    beforeNodeProcess(node: Node): boolean {
      if (node.type === ELEMENT_NODE) {
        const elementNode = node as ElementNode

        // Check if element should be hidden based on plugin data
        const tailwindData = elementNode.context?.tailwind
        if (tailwindData?.hidden) {
          return false
        }
      }

      return true
    },
  })
}
