import type { MdreamOptions } from 'mdream'
import type { ModuleRuntimeConfig } from '../../types.js'
import { htmlToMarkdown as _htmlToMarkdown, streamHtmlToMarkdown as _streamHtmlToMarkdown } from 'mdream'
import { useRuntimeConfig } from 'nitropack/runtime'

function resolveOptions(options?: Partial<MdreamOptions>): Partial<MdreamOptions> {
  const config = useRuntimeConfig().mdream as ModuleRuntimeConfig
  if (!options)
    return config.mdreamOptions || {}
  if (!config.mdreamOptions)
    return options
  return { ...config.mdreamOptions, ...options }
}

export function htmlToMarkdown(html: string, options?: Partial<MdreamOptions>): string {
  return _htmlToMarkdown(html, resolveOptions(options))
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options?: Partial<MdreamOptions>,
): AsyncIterable<string> {
  return _streamHtmlToMarkdown(htmlStream, resolveOptions(options))
}
