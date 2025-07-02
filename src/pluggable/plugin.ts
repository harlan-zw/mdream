import type { Plugin } from '../types'

/**
 * Create a plugin that implements the Plugin interface with improved type inference
 *
 * @returns A complete plugin implementation
 */
export function createPlugin<T extends Partial<Plugin>>(
  plugin: T,
): Plugin {
  return plugin
}
