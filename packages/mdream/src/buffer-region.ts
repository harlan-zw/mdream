import type {
  ElementNode,
  MdreamRuntimeState,
  Node,
} from './types'

/**
 * Creates a new buffer region
 * Returns null if node already has a region assigned
 */
export function createBufferRegion(
  node: ElementNode,
  state: MdreamRuntimeState,
  include: boolean,
): number | null {
  // Skip if node already has a region assigned
  if (node.regionId) {
    return null // Already processed by a previous plugin
  }

  // Generate unique region ID (start from 1 to avoid conflict with default region 0)
  const id = state.regionToggles.size + 1
  node.regionId = id

  // Add to state
  state.regionToggles.set(id, include)
  state.regionContentBuffers.set(id, [])
  return id
}

/**
 * Checks if a node is included based on regions and default state
 */
export function isNodeIncluded(
  node: Node,
  state: MdreamRuntimeState,
): boolean {
  // Check if node or any ancestor has an explicit region
  let current: Node | undefined | null = node
  while (current) {
    const regionId = current.regionId
    if (regionId !== undefined) {
      const include = state.regionToggles.get(regionId)
      if (typeof include !== 'undefined') {
        return include
      }
    }
    current = current.parent
  }

  return true
}

/**
 * Collects content for a node into appropriate buffer (optimized)
 */
export function collectNodeContent(
  node: Node,
  content: string,
  state: MdreamRuntimeState,
): void {
  if (!content) {
    return
  }

  const regionId: number = node.regionId || 0

  const targetBuffer: string[] | undefined = state.regionContentBuffers.get(regionId)
  if (targetBuffer) {
    // Add to buffer
    targetBuffer.push(content)

    // Update cache when content is added
    state.lastContentCache = content
  }
}

/**
 * Assembles final content from buffer regions and clears them after use
 * Ensures frontmatter (regionId -1) appears first, followed by other included regions
 */
export function assembleBufferedContent(
  state: MdreamRuntimeState,
): string {
  const fragments: string[] = []

  // Then process all other regions (excluding frontmatter)
  for (const [regionId, content] of Array.from(state.regionContentBuffers.entries())) {
    // Check if region should be included
    const include = state.regionToggles.get(regionId)
    if (include) {
      fragments.push(...content)
    }
  }

  // gc
  state.regionToggles.clear()
  state.regionContentBuffers.clear()

  // Join all fragments and trim leading whitespace
  return fragments.join('').trimStart()
}
