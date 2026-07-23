import type { ElementNode, Node } from './types'
import { TAG_BLOCKQUOTE, TAG_LI } from './const'
import {
  HTML_ENTITIES,
  MAX_ENTITY_NAME_LENGTH,
  MAX_LEGACY_ENTITY_NAME_LENGTH,
} from './entities'

/**
 * Build the Markdown prefix needed to keep a continued line inside its open
 * blockquotes and list items. Ancestors are emitted outermost-first so mixed
 * nesting retains its real structure.
 */
export function continuationPrefix(
  node: Pick<Node, 'parent'>,
  listIndentWidths: readonly number[],
  includeBlockquotes = true,
): string {
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
    if (tagId === TAG_BLOCKQUOTE && includeBlockquotes) {
      prefix += '> '
    }
    else if (tagId === TAG_LI) {
      prefix += ' '.repeat(listIndentWidths[listIndex] ?? 2)
      listIndex++
    }
  }
  return prefix
}

// U+0080–U+009F replacements from the numeric character reference end state.
// Undefined Windows-1252 slots intentionally retain their original controls.
const C1_REPLACEMENTS = '\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178'

function isAsciiAlphaNumeric(code: number): boolean {
  return (code >= 48 && code <= 57)
    || (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
}

function numericReplacement(codePoint: number): string {
  if (codePoint === 0 || codePoint > 0x10FFFF || (codePoint >= 0xD800 && codePoint <= 0xDFFF))
    return '\uFFFD'
  if (codePoint >= 0x80 && codePoint <= 0x9F)
    return C1_REPLACEMENTS[codePoint - 0x80]!
  return String.fromCodePoint(codePoint)
}

function isCharacterReferenceTail(text: string, start: number): boolean {
  let index = start
  if (text.charCodeAt(index) === 35) { // #
    index++
    const hex = text.charCodeAt(index) === 120 || text.charCodeAt(index) === 88
    if (hex)
      index++
    const digitStart = index
    while (index < text.length) {
      const code = text.charCodeAt(index)
      const digit = code >= 48 && code <= 57
      const hexDigit = hex && ((code >= 65 && code <= 70) || (code >= 97 && code <= 102))
      if (!digit && !hexDigit)
        break
      index++
    }
    return index > digitStart && text.charCodeAt(index) === 59
  }

  const nameStart = index
  while (index < text.length && isAsciiAlphaNumeric(text.charCodeAt(index)))
    index++
  return index > nameStart && text.charCodeAt(index) === 59
}

function decodedReference(
  replacement: string,
  text: string,
  next: number,
  protectDecodedEntityReferences: boolean,
): string {
  return replacement === '&'
    && protectDecodedEntityReferences
    && isCharacterReferenceTail(text, next)
    ? '\\&'
    : replacement
}

/** Decode character references using the HTML tokenizer's longest-match rules. */
export function decodeHTMLEntities(
  text: string,
  inAttribute = false,
  protectDecodedEntityReferences = false,
): string {
  let result = ''
  let i = 0
  const len = text.length

  while (i < len) {
    if (text.charCodeAt(i) !== 38) { // '&'
      const plainStart = i
      while (i < len && text.charCodeAt(i) !== 38)
        i++
      result += text.slice(plainStart, i)
      continue
    }

    // Numeric character references consume valid digits only and do not
    // require a semicolon. Saturating avoids precision loss on hostile input.
    if (i + 2 < len && text.charCodeAt(i + 1) === 35) { // '#'
      let end = i + 2
      const isHex = text.charCodeAt(end) === 120 || text.charCodeAt(end) === 88 // 'x' or 'X'
      if (isHex)
        end++

      const digitStart = end
      let codePoint = 0
      while (end < len) {
        const code = text.charCodeAt(end)
        let digit = -1
        if (code >= 48 && code <= 57)
          digit = code - 48
        else if (isHex && code >= 65 && code <= 70)
          digit = code - 55
        else if (isHex && code >= 97 && code <= 102)
          digit = code - 87
        if (digit < 0)
          break
        codePoint = codePoint * (isHex ? 16 : 10) + digit
        end++
      }

      if (end > digitStart) {
        result += decodedReference(
          numericReplacement(codePoint),
          text,
          text.charCodeAt(end) === 59 ? end + 1 : end,
          protectDecodedEntityReferences,
        )
        if (text.charCodeAt(end) === 59) // ';'
          end++
        i = end
        continue
      }
    }

    // Canonical-only table keys carry a `$` prefix. Unprefixed keys are the
    // small legacy set that may omit semicolons (`&notit;` -> `¬it;`).
    const nameStart = i + 1
    let nameEnd = nameStart
    const scanEnd = Math.min(len, nameStart + MAX_ENTITY_NAME_LENGTH)
    while (nameEnd < scanEnd && isAsciiAlphaNumeric(text.charCodeAt(nameEnd)))
      nameEnd++

    if (nameEnd > nameStart && text.charCodeAt(nameEnd) === 59) {
      const name = text.slice(nameStart, nameEnd)
      const direct = HTML_ENTITIES[name]
      const replacement = typeof direct === 'string' ? direct : HTML_ENTITIES[`$${name}`]
      if (replacement !== undefined) {
        result += decodedReference(replacement, text, nameEnd + 1, protectDecodedEntityReferences)
        i = nameEnd + 1
        continue
      }
    }

    let legacyEnd = Math.min(nameEnd, nameStart + MAX_LEGACY_ENTITY_NAME_LENGTH)
    let decodedLegacy = false
    while (legacyEnd > nameStart) {
      const name = text.slice(nameStart, legacyEnd)
      const replacement = HTML_ENTITIES[name]
      if (typeof replacement === 'string') {
        const next = text.charCodeAt(legacyEnd)
        if (replacement !== undefined && !(inAttribute && (next === 61 || isAsciiAlphaNumeric(next)))) {
          result += decodedReference(replacement, text, legacyEnd, protectDecodedEntityReferences)
          i = legacyEnd
          decodedLegacy = true
        }
        // Once the longest legacy name is known, attribute ambiguity must
        // preserve it rather than falling back to a shorter prefix.
        break
      }
      legacyEnd--
    }
    if (decodedLegacy)
      continue

    result += '&'
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
