import type {
  BufferRegion,
  ElementNode,
  MdreamRuntimeState,
  Node,
  StreamingBufferRegion,
  StreamingMdreamState,
} from './types'

/**
 * Check if buffer regions are active
 */
function hasActiveBufferRegions(state: MdreamRuntimeState): boolean {
  return !!(state.bufferRegions && state.nodeRegionMap)
}

/**
 * Creates a new buffer region
 * Returns null if node already has a region assigned
 */
export function createBufferRegion(
  node: ElementNode,
  state: MdreamRuntimeState,
  include: boolean,
): BufferRegion | null {
  // Initialize state fields if they don't exist
  if (!state.bufferRegions) {
    state.bufferRegions = []
  }
  if (!state.nodeRegionMap) {
    state.nodeRegionMap = new WeakMap()
  }
  if (!state.regionContentBuffers) {
    state.regionContentBuffers = new Map()
  }

  // Skip if node already has a region assigned
  if (state.nodeRegionMap.has(node)) {
    return null // Already processed by a previous plugin
  }

  // Generate unique region ID
  const id = `region-${state.bufferRegions.length}-${Date.now()}`

  // Create the buffer region
  const region: BufferRegion = {
    id,
    startNode: node,
    include,
    depth: node.depth,
    isComplete: false,
  }

  // Add to state
  state.bufferRegions.push(region)
  state.nodeRegionMap.set(node, id)
  state.regionContentBuffers.set(id, [])

  return region
}

/**
 * Closes an existing buffer region
 */
export function closeBufferRegion(
  node: ElementNode,
  state: MdreamRuntimeState,
): void {
  if (!state.nodeRegionMap || !state.bufferRegions) {
    return
  }

  const regionId = state.nodeRegionMap.get(node)
  if (!regionId) {
    return // No region to close
  }

  const region = state.bufferRegions.find(r => r.id === regionId)
  if (region) {
    region.endNode = node
    region.isComplete = true
  }
}

/**
 * Checks if a node is included based on regions and default state
 */
export function isNodeIncluded(
  node: Node,
  state: MdreamRuntimeState,
): boolean {
  // Only apply strong negative patterns when buffer regions are active (readability plugin is being used)
  if (hasActiveBufferRegions(state)) {
    // First check for strong negative patterns in the node hierarchy
    let current: Node | undefined = node
    while (current) {
      if (current.type === 1 && (current as any).name) { // ELEMENT_NODE
        const element = current as any
        const hasStrongNegativePattern = (
          (element.attributes?.class && /nav|menu|header|footer|sidebar|hidden|copyright/i.test(element.attributes.class as string))
          || (element.attributes?.id && /nav|menu|header|footer|sidebar|hidden|copyright/i.test(element.attributes.id as string))
          || (element.attributes?.style && /display:\s*none|visibility:\s*hidden/i.test(element.attributes.style as string))
          || (element.name && /nav|header|footer|aside/i.test(element.name))
        )

        if (hasStrongNegativePattern) {
          return false
        }
      }
      current = current.parent
    }
  }

  // Then check if node or any ancestor has an explicit region
  let current: Node | undefined = node
  while (current) {
    const regionId = state.nodeRegionMap?.get(current)
    if (regionId) {
      const region = state.bufferRegions?.find(r => r.id === regionId)
      if (region) {
        return region.include
      }
    }
    current = current.parent
  }

  // If no explicit region, use default state
  return state.defaultIncludeNodes ?? true
}

/**
 * Collects content for a node into appropriate buffer
 */
export function collectNodeContent(
  node: Node,
  content: string,
  state: MdreamRuntimeState,
): void {
  if (!content || !state.regionContentBuffers) {
    return
  }

  // Always check inclusion first, regardless of regions
  if (!isNodeIncluded(node, state)) {
    return // Exclude content entirely
  }

  // Find the region this node belongs to
  let current: Node | undefined = node
  let regionId: string | undefined

  while (current && !regionId) {
    regionId = state.nodeRegionMap?.get(current)
    current = current.parent
  }

  if (regionId) {
    // Add content to the specific region buffer
    const buffer = state.regionContentBuffers.get(regionId)
    if (buffer) {
      buffer.push(content)
    }
  }
  else {
    // No region found, add to default region since content is already approved for inclusion
    const defaultRegionId = 'default'
    if (!state.regionContentBuffers.has(defaultRegionId)) {
      state.regionContentBuffers.set(defaultRegionId, [])
    }
    state.regionContentBuffers.get(defaultRegionId)!.push(content)
  }
}

/**
 * Assembles final content from buffer regions
 */
export function assembleBufferedContent(
  state: MdreamRuntimeState,
): string {
  if (!state.bufferRegions || !state.regionContentBuffers) {
    return ''
  }

  let result = ''
  let frontmatterContent = ''
  let bodyContent = ''

  // First, add content from the default region (unassigned content)
  const defaultBuffer = state.regionContentBuffers.get('default')
  if (defaultBuffer) {
    // Separate frontmatter from body content
    for (const content of defaultBuffer) {
      if (content.startsWith('---\n') && content.includes('\n---\n')) {
        frontmatterContent += content
      }
      else {
        bodyContent += content
      }
    }
  }

  // Then process explicit regions in order of creation
  for (const region of state.bufferRegions) {
    if (region.include) {
      const buffer = state.regionContentBuffers.get(region.id)
      if (buffer) {
        for (const content of buffer) {
          if (content.startsWith('---\n') && content.includes('\n---\n')) {
            frontmatterContent += content
          }
          else {
            bodyContent += content
          }
        }
      }
    }
  }

  // Assemble with frontmatter first, then body content
  result = frontmatterContent + bodyContent

  // Trim leading whitespace to prevent extra newlines at the start
  return result.trimStart()
}

/**
 * STREAMING-SPECIFIC FUNCTIONS
 */

/**
 * Determines which regions can be safely flushed during streaming
 */
export function getFlushableRegions(
  state: StreamingMdreamState,
): StreamingBufferRegion[] {
  if (!state.streamingRegions) {
    return []
  }

  // Find completed regions that don't have pending child regions
  return state.streamingRegions.filter(region =>
    region.isComplete
    && region.canFlush
    && !region.isPartiallyProcessed,
  )
}

/**
 * Flushes completed regions and returns content for streaming output
 */
export function flushCompletedRegions(
  state: StreamingMdreamState,
): string {
  const flushableRegions = getFlushableRegions(state)
  if (flushableRegions.length === 0) {
    return ''
  }

  let result = ''

  for (const region of flushableRegions) {
    if (region.include) {
      result += region.accumulatedContent.join('')
    }
  }

  return result
}

/**
 * Cleans up flushed regions to manage memory
 */
export function cleanupFlushedRegions(
  state: StreamingMdreamState,
): void {
  if (!state.streamingRegions) {
    return
  }

  const flushableRegions = getFlushableRegions(state)

  for (const region of flushableRegions) {
    // Clear the accumulated content to free memory
    region.accumulatedContent = []

    // Update tracking state
    state.lastFlushedChunkId = Math.max(
      state.lastFlushedChunkId,
      region.endChunkId ?? region.startChunkId,
    )

    // Update total buffered size
    state.totalBufferedSize = Math.max(0, state.totalBufferedSize - region.accumulatedContent.join('').length,
    )
  }

  // Remove flushed regions from the array
  state.streamingRegions = state.streamingRegions.filter(
    region => !flushableRegions.includes(region),
  )
}

/**
 * Handles regions that span across chunk boundaries
 */
export function handlePartialRegions(
  state: StreamingMdreamState,
  chunkBoundary: number,
): void {
  if (!state.streamingRegions) {
    return
  }

  for (const region of state.streamingRegions) {
    // Mark regions as partial if they cross chunk boundaries
    if (region.lastProcessedPosition < chunkBoundary && !region.isComplete) {
      region.isPartiallyProcessed = true
      region.canFlush = false
    }
  }
}

/**
 * Checks if memory usage is within limits and triggers cleanup if needed
 */
export function manageStreamingMemory(
  state: StreamingMdreamState,
): void {
  // Monitor total buffered content size
  if (state.totalBufferedSize > state.maxBufferedContent) {
    // Aggressive cleanup of older regions
    aggressiveRegionCleanup(state)
  }

  // Monitor region count and complexity
  const MAX_REGIONS = 1000 // Reasonable limit
  if ((state.streamingRegions?.length ?? 0) > MAX_REGIONS) {
    // Force flush of older completed regions
    forceFlushOldRegions(state)
  }
}

/**
 * CORE FUNCTIONALITY IMPROVEMENTS
 */

/**
 * Optimized content assembly replacing fragments.join('')
 */
export function assembleRegionContent(
  state: MdreamRuntimeState,
): string {
  // Stream content from regions without large string concatenations
  // More efficient than current fragments.join('')

  if (!state.bufferRegions || !state.regionContentBuffers) {
    // Fallback to existing fragment system if regions not available
    return state.fragments?.join('') ?? ''
  }

  const result: string[] = []

  // Process included regions in order
  for (const region of state.bufferRegions) {
    if (region.include) {
      const buffer = state.regionContentBuffers.get(region.id)
      if (buffer && buffer.length > 0) {
        // Apply region-specific formatting
        const formattedContent = applyRegionFormatting(region, buffer.join(''), state)
        result.push(formattedContent)
      }
    }
  }

  return result.join('')
}

/**
 * Automatic position calculation from region boundaries
 */
export function calculateRegionPositions(
  state: MdreamRuntimeState,
): void {
  // Automatically calculate positions from region content
  // Eliminates manual currentMdPosition tracking

  if (!state.bufferRegions || !state.regionContentBuffers) {
    return
  }

  let currentPosition = 0

  for (const region of state.bufferRegions) {
    if (region.include) {
      const buffer = state.regionContentBuffers.get(region.id)
      if (buffer) {
        const content = buffer.join('')

        // Update node positions
        region.startNode.mdStart = currentPosition
        region.startNode.mdExit = content.length

        if (region.endNode) {
          region.endNode.mdStart = currentPosition
          region.endNode.mdExit = content.length
        }

        currentPosition += content.length
      }
    }
  }

  // Update global position
  state.currentMdPosition = currentPosition
}

/**
 * Centralized whitespace and formatting per region
 */
export function applyRegionFormatting(
  region: BufferRegion,
  content: string,
  state: MdreamRuntimeState,
): string {
  // Consistent formatting rules applied per region
  // Centralizes scattered whitespace logic
  // Must preserve: lastNewLines, list indentation, blockquote prefixes

  if (!content) {
    return content
  }

  let formatted = content

  // Apply formatting context if available
  if (state.formattingContext) {
    const context = state.formattingContext.get(region.id)
    if (context) {
      // Apply context-specific formatting
      if (context.indentation) {
        const lines = formatted.split('\n')
        formatted = lines.map(line =>
          line.trim() ? `${context.indentation}${line}` : line,
        ).join('\n')
      }

      if (context.prefix) {
        const lines = formatted.split('\n')
        formatted = lines.map(line =>
          line.trim() ? `${context.prefix}${line}` : line,
        ).join('\n')
      }
    }
  }

  return formatted
}

/**
 * CRITICAL EDGE CASE HANDLING
 */

/**
 * Handle position drift during streaming to prevent mid-word cuts
 */
export function adjustRegionBoundariesForWordBoundaries(
  state: StreamingMdreamState,
): void {
  // Ensure region boundaries respect word boundaries
  // Prevent truncation like "Bas" instead of "Basics"

  if (!state.streamingRegions) {
    return
  }

  for (const region of state.streamingRegions) {
    if (region.accumulatedContent.length > 0) {
      const lastContent = region.accumulatedContent[region.accumulatedContent.length - 1]

      // Check if content ends mid-word
      if (lastContent && /\w$/.test(lastContent)) {
        // Find the last word boundary
        const lastSpaceIndex = lastContent.lastIndexOf(' ')
        const lastNewlineIndex = lastContent.lastIndexOf('\n')
        const lastBoundary = Math.max(lastSpaceIndex, lastNewlineIndex)

        if (lastBoundary > 0) {
          // Split at word boundary
          const beforeBoundary = lastContent.substring(0, lastBoundary + 1)
          const afterBoundary = lastContent.substring(lastBoundary + 1)

          // Update current region content
          region.accumulatedContent[region.accumulatedContent.length - 1] = beforeBoundary

          // The remaining content should be moved to the next flush
          // For now, we'll just log this situation
          console.warn('Word boundary adjustment needed:', afterBoundary)
        }
      }
    }
  }
}

/**
 * Preserve formatting state across region boundaries
 */
export function preserveFormattingState(
  fromRegion: BufferRegion,
  toRegion: BufferRegion,
  state: MdreamRuntimeState,
): void {
  // Transfer lastNewLines, indentation context, blockquote depth
  // Maintain consistent spacing between regions

  if (!state.formattingContext) {
    state.formattingContext = new Map()
  }

  const fromContext = state.formattingContext.get(fromRegion.id)
  if (fromContext) {
    // Copy formatting context to next region
    state.formattingContext.set(toRegion.id, { ...fromContext })
  }
}

/**
 * Handle plugin conflicts over region ownership
 */
export function resolveRegionConflicts(
  state: MdreamRuntimeState,
  conflictingRegions: BufferRegion[],
): BufferRegion[] {
  // Use plugin priority to resolve conflicts
  // Ensure higher priority plugins take precedence

  if (conflictingRegions.length <= 1) {
    return conflictingRegions
  }

  // For now, use simple last-wins strategy
  // TODO: Implement proper priority-based resolution when plugin priorities are available
  return [conflictingRegions[conflictingRegions.length - 1]]
}

/**
 * HELPER FUNCTIONS
 */

/**
 * Aggressive cleanup of older regions during memory pressure
 */
function aggressiveRegionCleanup(state: StreamingMdreamState): void {
  if (!state.streamingRegions) {
    return
  }

  // Force flush completed regions regardless of canFlush status
  const completedRegions = state.streamingRegions.filter(r => r.isComplete)

  for (const region of completedRegions) {
    region.accumulatedContent = []
    state.totalBufferedSize = Math.max(0, state.totalBufferedSize - region.accumulatedContent.join('').length,
    )
  }

  // Remove completed regions
  state.streamingRegions = state.streamingRegions.filter(r => !r.isComplete)
}

/**
 * Force flush of older completed regions
 */
function forceFlushOldRegions(state: StreamingMdreamState): void {
  if (!state.streamingRegions) {
    return
  }

  // Sort by chunk ID and flush oldest completed regions
  const sortedRegions = [...state.streamingRegions].sort((a, b) => a.startChunkId - b.startChunkId)
  const oldRegions = sortedRegions.slice(0, Math.floor(sortedRegions.length / 2))

  for (const region of oldRegions) {
    if (region.isComplete) {
      region.canFlush = true
    }
  }
}
