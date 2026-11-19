import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'

export interface MarkdownOptions {
  origin?: string
  format?: 'markdown'
}

const FULL_BUILD_OPTIONS = {
  clean: true,
  minimal: true,
  frontmatter: true,
  isolateMain: true,
  tailwind: true,
  filter: true,
  extraction: true,
  tagOverrides: true,
  wrapWidth: true,
} satisfies Record<Exclude<keyof MdreamOptions, keyof MarkdownOptions>, true>

const fullBuildKeys = Object.keys(FULL_BUILD_OPTIONS)

function unsupportedOption(key: string): never {
  throw new TypeError(`The mdream Markdown build does not support the \`${key}\` option. Remove the mdream-markdown condition to use it.`)
}

export function resolveMarkdownOptions(options: MarkdownOptions = {}): ResolvedOptions {
  const values = options as Record<string, unknown>
  const { format } = values
  if (format !== undefined && format !== 'markdown')
    unsupportedOption('format')

  // Read known options directly, including getters and non-enumerable properties.
  for (const key of fullBuildKeys) {
    if (values[key] !== undefined)
      unsupportedOption(key)
  }
  for (const key in options) {
    if (key !== 'origin' && key !== 'format' && !Object.hasOwn(FULL_BUILD_OPTIONS, key) && values[key] !== undefined)
      unsupportedOption(key)
  }
  return { napiOpts: { origin: options.origin } }
}
