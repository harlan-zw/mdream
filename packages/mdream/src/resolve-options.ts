import type { HtmlToMarkdownOptions, PluginOptions, TagOverrideNapi } from '../napi/index.js'
import type { CleanOptions, ExtractedElement, MdreamOptions } from './index.js'

export interface ResolvedOptions {
  napiOpts: HtmlToMarkdownOptions
  extractionHandlers?: Record<string, (el: ExtractedElement) => void>
  frontmatterCallback?: (fm: Record<string, string>) => void
}

const MINIMAL_FILTER_EXCLUDE = ['form', 'fieldset', 'object', 'embed', 'footer', 'aside', 'iframe', 'input', 'textarea', 'select', 'button', 'nav'] as const
const CLEAN_ALL: CleanOptions = { urls: true, fragments: true, emptyLinks: true, redundantLinks: true, selfLinkHeadings: true, emptyImages: true, emptyLinkText: true }
const VALID_OPTIONS = 'origin, clean, minimal, frontmatter, isolateMain, tailwind, filter, extraction, tagOverrides, wrapWidth, format'

function unknownOptionMessage(key: string, value: unknown): string {
  switch (key) {
    case 'preset':
      return 'mdream has no `preset` option. Pass { minimal: true }.'
    case 'cleanUrls':
      return 'mdream has no `cleanUrls` option. Pass { clean: { urls: true } }.'
    case 'plugins':
      return Array.isArray(value)
        ? 'Custom hook plugins require @mdream/js. '
        + 'Pass declarative config (e.g. { frontmatter: true }) to the Rust engine, '
        + 'or import { htmlToMarkdown } from \'@mdream/js\' for hook-based plugins. '
        + 'See https://github.com/harlan-zw/mdream/tree/main/packages/js#migrating-from-v1'
        : 'mdream takes plugin options at the top level, such as { frontmatter: true }.'
  }
  return `mdream has no \`${key}\` option. Valid options: ${VALID_OPTIONS}.`
}

// An unknown key would silently do nothing, so every entry rejects it and
// names the fix. A key set to `undefined` passes, as an absent key does.
function assertKnownOptions(options: Partial<MdreamOptions>): void {
  for (const key in options) {
    switch (key) {
      case 'origin':
      case 'clean':
      case 'minimal':
      case 'frontmatter':
      case 'isolateMain':
      case 'tailwind':
      case 'filter':
      case 'extraction':
      case 'tagOverrides':
      case 'wrapWidth':
      case 'format':
        continue
    }
    const value = (options as Record<string, unknown>)[key]
    if (value !== undefined)
      throw new TypeError(unknownOptionMessage(key, value))
  }
}

function resolveClean(clean: MdreamOptions['clean'], minimal: boolean): CleanOptions | undefined {
  if (clean === undefined)
    return minimal ? CLEAN_ALL : undefined
  if (!clean)
    return undefined
  return clean === true ? CLEAN_ALL : clean
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

export function resolveOptions(options: Partial<MdreamOptions>): ResolvedOptions {
  assertKnownOptions(options)

  const minimal = options.minimal === true
  const plugins: PluginOptions = {}
  let frontmatterCallback: ((fm: Record<string, string>) => void) | undefined

  if (minimal ? options.frontmatter !== false : options.frontmatter) {
    const fm = resolveFrontmatter(options.frontmatter)
    plugins.frontmatter = fm.config
    frontmatterCallback = fm.callback
  }

  if (minimal ? options.isolateMain !== false : options.isolateMain)
    plugins.isolateMain = true

  if (minimal ? options.tailwind !== false : options.tailwind)
    plugins.tailwind = true

  // Under `minimal`, a filter extends the preset's excludes rather than
  // replacing them. `filter: false` turns filtering off.
  if (minimal && options.filter !== false)
    plugins.filter = { ...options.filter, exclude: [...MINIMAL_FILTER_EXCLUDE, ...(options.filter?.exclude ?? [])] }
  else if (options.filter)
    plugins.filter = options.filter

  const extraction = options.extraction
  let extractionHandlers: Record<string, (el: ExtractedElement) => void> | undefined
  if (extraction) {
    plugins.extraction = { selectors: Object.keys(extraction) }
    extractionHandlers = extraction
  }

  const tagOverrides = options.tagOverrides
  if (tagOverrides) {
    const overrides: Record<string, TagOverrideNapi> = {}
    for (const tag in tagOverrides) {
      const value = tagOverrides[tag]
      if (value)
        overrides[tag] = typeof value === 'string' ? { alias: value } : value
    }
    plugins.tagOverrides = overrides
  }

  return {
    napiOpts: { origin: options.origin, clean: resolveClean(options.clean, minimal), plugins, wrapWidth: options.wrapWidth, format: options.format },
    extractionHandlers,
    frontmatterCallback,
  }
}
