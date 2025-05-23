import type { ElementNode, HandlerContext, MdreamRuntimeState } from './types'
import { collectNodeContent } from './buffer-region'

/**
 * Creates handler context with content collection support
 */
export function createHandlerContext(
  node: ElementNode,
  state: MdreamRuntimeState,
): HandlerContext {
  const context: HandlerContext = {
    node,
    parent: node.parent ?? undefined,
    state,
    collectContent: (content: string) => {
      collectNodeContent(node, content, state)
    },
  }

  return context
}

/**
 * Collects node content through handler context
 */
export function handleNodeContent(
  context: HandlerContext,
  content: string,
): void {
  if (context.collectContent) {
    context.collectContent(content)
  }
  else {
    // Fallback: add to fragments if region system not available
    if (context.state.fragments) {
      context.state.fragments.push(content)
    }
  }
}

/**
 * Determines if a node should collect its content into regions
 */
export function shouldCollectContent(
  node: ElementNode,
  state: MdreamRuntimeState,
): boolean {
  // Check if the tag handler supports content collection
  if (node.tagHandler?.collectsContent) {
    return true
  }

  // Check if we have buffer regions active
  return !!(state.bufferRegions && state.nodeRegionMap)
}

/**
 * Gets the appropriate output method for a node
 */
export function getOutputMethod(
  node: ElementNode,
  state: MdreamRuntimeState,
): 'collect' | 'fragment' | 'none' {
  // If buffer regions are active, always use collection
  if (state.bufferRegions && state.nodeRegionMap) {
    return 'collect'
  }

  // Fall back to fragment system
  if (state.fragments) {
    return 'fragment'
  }

  return 'none'
}

/**
 * Handles content output based on the current system state
 */
export function outputContent(
  content: string,
  node: ElementNode,
  state: MdreamRuntimeState,
): void {
  const method = getOutputMethod(node, state)

  switch (method) {
    case 'collect':
      collectNodeContent(node, content, state)
      break
    case 'fragment':
      if (state.fragments) {
        state.fragments.push(content)
      }
      break
    case 'none':
      // Do nothing - content is lost
      break
  }
}

/**
 * Creates a context for content-collecting tag handlers
 */
export function createCollectingContext(
  node: ElementNode,
  state: MdreamRuntimeState,
): HandlerContext {
  const context = createHandlerContext(node, state)

  // Mark this tag handler as collecting content
  if (node.tagHandler) {
    node.tagHandler.collectsContent = true
  }

  return context
}
