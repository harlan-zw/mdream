import type { MdreamOptions } from './types'

// `clean: true` and plain rule objects were the v1 API. Fail loudly instead
// of silently skipping the `fragments` pass they cannot run.
export function checkClean(options: Partial<MdreamOptions>): void {
  const clean = options.clean
  if (clean && typeof clean.apply !== 'function')
    throw new TypeError('The clean option needs cleanup rules from clean(). Import it from \'@mdream/js/clean\'.')
}
// Options that the mdream (Rust) entry or @mdream/js v1 reads and @mdream/js
// does not. Each would silently do nothing, so every entry rejects it and
// names the fix.
const PLUGIN_OPTIONS = ['frontmatter', 'isolateMain', 'tailwind', 'filter', 'extraction'] as const

export function assertEngineOptions(options: object): void {
  if ('minimal' in options) {
    throw new TypeError(
      '@mdream/js has no `minimal` option. '
      + 'Use withMinimalPreset() from \'@mdream/js/preset/minimal\': htmlToMarkdown(html, withMinimalPreset({ origin })).',
    )
  }
  if ('format' in options)
    throw new TypeError('@mdream/js has no `format` option. Use htmlToText() from \'@mdream/js/text\' or htmlToSafeHtml() from \'@mdream/js/html\'.')
  if ('hooks' in options)
    throw new TypeError('@mdream/js has no `hooks` option. Pass the hooks in `plugins`.')
  for (const key of PLUGIN_OPTIONS) {
    if (key in options)
      throw new TypeError(`@mdream/js has no \`${key}\` option. Pass { plugins: [${key}Plugin()] } with ${key}Plugin from '@mdream/js/plugins'.`)
  }
  const plugins = (options as { plugins?: unknown }).plugins
  if (plugins != null && !Array.isArray(plugins))
    throw new TypeError('@mdream/js takes `plugins` as an array, such as { plugins: [frontmatterPlugin()] } with frontmatterPlugin from \'@mdream/js/plugins\'.')
}
