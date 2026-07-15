import type { HtmlToMarkdownOptions, PluginOptions, TagOverrideNapi } from '../napi/index.js'
import type { CleanOptions, ExtractedElement, MdreamOptions } from './index.js'

interface ResolvableOptions extends Partial<MdreamOptions> {
  cleanUrls?: boolean
  plugins?: PluginOptions | unknown[]
}

interface ResolvedOptions {
  napiOpts: HtmlToMarkdownOptions
  extractionHandlers?: Record<string, (el: ExtractedElement) => void>
  frontmatterCallback?: (fm: Record<string, string>) => void
}

const MINIMAL_FILTER_EXCLUDE = ['form', 'fieldset', 'object', 'embed', 'footer', 'aside', 'iframe', 'input', 'textarea', 'select', 'button', 'nav'] as const
const MINIMAL_FILTER_DEFAULT = { exclude: MINIMAL_FILTER_EXCLUDE as unknown as string[] }
const CLEAN_ALL: CleanOptions = { urls: true, fragments: true, emptyLinks: true, redundantLinks: true, selfLinkHeadings: true, emptyImages: true, emptyLinkText: true }

function resolveCleanConfig(options: ResolvableOptions, minimal: boolean): { cleanUrls: boolean, clean?: CleanOptions } {
  let cleanOpt = options.clean
  if (cleanOpt === undefined) {
    if (!minimal)
      return { cleanUrls: options.cleanUrls === true }
    cleanOpt = true
  }
  if (!cleanOpt)
    return { cleanUrls: options.cleanUrls === true }
  const resolved = cleanOpt === true ? CLEAN_ALL : cleanOpt
  return {
    cleanUrls: options.cleanUrls === true || resolved.urls === true,
    clean: resolved,
  }
}

function resolveFrontmatter(opt: MdreamOptions['frontmatter']): { config?: object, callback?: (fm: Record<string, string>) => void } {
  if (typeof opt === 'function')
    return { config: {}, callback: opt }
  if (opt && typeof opt === 'object') {
    const { onExtract, ...config } = opt
    return { config, callback: onExtract }
  }
  return { config: {} }
}

export function resolveOptions(options: ResolvableOptions): ResolvedOptions {
  if (Array.isArray(options.plugins)) {
    throw new TypeError(
      'Custom hook plugins require @mdream/js. '
      + 'Pass declarative config (e.g. { frontmatter: true }) to the Rust engine, '
      + 'or import { htmlToMarkdown } from \'@mdream/js\' for hook-based plugins. '
      + 'See https://mdream.dev/v1-migration#custom-plugins',
    )
  }

  const minimal = options.minimal === true
  const plugins: PluginOptions = options.plugins ? { ...options.plugins } : {}
  let frontmatterCallback: ((fm: Record<string, string>) => void) | undefined

  const frontmatterDisabled = options.frontmatter === false
  const enableFm = minimal ? !frontmatterDisabled : !!options.frontmatter
  if (enableFm) {
    const fm = resolveFrontmatter(options.frontmatter)
    plugins.frontmatter = fm.config
    frontmatterCallback = fm.callback
  }
  else if (frontmatterDisabled) {
    delete plugins.frontmatter
  }

  const isolateMainDisabled = options.isolateMain === false
  if (minimal ? !isolateMainDisabled : options.isolateMain)
    plugins.isolateMain = true
  else if (isolateMainDisabled)
    delete plugins.isolateMain

  const tailwindDisabled = options.tailwind === false
  if (minimal ? !tailwindDisabled : options.tailwind)
    plugins.tailwind = true
  else if (tailwindDisabled)
    delete plugins.tailwind

  if (minimal)
    plugins.filter = options.filter || MINIMAL_FILTER_DEFAULT
  else if (options.filter)
    plugins.filter = options.filter

  let extractionHandlers: Record<string, (el: ExtractedElement) => void> | undefined
  if (options.extraction) {
    plugins.extraction = { selectors: Object.keys(options.extraction) }
    extractionHandlers = options.extraction
  }

  if (options.tagOverrides) {
    const overrides: Record<string, TagOverrideNapi> = {}
    for (const tag in options.tagOverrides) {
      const value = options.tagOverrides[tag]
      if (value)
        overrides[tag] = typeof value === 'string' ? { alias: value } : value
    }
    plugins.tagOverrides = overrides
  }

  const { cleanUrls, clean } = resolveCleanConfig(options, minimal)

  return {
    napiOpts: { origin: options.origin, cleanUrls, clean, plugins, wrapWidth: options.wrapWidth, format: options.format },
    extractionHandlers,
    frontmatterCallback,
  }
}
