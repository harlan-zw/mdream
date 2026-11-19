import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'

type FullBuildOption = Exclude<keyof MdreamOptions, 'origin' | 'format'>

export type MarkdownOptions = {
  origin?: string
  format?: 'markdown'
} & Partial<Record<FullBuildOption, undefined>>

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
} satisfies Record<FullBuildOption, true>

const fullBuildKeys = Object.keys(FULL_BUILD_OPTIONS)

function unsupportedOption(key: string): never {
  throw new TypeError(`The mdream Markdown build does not support the \`${key}\` option. Remove the mdream-markdown condition to use it.`)
}

function rejectUnknownOption(values: Record<string, unknown>, key: string): void {
  if (key !== 'origin' && key !== 'format' && !Object.hasOwn(FULL_BUILD_OPTIONS, key) && values[key] !== undefined)
    unsupportedOption(key)
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
  for (const key of Object.getOwnPropertyNames(values))
    rejectUnknownOption(values, key)
  for (const key in values) {
    if (!Object.hasOwn(values, key))
      rejectUnknownOption(values, key)
  }
  return { napiOpts: { origin: options.origin } }
}
