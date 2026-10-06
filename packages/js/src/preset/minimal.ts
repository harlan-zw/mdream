import type { Cleaner, MdreamOptions } from '../types'
import { clean } from '../clean'
import { filterPlugin } from '../plugins/filter'
import { frontmatterPlugin } from '../plugins/frontmatter'
import { isolateMainPlugin } from '../plugins/isolate-main'
import { tailwindPlugin } from '../plugins/tailwind'

/**
 * Compose the minimal plugin set with explicit user plugins. An appended
 * `filterPlugin()` adds to the preset's excludes. To leave out a default
 * plugin, pass your own `plugins` array instead of using the preset.
 */
export function withMinimalPreset(options: Omit<MdreamOptions, 'clean'> & { clean?: Cleaner | false } = {}): MdreamOptions {
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
