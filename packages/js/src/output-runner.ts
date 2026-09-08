import type { ParseState } from './parse'
import type { MdreamRuntimeState, NodeEvent, TagHandler, TransformPlugin } from './types'
import { finalizeParse, parseHtmlStream } from './parse'
import { processPluginsForEvent } from './plugin-processor'

export interface OutputProcessor {
  state: MdreamRuntimeState & { depthMap: Uint16Array }
  processEvent: (event: NodeEvent) => void
  takeOutput: () => string
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
  return processor.takeOutput()
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
  const decoder = new TextDecoder()
  const reader = htmlStream.getReader()
  let remainingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      const decoded = typeof value === 'string'
        ? decoder.decode() + value
        : decoder.decode(value, { stream: true })
      remainingHtml = parseHtmlStream(`${remainingHtml}${decoded}`, parseState, handleEvent)

      const chunk = processor.takeOutput()
      if (chunk)
        yield chunk
    }

    const finalHtml = remainingHtml + decoder.decode()
    const leftover = finalHtml ? parseHtmlStream(finalHtml, parseState, handleEvent) : ''
    finalizeParse(leftover, parseState, handleEvent)

    const finalChunk = processor.takeOutput()
    if (finalChunk)
      yield finalChunk
  }
  finally {
    reader.releaseLock()
  }
}
