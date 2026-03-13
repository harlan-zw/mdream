import type { EngineOptions, MdreamResult, TransformPlugin } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { resolvePlugins } from './resolve-plugins'
import { streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tags'

/**
 * Creates a JavaScript-powered markdown engine.
 * @param hooks - Optional imperative transform plugins (JS-engine-only feature)
 */
export function createJavaScriptEngine(hooks?: TransformPlugin[]) {
  return {
    htmlToMarkdown(html: string, options: EngineOptions = {}): MdreamResult {
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
    },
    streamHtmlToMarkdown(htmlStream: ReadableStream<Uint8Array | string> | null, options: EngineOptions = {}) {
      const { plugins } = resolvePlugins(options, hooks)
      const tagOverrideHandlers = options.plugins?.tagOverrides
        ? buildTagOverrideHandlers(options.plugins.tagOverrides)
        : undefined
      return streamHtmlToMarkdown(htmlStream, options, plugins, tagOverrideHandlers)
    },
  }
}
