import type { MarkdownEngine, MdreamOptions } from './types'

function resolveEngine(options: MdreamOptions): MarkdownEngine {
  if (!options.engine)
    throw new Error('No engine provided. Pass an engine via options, or import from `mdream` / `@mdream/js` which provide a default engine.')
  return options.engine
}

export function htmlToMarkdown(
  html: string,
  options: MdreamOptions,
): string {
  return resolveEngine(options).htmlToMarkdown(html, options)
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: MdreamOptions,
): AsyncIterable<string> {
  return resolveEngine(options).streamHtmlToMarkdown(htmlStream, options)
}
