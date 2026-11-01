import type { ElementNode, MdreamRuntimeState, NodeEvent, PluginState, TextNode, TransformPlugin } from './types'
import { ELEMENT_NODE, NodeEventEnter, TAG_A, TAG_PRE, TEXT_NODE } from './const'
import { countContentInEnclosingLink } from './utils'

/** Whether text shows nothing: empty, or only the parser's whitespace outside `<pre>`. */
function isBlankText(value: string, inPreTag: boolean): boolean {
  if (!value)
    return true
  if (inPreTag)
    return false
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code !== 32 && code !== 9 && code !== 10 && code !== 12 && code !== 13)
      return false
  }
  return true
}

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
  plugins: TransformPlugin[] | undefined,
  state: MdreamRuntimeState,
  processEvent: (event: NodeEvent) => void,
): boolean {
  state.depth = event.node.depth
  // Process plugins with full state access
  if (plugins?.length) {
    // Text as the parser made it, to tell after the hooks whether they changed it.
    const text = event.node.type === TEXT_NODE ? (event.node as TextNode).value : undefined
    // Run processAttributes BEFORE beforeNodeProcess so that
    // ancestor context (e.g. tailwind hidden state) is available
    // when descendant nodes check their ancestors in beforeNodeProcess.
    if (event.node.type === ELEMENT_NODE && event.type === NodeEventEnter) {
      const element = event.node as ElementNode
      let hasCheckedAttributes = false
      for (let index = 0; index < plugins.length; index++) {
        const plugin = plugins[index]
        if (plugin === undefined)
          throw new TypeError('Plugin arrays must not contain undefined entries.')
        if (plugin.processAttributes) {
          if (!hasCheckedAttributes) {
            hasCheckedAttributes = true
            // The parser shares a frozen object for elements without attributes.
            if (!Object.isExtensible(element.attributes))
              element.attributes = { ...element.attributes }
          }
          plugin.processAttributes(element, state)
        }
      }
    }

    let shouldSkip = false
    for (let index = 0; index < plugins.length; index++) {
      const plugin = plugins[index]
      if (plugin === undefined)
        throw new TypeError('Plugin arrays must not contain undefined entries.')
      const res = plugin.beforeNodeProcess?.(event, state)
      if (typeof res === 'object') {
        // Last plugin wins - allows overriding skip decisions
        shouldSkip = res.skip
      }
    }
    if (shouldSkip) {
      // The parser reads these flags after the event: skipped text does not
      // count as link text, and a skipped link gets no fallback label.
      if (event.node.type === TEXT_NODE)
        (event.node as TextNode).excludedFromMarkdown = true
      else if (event.type === NodeEventEnter && (event.node as ElementNode).tagId === TAG_A)
        (event.node as ElementNode).enterSkipped = true
      return true // Skip this event
    }

    // Run plugin hooks
    if (event.node.type === ELEMENT_NODE) {
      const element = event.node as ElementNode

      // Collect plugin hook outputs
      const fn = event.type === NodeEventEnter ? 'onNodeEnter' : 'onNodeExit'
      let pluginOutputs: string[] | undefined
      for (let index = 0; index < plugins.length; index++) {
        const plugin = plugins[index]
        if (plugin === undefined)
          throw new TypeError('Plugin arrays must not contain undefined entries.')
        if (plugin[fn]) {
          const result = plugin[fn](element, state)
          if (result) {
            ;(pluginOutputs ??= []).push(result)
          }
        }
      }

      // Store plugin outputs on the element for processing
      if (pluginOutputs) {
        element.pluginOutput = element.pluginOutput ? element.pluginOutput.concat(pluginOutputs) : pluginOutputs
        // Output that shows is text of the links around the element, so a link
        // whose own text a hook skips takes no title or aria-label after it.
        if (state.depthMap?.[TAG_A] && pluginOutputs.some(output => !isBlankText(output, (state.depthMap?.[TAG_PRE] || 0) > 0)))
          countContentInEnclosingLink(element.tagId === TAG_A ? element.parent : element)
      }
    }
    else if (event.node.type === TEXT_NODE && event.type === NodeEventEnter) {
      const textNode = event.node as TextNode
      for (let index = 0; index < plugins.length; index++) {
        const plugin = plugins[index]
        if (plugin === undefined)
          throw new TypeError('Plugin arrays must not contain undefined entries.')
        if (plugin.processTextNode) {
          const result = plugin.processTextNode(textNode, state)
          if (result) {
            if (result.skip) {
              textNode.excludedFromMarkdown = true
              return true // Skip this text node
            }
            textNode.value = result.content
          }
        }
      }
      // The output rewrites the value before the parser counts link text, so
      // record here whether link text a hook changed is now blank.
      if (state.depthMap?.[TAG_A] && textNode.value !== text)
        textNode.rewrittenBlank = isBlankText(textNode.value, (state.depthMap[TAG_PRE] || 0) > 0)
    }
  }

  processEvent(event)
  return false
}

/** Tell each plugin that the document ended. */
export function endPlugins(plugins: TransformPlugin[] | undefined, state: PluginState): void {
  if (!plugins)
    return
  for (let index = 0; index < plugins.length; index++) {
    const plugin = plugins[index]
    if (plugin === undefined)
      throw new TypeError('Plugin arrays must not contain undefined entries.')
    plugin.onDocumentEnd?.(state)
  }
}
