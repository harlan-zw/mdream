import type { ParseOptions, ParseResult, ParseState } from './parse-core'
import type { NodeEvent } from './types'
import { MAX_TAG_ID } from './const'
import {
  parseHtmlStream as parseCoreHtmlStream,
} from './parse-core'
import { tagHandlers } from './tags'

export { finalizeParse, parseAttributes } from './parse-core'
export type { ParseOptions, ParseResult, ParseState } from './parse-core'

/**
 * Public parser adapter. Defaults to Markdown tag handlers for compatibility
 * with the existing `@mdream/js/parse` subpath.
 */
export function parseHtml(html: string, options: ParseOptions = {}): ParseResult {
  const events: NodeEvent[] = []
  const state = {
    depthMap: new Uint8Array(MAX_TAG_ID),
    depth: 0,
    resolvedPlugins: options.resolvedPlugins || [],
    tagHandlers: options.tagHandlers ?? tagHandlers,
    tagOverrideHandlers: options.tagOverrideHandlers,
    plainText: options.plainText,
  }

  const remainingHtml = parseCoreHtmlStream(html, state, (event) => {
    events.push(event)
  })

  return { events, remainingHtml }
}

/**
 * Streaming parser adapter using Markdown tag handlers unless callers provide
 * their own handler table.
 */
export function parseHtmlStream(
  html: string,
  state: ParseState,
  onEvent: (event: NodeEvent) => void,
): string {
  state.tagHandlers ??= tagHandlers
  return parseCoreHtmlStream(html, state, onEvent)
}
