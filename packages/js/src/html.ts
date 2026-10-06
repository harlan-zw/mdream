import type { OutputProcessor } from './output-runner'
import type { MdreamOptions } from './types'
import { ELEMENT_NODE, MAX_TAG_ID } from './const'
import { createHtmlOutputState, processHtmlOutputEvent } from './html-output'
import { htmlTagHandlers } from './html-tags'
import { assertEngineOptions, checkClean } from './option-shape'
import { processHtmlOutput, streamHtmlOutput } from './output-runner'
import { resolvePlugins } from './pluggable/plugin'
import { buildTagOverrideHandlers } from './tag-overrides'

function createProcessor(options: MdreamOptions): OutputProcessor {
  const outputState = createHtmlOutputState()
  const state: OutputProcessor['state'] = {
    options,
    outputFormat: 'html',
    buffer: [],
    depthMap: new Uint16Array(MAX_TAG_ID),
    // Matches the parse state below: no Markdown escaping on this path.
    plainText: true,
  }

  return {
    state,
    processEvent(event) {
      state.depth = event.node.depth
      const inTemplate = event.node.type === ELEMENT_NODE
        ? event.node.excludedFromMarkdown
        : event.node.parent?.excludedFromMarkdown
      if (inTemplate)
        return
      processHtmlOutputEvent(event, outputState, state.buffer, options)
    },
    takeOutput() {
      const output = state.buffer.join('')
      if (output)
        outputState.hasOutput = true
      state.buffer.length = 0
      return output
    },
  }
}

function resolveOutputOptions(options: MdreamOptions) {
  assertEngineOptions(options)
  checkClean(options)
  return {
    plugins: resolvePlugins(options.plugins),
    tagHandlers: htmlTagHandlers,
    tagOverrideHandlers: options.tagOverrides
      ? buildTagOverrideHandlers(options.tagOverrides, htmlTagHandlers)
      : undefined,
    plainText: true,
  }
}

/** Convert HTML to allowlisted semantic HTML. */
export function htmlToSafeHtml(html: string, options: Partial<MdreamOptions> = {}): string {
  return processHtmlOutput(html, createProcessor(options), resolveOutputOptions(options))
}

/** Stream HTML as allowlisted semantic HTML. */
export function streamHtmlToSafeHtml(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  return streamHtmlOutput(htmlStream, createProcessor(options), resolveOutputOptions(options))
}

export type { MdreamOptions } from './types'
