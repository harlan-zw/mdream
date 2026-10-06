import type { MdreamOptions } from './types'
import { assertEngineOptions, checkClean } from './option-shape'
import { processHtmlOutput, streamHtmlOutput } from './output-runner'
import { resolvePlugins } from './pluggable/plugin'
import { buildTagOverrideHandlers } from './tag-overrides'
import { createTextOutputProcessor } from './text-output'
import { textTagHandlers } from './text-tags'

function resolveOutputOptions(options: MdreamOptions) {
  assertEngineOptions(options)
  checkClean(options)
  return {
    plugins: resolvePlugins(options.plugins),
    tagHandlers: textTagHandlers,
    tagOverrideHandlers: options.tagOverrides
      ? buildTagOverrideHandlers(options.tagOverrides, textTagHandlers)
      : undefined,
    plainText: true,
  }
}

/** Convert HTML to readable plain text. */
export function htmlToText(html: string, options: Partial<MdreamOptions> = {}): string {
  const outputOptions = resolveOutputOptions(options)
  return processHtmlOutput(html, createTextOutputProcessor(options, outputOptions.plugins.length !== 0), outputOptions)
}

/** Stream HTML as readable plain text. */
export function streamHtmlToText(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  const outputOptions = resolveOutputOptions(options)
  return streamHtmlOutput(htmlStream, createTextOutputProcessor(options, outputOptions.plugins.length !== 0), outputOptions)
}

export type { MdreamOptions } from './types'
