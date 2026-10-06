import type { MdreamOptions } from './types'

// `clean: true` and plain rule objects were the v1 API. Fail loudly instead
// of silently skipping the `fragments` pass they cannot run.
export function checkClean(options: Partial<MdreamOptions>): void {
  const clean = options.clean
  if (clean && typeof clean.apply !== 'function')
    throw new TypeError('The clean option needs cleanup rules from clean(). Import it from \'@mdream/js/clean\'.')
}

const CONVERTER_OPTIONS = 'origin, tagOverrides, clean, wrapWidth, plugins'
const SPLITTER_OPTIONS = `${CONVERTER_OPTIONS}, headersToSplitOn, returnEachLine, stripHeaders, chunkSize, chunkOverlap, lengthFunction, keepSeparator`

function isConverterOption(key: string): boolean {
  switch (key) {
    case 'origin':
    case 'tagOverrides':
    case 'clean':
    case 'wrapWidth':
    case 'plugins':
      return true
  }
  return false
}

function isSplitterOption(key: string): boolean {
  switch (key) {
    case 'headersToSplitOn':
    case 'returnEachLine':
    case 'stripHeaders':
    case 'chunkSize':
    case 'chunkOverlap':
    case 'lengthFunction':
    case 'keepSeparator':
      return true
  }
  return false
}

// The mdream (Rust) entry and @mdream/js v1 read some of these keys. Each
// message names the @mdream/js way to get the same result.
function unknownOptionMessage(key: string, validOptions: string): string {
  switch (key) {
    case 'minimal':
    case 'preset':
      return `@mdream/js has no \`${key}\` option. `
        + 'Use withMinimalPreset() from \'@mdream/js/preset/minimal\': htmlToMarkdown(html, withMinimalPreset({ origin })).'
    case 'format':
      return '@mdream/js has no `format` option. Use htmlToText() from \'@mdream/js/text\' or htmlToSafeHtml() from \'@mdream/js/html\'.'
    case 'hooks':
      return '@mdream/js has no `hooks` option. Pass the hooks in `plugins`.'
    case 'cleanUrls':
      return '@mdream/js has no `cleanUrls` option. Pass { clean: clean({ urls: true }) } with clean from \'@mdream/js/clean\'.'
    case 'frontmatter':
    case 'isolateMain':
    case 'tailwind':
    case 'filter':
    case 'extraction':
      return `@mdream/js has no \`${key}\` option. Pass { plugins: [${key}Plugin()] } with ${key}Plugin from '@mdream/js/plugins'.`
  }
  return `@mdream/js has no \`${key}\` option. Valid options: ${validOptions}.`
}

/**
 * Rejects each option the entry does not read, because it would silently do
 * nothing. The splitter also reads its chunk options. A key set to
 * `undefined` passes, as an absent key does.
 */
export function assertEngineOptions(options: object, entry: 'converter' | 'splitter' = 'converter'): void {
  const splitter = entry === 'splitter'
  for (const key in options) {
    if (isConverterOption(key) || (splitter && isSplitterOption(key)))
      continue
    if ((options as Record<string, unknown>)[key] !== undefined)
      throw new TypeError(unknownOptionMessage(key, splitter ? SPLITTER_OPTIONS : CONVERTER_OPTIONS))
  }
  const plugins = (options as { plugins?: unknown }).plugins
  if (plugins != null && !Array.isArray(plugins))
    throw new TypeError('@mdream/js takes `plugins` as an array, such as { plugins: [frontmatterPlugin()] } with frontmatterPlugin from \'@mdream/js/plugins\'.')
}
