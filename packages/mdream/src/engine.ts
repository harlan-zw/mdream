import type { EngineOptions, MarkdownEngine, PluginConfig } from '@mdream/engine-js'
import { createJavaScriptEngine, TagNameMap } from '@mdream/engine-js'

/**
 * Creates a Rust-powered engine. Throws if @mdream/engine-rust is not installed.
 * Only accepts shared `EngineOptions` — custom plugins are not supported.
 */
export async function createRustEngine(): Promise<MarkdownEngine> {
  const { htmlToMarkdown, MarkdownStream } = await import('@mdream/engine-rust')

  return {
    htmlToMarkdown(html: string, options: EngineOptions = {}): string {
      return htmlToMarkdown(html, {
        origin: options.origin,
        plugins: options.plugins ? toRustPlugins(options.plugins) : undefined,
      })
    },
    async* streamHtmlToMarkdown(htmlStream: any, options: EngineOptions = {}): AsyncIterable<string> {
      const rustOpts = {
        origin: options.origin,
        plugins: options.plugins ? toRustPlugins(options.plugins) : undefined,
      }
      const stream = new MarkdownStream(rustOpts)
      for await (const chunk of htmlStream) {
        const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        const processed = stream.processChunk(text)
        if (processed) {
          yield processed
        }
      }
      const final_ = stream.finish()
      if (final_) {
        yield final_
      }
    },
  }
}

function tagIdToSelector(v: string | number): string {
  if (typeof v === 'string')
    return v
  return TagNameMap[v] || String(v)
}

/**
 * Maps PluginConfig to Rust's PluginOptions.
 * Converts TAG_* numeric IDs to tag name strings for Rust's selector matching.
 */
function toRustPlugins(config: PluginConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (config.filter) {
    result.filter = {
      include: config.filter.include?.map(tagIdToSelector),
      exclude: config.filter.exclude?.map(tagIdToSelector),
      processChildren: config.filter.processChildren,
    }
  }

  if (config.frontmatter) {
    result.frontmatter = config.frontmatter === true
      ? {}
      : config.frontmatter
  }

  if (config.isolateMain) {
    result.isolateMain = true
  }

  if (config.tailwind) {
    result.tailwind = true
  }

  return result
}

/**
 * Creates the best available engine, preferring Rust for performance.
 * Falls back to JavaScript if Rust engine is not installed.
 */
export async function createEngine(preferredEngine?: 'rust' | 'js'): Promise<MarkdownEngine> {
  if (preferredEngine === 'js') {
    return createJavaScriptEngine()
  }

  try {
    return await createRustEngine()
  }
  catch (e) {
    if (preferredEngine === 'rust') {
      console.warn('[mdream] Rust engine not available, falling back to JavaScript engine:', e)
    }
    return createJavaScriptEngine()
  }
}
