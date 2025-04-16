import { HTML_ENTITIES } from './const.ts'

/**
 * Count occurrences of a character in a string
 */
export function countChar(str: string, char: string): number {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char)
      count++
  }
  return count
}

/**
 * Finds optimal break point to split text chunks
 */
export function findBestBreakPoint(text: string, maxSize: number): number {
  if (text.length <= maxSize)
    return text.length

  // Use a single-pass approach to find all potential break points
  const checkRange = Math.min(maxSize, text.length)
  let bestBreak = maxSize
  let paragraphBreak = -1
  let lineBreak = -1
  let sentenceBreak = -1
  let spaceBreak = -1
  let horizontalRuleBreak = -1

  // Scan backwards from maxSize to find best break point
  for (let i = checkRange; i > checkRange - 200 && i > 0; i--) {
    const char = text[i]
    const nextChar = i < text.length - 1 ? text[i + 1] : ''

    // Check for horizontal rule
    if (i >= 4 && text.substring(i-3, i+1) === '---\n') {
      horizontalRuleBreak = i + 1;
      break; // Horizontal rule is a very good break point, stop searching
    }

    // Check for paragraph break
    if (char === '\n' && nextChar === '\n') {
      paragraphBreak = i + 2
      break // Paragraph break is best option, stop searching
    }

    // Check for line break
    if (char === '\n' && lineBreak === -1) {
      lineBreak = i + 1
    }

    // Check for sentence break
    if ((char === '.' || char === '!' || char === '?')
      && (nextChar === ' ' || nextChar === '\n')
      && sentenceBreak === -1) {
      sentenceBreak = i + 2
    }

    // Check for space
    if (char === ' ' && spaceBreak === -1) {
      spaceBreak = i + 1
    }

    // Check for HTML entity boundary to avoid breaking in middle
    if (char === ';' && i > 5) {
      const entityStart = text.lastIndexOf('&', i)
      if (entityStart !== -1 && i - entityStart < 8) {
        // Avoid breaking inside an entity
        bestBreak = entityStart
      }
    }
  }

  // Return best break point in order of preference
  if (horizontalRuleBreak !== -1)
    return horizontalRuleBreak
  if (paragraphBreak !== -1)
    return paragraphBreak
  if (lineBreak !== -1)
    return lineBreak
  if (sentenceBreak !== -1)
    return sentenceBreak
  if (spaceBreak !== -1)
    return spaceBreak

  return bestBreak
}

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
            if (!isNaN(codePoint)) {
              result += String.fromCodePoint(codePoint)
              i++ // Skip the semicolon
              continue
            }
          }
          catch (e) {
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

