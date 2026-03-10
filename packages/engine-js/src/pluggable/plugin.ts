import type { Plugin } from '../types'

/**
 * Create a plugin with type-safe hook definitions.
 * All Plugin fields are optional, so this is a typed identity function.
 */
export function createPlugin(plugin: Plugin): Plugin {
  return plugin
}
