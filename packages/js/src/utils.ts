import type { ElementNode, Node } from './types'
import { TAG_BLOCKQUOTE, TAG_LI } from './const'
import { HTML_ENTITIES } from './entities'

/**
 * Build the Markdown prefix needed to keep a continued line inside its open
 * blockquotes and list items. Ancestors are emitted outermost-first so mixed
 * nesting retains its real structure.
 */
export function continuationPrefix(node: Pick<Node, 'parent'>, listIndentWidths: readonly number[]): string {
  const chain: ElementNode[] = []
  let current = node.parent
  while (current) {
    chain.push(current)
    current = current.parent
  }

  let prefix = ''
  let listIndex = 0
  for (let i = chain.length - 1; i >= 0; i--) {
    const tagId = chain[i]!.tagId
    if (tagId === TAG_BLOCKQUOTE) {
      prefix += '> '
    }
    else if (tagId === TAG_LI) {
      prefix += ' '.repeat(listIndentWidths[listIndex] ?? 2)
      listIndex++
    }
  }
  return prefix
}

/**
 * Decode HTML entities - single pass with O(1) named entity lookup
 */
export function decodeHTMLEntities(text: string): string {
  let result = ''
  let i = 0
  const len = text.length

  while (i < len) {
    if (text.charCodeAt(i) === 38) { // '&'
      // Numeric entity (&#NNN; or &#xHHH;)
      if (i + 2 < len && text.charCodeAt(i + 1) === 35) { // '#'
        const start = i
        i += 2

        const isHex = text.charCodeAt(i) === 120 || text.charCodeAt(i) === 88 // 'x' or 'X'
        if (isHex)
          i++

        const numStart = i
        // Cap digit scan: 7 hex digits covers U+10FFFF, 8 decimal digits covers 10FFFF
        const maxDigits = i + (isHex ? 7 : 8)

        while (i < len && i < maxDigits && text.charCodeAt(i) !== 59) // ';'
          i++

        if (i < len && text.charCodeAt(i) === 59) {
          const codePoint = Number.parseInt(text.substring(numStart, i), isHex ? 16 : 10)
          if (codePoint >= 0 && codePoint <= 0x10FFFF && !Number.isNaN(codePoint)) {
            result += String.fromCodePoint(codePoint)
            i++
            continue
          }
        }

        i = start
      }
      else {
        // Named entity: scan ahead to ';' (max 32 chars covers all HTML entity names)
        const maxEnd = i + 33 < len ? i + 33 : len
        let j = i + 1
        while (j < maxEnd && text.charCodeAt(j) !== 59) // ';'
          j++

        if (j < maxEnd && text.charCodeAt(j) === 59) {
          const replacement = HTML_ENTITIES[text.substring(i, j + 1)]
          if (replacement !== undefined) {
            result += replacement
            i = j + 1
            continue
          }
        }
      }
    }

    result += text[i]
    i++
  }

  return result
}

export function traverseUpToFirstBlockNode(node: Node) {
  let firstBlockParent = node
  const parentsToIncrement = [firstBlockParent]
  // find first block element
  while (firstBlockParent.tagHandler?.isInline) {
    if (!firstBlockParent.parent) {
      break
    }
    firstBlockParent = firstBlockParent.parent
    parentsToIncrement.push(firstBlockParent)
  }
  return parentsToIncrement
}
