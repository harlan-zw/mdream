import type { Cleaner, MdreamOptions } from '../types'
import { clean } from '../clean'
import {
  TAG_ASIDE,
  TAG_BUTTON,
  TAG_EMBED,
  TAG_FIELDSET,
  TAG_FOOTER,
  TAG_FORM,
  TAG_IFRAME,
  TAG_INPUT,
  TAG_NAV,
  TAG_OBJECT,
  TAG_SELECT,
  TAG_TEXTAREA,
} from '../const'
import { filterPlugin } from '../plugins/filter'
import { frontmatterPlugin } from '../plugins/frontmatter'
import { isolateMainPlugin } from '../plugins/isolate-main'
import { tailwindPlugin } from '../plugins/tailwind'

/**
 * Compose the minimal plugin set with explicit user plugins.
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
          TAG_FORM,
          TAG_FIELDSET,
          TAG_OBJECT,
          TAG_EMBED,
          TAG_FOOTER,
          TAG_ASIDE,
          TAG_IFRAME,
          TAG_INPUT,
          TAG_TEXTAREA,
          TAG_SELECT,
          TAG_BUTTON,
          TAG_NAV,
        ],
      }),
      ...(options.plugins ?? []),
    ],
  }
}
