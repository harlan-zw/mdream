import type { ElementNode, MdreamRuntimeState, NodeEvent, Plugin, TextNode } from './types'
import { ELEMENT_NODE, NodeEventEnter, TEXT_NODE } from './const.ts'

/**
 * Processes plugins for a given node event
 * Shared logic between markdown-processor.ts and stream.ts
 *
 * @param event - The node event to process
 * @param plugins - Array of plugins to apply
 * @param state - The current runtime state
 * @param processEvent - Callback to process the event after plugin processing
 * @returns true if the event should be skipped, false to continue processing
 */
export function processPluginsForEvent(
  event: NodeEvent,
  plugins: Plugin[] | undefined,
  state: MdreamRuntimeState,
  processEvent: (event: NodeEvent) => void,
): boolean {
  // Process plugins with full state access
  if (plugins?.length) {
    for (const plugin of plugins) {
      const res = plugin.beforeNodeProcess?.(event, state)
      if (typeof res === 'object' && res.skip) {
        return true // Skip this event
      }
    }

    // Run plugin hooks
    if (event.node.type === ELEMENT_NODE) {
      const element = event.node as ElementNode

      // Run processAttributes hook on element enter
      if (event.type === NodeEventEnter) {
        for (const plugin of plugins) {
          if (plugin.processAttributes) {
            plugin.processAttributes(element, state)
          }
        }
      }

      // Collect plugin hook outputs
      const fn = event.type === NodeEventEnter ? 'onNodeEnter' : 'onNodeExit'
      const pluginOutputs: string[] = []
      for (const plugin of plugins) {
        if (plugin[fn]) {
          const result = plugin[fn]!(element, state)
          if (result) {
            pluginOutputs.push(result)
          }
        }
      }

      // Store plugin outputs on the element for processing
      if (pluginOutputs.length > 0) {
        element.pluginOutput = (element.pluginOutput || []).concat(pluginOutputs)
      }
    }
    else if (event.node.type === TEXT_NODE && event.type === NodeEventEnter) {
      const textNode = event.node as TextNode
      for (const plugin of plugins) {
        if (plugin.processTextNode) {
          const result = plugin.processTextNode(textNode, state)
          if (result) {
            if (result.skip) {
              return true // Skip this text node
            }
            textNode.value = result.content
          }
        }
      }
    }
  }

  processEvent(event)
  return false
}
