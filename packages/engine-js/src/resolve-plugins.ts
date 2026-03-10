import type { EngineOptions, Plugin } from './types'
import { filterPlugin, frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from './plugins'

/**
 * Resolves declarative PluginConfig into a flat Plugin array.
 * Optionally appends imperative transform plugins.
 */
export function resolvePlugins(options: EngineOptions, transforms?: Plugin[]): Plugin[] {
  const plugins: Plugin[] = []
  const config = options.plugins

  if (config) {
    if (config.frontmatter) {
      plugins.push(frontmatterPlugin(
        config.frontmatter === true ? {} : config.frontmatter,
      ))
    }
    if (config.isolateMain) {
      plugins.push(isolateMainPlugin())
    }
    if (config.tailwind) {
      plugins.push(tailwindPlugin())
    }
    if (config.filter) {
      plugins.push(filterPlugin(config.filter))
    }
  }

  if (transforms) {
    plugins.push(...transforms)
  }

  return plugins
}
