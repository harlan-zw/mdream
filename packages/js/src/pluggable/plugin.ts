import type { TransformPlugin } from '../types'

/**
 * Create a plugin with type-safe hook definitions.
 * All TransformPlugin fields are optional, so this is a typed identity function.
 */
export function createPlugin(plugin: TransformPlugin): TransformPlugin {
  return plugin
}
