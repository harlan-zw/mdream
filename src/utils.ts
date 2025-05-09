import type { Node } from './types.ts'
import { HTML_ENTITIES } from './const.ts'

/**
 * Decode HTML entities - optimized version with single pass
 */
export function decodeHTMLEntities(text: string): string {
  let result = ''
  let i = 0

  while (i < text.length) {
    if (text[i] === '&') {
      // Check for named entity
      let match = false

      for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
        if (text.startsWith(entity, i)) {
          result += replacement
          i += entity.length
          match = true
          break
        }
      }

      if (match)
        continue

      // Check for numeric entity
      if (i + 2 < text.length && text[i + 1] === '#') {
        const start = i
        i += 2 // Skip &# prefix

        // Handle hex entities
        const isHex = text[i] === 'x' || text[i] === 'X'
        if (isHex)
          i++

        const numStart = i

        // Find the end of the numeric entity
        while (i < text.length && text[i] !== ';') {
          i++
        }

        if (i < text.length && text[i] === ';') {
          const numStr = text.substring(numStart, i)
          const base = isHex ? 16 : 10

          // Parse the number and convert to character if valid
          try {
            const codePoint = Number.parseInt(numStr, base)
            if (!Number.isNaN(codePoint)) {
              result += String.fromCodePoint(codePoint)
              i++ // Skip the semicolon
              continue
            }
          }
          catch {
            // If parsing fails, treat as plain text
          }
        }

        // If we get here, it wasn't a valid entity, reset and treat as text
        i = start
      }
    }

    // Regular character
    result += text[i]
    i++
  }

  return result
}

export function traverseUpToFirstBlockNode(node: Node) {
  let firstBlockParent = node
  const parentsToIncrement = [firstBlockParent]
  // find first block element
  while (firstBlockParent?.name && firstBlockParent.tagHandler?.isInline) {
    if (!firstBlockParent.parentNode) {
      break
    }
    firstBlockParent = firstBlockParent.parentNode
    parentsToIncrement.push(firstBlockParent)
  }
  return parentsToIncrement
}
