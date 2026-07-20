import type { EngineOptions, FrontmatterConfig, TransformPlugin } from './types'
import { extractionCollectorPlugin, filterPlugin, frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from './plugins'

export interface ResolvedPlugins {
  plugins: TransformPlugin[]
  callExtractionHandlers?: () => void
  getFrontmatter?: () => Record<string, string> | undefined
  frontmatterCallback?: (fm: Record<string, string>) => void
}

function resolveFrontmatterOpt(opt: NonNullable<EngineOptions['plugins']>['frontmatter']): { config: FrontmatterConfig, callback?: (fm: Record<string, string>) => void } {
  if (typeof opt === 'function')
    return { config: {}, callback: opt }
  if (typeof opt === 'object')
    return { config: opt, callback: opt.onExtract }
  return { config: {} }
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
      const fm = resolveFrontmatterOpt(config.frontmatter)
      const fmPlugin = frontmatterPlugin(fm.config)
      plugins.push(fmPlugin)
      getFrontmatter = (fmPlugin as any).getFrontmatter
      frontmatterCallback = fm.callback
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
