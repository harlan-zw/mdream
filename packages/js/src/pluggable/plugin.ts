import type { Plugin, PluginSetup, TransformPlugin } from '../types'

const NO_PLUGINS: TransformPlugin[] = []

/**
 * Create a plugin with type-safe hook definitions.
 * Pass a setup function when the plugin keeps per-document state: each
 * conversion calls it to create fresh hooks.
 */
export function createPlugin(plugin: TransformPlugin): TransformPlugin
export function createPlugin(setup: PluginSetup): PluginSetup
export function createPlugin(plugin: Plugin): Plugin {
  return plugin
}

/** Resolve the plugins for one conversion, running each setup once. */
export function resolvePlugins(plugins: Plugin[] | undefined): TransformPlugin[] {
  if (!plugins || plugins.length === 0)
    return NO_PLUGINS
  const resolved: TransformPlugin[] = Array.from({ length: plugins.length })
  for (let index = 0; index < plugins.length; index++) {
    const plugin = plugins[index]!
    resolved[index] = typeof plugin === 'function' ? plugin() : plugin
  }
  return resolved
}
