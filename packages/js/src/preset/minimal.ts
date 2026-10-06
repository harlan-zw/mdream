import type { Cleaner, MdreamOptions, SplitterOptions } from '../types'
import { clean } from '../clean'
import { filterPlugin } from '../plugins/filter'
import { frontmatterPlugin } from '../plugins/frontmatter'
import { isolateMainPlugin } from '../plugins/isolate-main'
import { tailwindPlugin } from '../plugins/tailwind'

/** Preset input: the options it returns, where `clean: false` turns off the default cleanup. */
type PresetInput<T extends MdreamOptions> = Omit<T, 'clean'> & { clean?: Cleaner | false }

/**
 * Compose the minimal plugin set with explicit user plugins. An appended
 * `filterPlugin()` adds to the preset's excludes. To leave out a default
 * plugin, pass your own `plugins` array instead of using the preset.
 * Splitter options pass through, so the result also works with
 * `htmlToMarkdownSplitChunks()`.
 */
export function withMinimalPreset(options?: PresetInput<MdreamOptions>): MdreamOptions
export function withMinimalPreset(options: PresetInput<SplitterOptions>): SplitterOptions
export function withMinimalPreset(options: PresetInput<SplitterOptions> = {}): SplitterOptions {
  return {
    ...options,
    // Pass `clean: false` to turn off the default cleanup.
    clean: options.clean === false ? undefined : options.clean ?? clean(),
    plugins: [
      frontmatterPlugin(),
      isolateMainPlugin(),
      tailwindPlugin(),
      filterPlugin({
        exclude: [
          'form',
          'fieldset',
          'object',
          'embed',
          'footer',
          'aside',
          'iframe',
          'input',
          'textarea',
          'select',
          'button',
          'nav',
        ],
      }),
      ...(options.plugins ?? []),
    ],
  }
}
