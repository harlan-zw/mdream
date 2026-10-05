import type { ParseState } from './parse'
import type { MdreamRuntimeState, NodeEvent, TagHandler, TransformPlugin } from './types'
import { finalizeParse, parseHtmlStream } from './parse'
import { endPlugins, processPluginsForEvent } from './plugin-processor'

export interface OutputProcessor {
  state: MdreamRuntimeState & { depthMap: Uint16Array }
  processEvent: (event: NodeEvent) => void
  /** Output that no later event can change. `final` drops every hold. */
  takeOutput: (final: boolean) => string
}

interface OutputOptions {
  plugins?: TransformPlugin[]
  tagHandlers?: Record<number, TagHandler>
  tagOverrideHandlers?: Map<string, TagHandler>
  plainText: boolean
}

function createParseState(processor: OutputProcessor, options: OutputOptions): ParseState {
  return {
    depthMap: processor.state.depthMap,
    depth: 0,
    resolvedPlugins: options.plugins,
    tagHandlers: options.tagHandlers,
    tagOverrideHandlers: options.tagOverrideHandlers,
    plainText: options.plainText,
  }
}

function createEventHandler(processor: OutputProcessor, plugins: TransformPlugin[]): (event: NodeEvent) => void {
  return plugins.length
    ? event => processPluginsForEvent(event, plugins, processor.state, processor.processEvent)
    : processor.processEvent
}

export function processHtmlOutput(html: string, processor: OutputProcessor, options: OutputOptions): string {
  const plugins = options.plugins ?? []
  const parseState = createParseState(processor, options)
  const handleEvent = createEventHandler(processor, plugins)
  const leftover = parseHtmlStream(html, parseState, handleEvent)
  finalizeParse(leftover, parseState, handleEvent)
  endPlugins(plugins, processor.state)
  return processor.takeOutput(true)
}

export async function* streamHtmlOutput(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  processor: OutputProcessor,
  options: OutputOptions,
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')

  const plugins = options.plugins ?? []
  const parseState = createParseState(processor, options)
  const handleEvent = createEventHandler(processor, plugins)
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
  let hasDecodedContent = false
  const reader = htmlStream.getReader()
  let remainingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      if (value === '')
        continue

      let decoded = typeof value === 'string'
        ? decoder.decode() + value
        : decoder.decode(value, { stream: true })
      if (decoded && !hasDecodedContent) {
        hasDecodedContent = true
        if (typeof value !== 'string' && decoded.charCodeAt(0) === 0xFEFF)
          decoded = decoded.slice(1)
      }
      remainingHtml = parseHtmlStream(`${remainingHtml}${decoded}`, parseState, handleEvent)

      const chunk = processor.takeOutput(false)
      if (chunk)
        yield chunk
    }

    const finalHtml = remainingHtml + decoder.decode()
    const leftover = finalHtml ? parseHtmlStream(finalHtml, parseState, handleEvent) : ''
    finalizeParse(leftover, parseState, handleEvent)
    endPlugins(plugins, processor.state)

    const finalChunk = processor.takeOutput(true)
    if (finalChunk)
      yield finalChunk
  }
  finally {
    reader.releaseLock()
  }
}
