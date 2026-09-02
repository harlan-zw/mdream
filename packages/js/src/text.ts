import type { MdreamOptions } from './types'
import { processHtmlOutput, streamHtmlOutput } from './output-runner'
import { buildTagOverrideHandlers } from './tag-overrides'
import { createTextOutputProcessor } from './text-output'
import { textTagHandlers } from './text-tags'

function resolveOutputOptions(options: MdreamOptions) {
  return {
    plugins: options.plugins,
    tagHandlers: textTagHandlers,
    tagOverrideHandlers: options.tagOverrides
      ? buildTagOverrideHandlers(options.tagOverrides, textTagHandlers)
      : undefined,
    plainText: true,
  }
}

/** Convert HTML to readable plain text. */
export function htmlToText(html: string, options: Partial<MdreamOptions> = {}): string {
  return processHtmlOutput(html, createTextOutputProcessor(options), resolveOutputOptions(options))
}

/** Stream HTML as readable plain text. */
export function streamHtmlToText(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  return streamHtmlOutput(htmlStream, createTextOutputProcessor(options), resolveOutputOptions(options))
}

export type { MdreamOptions } from './types'
