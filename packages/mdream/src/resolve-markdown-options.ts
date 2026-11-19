import type { ResolvedOptions } from './resolve-options.js'

export interface MarkdownOptions {
  origin?: string
  format?: 'markdown'
}

export function resolveMarkdownOptions(options: MarkdownOptions = {}): ResolvedOptions {
  for (const key in options) {
    if (key === 'origin')
      continue
    const value = (options as Record<string, unknown>)[key]
    if (value === undefined || (key === 'format' && value === 'markdown'))
      continue
    throw new TypeError(`The mdream Markdown build does not support the \`${key}\` option. Remove the mdream-markdown condition to use it.`)
  }
  return { napiOpts: { origin: options.origin } }
}
