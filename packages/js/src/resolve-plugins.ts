import type { EngineOptions, FrontmatterConfig, TransformPlugin } from './types'
import { extractionCollectorPlugin, filterPlugin, frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from './plugins'

export interface ResolvedPlugins {
  plugins: TransformPlugin[]
  callExtractionHandlers?: () => void
  getFrontmatter?: () => Record<string, string> | undefined
  frontmatterCallback?: (fm: Record<string, string>) => void
}

/**
 * Resolves declarative BuiltinPlugins config into a flat TransformPlugin array.
 * Optionally appends imperative transform plugins.
 */
export function resolvePlugins(options: EngineOptions, hooks?: TransformPlugin[]): ResolvedPlugins {
  const plugins: TransformPlugin[] = []
  let callExtractionHandlers: (() => void) | undefined
  let getFrontmatter: (() => Record<string, string> | undefined) | undefined
  let frontmatterCallback: ((fm: Record<string, string>) => void) | undefined
  const config = options.plugins

  if (config) {
    if (config.frontmatter) {
      let fmConfig: FrontmatterConfig = {}
      if (typeof config.frontmatter === 'function') {
        frontmatterCallback = config.frontmatter
      }
      else if (typeof config.frontmatter === 'object') {
        fmConfig = config.frontmatter
        frontmatterCallback = config.frontmatter.onExtract
      }
      const fmPlugin = frontmatterPlugin(fmConfig)
      plugins.push(fmPlugin)
      getFrontmatter = (fmPlugin as any).getFrontmatter
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
    if (config.extraction) {
      const collector = extractionCollectorPlugin(config.extraction)
      plugins.push(collector.plugin)
      callExtractionHandlers = collector.callHandlers
    }
  }

  if (hooks) {
    plugins.push(...hooks)
  }

  return { plugins, callExtractionHandlers, getFrontmatter, frontmatterCallback }
}
