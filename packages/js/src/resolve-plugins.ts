import type { EngineOptions, ExtractedElement, TransformPlugin } from './types'
import { extractionCollectorPlugin, filterPlugin, frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from './plugins'

export interface ResolvedPlugins {
  plugins: TransformPlugin[]
  getExtracted?: () => ExtractedElement[]
  callExtractionHandlers?: () => void
  getFrontmatter?: () => Record<string, string> | undefined
}

/**
 * Resolves declarative BuiltinPlugins config into a flat TransformPlugin array.
 * Optionally appends imperative transform plugins.
 */
export function resolvePlugins(options: EngineOptions, hooks?: TransformPlugin[]): ResolvedPlugins {
  const plugins: TransformPlugin[] = []
  let getExtracted: (() => ExtractedElement[]) | undefined
  let callExtractionHandlers: (() => void) | undefined
  let getFrontmatter: (() => Record<string, string> | undefined) | undefined
  const config = options.plugins

  if (config) {
    if (config.frontmatter) {
      const fmPlugin = frontmatterPlugin(
        config.frontmatter === true ? {} : config.frontmatter,
      )
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
      getExtracted = collector.getResults
      callExtractionHandlers = collector.callHandlers
    }
  }

  if (hooks) {
    plugins.push(...hooks)
  }

  return { plugins, getExtracted, callExtractionHandlers, getFrontmatter }
}
