import type { Node } from './types.ts'
import { COMMENT_NODE, DOCUMENT_NODE, ELEMENT_NODE, TEXT_NODE, VOID_TAGS } from './const.ts'

/**
 * Parse HTML string into a DOM tree
 * Uses manual parsing for performance
 */
export function parseHTML(html: string): Node {
  // Root document node
  const doc: Node = {
    type: DOCUMENT_NODE,
    children: [],
  }

  let parent = doc
  let lastIndex = 0
  let inTag = false
  let inComment = false
  let inDoctype = false

  // Iterate through the HTML string character by character
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      // Process any text content before this tag
      if (lastIndex < i && !inTag && !inComment && !inDoctype) {
        const text = html.substring(lastIndex, i)
        // Only create text nodes for non-whitespace content
        if (text.trim().length) {
          parent.children.push({
            type: TEXT_NODE,
            value: text,
            parent,
            children: [],
          })
        }
      }

      // Check what type of tag we're looking at
      if (i + 1 < html.length) {
        // Comment or doctype
        if (html[i + 1] === '!') {
          if (i + 3 < html.length && html.substring(i + 2, i + 4) === '--') {
            // Handle comment
            inComment = true
            const commentEndIndex = html.indexOf('-->', i + 4)
            if (commentEndIndex !== -1) {
              const commentText = html.substring(i + 4, commentEndIndex)
              parent.children.push({
                type: COMMENT_NODE,
                value: commentText,
                parent,
                children: [],
              })
              i = commentEndIndex + 2
              lastIndex = i + 1
              inComment = false
            }
          }
          else {
            // Handle doctype
            inDoctype = true
            const doctypeEndIndex = html.indexOf('>', i + 1)
            if (doctypeEndIndex !== -1) {
              i = doctypeEndIndex
              lastIndex = i + 1
              inDoctype = false
            }
          }
        }
        // Closing tag
        else if (html[i + 1] === '/') {
          inTag = true
          const tagNameEndIndex = findFirstOf(html, i + 2, ' >')
          if (tagNameEndIndex !== -1) {
            const tagName = html.substring(i + 2, tagNameEndIndex)

            // Close parent node if end-tag matches
            if (tagName === parent.name && parent.parent) {
              parent = parent.parent
            }

            const tagEndIndex = html.indexOf('>', tagNameEndIndex)
            if (tagEndIndex !== -1) {
              i = tagEndIndex
              lastIndex = i + 1
              inTag = false
            }
          }
        }
        // Opening tag
        else {
          inTag = true
          const tagNameEndIndex = findFirstOf(html, i + 1, ' />')
          if (tagNameEndIndex !== -1) {
            const tagName = html.substring(i + 1, tagNameEndIndex)

            // Process attributes and check for self-closing tag
            let attributes = {}
            let selfClosing = false

            const tagEndIndex = html.indexOf('>', tagNameEndIndex)
            if (tagEndIndex !== -1) {
              if (html[tagEndIndex - 1] === '/') {
                selfClosing = true
              }

              // Extract attributes if there are any
              if (tagEndIndex > tagNameEndIndex + 1) {
                const attrStr = html.substring(
                  tagNameEndIndex + 1,
                  selfClosing ? tagEndIndex - 1 : tagEndIndex,
                )
                attributes = parseAttributes(attrStr)
              }

              // Create the tag node
              const tag: Node = {
                type: ELEMENT_NODE,
                name: tagName,
                attributes,
                parent,
                children: [],
              }

              parent.children.push(tag)

              // If not self-closing or void tag, make it the new parent
              if (!selfClosing && !VOID_TAGS.has(tagName)) {
                parent = tag
              }

              i = tagEndIndex
              lastIndex = i + 1
              inTag = false
            }
          }
        }
      }
    }
  }

  // Handle any remaining text
  if (lastIndex < html.length) {
    const remainingText = html.slice(lastIndex)
    // Only create text nodes for non-whitespace content
    if (remainingText.trim().length) {
      parent.children.push({
        type: TEXT_NODE,
        value: remainingText,
        parent,
        children: [],
      })
    }
  }

  // Populate node depth map for nested lists
  const nodeDepthMap = new Map<Node, number>()
  populateNodeDepthMap(doc, nodeDepthMap)

  return doc
}

/**
 * Populate node depth map for nested lists
 */
export function populateNodeDepthMap(node: Node, depthMap: Map<Node, number>, depth = 0): void {
  if (node.type === ELEMENT_NODE && (node.name === 'ul' || node.name === 'ol')) {
    // Process any nested lists (increment depth for each level)
    for (const child of node.children) {
      if (child.type === ELEMENT_NODE && child.name === 'li') {
        // Set the depth for this list item
        depthMap.set(child, depth);

        // Look for nested lists inside this list item
        for (const nestedChild of child.children) {
          if (nestedChild.type === ELEMENT_NODE &&
              (nestedChild.name === 'ul' || nestedChild.name === 'ol')) {
            // Process the nested list with incremented depth
            populateNodeDepthMap(nestedChild, depthMap, depth + 1);
          }
        }
      }
    }
  } else if (node.children) {
    // Continue traversal for other nodes
    for (const child of node.children) {
      populateNodeDepthMap(child, depthMap, depth);
    }
  }
}

/**
 * Parse HTML attributes string into a key-value object
 * Optimized version that avoids unnecessary regex calls in a loop
 */
export function parseAttributes(attrStr: string): Record<string, string> {
  if (!attrStr)
    return {}

  const result: Record<string, string> = {}
  let i = 0

  // Skip leading whitespace
  while (i < attrStr.length && /\s/.test(attrStr[i])) i++

  while (i < attrStr.length) {
    // Find attribute name
    const nameStart = i

    // Read until we hit a space, equals, or end
    while (
      i < attrStr.length
      && attrStr[i] !== '='
      && attrStr[i] !== ' '
      && attrStr[i] !== '\t'
      && attrStr[i] !== '\n'
    ) {
      i++
    }

    // If we found a name
    if (i > nameStart) {
      const name = attrStr.substring(nameStart, i)
      let value = ''

      // Skip whitespace
      while (i < attrStr.length && /\s/.test(attrStr[i])) i++

      // If we have an equals sign, parse the value
      if (i < attrStr.length && attrStr[i] === '=') {
        i++ // Skip equals

        // Skip whitespace
        while (i < attrStr.length && /\s/.test(attrStr[i])) i++

        // Check for quoted value
        if (i < attrStr.length && (attrStr[i] === '"' || attrStr[i] === '\'')) {
          const quote = attrStr[i]
          const valueStart = ++i // Skip opening quote

          // Find closing quote that's not escaped
          while (
            i < attrStr.length
            && (attrStr[i] !== quote || attrStr[i - 1] === '\\')
          ) {
            i++
          }

          if (i < attrStr.length) {
            value = attrStr.substring(valueStart, i)
            i++ // Skip closing quote
          }
        }
        // Unquoted value
        else {
          const valueStart = i

          // Read until whitespace or end
          while (
            i < attrStr.length
            && !/\s/.test(attrStr[i])
            && attrStr[i] !== '>'
          ) {
            i++
          }

          value = attrStr.substring(valueStart, i)
        }
      }

      // Store the attribute
      result[name] = value
    }

    // Skip whitespace to the next attribute
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++
  }

  return result
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

