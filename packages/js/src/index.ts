import type { EngineOptions, MdreamOptions, MdreamResult, PipelineTransform, TransformPlugin } from './types'
import { applyClean, resolveClean } from './clean'
import { createMarkdownProcessor } from './markdown-processor'
import { resolvePlugins } from './resolve-plugins'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tags'

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

function resolveHooks(options: Partial<MdreamOptions>): TransformPlugin[] | undefined {
  return options.hooks?.length ? options.hooks : undefined
}

function convert(html: string, options: EngineOptions, hooks?: TransformPlugin[]): MdreamResult {
  const { plugins, getExtracted, callExtractionHandlers, getFrontmatter } = resolvePlugins(options, hooks)
  const tagOverrideHandlers = options.plugins?.tagOverrides
    ? buildTagOverrideHandlers(options.plugins.tagOverrides)
    : undefined
  const processor = createMarkdownProcessor(options, plugins, tagOverrideHandlers)
  processor.processHtml(html)
  const result: MdreamResult = { markdown: processor.getMarkdown() }
  if (getFrontmatter) {
    result.frontmatter = getFrontmatter()
  }
  if (getExtracted) {
    result.extracted = getExtracted()
    callExtractionHandlers?.()
  }
  return result
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): MdreamResult {
  const pipeline = options.pipeline
  const hooks = resolveHooks(options)
  if (pipeline?.length)
    html = applyBeforeParse(html, pipeline)
  const result = convert(html, options, hooks)
  if (pipeline?.length)
    result.markdown = applyAfterConvert(result.markdown, pipeline)
  if (options.clean)
    result.markdown = applyClean(result.markdown, resolveClean(options.clean))
  return result
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  const hooks = resolveHooks(options)
  const { plugins } = resolvePlugins(options, hooks)
  const tagOverrideHandlers = options.plugins?.tagOverrides
    ? buildTagOverrideHandlers(options.plugins.tagOverrides)
    : undefined
  const pipeline = options.pipeline

  if (!pipeline?.length)
    return _streamHtmlToMarkdown(htmlStream, options, plugins, tagOverrideHandlers)

  const hasBeforeParse = pipeline.some(p => p.beforeParse)
  const hasAfterConvert = pipeline.some(p => p.afterConvert)

  const inputStream = hasBeforeParse && htmlStream
    ? wrapHtmlStream(htmlStream, pipeline)
    : htmlStream

  const output = _streamHtmlToMarkdown(inputStream, options, plugins, tagOverrideHandlers)
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

export { ELEMENT_NODE, NodeEventEnter, NodeEventExit, TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6, TEXT_NODE } from './const'
export { createPlugin } from './pluggable/plugin'
export { withMinimalPreset } from './preset/minimal'
export type { MdreamOptions } from './types'
export type {
  BuiltinPlugins,
  CleanOptions,
  ElementNode,
  EngineOptions,
  ExtractedElement,
  MarkdownChunk,
  MdreamResult,
  Node,
  NodeEvent,
  PipelineTransform,
  PluginContext,
  SplitterOptions,
  TagOverride,
  TextNode,
  TransformPlugin,
} from './types'
