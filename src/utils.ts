import type { DownstreamState } from './types.ts'
import { HTML_ENTITIES } from './const.ts'

/**
 * Decode HTML entities - optimized version with single pass
 */
export function decodeHTMLEntities(text: string): string {
  if (!text || !text.includes('&'))
    return text

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

/**
 * Escape markdown code block syntax within code blocks
 * This prevents triple backticks inside code blocks from breaking the syntax
 */
export function escapeMarkdownCodeBlock(text: string): string {
  // Replace triple backticks with escaped version
  return text.replace(/```/g, '\\`\\`\\`')
}

export function trimNewLines(s: string) {
  return trimWhitespace(s.replace(/^\n+/, '').replace(/\n+$/, ''))
}

export function trimWhitespace(s: string) {
  return s.replace(/\s+/g, ' ')
}

export function isNodeInStack(state: DownstreamState, elementName: string): boolean {
  for (let i = state.nodeStack.length - 1; i >= 0; i--) {
    const ctx = state.nodeStack[i]
    if (ctx?.name === elementName) {
      return true
    }
  }
  return false
}

export function getNodeDepth(state: DownstreamState, elementName: string): number {
  return state.nodeStack.filter(Boolean).filter(ctx =>
    ctx.name === elementName,
  ).length
}

/**
 * Find first occurrence of any character in a set
 */
export function findFirstOf(str: string, startIndex: number, chars: string): number {
  for (let i = startIndex; i < str.length; i++) {
    if (chars.includes(str[i])) {
      return i
    }
  }
  return -1
}
