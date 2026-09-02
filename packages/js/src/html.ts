import type { OutputProcessor } from './output-runner'
import type { MdreamOptions } from './types'
import { ELEMENT_NODE, MAX_TAG_ID } from './const'
import { createHtmlOutputState, processHtmlOutputEvent } from './html-output'
import { processHtmlOutput, streamHtmlOutput } from './output-runner'
import { parserTagHandlers } from './parser-tags'
import { buildTagOverrideHandlers } from './tag-overrides'

function createProcessor(options: MdreamOptions): OutputProcessor {
  const outputState = createHtmlOutputState()
  const state: OutputProcessor['state'] = {
    options,
    outputFormat: 'html',
    buffer: [],
    depthMap: new Uint16Array(MAX_TAG_ID),
    plainText: false,
  }

  return {
    state,
    processEvent(event) {
      const inTemplate = event.node.type === ELEMENT_NODE
        ? event.node.excludedFromMarkdown
        : event.node.parent?.excludedFromMarkdown
      if (inTemplate)
        return
      processHtmlOutputEvent(event, outputState, state.buffer, options)
    },
    takeOutput() {
      const output = state.buffer.join('')
      state.buffer.length = 0
      return output
    },
  }
}

function resolveOutputOptions(options: MdreamOptions) {
  return {
    plugins: options.plugins,
    tagHandlers: parserTagHandlers,
    tagOverrideHandlers: options.tagOverrides
      ? buildTagOverrideHandlers(options.tagOverrides, parserTagHandlers)
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
