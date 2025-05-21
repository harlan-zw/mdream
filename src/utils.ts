import type { ElementNode, MdreamRuntimeState, Node } from './types'
import { HTML_ENTITIES } from './const'

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
  while (firstBlockParent.tagHandler?.isInline) {
    if (!firstBlockParent.parent) {
      break
    }
    firstBlockParent = firstBlockParent.parent
    parentsToIncrement.push(firstBlockParent)
  }
  return parentsToIncrement
}

export function isBufferingPaused(state: MdreamRuntimeState) {
  // Check if buffering is paused
  return state.isBufferPaused
}

export function pauseBuffering(state: MdreamRuntimeState, node: ElementNode) {
  state.isBufferPaused = true
  // Pause buffering for the current node
  state.bufferMarkers = state.bufferMarkers || []
  state.bufferMarkers.push({
    position: node.mdStart || 0,
    score: node.context?.score || 0,
    node: node.name || node.value,
    pause: true,
  })
}

export function resumeBuffering(node: ElementNode, state: MdreamRuntimeState) {
  state.isBufferPaused = false
  // Resume buffering for the current node
  state.bufferMarkers = state.bufferMarkers || []
  state.bufferMarkers.push({
    position: node.mdStart,
    score: node.context.score,
    node: node.name || node.value,
    class: node.attributes?.class || '',
    pause: false,
  })
}

export function applyBufferMarkers(state: MdreamRuntimeState, s: string): string {
  console.log(s)
  // If no buffer markers, return the original string
  if (!state.bufferMarkers || !state.bufferMarkers.length) {
    return s
  }

  console.log(state.bufferMarkers)
  // Sort markers by position
  const markers = []
  // dedupe based on position, take the last one
  const dedupedMarkers = new Map<number, { position: number, pause: boolean }>()
  for (const marker of state.bufferMarkers) {
    // always override
    dedupedMarkers.set(marker.position, marker)
  }
  // Convert back to array
  for (const marker of dedupedMarkers.values()) {
    markers.push(marker)
  }
  markers.sort((a, b) => a.position - b.position)

  // Start with an empty output
  let out = ''
  // Initialize pause state based on first marker
  // If first marker is to pause, we start unpaused until we hit that marker
  // If first marker is to unpause, we start paused until we hit that marker
  let currentlyPaused = !markers[0].pause
  let lastPosition = 0

  // Process each marker in order
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]

    // If we're transitioning states
    if (marker.pause !== currentlyPaused) {
      if (!marker.pause) {
        // Transitioning from paused to unpaused (include content now)
        lastPosition = marker.position
      }
      else {
        // Transitioning from unpaused to paused (stop including content)
        if (marker.position > lastPosition) {
          out += s.substring(lastPosition, marker.position)
        }
      }
      currentlyPaused = marker.pause
    }
  }

  // If we ended in an unpaused state, include remaining content
  if (!currentlyPaused && lastPosition < s.length) {
    out += s.substring(lastPosition)
  }

  return out
}
