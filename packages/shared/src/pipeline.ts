import type { MarkdownEngine, MdreamOptions, MdreamResult, PipelineTransform } from './types'

function applyBeforeParse(html: string, pipeline: PipelineTransform[]): string {
  for (let i = 0; i < pipeline.length; i++) {
    const t = pipeline[i]!.beforeParse
    if (t)
      html = t(html)
  }
  return html
}

function applyAfterConvert(md: string, pipeline: PipelineTransform[]): string {
  for (let i = 0; i < pipeline.length; i++) {
    const t = pipeline[i]!.afterConvert
    if (t)
      md = t(md)
  }
  return md
}

function resolveEngine(options: MdreamOptions): MarkdownEngine {
  if (!options.engine)
    throw new Error('No engine provided. Pass an engine via options, or import from `mdream` / `@mdream/js` which provide a default engine.')
  return options.engine
}

export function htmlToMarkdown(
  html: string,
  options: MdreamOptions,
): MdreamResult {
  const pipeline = options.pipeline
  if (pipeline?.length)
    html = applyBeforeParse(html, pipeline)
  const result = resolveEngine(options).htmlToMarkdown(html, options)
  if (pipeline?.length)
    result.markdown = applyAfterConvert(result.markdown, pipeline)
  return result
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: MdreamOptions,
): AsyncIterable<string> {
  const engine = resolveEngine(options)
  const pipeline = options.pipeline
  if (!pipeline?.length)
    return engine.streamHtmlToMarkdown(htmlStream, options)

  const hasBeforeParse = pipeline.some(p => p.beforeParse)
  const hasAfterConvert = pipeline.some(p => p.afterConvert)

  const inputStream = hasBeforeParse && htmlStream
    ? wrapHtmlStream(htmlStream, pipeline)
    : htmlStream

  const output = engine.streamHtmlToMarkdown(inputStream, options)
  return hasAfterConvert ? pipelineOutputStream(output, pipeline) : output
}

function wrapHtmlStream(
  htmlStream: ReadableStream<Uint8Array | string>,
  pipeline: PipelineTransform[],
): ReadableStream<string> {
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()
  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      const text = typeof value === 'string' ? value : decoder.decode(value, { stream: true })
      controller.enqueue(applyBeforeParse(text, pipeline))
    },
    cancel() {
      reader.cancel()
    },
  })
}

async function* pipelineOutputStream(
  source: AsyncIterable<string>,
  pipeline: PipelineTransform[],
): AsyncIterable<string> {
  for await (const chunk of source) {
    yield applyAfterConvert(chunk, pipeline)
  }
}
