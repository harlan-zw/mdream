import type { ElementNode, TextNode, TransformPlugin } from '../types'
import { ELEMENT_NODE } from '../const'
import { createPlugin } from '../pluggable/plugin'

/**
 * Interface for storing Tailwind data on nodes
 */
interface TailwindNodeData {
  prefix: string
  suffix: string
  hidden: boolean
}

// Each utility group keeps its winning value packed as `breakpoint << 1 | enabled`;
// -1 means no class in the group was seen.
const UNSET = -1

function breakpointOf(cls: string): number {
  const c = cls.charCodeAt(0)
  if (c === 115 /* s */ && cls.startsWith('sm:'))
    return 1
  if (c === 109 /* m */ && cls.startsWith('md:'))
    return 2
  if (c === 108 /* l */ && cls.startsWith('lg:'))
    return 3
  if (c === 120 /* x */ && cls.startsWith('xl:'))
    return 4
  if (c === 50 /* 2 */ && cls.startsWith('2xl:'))
    return 5
  return 0
}

const BREAKPOINT_PREFIX_LENGTH = [0, 3, 3, 3, 3, 4]

/** A class at an equal or wider breakpoint replaces the group's current value. */
function supersede(current: number, breakpoint: number, enabled: boolean): number {
  return current === UNSET || breakpoint >= current >> 1
    ? breakpoint << 1 | (enabled ? 1 : 0)
    : current
}

/**
 * Resolve Tailwind utility classes to Markdown emphasis and visibility. Mirrors
 * the Rust core (crates/core/src/tailwind.rs): within each group the class at
 * the widest breakpoint wins, and source order breaks ties, so `hidden md:block`
 * stays visible.
 */
function processTailwindClasses(classAttr: string): TailwindNodeData {
  let weight = UNSET
  let emphasis = UNSET
  let decoration = UNSET
  let displayHidden = UNSET
  let positionHidden = UNSET

  const length = classAttr.length
  let index = 0
  while (index < length) {
    while (index < length && classAttr.charCodeAt(index) <= 32)
      index++
    if (index >= length)
      break
    const start = index
    while (index < length && classAttr.charCodeAt(index) > 32)
      index++
    const cls = classAttr.slice(start, index)
    const breakpoint = breakpointOf(cls)
    const base = breakpoint ? cls.slice(BREAKPOINT_PREFIX_LENGTH[breakpoint]) : cls
    switch (base) {
      case 'italic':
        emphasis = supersede(emphasis, breakpoint, true)
        break
      case 'not-italic':
        emphasis = supersede(emphasis, breakpoint, false)
        break
      case 'font-bold':
      case 'font-semibold':
      case 'font-black':
      case 'font-extrabold':
      case 'font-medium':
      case 'bold':
        weight = supersede(weight, breakpoint, true)
        break
      case 'line-through':
      case 'underline':
        decoration = supersede(decoration, breakpoint, true)
        break
      case 'no-underline':
        decoration = supersede(decoration, breakpoint, false)
        break
      case 'hidden':
        displayHidden = supersede(displayHidden, breakpoint, true)
        break
      case 'block':
      case 'flex':
      case 'inline':
        displayHidden = supersede(displayHidden, breakpoint, false)
        break
      case 'absolute':
      case 'fixed':
      case 'sticky':
        positionHidden = supersede(positionHidden, breakpoint, true)
        break
      case 'static':
      case 'relative':
        positionHidden = supersede(positionHidden, breakpoint, false)
        break
      default:
        if (base.includes('font-'))
          weight = supersede(weight, breakpoint, false)
        else if (base.includes('invisible'))
          displayHidden = supersede(displayHidden, breakpoint, true)
    }
  }

  let prefix = ''
  let suffix = ''
  if (weight !== UNSET && weight & 1) {
    prefix += '**'
    suffix += '**'
  }
  if (emphasis !== UNSET && emphasis & 1) {
    prefix += '*'
    suffix = `*${suffix}`
  }
  if (decoration !== UNSET && decoration & 1) {
    prefix += '~~'
    suffix = `~~${suffix}`
  }
  const hidden = (displayHidden !== UNSET && (displayHidden & 1) === 1)
    || (positionHidden !== UNSET && (positionHidden & 1) === 1)
  return { prefix, suffix, hidden }
}

/**
 * Creates a plugin that adds Tailwind class processing
 */
export function tailwindPlugin(): TransformPlugin {
  return createPlugin({
    excludesOverflowSubtree(node) {
      if ((node.parent as ElementNode | undefined)?.context?.tailwind?.hidden)
        return true
      const classAttr = node.attributes?.class
      return classAttr ? processTailwindClasses(classAttr).hidden : false
    },

    // Process node attributes to extract Tailwind classes
    processAttributes(node: ElementNode): void {
      const parentHidden = (node.parent as ElementNode | undefined)?.context?.tailwind?.hidden

      const classAttr = node.attributes?.class
      if (!classAttr && !parentHidden) {
        return
      }

      let prefix = ''
      let suffix = ''
      let hidden = false
      if (classAttr) {
        const result = processTailwindClasses(classAttr)
        prefix = result.prefix
        suffix = result.suffix
        hidden = result.hidden
      }

      // Store the processed Tailwind information in the node's plugin data
      node.context = node.context || {}
      node.context.tailwind = {
        prefix,
        suffix,
        hidden: hidden || !!parentHidden,
      }
    },

    // Process text nodes to apply Tailwind formatting
    processTextNode(node: TextNode, state) {
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

      // Apply Tailwind prefix/suffix
      const prefix = state.outputFormat === 'markdown' ? (tailwindData?.prefix || '') : ''
      const suffix = state.outputFormat === 'markdown' ? (tailwindData?.suffix || '') : ''

      if (prefix || suffix) {
        node.generatedMarkdown = { prefix, suffix }
      }

      return undefined
    },

    // Filter out hidden elements
    beforeNodeProcess({ node }) {
      if (node.type === ELEMENT_NODE) {
        const elementNode = node as ElementNode
        if (elementNode.context?.tailwind?.hidden) {
          return { skip: true }
        }
      }
    },
  })
}
